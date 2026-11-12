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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

module.exports = db;