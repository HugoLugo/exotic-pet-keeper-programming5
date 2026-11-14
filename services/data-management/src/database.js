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
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS feeding_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL,
        food TEXT NOT NULL,
        feeding_date TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (pet_id) REFERENCES pets(id)
    );
`);

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
    ['notes', 'TEXT']
]) {
    if (!columns.some(column => column.name === name)) {
        db.exec(`ALTER TABLE pets ADD COLUMN ${name} ${definition}`);
        console.log(`Added ${name} column to pets table`);
    }
}

module.exports = db;