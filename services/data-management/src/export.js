'use strict';

// Stage 5: read-only, animal-specific exports. No enclosure sensor readings are
// attributed to an animal: enclosure changes are observations, not occupancy proof.
const zlib = require('node:zlib');
const fs = require('node:fs');

const CATEGORIES = ['feeding','molting','weight','length','behavior','health','husbandry','other','enclosure_change'];
const LABELS = {feeding:'Feeding history',molting:'Molting / shedding',weight:'Weight measurements',length:'Length measurements',behavior:'Behavior observations',health:'Health observations',husbandry:'Husbandry observations',other:'General observations',enclosure_change:'Recorded enclosure changes'};
const EVENT_FIELDS = ['id','pet_id','event_type','event_date','event_time','utc_offset_minutes','molt_stage','molt_outcome','weight_g','length_cm','length_method','temperature_c','humidity_pct','description','notes','created_at','updated_at'];
const FEEDING_FIELDS = ['id','pet_id','feeding_date','feeding_time','food','feeding_outcome','entry_source','temperature_c','humidity_pct','notes'];
const CHANGE_FIELDS = ['id','pet_id','occurred_at','previous_enclosure_id','previous_enclosure_name','new_enclosure_id','new_enclosure_name'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  return y>=1 && dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d;
}
function parseOptions(query) {
  const format = query.format;
  if (!['pdf','csv'].includes(format)) throw new Error('Format must be pdf or csv');
  const from = query.from || null, to = query.to || null;
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from>to)) throw new Error('Invalid date range');
  const raw = query.categories;
  const selected = raw === undefined ? CATEGORIES : (typeof raw === 'string' ? raw.split(',') : []);
  if (!selected.length || selected.some(c=>!CATEGORIES.includes(c)) || new Set(selected).size!==selected.length) throw new Error('Select one or more valid, unique categories');
  return {format,from,to,categories:selected};
}
function inRange(date, options) { return (!options.from || date>=options.from) && (!options.to || date<=options.to); }
function loadRecords(db,petId,options) {
  const pet = db.prepare('SELECT * FROM pets WHERE id=?').get(petId);
  if (!pet) return null;
  const selected = new Set(options.categories);
  const feedings = selected.has('feeding') ? db.prepare('SELECT * FROM feeding_records WHERE pet_id=? ORDER BY feeding_date DESC,feeding_time DESC,id DESC').all(petId).filter(r=>inRange(r.feeding_date,options)) : [];
  const events = db.prepare('SELECT * FROM animal_events WHERE pet_id=? ORDER BY event_date DESC,event_time DESC,id DESC').all(petId).filter(r=>selected.has(r.event_type) && inRange(r.event_date,options));
  // occurred_at is an absolute timestamp. Filter by its original UTC calendar date,
  // not by a guessed keeper-local timezone.
  const changes = selected.has('enclosure_change') ? db.prepare('SELECT * FROM enclosure_change_events WHERE pet_id=? ORDER BY occurred_at DESC,id DESC').all(petId).filter(r=>inRange(r.occurred_at.slice(0,10),options)) : [];
  return {pet,feedings,events,changes,options,generatedAt:new Date().toISOString()};
}
function csvCell(value) {
  if (value === undefined || value === null) return '';
  const string = String(value);
  // Only textual values need formula injection neutralization: numeric DB values
  // remain numeric, and literal text is escaped before quoting.
  const dangerous = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@\-\t\r]/u.test(string);
  const safe = dangerous ? `'${string}` : string;
  return `"${safe.replace(/"/g,'""')}"`;
}
function csv(rows, fields) {
  return Buffer.from('\uFEFF'+fields.map(csvCell).join(',')+'\r\n'+rows.map(row=>fields.map(field=>csvCell(row[field])).join(',')).join('\r\n')+(rows.length?'\r\n':''),'utf8');
}
// ZIP (stored entries, CRC32): small deterministic ZIP files without external dependencies.
const CRC_TABLE = Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(data) {let c=0xffffffff;for(const x of data)c=CRC_TABLE[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files) {
  const local=[],central=[];let offset=0;
  for(const [filename,contents] of Object.entries(files)) {
    const name=Buffer.from(filename,'utf8'),data=zlib.deflateRawSync(contents),crc=crc32(contents);
    const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(8,8);head.writeUInt32LE(crc,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(contents.length,22);head.writeUInt16LE(name.length,26);
    local.push(head,name,data);
    const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x800,8);dir.writeUInt16LE(8,10);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(data.length,20);dir.writeUInt32LE(contents.length,24);dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(offset,42);
    central.push(dir,name);offset+=head.length+name.length+data.length;
  }
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);const size=central.reduce((s,b)=>s+b.length,0);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}
function makeCsvZip(data) {
  const {pet,feedings,events,changes,options,generatedAt}=data;
  const files={
    'animal.csv':csv([pet],['id','name','species','gender','date_of_birth','enclosure_id','notes','created_at']),
    'feeding_records.csv':csv(feedings,FEEDING_FIELDS),
    'animal_events.csv':csv(events,EVENT_FIELDS),
    'enclosure_changes.csv':csv(changes,CHANGE_FIELDS),
    'export_metadata.csv':csv([
      {key:'generated_at_utc',value:generatedAt}, {key:'from_inclusive',value:options.from||'all'}, {key:'to_inclusive',value:options.to||'all'},
      {key:'categories',value:options.categories.join(';')},{key:'observation_dates',value:'YYYY-MM-DD, as stored; no inferred time'},
      {key:'enclosure_change_range',value:'Filtered by UTC date of occurred_at'},{key:'timezones',value:'event utc_offset_minutes applies only when an event time is recorded'},
      {key:'environment',value:'Only keeper-entered measurements attached to records; no enclosure sensor history'},
      {key:'feeding_outcome',value:'recorded = outcome not specified; accepted / refused = recorded response'},
      {key:'entry_source',value:'quick / individual / blank if not recorded'},
      {key:'csv_safety',value:'Text beginning with formula-like characters is prefixed by an apostrophe for spreadsheet safety'},
      {key:'missing_values',value:'Empty cell = not recorded; never infer zero'},
      {key:'disclaimer',value:'Recorded observations only. Enclosure changes do not establish occupancy intervals. No veterinary interpretation.'}
    ],['key','value'])
  };
  return zip(files);
}
function fileSlug(name) {return String(name||'animal').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'animal';}
function fileName(data,ext) {return `${fileSlug(data.pet.name)}-${data.pet.id}-care-history-${data.generatedAt.slice(0,10)}.${ext}`;}
function display(value) {return value===null||value===undefined||value===''?'Not recorded':String(value);}
function fmtStamp(date,time,offset) {return `${display(date)}${time?' · '+time:''}${offset!==null&&offset!==undefined?` (UTC${offset>=0?'+':'-'}${String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')}:${String(Math.abs(offset)%60).padStart(2,'0')})`:''}`;}
function pdfFont(doc) {
  const regular = process.platform==='win32'?'C:\\Windows\\Fonts\\arial.ttf':'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  const bold = process.platform==='win32'?'C:\\Windows\\Fonts\\arialbd.ttf':'/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  if (fs.existsSync(regular)&&fs.existsSync(bold)) {doc.registerFont('Body',regular);doc.registerFont('BodyBold',bold);return ['Body','BodyBold'];}
  // Core PDF fonts are fallback only; system TrueType is preferred for Unicode.
  return ['Helvetica','Helvetica-Bold'];
}
function makePdf(data,res) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({size:'A4',margins:{top:57,bottom:60,left:55,right:55},bufferPages:true,info:{Title:`Care history: ${data.pet.name}`,Author:'Exotic Pet Keeper',Subject:'Keeper-recorded historical observations'}});
  const [regular,bold]=pdfFont(doc);
  const ink='#294D38', muted='#536758', paper='#FFFFFF';
  const WIDTH=485;
  // Measure text using the same fonts and sizes used to render it. This keeps
  // short section headings with their first observation instead of orphaning
  // them at the bottom of a page.
  function recordHeight(record) {
    doc.font(bold).fontSize(9.75);
    let height = doc.heightOfString(record.title, {width:WIDTH});
    doc.font(regular).fontSize(9.25);
    for (const line of record.lines) if (line) height += doc.heightOfString(line, {width:WIDTH});
    return height + 25; // spacing and the divider below the observation
  }
  function ensure(height=50) {
    const room = doc.page.height - doc.page.margins.top - 64;
    if (doc.y + Math.min(height, room) > doc.page.height - 64) doc.addPage();
  }
  function section(name,rows) {
    doc.font(bold).fontSize(12.5);
    const headingHeight = doc.heightOfString(name,{width:WIDTH}) + 24;
    const firstRecordHeight = rows.length ? recordHeight(rows[0]) : 25;
    ensure(headingHeight + firstRecordHeight);
    doc.moveDown(.75).font(bold).fontSize(12.5).fillColor(ink).text(name,{width:WIDTH});
    doc.moveDown(.3);
    if(!rows.length){doc.font(regular).fontSize(9.25).fillColor(muted).text('No records in the selected period.');return;}
    for(const record of rows){
      ensure(recordHeight(record));
      doc.font(bold).fontSize(9.75).fillColor(ink).text(record.title,{width:WIDTH});
      doc.font(regular).fontSize(9.25).fillColor('#3B4E40');
      for(const line of record.lines)if(line)doc.text(line,{width:WIDTH,continued:false});
      doc.moveDown(.45);
      // Do not leave a divider stranded at the top of a new page.
      if (doc.y + 12 <= doc.page.height - 64) {
        doc.moveTo(55,doc.y).lineTo(540,doc.y).strokeColor('#DDE7D8').lineWidth(.6).stroke();
        doc.moveDown(.5);
      }
    }
  }
  doc.pipe(res);
  doc.fillColor(ink).font(bold).fontSize(10).text('EXOTIC PET KEEPER',{align:'left'});
  doc.moveDown(.7).fontSize(22).text('Animal Care History Report');
  doc.moveDown(.6).font(regular).fontSize(10).text(`Animal: ${display(data.pet.name)}  |  Species: ${display(data.pet.species)}`);
  doc.fontSize(9.25).fillColor(muted).text(`Animal ID: ${data.pet.id}  |  Generated (UTC): ${data.generatedAt}`);
  doc.text(data.options.from||data.options.to ? `Selected dates: ${data.options.from||'Beginning of history'} to ${data.options.to||'Latest available'} (inclusive)` : 'Selected dates: All available history');
  doc.text(`Categories: ${data.options.categories.map(c=>LABELS[c]).join(', ')}`,{width:WIDTH});
  doc.moveDown(.6).font(bold).fillColor(ink).text('Record summary');
  doc.font(regular).fillColor(muted).text(`Feeding: ${data.feedings.length}  |  Animal observations: ${data.events.length}  |  Recorded enclosure changes: ${data.changes.length} (calculated counts)`);
  const sections=[
    ['feeding',data.feedings.map(f=>({title:`${fmtStamp(f.feeding_date,f.feeding_time,null)} · ${display(f.food)}`,lines:[`Response: ${display(f.feeding_outcome)}  |  Entry: ${display(f.entry_source)}`, `Keeper-recorded conditions: ${f.temperature_c==null?'Not recorded':f.temperature_c+' °C'}; ${f.humidity_pct==null?'Not recorded':f.humidity_pct+'%'}`, f.notes?`Notes: ${f.notes}`:null,`Record ID: ${f.id}`]}))],
    ...['molting','weight','length','behavior','health','husbandry','other'].map(type=>[type,data.events.filter(e=>e.event_type===type).map(e=>({title:fmtStamp(e.event_date,e.event_time,e.utc_offset_minutes),lines:[type==='molting'?`Stage: ${display(e.molt_stage)}  |  Outcome: ${display(e.molt_outcome)}`:null,type==='weight'?`Weight: ${display(e.weight_g)} g`:null,type==='length'?`Length: ${display(e.length_cm)} cm  |  Method: ${display(e.length_method)}`:null,e.description?`Observation: ${e.description}`:null,`Keeper-recorded conditions: ${e.temperature_c==null?'Not recorded':e.temperature_c+' °C'}; ${e.humidity_pct==null?'Not recorded':e.humidity_pct+'%'}`,e.notes?`Notes: ${e.notes}`:null,`Record ID: ${e.id}`]}))]),
    ['enclosure_change',data.changes.map(c=>({title:`${c.occurred_at} · Recorded assignment change`,lines:[`From: ${display(c.previous_enclosure_name)} (ID ${display(c.previous_enclosure_id)})`,`To: ${display(c.new_enclosure_name)} (ID ${display(c.new_enclosure_id)})`,`Record ID: ${c.id}`]}))]
  ];
  for(const [cat,rows] of sections)if(data.options.categories.includes(cat))section(LABELS[cat],rows);
  ensure(100);doc.moveDown().font(bold).fillColor(ink).fontSize(10).text('Interpretation and completeness');
  doc.font(regular).fontSize(9).fillColor(muted).text('This report presents recorded observations, not a veterinary assessment. Missing values mean not recorded. Enclosure assignment changes do not prove complete historical occupancy; enclosure sensor readings are excluded. Feeding “recorded” does not imply accepted. Observation dates and times are not replaced by database creation times.',{width:WIDTH});
  const count=doc.bufferedPageRange().count;
  for(let i=0;i<count;i++){doc.switchToPage(i);doc.font(regular).fontSize(8.5).fillColor(muted).text(`Exotic Pet Keeper · ${data.pet.id}                                      Page ${i+1} / ${count}`,55,doc.page.height-70,{width:WIDTH,align:'center',lineBreak:false});}
  doc.end();
}
module.exports={parseOptions,loadRecords,makeCsvZip,makePdf,fileName,CATEGORIES};
