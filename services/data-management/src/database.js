const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dataDirectory = path.join(__dirname, '..', 'data');

fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, 'pets.db');

const db = new DatabaseSync(databasePath);

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        enclosure_id INTEGER,
        gender TEXT NOT NULL DEFAULT 'unknown',
        date_of_birth TEXT,
        notes TEXT,
        illustration_key TEXT
    );

    CREATE TABLE IF NOT EXISTS feeding_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feeding_group_members (
        group_id INTEGER NOT NULL,
        pet_id INTEGER NOT NULL,
        PRIMARY KEY (group_id, pet_id),
        FOREIGN KEY (group_id) REFERENCES feeding_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS animal_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pets(id),
        event_type TEXT NOT NULL CHECK(event_type IN ('molting','weight','length','behavior','health','husbandry','other')),
        event_date TEXT NOT NULL,
        event_time TEXT,
        utc_offset_minutes INTEGER,
        description TEXT,
        molt_outcome TEXT,
        weight_g REAL,
        length_cm REAL,
        length_method TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_animal_events_pet_date ON animal_events(pet_id,event_date DESC,event_time DESC,id DESC);

    CREATE TABLE IF NOT EXISTS feeding_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL,
        food TEXT NOT NULL,
        feeding_date TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (pet_id) REFERENCES pets(id)
    );
`);

// Stage 3D.5.4B: optional keeper-observed environmental context and shedding stage.
// Existing molting records retain NULL stage (legacy completed/observed molt).
const animalEventColumns = new Set(db.prepare('PRAGMA table_info(animal_events)').all().map(column => column.name));
for (const [name, definition] of [
    ['molt_stage', 'TEXT'],
    ['temperature_c', 'REAL'],
    ['humidity_pct', 'REAL']
]) {
    if (!animalEventColumns.has(name)) {
        db.exec(`ALTER TABLE animal_events ADD COLUMN ${name} ${definition}`);
        console.log(`Added ${name} column to animal_events table`);
    }
}

// Add enclosure_id to databases created before Milestone 10
const columns = db.prepare('PRAGMA table_info(pets)').all();

const hasEnclosureId = columns.some(
    column => column.name === 'enclosure_id'
);

if (!hasEnclosureId) {
    db.exec('ALTER TABLE pets ADD COLUMN enclosure_id INTEGER');
    console.log('Added enclosure_id column to pets table');
}

// Non-destructive migrations for existing pet databases.
for (const [name, definition] of [
    ['gender', "TEXT NOT NULL DEFAULT 'unknown'"],
    ['date_of_birth', 'TEXT'],
    ['notes', 'TEXT'],
    ['illustration_key', 'TEXT']
]) {
    if (!columns.some(column => column.name === name)) {
        db.exec(`ALTER TABLE pets ADD COLUMN ${name} ${definition}`);
        console.log(`Added ${name} column to pets table`);
    }
}

// Preserve existing feeding entries without assuming that they were accepted.
const feedingColumns = db.prepare('PRAGMA table_info(feeding_records)').all();
if (!feedingColumns.some(column => column.name === 'feeding_outcome')) {
    db.exec("ALTER TABLE feeding_records ADD COLUMN feeding_outcome TEXT NOT NULL DEFAULT 'recorded'");
}

// Optional individual feeding observations; keep historical date-only records unchanged.
const feedingExtras = new Set(db.prepare('PRAGMA table_info(feeding_records)').all().map(c => c.name));
// Provenance is known only for new entries; existing feeding history stays unclassified.
for (const [name, type] of [['feeding_time','TEXT'],['temperature_c','REAL'],['humidity_pct','REAL'],['entry_source','TEXT']]) {
    if (!feedingExtras.has(name)) {
        db.exec(`ALTER TABLE feeding_records ADD COLUMN ${name} ${type}`);
        console.log(`Added ${name} column to feeding_records table`);
    }
}
// Stage 3D.5.4C: length measurements require extending the original event_type CHECK.
// Rebuild this single table atomically so pre-existing event IDs and observations survive.
const eventSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='animal_events'").get()?.sql || '';
if (!/['"]length['"]/.test(eventSql) || !new Set(db.prepare('PRAGMA table_info(animal_events)').all().map(c => c.name)).has('length_cm')) {
    const allColumns = db.prepare('PRAGMA table_info(animal_events)').all().map(c => c.name);
    const oldFields = ['id','pet_id','event_type','event_date','event_time','utc_offset_minutes','description','molt_outcome','weight_g','notes','created_at','updated_at','molt_stage','temperature_c','humidity_pct'];
    const carried = oldFields.filter(c => allColumns.includes(c));
    db.exec('BEGIN IMMEDIATE');
    try {
        db.exec(`CREATE TABLE animal_events_length_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_id INTEGER NOT NULL REFERENCES pets(id),
            event_type TEXT NOT NULL CHECK(event_type IN ('molting','weight','length','behavior','health','husbandry','other')),
            event_date TEXT NOT NULL,
            event_time TEXT,
            utc_offset_minutes INTEGER,
            description TEXT,
            molt_outcome TEXT,
            weight_g REAL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            molt_stage TEXT,
            temperature_c REAL,
            humidity_pct REAL,
            length_cm REAL,
            length_method TEXT
        )`);
        db.exec(`INSERT INTO animal_events_length_new (${carried.join(',')}) SELECT ${carried.join(',')} FROM animal_events`);
        db.exec('DROP TABLE animal_events');
        db.exec('ALTER TABLE animal_events_length_new RENAME TO animal_events');
        db.exec('CREATE INDEX idx_animal_events_pet_date ON animal_events(pet_id,event_date DESC,event_time DESC,id DESC)');
        db.exec('COMMIT');
        console.log('Migrated animal_events for length measurements (existing records preserved)');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

module.exports = db;