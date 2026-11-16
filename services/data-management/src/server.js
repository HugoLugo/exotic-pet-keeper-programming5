
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

// Display names are snapshots. Failure to look up an old enclosure never invents
// an occupancy period; the stable ID remains available in the event.
async function enclosureSnapshotName(id) {
    if (id === null) return 'Unassigned';
    try {
        const response = await fetch(`http://localhost:3002/enclosures/${id}`, {signal: AbortSignal.timeout(3000)});
        if (response.ok) {
            const value = await response.json();
            if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
        }
    } catch (err) {
        console.warn('Could not resolve enclosure name for event:', err.message);
    }
    return `Enclosure #${id}`;
}

function formatEnclosureChange(row) {
    const instant = new Date(row.occurred_at);
    return {
        id: `change-${row.id}`, pet_id: row.pet_id, event_type: 'enclosure_change',
        event_date: `${instant.getFullYear()}-${String(instant.getMonth()+1).padStart(2,'0')}-${String(instant.getDate()).padStart(2,'0')}`,
        event_time: `${String(instant.getHours()).padStart(2,'0')}:${String(instant.getMinutes()).padStart(2,'0')}`,
        utc_offset_minutes: -instant.getTimezoneOffset(),
        description: `Assignment changed from ${row.previous_enclosure_name} to ${row.new_enclosure_name}.`,
        previous_enclosure_id: row.previous_enclosure_id,
        previous_enclosure_name: row.previous_enclosure_name,
        new_enclosure_id: row.new_enclosure_id,
        new_enclosure_name: row.new_enclosure_name,
        automatic: true, occurred_at: row.occurred_at,
        notes: null, molt_outcome: null, molt_stage: null, weight_g: null,
        length_cm: null, length_method: null, temperature_c: null, humidity_pct: null
    };
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

const EVENT_TYPES = new Set(['molting','weight','length','behavior','health','husbandry','other']);
const MOLT_OUTCOMES = new Set(['successful','incomplete','difficulty_observed','unknown']);
const MOLT_STAGES = new Set(['pre_molt','molt_observed']);
const LENGTH_METHODS = new Set(['body','total','diagonal','shed','other']);
const FEEDING_OUTCOMES = new Set(['recorded','accepted','refused']);
function validateFeedingObservations(input) {
    const {feeding_time=null,temperature_c=null,humidity_pct=null} = input || {};
    if (feeding_time !== null && (typeof feeding_time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(feeding_time))) return 'Feeding time must be HH:MM or omitted';
    if (temperature_c !== null && (typeof temperature_c !== 'number' || !Number.isFinite(temperature_c) || temperature_c < -50 || temperature_c > 100)) return 'Temperature must be between -50 and 100 °C';
    if (humidity_pct !== null && (typeof humidity_pct !== 'number' || !Number.isFinite(humidity_pct) || humidity_pct < 0 || humidity_pct > 100)) return 'Humidity must be between 0 and 100%';
    return null;
}
function validOutcome(value) { return FEEDING_OUTCOMES.has(value); }
function validateAnimalEvent(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Invalid event data';
    const {event_type,event_date,event_time=null,utc_offset_minutes=null,description=null,molt_outcome=null,weight_g=null,notes=null,molt_stage=null,temperature_c=null,humidity_pct=null,length_cm=null,length_method=null} = input;
    if (!EVENT_TYPES.has(event_type)) return 'Select a valid event type';
    if (typeof event_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event_date) ||
        !isValidDate(`${event_date.slice(8,10)}/${event_date.slice(5,7)}/${event_date.slice(0,4)}`) ||
        event_date > new Date().toISOString().slice(0,10)) return 'Enter a valid observation date that is not in the future';
    if (event_time !== null && (typeof event_time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event_time))) return 'Time must be HH:MM or omitted';
    if (utc_offset_minutes !== null && (!Number.isInteger(utc_offset_minutes) || Math.abs(utc_offset_minutes)>840 || event_time===null)) return 'Invalid time-zone offset';
    if (description !== null && (typeof description !== 'string' || description.length>2000)) return 'Description must be at most 2000 characters';
    if (notes !== null && (typeof notes !== 'string' || notes.length>2000)) return 'Notes must be at most 2000 characters';
    if (event_type==='molting') {
        if (molt_stage!==null && !MOLT_STAGES.has(molt_stage)) return 'Select a valid shedding stage';
        if (molt_stage==='pre_molt') {
            if (molt_outcome!==null) return 'Pre-molt observations cannot have a completed shedding outcome';
        } else if (!MOLT_OUTCOMES.has(molt_outcome)) return 'Select an observed shedding outcome';
    } else if (molt_outcome!==null || molt_stage!==null) return 'Shedding fields are only for molting events';
    if (temperature_c!==null && (typeof temperature_c!=='number' || !Number.isFinite(temperature_c) || temperature_c< -50 || temperature_c>100)) return 'Temperature must be between -50 and 100 °C or omitted';
    if (humidity_pct!==null && (typeof humidity_pct!=='number' || !Number.isFinite(humidity_pct) || humidity_pct<0 || humidity_pct>100)) return 'Humidity must be between 0 and 100% or omitted';
    if (event_type==='weight') {
        if (typeof weight_g!=='number' || !Number.isFinite(weight_g) || weight_g<=0 || weight_g>1000000) return 'Enter a positive, valid weight in grams';
    } else if (weight_g!==null) return 'Weight is only for weight events';
    if (event_type==='length') {
        if (typeof length_cm!=='number' || !Number.isFinite(length_cm) || length_cm<=0 || length_cm>10000) return 'Enter a positive length up to 10,000 cm';
        if (!LENGTH_METHODS.has(length_method)) return 'Select a length measurement method';
    } else if (length_cm!==null || length_method!==null) return 'Length fields are only for length events';
    if (!['molting','weight','length'].includes(event_type) && (!description || !description.trim())) return 'An observation description is required';
    return null;
}
function eventValues(input) {
    return [input.event_type,input.event_date,input.event_time||null,input.utc_offset_minutes??null,
        input.description?.trim()||null,input.molt_outcome||null,input.weight_g??null,input.notes?.trim()||null,
        input.molt_stage??null,input.temperature_c??null,input.humidity_pct??null,input.length_cm??null,input.length_method??null];
}
function lookupEventPet(req,res) {
    const petId=Number(req.params.id);
    if (!isValidId(petId)) {res.status(400).json({error:'Invalid pet ID'});return null;}
    if (!db.prepare('SELECT id FROM pets WHERE id = ?').get(petId)) {res.status(404).json({error:'Pet not found'});return null;}
    return petId;
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

// Stable identifiers for approved frontend illustration assets. Store keys, never paths.
const APPROVED_ILLUSTRATIONS = new Set([
    'gecko', 'python', 'tarantula', 'scorpion'
]);

function isValidIllustrationKey(value) {
    return value === null || (
        typeof value === 'string' && APPROVED_ILLUSTRATIONS.has(value)
    );
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
        date_of_birth = null, notes = null, illustration_key = null } = req.body || {};

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

    if (!isValidIllustrationKey(illustration_key)) {
        return res.status(400).json({
            error: 'illustration_key must be gecko, python, tarantula, scorpion, or null'
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
        INSERT INTO pets (name, species, enclosure_id, gender, date_of_birth, notes, illustration_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), species.trim(), enclosure_id, gender, date_of_birth,
        typeof notes === 'string' ? notes.trim() : null, illustration_key);

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
        date_of_birth = null, notes = null, illustration_key } = req.body || {};

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
        'SELECT * FROM pets WHERE id = ?'
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

    // Omitted key keeps the existing choice for older clients; null clears it.
    const selectedIllustration = illustration_key === undefined
        ? existingPet.illustration_key
        : illustration_key;

    if (!isValidIllustrationKey(selectedIllustration)) {
        return res.status(400).json({
            error: 'illustration_key must be gecko, python, tarantula, scorpion, or null'
        });
    }

    // Validate the new enclosure assignment
    const enclosureError = await validateEnclosureAssignment(enclosure_id);

    if (enclosureError) {
        return res.status(enclosureError.status).json({
            error: enclosureError.error
        });
    }

    const previousId = existingPet.enclosure_id == null ? null : Number(existingPet.enclosure_id);
    const nextId = enclosure_id == null ? null : Number(enclosure_id);
    const changed = previousId !== nextId;
    // Resolve descriptions before beginning the database transaction.
    const previousName = changed ? await enclosureSnapshotName(previousId) : null;
    const nextName = changed ? await enclosureSnapshotName(nextId) : null;
    try {
        db.exec('BEGIN IMMEDIATE');
        // Avoid recording a misleading event when concurrent requests race.
        const current = db.prepare('SELECT enclosure_id FROM pets WHERE id = ?').get(id);
        if (!current) { db.exec('ROLLBACK'); return res.status(404).json({error:'Pet not found'}); }
        if ((current.enclosure_id == null ? null : Number(current.enclosure_id)) !== previousId) {
            db.exec('ROLLBACK');
            return res.status(409).json({error:'Enclosure assignment changed during this request; refresh and retry.'});
        }
        db.prepare(`
            UPDATE pets
            SET name = ?, species = ?, enclosure_id = ?, gender = ?,
                date_of_birth = ?, notes = ?, illustration_key = ?
            WHERE id = ?
        `).run(name.trim(), species.trim(), nextId, gender, date_of_birth,
            typeof notes === 'string' ? notes.trim() : null, selectedIllustration, id);
        if (changed) {
            db.prepare(`INSERT INTO enclosure_change_events
                (pet_id, previous_enclosure_id, previous_enclosure_name, new_enclosure_id, new_enclosure_name, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
                .run(id, previousId, previousName, nextId, nextName, new Date().toISOString());
        }
        db.exec('COMMIT');
    } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
    }

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
        db.prepare('DELETE FROM feeding_group_members WHERE pet_id = ?').run(id);
        db.prepare('DELETE FROM feeding_records WHERE pet_id = ?').run(id);
        db.prepare('DELETE FROM animal_events WHERE pet_id = ?').run(id);
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
// FEEDING GROUPS + ATOMIC QUICK FEEDING (STAGE 3C)
// --------------------------------------------------

function feedingGroupDetails(group) {
    const members = db.prepare(`
        SELECT p.id, p.name, p.species FROM feeding_group_members m
        JOIN pets p ON p.id = m.pet_id WHERE m.group_id = ?
        ORDER BY LOWER(p.name), p.id
    `).all(group.id);
    return { ...group, members, pet_ids: members.map(p => p.id) };
}

function parseGroupBody(body) {
    const { name, pet_ids } = body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        return { error: 'Group name must be 1–100 characters' };
    }
    if (!Array.isArray(pet_ids) || pet_ids.length > 500 ||
        !pet_ids.every(isValidId) || new Set(pet_ids).size !== pet_ids.length) {
        return { error: 'pet_ids must be an array of unique, positive integer pet IDs (maximum 500)' };
    }
    const findPet = db.prepare('SELECT id FROM pets WHERE id = ?');
    if (!pet_ids.every(id => !!findPet.get(id))) {
        return { error: 'One or more pets do not exist' };
    }
    return { name: name.trim(), pet_ids };
}

app.get('/feeding-groups', (req, res) => {
    const groups = db.prepare('SELECT * FROM feeding_groups ORDER BY LOWER(name), id').all();
    res.json(groups.map(feedingGroupDetails));
});

app.post('/feeding-groups', (req, res) => {
    const input = parseGroupBody(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    let groupId;
    try {
        db.exec('BEGIN IMMEDIATE');
        groupId = Number(db.prepare('INSERT INTO feeding_groups (name) VALUES (?)').run(input.name).lastInsertRowid);
        const add = db.prepare('INSERT INTO feeding_group_members (group_id, pet_id) VALUES (?, ?)');
        for (const petId of input.pet_ids) add.run(groupId, petId);
        db.exec('COMMIT');
    } catch (err) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw err;
    }
    res.status(201).json(feedingGroupDetails(db.prepare('SELECT * FROM feeding_groups WHERE id = ?').get(groupId)));
});

app.put('/feeding-groups/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid group ID' });
    if (!db.prepare('SELECT id FROM feeding_groups WHERE id = ?').get(id)) return res.status(404).json({ error: 'Group not found' });
    const input = parseGroupBody(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    try {
        db.exec('BEGIN IMMEDIATE');
        db.prepare('UPDATE feeding_groups SET name = ? WHERE id = ?').run(input.name, id);
        db.prepare('DELETE FROM feeding_group_members WHERE group_id = ?').run(id);
        const add = db.prepare('INSERT INTO feeding_group_members (group_id, pet_id) VALUES (?, ?)');
        for (const petId of input.pet_ids) add.run(id, petId);
        db.exec('COMMIT');
    } catch (err) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw err;
    }
    res.json(feedingGroupDetails(db.prepare('SELECT * FROM feeding_groups WHERE id = ?').get(id)));
});

app.delete('/feeding-groups/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid group ID' });
    const result = db.prepare('DELETE FROM feeding_groups WHERE id = ?').run(id);
    if (!result.changes) return res.status(404).json({ error: 'Group not found' });
    res.status(204).send();
});

app.post('/feedings/bulk', (req, res) => {
    const { pet_ids, food, feeding_date, notes, refused_pet_ids = [], feeding_time = null } = req.body || {};
    const observationError = validateFeedingObservations({feeding_time});
    if (observationError) return res.status(400).json({error:observationError});
    if (!Array.isArray(pet_ids) || !pet_ids.length || pet_ids.length > 500 ||
        !pet_ids.every(isValidId) || new Set(pet_ids).size !== pet_ids.length) {
        return res.status(400).json({ error: 'Select 1–500 unique, valid pet IDs' });
    }
    if (!Array.isArray(refused_pet_ids) || new Set(refused_pet_ids).size !== refused_pet_ids.length ||
        !refused_pet_ids.every(id => isValidId(id) && pet_ids.includes(id))) {
        return res.status(400).json({ error: 'Refused animals must be a unique subset of the selected pets' });
    }
    if (!isValidFeeding(food, feeding_date, notes)) {
        return res.status(400).json({ error: 'Valid food, feeding_date (DD/MM/YYYY), and optional notes are required' });
    }
    const findPet = db.prepare('SELECT id FROM pets WHERE id = ?');
    if (!pet_ids.every(id => !!findPet.get(id))) {
        return res.status(400).json({ error: 'One or more selected pets do not exist. Refresh the list and try again.' });
    }
    const createdIds = [];
    try {
        db.exec('BEGIN IMMEDIATE');
        const insert = db.prepare("INSERT INTO feeding_records (pet_id, food, feeding_date, notes, feeding_outcome, feeding_time, entry_source) VALUES (?, ?, ?, ?, ?, ?, 'quick')");
        for (const petId of pet_ids) {
            const result = insert.run(petId, food.trim(), toDatabaseDate(feeding_date), typeof notes === 'string' ? notes.trim() : null, refused_pet_ids.includes(petId) ? 'refused' : 'accepted', feeding_time);
            createdIds.push(Number(result.lastInsertRowid));
        }
        db.exec('COMMIT');
    } catch (err) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw err;
    }
    const find = db.prepare('SELECT * FROM feeding_records WHERE id = ?');
    res.status(201).json({ count: createdIds.length, records: createdIds.map(id => formatFeeding(find.get(id))) });
});

app.get('/feedings/recent', (req, res) => {
    const records = db.prepare(`
        SELECT f.*, p.name AS pet_name FROM feeding_records f
        JOIN pets p ON p.id = f.pet_id
        ORDER BY f.feeding_date DESC, COALESCE(NULLIF(f.feeding_time, ''), '00:00:00') DESC, f.id DESC LIMIT 50
    `).all();
    res.json(records.map(formatFeeding));
});

// --------------------------------------------------
// ANIMAL EVENTS — each event belongs to one animal.
// --------------------------------------------------
app.get('/pets/:id/events', (req,res) => {
    const petId=lookupEventPet(req,res); if (petId===null) return;
    const observations = db.prepare('SELECT * FROM animal_events WHERE pet_id=?').all(petId);
    const changes = db.prepare('SELECT * FROM enclosure_change_events WHERE pet_id=?').all(petId).map(formatEnclosureChange);
    res.json([...observations, ...changes].sort((a,b) =>
        b.event_date.localeCompare(a.event_date) ||
        (b.event_time || '').localeCompare(a.event_time || '') ||
        String(b.id).localeCompare(String(a.id))));
});
app.post('/pets/:id/events', (req,res) => {
    const petId=lookupEventPet(req,res); if (petId===null) return;
    const error=validateAnimalEvent(req.body);if(error)return res.status(400).json({error});
    const result=db.prepare(`INSERT INTO animal_events (pet_id,event_type,event_date,event_time,utc_offset_minutes,description,molt_outcome,weight_g,notes,molt_stage,temperature_c,humidity_pct,length_cm,length_method)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(petId,...eventValues(req.body));
    res.status(201).json(db.prepare('SELECT * FROM animal_events WHERE id=?').get(result.lastInsertRowid));
});
app.get('/pets/:id/events/:eventId',(req,res)=>{
    const petId=lookupEventPet(req,res);if(petId===null)return;
    const eventId=Number(req.params.eventId);if(!isValidId(eventId))return res.status(400).json({error:'Invalid event ID'});
    const record=db.prepare('SELECT * FROM animal_events WHERE pet_id=? AND id=?').get(petId,eventId);
    if(!record)return res.status(404).json({error:'Animal event not found'});
    res.json(record);
});
app.put('/pets/:id/events/:eventId',(req,res)=>{
    const petId=lookupEventPet(req,res);if(petId===null)return;
    const eventId=Number(req.params.eventId);if(!isValidId(eventId))return res.status(400).json({error:'Invalid event ID'});
    if(!db.prepare('SELECT id FROM animal_events WHERE pet_id=? AND id=?').get(petId,eventId))return res.status(404).json({error:'Animal event not found'});
    const error=validateAnimalEvent(req.body);if(error)return res.status(400).json({error});
    db.prepare(`UPDATE animal_events SET event_type=?,event_date=?,event_time=?,utc_offset_minutes=?,description=?,molt_outcome=?,weight_g=?,notes=?,molt_stage=?,temperature_c=?,humidity_pct=?,length_cm=?,length_method=?,updated_at=CURRENT_TIMESTAMP
        WHERE pet_id=? AND id=?`).run(...eventValues(req.body),petId,eventId);
    res.json(db.prepare('SELECT * FROM animal_events WHERE pet_id=? AND id=?').get(petId,eventId));
});
app.delete('/pets/:id/events/:eventId',(req,res)=>{
    const petId=lookupEventPet(req,res);if(petId===null)return;
    const eventId=Number(req.params.eventId);if(!isValidId(eventId))return res.status(400).json({error:'Invalid event ID'});
    const result=db.prepare('DELETE FROM animal_events WHERE pet_id=? AND id=?').run(petId,eventId);
    if(!result.changes)return res.status(404).json({error:'Animal event not found'});
    res.status(204).send();
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

    const { food, feeding_date, notes, feeding_outcome = 'recorded', feeding_time = null, temperature_c = null, humidity_pct = null } = req.body || {};

    const observationError = validateFeedingObservations({feeding_time,temperature_c,humidity_pct});
    if (observationError) return res.status(400).json({error:observationError});

    if (!validOutcome(feeding_outcome)) return res.status(400).json({error:'Invalid feeding outcome'});
    if (!isValidFeeding(food, feeding_date, notes)) {
        return res.status(400).json({
            error: 'Valid food, feeding_date (DD/MM/YYYY), and optional notes are required'
        });
    }

    const result = db.prepare(`
        INSERT INTO feeding_records (pet_id, food, feeding_date, notes, feeding_outcome, feeding_time, temperature_c, humidity_pct, entry_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'individual')
    `).run(
        petId,
        food.trim(),
        toDatabaseDate(feeding_date),
        typeof notes === 'string' ? notes.trim() : null,
        feeding_outcome,
        feeding_time, temperature_c, humidity_pct
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

    const { food, feeding_date, notes, feeding_outcome = 'recorded', feeding_time = null, temperature_c = null, humidity_pct = null } = req.body || {};

    const observationError = validateFeedingObservations({feeding_time,temperature_c,humidity_pct});
    if (observationError) return res.status(400).json({error:observationError});

    if (!validOutcome(feeding_outcome)) return res.status(400).json({error:'Invalid feeding outcome'});
    if (!isValidFeeding(food, feeding_date, notes)) {
        return res.status(400).json({
            error: 'Valid food, feeding_date (DD/MM/YYYY), and optional notes are required'
        });
    }

    db.prepare(`
        UPDATE feeding_records
        SET food = ?, feeding_date = ?, notes = ?, feeding_outcome = ?, feeding_time = ?, temperature_c = ?, humidity_pct = ?
        WHERE id = ? AND pet_id = ?
    `).run(
        food.trim(),
        toDatabaseDate(feeding_date),
        typeof notes === 'string' ? notes.trim() : null,
        feeding_outcome,
        feeding_time, temperature_c, humidity_pct,
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
