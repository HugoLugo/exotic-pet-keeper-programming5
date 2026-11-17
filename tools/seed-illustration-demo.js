'use strict';
// Fictional visual-QA records. Idempotent: only touches records marked EPK-ILLUSTRATION-DEMO.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const petDb = require(path.join(root, 'services/data-management/src/database.js'));
const enclosureDb = require(path.join(root, 'services/enclosure/src/database.js'));
const TAG = '[EPK-ILLUSTRATION-DEMO]';
const animals = [
  {name:'Mochi', species:'Leopard Gecko', key:'gecko', habitat:'Desert', temp:[24,31],humidity:[25,50],reading:[27,36],food:'Insects'},
  {name:'Saffron', species:'Ball Python', key:'ball_python', habitat:'Tropical',temp:[24,32],humidity:[55,80],reading:[27,65],food:'Thawed mouse'},
  {name:'Ruby', species:'Mexican Red-Knee Tarantula', key:'red_knee_tarantula',habitat:'Desert',temp:[21,29],humidity:[35,70],reading:[25,51],food:'Cricket'},
  {name:'Onyx', species:'Asian Forest Scorpion', key:'asian_forest_scorpion',habitat:'Tropical',temp:[23,30],humidity:[65,90],reading:[26,79],food:'Cricket'},
  {name:'Pippa', species:'Pacman Frog', key:'pacman_frog',habitat:'Tropical',temp:[22,29],humidity:[60,85],reading:[25,72],food:'Earthworm'},
  {name:'Noodle', species:'Corn Snake', key:'corn_snake',habitat:'Temperate',temp:[22,31],humidity:[40,70],reading:[26,54],food:'Thawed mouse'},
  {name:'Sol', species:'Bearded Dragon', key:'bearded_dragon',habitat:'Desert',temp:[23,37],humidity:[25,55],reading:[28,37],food:'Leafy greens and insects'},
  {name:'Clover', species:'Crested Gecko', key:'crested_gecko',habitat:'Tropical',temp:[20,28],humidity:[50,85],reading:[24,65],food:'Prepared gecko diet'},
  {name:'Bubbles', species:'Axolotl', key:'axolotl',habitat:'Aquatic',temp:[14,21],humidity:[0,100],reading:[18,70],food:'Earthworm'},
  {name:'Petal', species:'Orchid Mantis', key:'orchid_mantis',habitat:'Tropical',temp:[22,29],humidity:[50,85],reading:[25,70],food:'Fruit flies'}
];
const utcDate = daysAgo => new Date(Date.now() - daysAgo*86400000).toISOString().slice(0,10);
const utcTimestamp = daysAgo => new Date(Date.now() - daysAgo*86400000).toISOString().slice(0,19).replace('T',' ');
let createdPets=0, createdEnclosures=0;
for(const animal of animals) {
  const enclosureName = `EPK Demo - ${animal.species}`;
  let enclosure=enclosureDb.prepare('SELECT * FROM enclosures WHERE name=? AND notes LIKE ?').get(enclosureName,`%${TAG}%`);
  if (!enclosure) {
    const r=enclosureDb.prepare(`INSERT INTO enclosures
      (name,min_temperature,max_temperature,min_humidity,max_humidity,enclosure_type,notes,monitoring_mode)
      VALUES (?,?,?,?,?,?,?,'manual')`).run(enclosureName,animal.temp[0],animal.temp[1],animal.humidity[0],animal.humidity[1],animal.habitat,
        `${TAG} Fictional illustration QA habitat. Environmental limits are placeholders, not husbandry advice.`);
    enclosure={id:Number(r.lastInsertRowid)}; createdEnclosures++;
  }
  let pet=petDb.prepare('SELECT * FROM pets WHERE name=? AND notes LIKE ?').get(animal.name,`%${TAG}%`);
  if(!pet) {
    const r=petDb.prepare(`INSERT INTO pets (name,species,enclosure_id,gender,date_of_birth,notes,illustration_key)
      VALUES (?, ?, ?, 'unknown', NULL, ?, ?)`).run(animal.name,animal.species,enclosure.id,
      `${TAG} Fictional pet for testing artwork and enclosure layouts.`,animal.key);
    pet={id:Number(r.lastInsertRowid)}; createdPets++;
  } else if(pet.enclosure_id!==enclosure.id || pet.illustration_key!==animal.key) {
    // Only explicitly tagged demo pets are reconciled.
    petDb.prepare('UPDATE pets SET enclosure_id=?, illustration_key=? WHERE id=?').run(enclosure.id,animal.key,pet.id);
  }
  enclosureDb.prepare('UPDATE enclosures SET featured_pet_id=? WHERE id=?').run(pet.id,enclosure.id);
  if(enclosureDb.prepare('SELECT count(*) AS n FROM reading_history WHERE enclosure_id=?').get(enclosure.id).n===0) {
    const insert=enclosureDb.prepare(`INSERT INTO reading_history (enclosure_id,temperature,humidity,recorded_at,source)
        VALUES (?,?,?,?,'manual')`);
    for(const [i,days] of [3,2,1].entries()) {
      insert.run(enclosure.id, animal.reading[0]+[0.4,-0.2,0][i], animal.reading[1]+[2,-1,0][i], utcTimestamp(days));
    }
    enclosureDb.prepare('UPDATE enclosures SET is_abnormal=0 WHERE id=?').run(enclosure.id);
  }
  if(petDb.prepare('SELECT count(*) AS n FROM feeding_records WHERE pet_id=?').get(pet.id).n===0) {
    for(const day of [15,7]) {
      petDb.prepare(`INSERT INTO feeding_records (pet_id,food,feeding_date,notes,feeding_outcome,entry_source)
        VALUES (?,?,?,?, 'accepted','individual')`).run(pet.id,animal.food,utcDate(day),`${TAG} Fictional feeding entry`);
    }
  }
  if(petDb.prepare('SELECT count(*) AS n FROM animal_events WHERE pet_id=?').get(pet.id).n===0) {
    petDb.prepare(`INSERT INTO animal_events (pet_id,event_type,event_date,description,notes)
      VALUES (?,'behavior',?,?,?)`).run(pet.id,utcDate(2), 'Fictional demo observation for the Records & Insights layout.',TAG);
  }
}
console.log(`Demo QA ready: ${animals.length} pets / ${animals.length} enclosures (new: ${createdPets} pets, ${createdEnclosures} enclosures).`);
console.log('Existing non-demo records were not deleted. Rerunning this script does not duplicate tagged demo records.');
