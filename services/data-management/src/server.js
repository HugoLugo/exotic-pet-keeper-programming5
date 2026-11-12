const express = require('express');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'data-management'
    });
});

// Retrieve all registered pets
app.get('/pets', (req, res) => {
    const pets = db.prepare('SELECT * FROM pets').all();

    res.status(200).json(pets);
});

// Register a new pet
app.post('/pets', (req, res) => {
    const { name, species } = req.body;

    // Validate required information
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

    // Insert the pet into SQLite
    const result = db.prepare(
        'INSERT INTO pets (name, species) VALUES (?, ?)'
    ).run(name.trim(), species.trim());

    // Retrieve the newly created pet
    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(pet);
});

// Retrieve a specific pet by ID
app.get('/pets/:id', (req, res) => {
    const id = Number(req.params.id);

    // Validate the ID
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    // Search for the pet in SQLite
    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(id);

    // Check if the pet exists
    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    res.status(200).json(pet);
});

// Update an existing pet
app.put('/pets/:id', (req, res) => {
    const id = Number(req.params.id);

    // Validate the pet ID
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    const { name, species } = req.body;

    // Validate the new information
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

    // Update the pet in SQLite
    const result = db.prepare(
        'UPDATE pets SET name = ?, species = ? WHERE id = ?'
    ).run(name.trim(), species.trim(), id);

    // Check whether the pet exists
    if (result.changes === 0) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    // Retrieve the updated pet
    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(id);

    res.status(200).json(pet);
});

// Delete an existing pet
app.delete('/pets/:id', (req, res) => {
    const id = Number(req.params.id);

    // Validate the pet ID
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Invalid pet ID'
        });
    }

    // Check if the pet exists
    const pet = db.prepare(
        'SELECT * FROM pets WHERE id = ?'
    ).get(id);

    if (!pet) {
        return res.status(404).json({
            error: 'Pet not found'
        });
    }

    // Check whether the pet has feeding records
    const feedingRecord = db.prepare(
        'SELECT id FROM feeding_records WHERE pet_id = ? LIMIT 1'
    ).get(id);

    if (feedingRecord) {
        return res.status(409).json({
            error: 'Cannot delete a pet with feeding records'
        });
    }

    // Delete the pet
    db.prepare('DELETE FROM pets WHERE id = ?').run(id);

    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`Data Management Service running on port ${PORT}`);
});