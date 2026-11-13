const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dataDirectory = path.join(__dirname, '..', 'data');

fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, 'enclosures.db');

const db = new DatabaseSync(databasePath);

// Enable foreign key enforcement
db.exec('PRAGMA foreign_keys = ON');

// Create database tables
db.exec(`
    CREATE TABLE IF NOT EXISTS enclosures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        min_temperature REAL NOT NULL,
        max_temperature REAL NOT NULL,
        min_humidity REAL NOT NULL,
        max_humidity REAL NOT NULL,
        is_abnormal INTEGER NOT NULL DEFAULT 0
            CHECK (is_abnormal IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS readings (
        enclosure_id INTEGER PRIMARY KEY,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (enclosure_id)
            REFERENCES enclosures(id)
            ON DELETE CASCADE
    );
`);

module.exports = db;
db;
