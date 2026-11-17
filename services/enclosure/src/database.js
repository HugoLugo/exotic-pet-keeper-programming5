
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

    CREATE TABLE IF NOT EXISTS reading_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enclosure_id INTEGER NOT NULL,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL
            CHECK (source IN ('sensor', 'manual')),
        FOREIGN KEY (enclosure_id)
            REFERENCES enclosures(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reading_history_enclosure_date
    ON reading_history(enclosure_id, recorded_at);
`);

// Add optional Stage 3D habitat metadata to databases created in earlier stages.
// PRAGMA-based column checks keep this migration safe on every service restart.
const columns = new Set(db.prepare('PRAGMA table_info(enclosures)').all().map(column => column.name));
if (!columns.has('enclosure_type')) db.exec('ALTER TABLE enclosures ADD COLUMN enclosure_type TEXT');
if (!columns.has('notes')) db.exec('ALTER TABLE enclosures ADD COLUMN notes TEXT');
// Only an ID is stored: pets belong to the Data Management database.
if (!columns.has('featured_pet_id')) db.exec('ALTER TABLE enclosures ADD COLUMN featured_pet_id INTEGER');
// Existing enclosures remain automatic; switching modes sets a history-row boundary.
// A monotonically increasing history ID avoids timestamp precision/race problems.
if (!columns.has('monitoring_mode')) db.exec("ALTER TABLE enclosures ADD COLUMN monitoring_mode TEXT NOT NULL DEFAULT 'automatic' CHECK (monitoring_mode IN ('manual', 'automatic'))");
if (!columns.has('monitoring_start_history_id')) db.exec('ALTER TABLE enclosures ADD COLUMN monitoring_start_history_id INTEGER NOT NULL DEFAULT 0');
// Stage 8.2 — favorite flag persists per enclosure and defaults to off.
if (!columns.has('is_favorite')) db.exec('ALTER TABLE enclosures ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1))');

module.exports = db;