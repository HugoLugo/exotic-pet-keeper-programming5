'use strict';
/**
 * Exotic Pet Keeper — one visual QA demo.
 * Replaces ALL pets/enclosures and their test records in the two app databases.
 * PRECONDITIONS: The Illustration Quick Patch is installed; services are STOPPED.
 * Does not touch the Leopard Gecko or any other illustration asset or app code.
 * Backs up both SQLite databases to backups/one-demo-reset-... BEFORE cleanup.
 * Works on Node.js 22+ (node:sqlite).
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {DatabaseSync, backup} = require('node:sqlite');
const root = path.resolve(process.argv[2] || process.cwd());
const TAG = '[EPK-ILLUSTRATION-DEMO]';
const D = [
  { name:'Mochi', species:'Leopard Gecko', key:'gecko',        habitat:'Desert',    t:[24,31],h:[25,50],reading:[27,36],food:'Insects' },
  { name:'Saffron',species:'Ball Python', key:'ball_python',   habitat:'Tropical',  t:[24,32],h:[55,80],reading:[27,65],food:'Thawed mouse' },
  { name:'Ruby',species:'Mexican Red-Knee Tarantula',key:'red_knee_tarantula',habitat:'Desert',t:[21,29],h:[35,70],reading:[25,51],food:'Cricket' },
  { name:'Onyx',species:'Asian Forest Scorpion',key:'asian_forest_scorpion',habitat:'Tropical',t:[23,30],h:[65,90],reading:[26,79],food:'Cricket' },
  { name:'Pippa',species:'Pacman Frog', key:'pacman_frog',      habitat:'Tropical',  t:[22,29],h:[60,85],reading:[25,72],food:'Earthworm' },
  { name:'Noodle',species:'Corn Snake',key:'corn_snake',        habitat:'Temperate', t:[22,31],h:[40,70],reading:[26,54],food:'Thawed mouse' },
  { name:'Sol',species:'Bearded Dragon',key:'bearded_dragon',  habitat:'Desert',    t:[23,37],h:[25,55],reading:[28,37],food:'Leafy greens and insects' },
  { name:'Clover',species:'Crested Gecko',key:'crested_gecko', habitat:'Tropical',  t:[20,28],h:[50,85],reading:[24,65],food:'Prepared gecko diet' },
  { name:'Bubbles',species:'Axolotl',key:'axolotl',             habitat:'Aquatic',   t:[14,21],h:[0,100],reading:[18,70],food:'Earthworm' },
  { name:'Petal',species:'Orchid Mantis',key:'orchid_mantis',  habitat:'Tropical',  t:[22,29],h:[50,85],reading:[25,70],food:'Fruit flies' }
];
const required = [
  'frontend/app.js',
  'services/data-management/src/database.js',
  'services/data-management/src/server.js',
  'services/enclosure/src/database.js',
  'frontend/public/assets/illustrations/animals/leopard-gecko.webp',
  ...['axolotl','ball-python','bearded-dragon','corn-snake','crested-gecko','orchid-mantis','pacman-frog','scorpion','tarantula']
    .map(x=>`frontend/public/assets/illustrations/animals/${x}.webp`)
];
const abs = r => path.join(root,r);
function assert(condition, reason) { if(!condition) throw Error(reason); }
function checkDirectory() {
  for(const item of required) assert(fs.existsSync(abs(item)),`Required project file missing: ${item}`);
  const front=fs.readFileSync(abs('frontend/app.js'),'utf8');
  const back=fs.readFileSync(abs('services/data-management/src/server.js'),'utf8');
  for (const key of D.map(a=>a.key)) {
    assert(front.includes(key) && back.includes(key), `Illustration key '${key}' not installed in frontend AND backend. Install the earlier EPK Illustration Quick Patch first; database not touched.`);
  }
  for(const entry of D) assert(entry.name.length && entry.species.length, 'Incomplete fixture');
}
function dateAgo(days) { return new Date(Date.now()-days*86400000).toISOString().slice(0,10); }
function timestampAgo(days){return new Date(Date.now()-days*86400000).toISOString().slice(0,19).replace('T',' ');}
async function portOpen(port) {
  return new Promise(resolve=>{
    const s=net.connect({host:'127.0.0.1',port});
    s.setTimeout(350);
    s.on('connect',()=>{s.destroy();resolve(true)});
    s.on('error',()=>{s.destroy();resolve(false)});
    s.on('timeout',()=>{s.destroy();resolve(false)});
  });
}
function tables(db, location) {
  return db.prepare(`SELECT name FROM ${location}.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all().map(row=>row.name).sort();
}
function assertKnownTables(db) {
  const petTables=['pets','feeding_groups','feeding_group_members','feeding_records','animal_events','enclosure_change_events'];
  const enclosureTables=['enclosures','readings','reading_history'];
  for(const [location, expected] of [['main',petTables],['enclosure',enclosureTables]]) {
    const found=tables(db,location);
    assert(expected.every(x=>found.includes(x)),`Missing expected ${location} tables: ${expected.filter(x=>!found.includes(x)).join(', ')}`);
    const unknown=found.filter(x=>!expected.includes(x));
    assert(unknown.length===0,`Unrecognized ${location} tables (${unknown.join(', ')}). Refusing to clear a newer database schema.`);
  }
  const cols=(schema,table)=>new Set(db.prepare(`PRAGMA ${schema}.table_info(${table})`).all().map(c=>c.name));
  for(const [schema,table,fields] of [
    ['main','pets',['id','name','species','enclosure_id','gender','date_of_birth','notes','illustration_key']],
    ['main','feeding_records',['pet_id','food','feeding_date','notes','feeding_outcome','entry_source']],
    ['main','animal_events',['pet_id','event_type','event_date','description','notes']],
    ['enclosure','enclosures',['id','name','min_temperature','max_temperature','min_humidity','max_humidity','enclosure_type','notes','monitoring_mode','featured_pet_id']],
    ['enclosure','reading_history',['enclosure_id','temperature','humidity','recorded_at','source']]
  ]) {
    const found=cols(schema,table);
    assert(fields.every(x=>found.has(x)),`Missing ${schema}.${table} columns: ${fields.filter(x=>!found.has(x)).join(', ')}`);
  }
}
function count(db,schema,table) {return db.prepare(`SELECT COUNT(*) n FROM ${schema}.${table}`).get().n;}
function checkResult(db) {
  assert(count(db,'main','pets')===10,'Expected exactly 10 pets');
  assert(count(db,'enclosure','enclosures')===10,'Expected exactly 10 enclosures');
  assert(count(db,'main','feeding_records')===30,'Expected exactly 30 feeding records');
  assert(count(db,'main','animal_events')===20,'Expected exactly 20 animal events');
  assert(count(db,'enclosure','reading_history')===40,'Expected exactly 40 environmental readings');
  assert(count(db,'enclosure','readings')===0,'Unexpected automatic sensor readings');
  for (const a of D) {
    const pet=db.prepare('SELECT * FROM pets WHERE illustration_key=?').get(a.key);
    assert(pet && pet.name===a.name,`Missing demo pet ${a.name}`);
    const enc=db.prepare('SELECT * FROM enclosure.enclosures WHERE id=?').get(pet.enclosure_id);
    assert(enc && enc.featured_pet_id===pet.id && enc.name===`EPK Demo - ${a.species}`,`Enclosure mismatch for ${a.name}`);
    assert(db.prepare('SELECT COUNT(*) n FROM feeding_records WHERE pet_id=?').get(pet.id).n===3,`Missing feeding history for ${a.name}`);
    assert(db.prepare('SELECT COUNT(*) n FROM animal_events WHERE pet_id=?').get(pet.id).n===2,`Missing events for ${a.name}`);
    assert(db.prepare('SELECT COUNT(*) n FROM enclosure.reading_history WHERE enclosure_id=?').get(enc.id).n===4,`Missing readings for ${a.name}`);
  }
  assert(['ok'].includes(db.prepare('PRAGMA main.integrity_check').get().integrity_check),'Pet database integrity check failed');
  assert(['ok'].includes(db.prepare('PRAGMA enclosure.integrity_check').get().integrity_check),'Enclosure database integrity check failed');
}
async function main() {
  checkDirectory();
  const up=[];
  for(const p of [3001,3002]) if(await portOpen(p)) up.push(p);
  assert(!up.length,`Backend services appear to be running on port(s) ${up.join(', ')}. Stop Data Management, Enclosure and sensor processes first. Nothing changed.`);
  // Initialize schemas/migrations exactly as the application's own services do.
  const petDbModule = require(abs('services/data-management/src/database.js'));
  const envDbModule = require(abs('services/enclosure/src/database.js'));
  petDbModule.close();envDbModule.close();
  const petFile=abs('services/data-management/data/pets.db');
  const encFile=abs('services/enclosure/data/enclosures.db');
  const db=new DatabaseSync(petFile);
  let env;
  try {
    db.exec('PRAGMA foreign_keys=ON');
    db.prepare('ATTACH DATABASE ? AS enclosure').run(encFile);
    assertKnownTables(db);
    const oldCounts={pets:count(db,'main','pets'),enclosures:count(db,'enclosure','enclosures'),feedings:count(db,'main','feeding_records'),events:count(db,'main','animal_events'),readings:count(db,'enclosure','reading_history')};
    const folder=abs(path.join('backups',`one-demo-reset-${new Date().toISOString().replace(/[:.]/g,'-')}`));
    fs.mkdirSync(folder,{recursive:true});
    // Online SQLite snapshots, not raw copying of live database files; protects against WAL state.
    const b1=new DatabaseSync(petFile);const b2=new DatabaseSync(encFile);
    try {
      await backup(b1,path.join(folder,'pets.db'));
      await backup(b2,path.join(folder,'enclosures.db'));
    } finally {b1.close();b2.close();}
    for(const filename of ['pets.db','enclosures.db']) {
      const p=path.join(folder,filename);
      assert(fs.existsSync(p) && fs.statSync(p).size>0,`Backup failed: ${p}`);
      const verify=new DatabaseSync(p);
      try {assert(verify.prepare('PRAGMA integrity_check').get().integrity_check==='ok',`Backup corruption: ${filename}`);}finally{verify.close();}
    }
    console.log('Backup completed:',folder);
    console.log('Previous data:',JSON.stringify(oldCounts));
    // One transaction spans both attached databases (normal DELETE journal mode).
    // This is a visual QA workspace, not a user-data migration.
    db.exec('BEGIN IMMEDIATE');
    try {
      for(const table of ['feeding_group_members','feeding_groups','feeding_records','animal_events','enclosure_change_events','pets'])db.exec(`DELETE FROM main.${table}`);
      for(const table of ['reading_history','readings','enclosures'])db.exec(`DELETE FROM enclosure.${table}`);
      db.exec("DELETE FROM main.sqlite_sequence WHERE name IN ('pets','feeding_records','animal_events','feeding_groups','enclosure_change_events')");
      db.exec("DELETE FROM enclosure.sqlite_sequence WHERE name IN ('enclosures','reading_history')");
      const createEnc=db.prepare(`INSERT INTO enclosure.enclosures
        (name,min_temperature,max_temperature,min_humidity,max_humidity,enclosure_type,notes,monitoring_mode,is_abnormal)
        VALUES (?,?,?,?,?,?,?,'manual',0)`);
      const createPet=db.prepare(`INSERT INTO main.pets (name,species,enclosure_id,gender,date_of_birth,notes,illustration_key)
        VALUES (?,?,?,'unknown',NULL,?,?)`);
      const featured=db.prepare('UPDATE enclosure.enclosures SET featured_pet_id=? WHERE id=?');
      const reading=db.prepare(`INSERT INTO enclosure.reading_history
        (enclosure_id,temperature,humidity,recorded_at,source) VALUES (?,?,?,?,'manual')`);
      const feeding=db.prepare(`INSERT INTO main.feeding_records
        (pet_id,food,feeding_date,notes,feeding_outcome,entry_source)
        VALUES (?,?,?,?,?,'individual')`);
      const event=db.prepare(`INSERT INTO main.animal_events
        (pet_id,event_type,event_date,description,notes) VALUES (?,?,?,?,?)`);
      for (const a of D) {
        const name=`EPK Demo - ${a.species}`;
        const notes=`${TAG} Fictional enclosure for visual QA. Thresholds are UI placeholders, not husbandry guidance.`;
        const encId=Number(createEnc.run(name,...a.t,...a.h,a.habitat,notes).lastInsertRowid);
        const petId=Number(createPet.run(a.name,a.species,encId,`${TAG} Fictional pet for illustration QA.`,a.key).lastInsertRowid);
        featured.run(petId,encId);
        for(const [i,days] of [4,3,2,1].entries()) {
          reading.run(encId,a.reading[0]+[0.5,-0.4,0.2,0][i],a.reading[1]+[2,-1,1,0][i],timestampAgo(days));
        }
        for(const [i,days] of [16,9,3].entries()){
          feeding.run(petId,a.food,dateAgo(days),`${TAG} Fictional feeding record ${i+1}.`,i===2&&['Petal','Ruby'].includes(a.name)?'refused':'accepted');
        }
        event.run(petId,'behavior',dateAgo(2), 'Fictional observation: typical activity documented for the illustration demo.',TAG);
        event.run(petId,'husbandry',dateAgo(6),'Fictional enclosure inspection recorded for the Records & Insights demo.',TAG);
      }
      checkResult(db);
      db.exec('COMMIT');
    } catch(err) { try{db.exec('ROLLBACK');}catch{} throw err; }
    console.log('SUCCESS: ONE demo only — 10 pets, 10 enclosures, 30 feedings, 20 animal events, 40 manual environmental readings.');
    console.log('All older demo pets, enclosures, feeding groups, records and readings were removed.');
    console.log('All 10 animals have their own enclosure and individual records. Art files and Gecko are unchanged.');
    console.log('Backups:',folder);
    // Make rerunning convenient without needing to re-extract the ZIP next time.
    const target=abs('tools/reset-illustration-demo.js');
    if(path.resolve(__filename)!==path.resolve(target)) {
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.copyFileSync(__filename,target);
      console.log('Reusable reset script installed at tools/reset-illustration-demo.js');
    }
  } finally { db.close(); }
}
main().catch(err=>{console.error('\nERROR:',err.message);process.exitCode=1;});
