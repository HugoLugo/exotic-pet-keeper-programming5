
const express = require('express');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(express.json());

// Validate positive integer IDs
function isValidId(id) {
    return Number.isSafeInteger(id) && id > 0;
}

 // Validate an optional enclosure assignment
async function validateEnclosureAssignment(enclosureId) {
    // A pet can exist without an assigned enclosure
    if (enclosureId === null || enclosureId === undefined) {
        return null;
    }

    if (!isValidId(enclosureId)) {
        return {
            status: 400,
            error: 'enclosure_id must be a positive integer or null'
        };
    }

    try {
        const response = await fetch(
            `http://localhost:3002/enclosures/${enclosureId}`,
            { signal: AbortSignal.timeout(3000) }
        );

        if (response.status === 404) {
            return {
                status: 400,
                error: 'Assigned enclosure does not exist'
            };
        }

        if (!response.ok) {
            return {
                status: 503,
                error: 'Could not validate enclosure'
            };
        }

        return null;

    } catch (error) {
        console.error('Enclosure validation failed:', error.message);

        return {
            status: 503,
            error: 'Enclosure Service unavailable'
        };
    }
}

// Validate dates using DD/MM/YYYY
function isValidDate(date) {
    if (typeof date !== 'string') {
        return false;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        return false;
    }

    const [day, month, year] = date.split('/').map(Number);

    if (year < 1 || month < 1 || month > 12 || day < 1) {
        return false;
    }

    // Account for leap years
    const isLeapYear =
        year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0);

    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31, 30, 31, 30,
        31, 31, 30, 31, 30, 31
    ];

    return day <= daysInMonth[month - 1];
}

// Convert DD/MM/YYYY to YYYY-MM-DD for SQLite
function toDatabaseDate(date) {
    const [day, month, year] = date.split('/');

    return `${year}-${month}-${day}`;
}

// Convert YYYY-MM-DD to DD/MM/YYYY for the API
function toDisplayDate(date) {
    if (typeof date !== 'string') {
        return date;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
        return date;
    }

    return `${match[3]}/${match[2]}/${match[1]}`;
}

// Format a feeding record before sending it to the client
function formatFeeding(feeding) {
    return {
        ...feeding,
        feeding_date: toDisplayDate(feeding.feeding_date)
    };
}

// Validate feeding information
function isValidFeeding(food, feeding_date, notes) {
    return (
        typeof food === 'string' &&
        food.trim().length > 0 &&
        isValidDate(feeding_date) &&
        (
            notes === undefined ||
            notes === null ||
            typeof notes === 'string'
        )
    );
}

// Pet birth dates use ISO 8601 (YYYY-MM-DD), suitable for HTML date inputs.
function isValidBirthDate(value) {
    if (value === null) return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day &&
        value <= new Date().toISOString().slice(0, 10);
}

function isValidPetExtras(gender, dateOfBirth, notes) {
    return ['male', 'female', 'unknown'].includes(gender) &&
        isValidBirthDate(dateOfBirth) &&
        (notes === null || (typeof notes === 'string' && notes.length <= 2000));
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'data-management'
    });
});

// --------------------------------------------------
// PET MANAGEMENT
// --------------------------------------------------

// Retrieve all registered pets
app.get('/pets', (req, res) => {
    const pets = db.prepare(
        'SELECT * FROM pets'
    ).all();

    res.status(200).json(pets);
});

 // Register a new pet
app.post('/pets', async (req, res) => {
    const { name, species, enclosure_id = null, gender = 'unknown',
        date_of_birth = null, notes = null } = req.body || {};

    if (
        typeof name !== 'string' ||
        typeof species !== 'string' ||
        !name.trim() ||
        !species.trim()
    ) {
        return res.status(400).json({
            error: 'Name and species are required'
        });
    }

    if (!isValidPetExtras(gender, date_of_birth, notes)) {
        return res.status(400).json({
            error: 'gender must be male/female/unknown; date_of_birth must be a valid YYYY-MM-DD date not in the future or null; notes must be text up to 2000 characters or null'
        });
    }

    // Validate the enclosure before creating the pet
    const enclosureError = await validateEnclosureAssignment(enclosure_id);

    if (enclosureError) {
        return res.status(enclosureError.status).json({
            error: enclosureError.error
        });
    }

    const result = db.prepare(`
        INSERT INTO pets (name, species, enclosure_id, gender, date_of_birth, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), species.trim(), enclosure_id, gender, date_of_birth,
        typeof notes === 'string' ? notes.trim() : null);

    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(pet);
});

// Retrieve a specific pet
app.get('/pets/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(id);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    res.status(200).json(pet);
});


 // Update an existing pet
app.put('/pets/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    const { name, species, enclosure_id = null, gender = 'unknown',
        date_of_birth = null, notes = null } = req.body || {};

    if (
        typeof name !== 'string' ||
        typeof species !== 'string' ||
        !name.trim() ||
        !species.trim()
    ) {
        return res.status(400).json({
            error: 'Name and species are required'
        });
    }

    // Check that the pet exists before validating the enclosure
    const existingPet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(id);

    if (!existingPet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    if (!isValidPetExtras(gender, date_of_birth, notes)) {
        return res.status(400).json({
            error: 'gender must be male/female/unknown; date_of_birth must be a valid YYYY-MM-DD date not in the future or null; notes must be text up to 2000 characters or null'
        });
    }

    // Validate the new enclosure assignment
    const enclosureError = await validateEnclosureAssignment(enclosure_id);

    if (enclosureError) {
        return res.status(enclosureError.status).json({
            error: enclosureError.error
        });
    }

    db.prepare(`
        UPDATE pets
        SET name = ?, species = ?, enclosure_id = ?, gender = ?,
            date_of_birth = ?, notes = ?
        WHERE id = ?
    `).run(name.trim(), species.trim(), enclosure_id, gender, date_of_birth,
        typeof notes === 'string' ? notes.trim() : null, id);

    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(id);

    res.status(200).json(pet);
});

// Delete an existing pet
app.delete('/pets/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    const pet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(id);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    // Delete dependent feeding records and pet together, or undo both on failure.
    try {
        db.exec('BEGIN IMMEDIATE');
        db.prepare('DELETE FROM feeding_records WHERE pet_id = ?').run(id);
        db.prepare('DELETE FROM pets WHERE id = ?').run(id);
        db.exec('COMMIT');
    } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
    }

    res.status(204).send();
});

 // Retrieve pets assigned to an enclosure
app.get('/enclosures/:id/pets', (req, res) => {
    const id = Number(req.params.id);

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid enclosure ID'
        });
    }

    const pets = db.prepare(`
        SELECT *
        FROM pets
        WHERE enclosure_id = ?
        ORDER BY id
    `).all(id);

    res.status(200).json(pets);
});

// --------------------------------------------------
// FEEDING RECORD MANAGEMENT
// --------------------------------------------------

// Retrieve feeding history for a pet
app.get('/pets/:id/feedings', (req, res) => {
    const petId = Number(req.params.id);

    if (!isValidId(petId)) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    const pet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(petId);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    const feedings = db.prepare(`
        SELECT * FROM feeding_records
        WHERE pet_id = ?
        ORDER BY feeding_date DESC, id DESC
    `).all(petId);

    res.status(200).json(feedings.map(formatFeeding));
});

// Register a new feeding event
app.post('/pets/:id/feedings', (req, res) => {
    const petId = Number(req.params.id);

    if (!isValidId(petId)) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    const pet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(petId);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    const { food, feeding_date, notes } = req.body || {};

    if (!isValidFeeding(food, feeding_date, notes)) {
        return res.status(400).json({
            error: 'Valid food, feeding_date (DD/MM/YYYY), and optional notes are required'
        });
    }

    const result = db.prepare(`
        INSERT INTO feeding_records (pet_id, food, feeding_date, notes)
        VALUES (?, ?, ?, ?)
    `).run(
        petId,
        food.trim(),
        toDatabaseDate(feeding_date),
        typeof notes === 'string' ? notes.trim() : null
    );

    const feeding = db.prepare(
        'SELECT * FROM feeding_records WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(formatFeeding(feeding));
});

// Retrieve a specific feeding record
app.get('/pets/:id/feedings/:feedingId', (req, res) => {
    const petId = Number(req.params.id);
    const feedingId = Number(req.params.feedingId);

    if (!isValidId(petId) || !isValidId(feedingId)) {
        return res.status(400).json({
            error: 'Invalid pet or feeding ID'
        });
    }

    const pet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(petId);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    const feeding = db.prepare(
        'SELECT * FROM feeding_records WHERE id = ? AND pet_id = ?'
    ).get(feedingId, petId);

    if (!feeding) {
        return res.status(404).json({
            error: 'Feeding record not found'
        });
    }

    res.status(200).json(formatFeeding(feeding));
});

// Update an existing feeding record
app.put('/pets/:id/feedings/:feedingId', (req, res) => {
    const petId = Number(req.params.id);
    const feedingId = Number(req.params.feedingId);

    if (!isValidId(petId) || !isValidId(feedingId)) {
        return res.status(400).json({
            error: 'Invalid pet or feeding ID'
        });
    }

    const pet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(petId);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    const feeding = db.prepare(
        'SELECT id FROM feeding_records WHERE id = ? AND pet_id = ?'
    ).get(feedingId, petId);

    if (!feeding) {
        return res.status(404).json({
            error: 'Feeding record not found'
        });
    }

    const { food, feeding_date, notes } = req.body || {};

    if (!isValidFeeding(food, feeding_date, notes)) {
        return res.status(400).json({
            error: 'Valid food, feeding_date (DD/MM/YYYY), and optional notes are required'
        });
    }

    db.prepare(`
        UPDATE feeding_records
        SET food = ?, feeding_date = ?, notes = ?
        WHERE id = ? AND pet_id = ?
    `).run(
        food.trim(),
        toDatabaseDate(feeding_date),
        typeof notes === 'string' ? notes.trim() : null,
        feedingId,
        petId
    );

    const updatedFeeding = db.prepare(
        'SELECT * FROM feeding_records WHERE id = ? AND pet_id = ?'
    ).get(feedingId, petId);

    res.status(200).json(formatFeeding(updatedFeeding));
});

// Delete an existing feeding record
app.delete('/pets/:id/feedings/:feedingId', (req, res) => {
    const petId = Number(req.params.id);
    const feedingId = Number(req.params.feedingId);

    if (!isValidId(petId) || !isValidId(feedingId)) {
        return res.status(400).json({
            error: 'Invalid pet or feeding ID'
        });
    }

    const pet = db.prepare(
        'SELECT id FROM pets WHERE id = ?'
    ).get(petId);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    const result = db.prepare(
        'DELETE FROM feeding_records WHERE id = ? AND pet_id = ?'
    ).run(feedingId, petId);

    if (result.changes === 0) {
        return res.status(404).json({
            error: 'Feeding record not found'
        });
    }

    res.status(204).send();
});

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

// Handle malformed JSON and unexpected errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'Invalid JSON'
        });
    }

    console.error(err);

    res.status(500).json({
        error: 'Internal server error'
    });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
    console.log(`Data Management Service running on port ${PORT}`);
});
