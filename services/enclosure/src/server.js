const express = require('express');
const db = require('./database');

const app = express();
const PORT = 3002;

app.use(express.json());

// Convert database fields to API format
function formatEnclosure(enclosure) {
    return {
        id: enclosure.id,
        name: enclosure.name,
        enclosureType: enclosure.enclosure_type,
        notes: enclosure.notes,
        featuredPetId: enclosure.featured_pet_id,
        monitoringMode: enclosure.monitoring_mode,
        minTemperature: enclosure.min_temperature,
        maxTemperature: enclosure.max_temperature,
        minHumidity: enclosure.min_humidity,
        maxHumidity: enclosure.max_humidity,
        isAbnormal: enclosure.is_abnormal === 1
    };
}

// Validate enclosure configuration
function validateEnclosure(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'A valid enclosure object is required';
    }

    const {
        name,
        minTemperature,
        maxTemperature,
        minHumidity,
        maxHumidity
    } = data;

    if (typeof name !== 'string' || name.trim() === '') {
        return 'A valid enclosure name is required';
    }

    const values = [
        minTemperature,
        maxTemperature,
        minHumidity,
        maxHumidity
    ];

    if (!values.every(value =>
        typeof value === 'number' && Number.isFinite(value)
    )) {
        return 'All environmental thresholds must be valid numbers';
    }

    if (minTemperature >= maxTemperature) {
        return 'Minimum temperature must be lower than maximum temperature';
    }

    if (minHumidity < 0 || maxHumidity > 100 ||
        minHumidity >= maxHumidity) {
        return 'Humidity thresholds must be between 0 and 100, with minimum lower than maximum';
    }

    if (data.enclosureType != null &&
        (typeof data.enclosureType !== 'string' ||
        !['Tropical', 'Desert', 'Temperate', 'Aquatic', 'Paludarium', 'Other'].includes(data.enclosureType))) {
        return 'Enclosure type must be a supported habitat type';
    }
    if (data.notes != null &&
        (typeof data.notes !== 'string' || data.notes.length > 2000)) {
        return 'Notes must be text containing at most 2000 characters';
    }
    if (data.monitoringMode !== undefined && !['manual', 'automatic'].includes(data.monitoringMode)) {
        return 'Monitoring mode must be manual or automatic';
    }
    if (name.trim().length > 120) return 'Enclosure name must be at most 120 characters';

    return null;
}

// Validate positive integer IDs
function isValidId(id) {
    const number = Number(id);

    return /^\d+$/.test(id) &&
        Number.isSafeInteger(number) &&
        number > 0;
}

// Select the newest observation for the selected mode, after the last mode switch.
function currentObservation(enclosure) {
    return db.prepare(`
        SELECT id, temperature, humidity, recorded_at, source
        FROM reading_history
        WHERE enclosure_id = ? AND source = ? AND id > ?
        ORDER BY recorded_at DESC, id DESC LIMIT 1
    `).get(enclosure.id, enclosure.monitoring_mode === 'automatic' ? 'sensor' : 'manual', enclosure.monitoring_start_history_id);
}

function evaluateAbnormal(observation, thresholds) {
    return observation.temperature < thresholds.min_temperature ||
        observation.temperature > thresholds.max_temperature ||
        observation.humidity < thresholds.min_humidity ||
        observation.humidity > thresholds.max_humidity;
}

function formatCurrentReading(enclosure) {
    const reading = currentObservation(enclosure);
    if (!reading) return {
        enclosureId: enclosure.id, monitoringMode: enclosure.monitoring_mode,
        temperature: null, humidity: null, recordedAt: null,
        source: null, isAbnormal: null, status: 'no_reading'
    };
    const abnormal = evaluateAbnormal(reading, enclosure);
    return {
        enclosureId: enclosure.id, monitoringMode: enclosure.monitoring_mode,
        temperature: reading.temperature, humidity: reading.humidity,
        recordedAt: reading.recorded_at.replace(' ', 'T') + 'Z',
        source: reading.source, isAbnormal: abnormal,
        status: abnormal ? 'abnormal' : 'normal'
    };
}

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'enclosure'
    });
});

// GET all enclosures
app.get('/enclosures', (req, res) => {
    const enclosures = db.prepare(`
        SELECT * FROM enclosures
        ORDER BY id
    `).all();

    res.status(200).json(
        enclosures.map(formatEnclosure)
    );
});

// GET one enclosure
app.get('/enclosures/:id', (req, res) => {
    const { id } = req.params;

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid enclosure ID'
        });
    }

    const enclosure = db.prepare(`
        SELECT * FROM enclosures WHERE id = ?
    `).get(Number(id));

    if (!enclosure) {
        return res.status(404).json({
            error: 'Enclosure not found'
        });
    }

    res.status(200).json(formatEnclosure(enclosure));
});

// Mode-aware reading for the monitoring interface; no readings from before a mode switch.
app.get('/enclosures/:id/readings/current', (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid enclosure ID' });
    const enclosure = db.prepare('SELECT * FROM enclosures WHERE id = ?').get(Number(req.params.id));
    if (!enclosure) return res.status(404).json({ error: 'Enclosure not found' });
    return res.status(200).json(formatCurrentReading(enclosure));
});

// GET the latest automatic sensor reading (manual history does not alter live status).
app.get('/enclosures/:id/readings/latest', (req, res) => {
    const { id } = req.params;

    if (!isValidId(id)) {
        return res.status(400).json({ error: 'Invalid enclosure ID' });
    }

    const enclosure = db.prepare(`
        SELECT id, is_abnormal FROM enclosures WHERE id = ?
    `).get(Number(id));

    if (!enclosure) {
        return res.status(404).json({ error: 'Enclosure not found' });
    }

    const reading = db.prepare(`
        SELECT temperature, humidity, recorded_at
        FROM readings
        WHERE enclosure_id = ?
    `).get(enclosure.id);

    if (!reading) {
        return res.status(200).json({
            enclosureId: enclosure.id,
            temperature: null,
            humidity: null,
            recordedAt: null,
            isAbnormal: null,
            status: 'no_reading'
        });
    }

    // Legacy sensor-only endpoint never reports a manual observation's status.
    const thresholds = db.prepare('SELECT * FROM enclosures WHERE id = ?').get(enclosure.id);
    const isAbnormal = evaluateAbnormal(reading, thresholds);

    res.status(200).json({
        enclosureId: enclosure.id,
        temperature: reading.temperature,
        humidity: reading.humidity,
        recordedAt: reading.recorded_at.replace(' ', 'T') + 'Z',
        isAbnormal,
        status: isAbnormal ? 'abnormal' : 'normal'
    });
});

// Choose the single illustrated occupant without changing enclosure settings.
// Fail closed if the Data Management Service cannot validate the assignment.
app.patch('/enclosures/:id/featured-pet', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid enclosure ID' });
    const enclosure = db.prepare('SELECT id FROM enclosures WHERE id = ?').get(Number(id));
    if (!enclosure) return res.status(404).json({ error: 'Enclosure not found' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !Object.hasOwn(body, 'featuredPetId') ||
        (body.featuredPetId !== null && (!Number.isSafeInteger(body.featuredPetId) || body.featuredPetId <= 0))) {
        return res.status(400).json({ error: 'featuredPetId must be a positive integer or null' });
    }
    try {
        // Validate even for null, so the service can distinguish empty occupancy from unavailable data.
        const response = await fetch(`http://localhost:3001/enclosures/${id}/pets`,
            { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return res.status(503).json({ error: 'Could not verify assigned pets' });
        const pets = await response.json();
        if (!Array.isArray(pets)) return res.status(503).json({ error: 'Invalid pets response' });
        if (body.featuredPetId !== null && !pets.some(p => p.id === body.featuredPetId)) {
            return res.status(409).json({ error: 'The selected pet is no longer assigned to this enclosure' });
        }
        db.prepare('UPDATE enclosures SET featured_pet_id = ? WHERE id = ?')
            .run(body.featuredPetId, Number(id));
        return res.status(200).json(formatEnclosure(db.prepare('SELECT * FROM enclosures WHERE id = ?').get(Number(id))));
    } catch (error) {
        console.error('Featured pet assignment verification failed:', error.message);
        return res.status(503).json({ error: 'Data Management Service unavailable' });
    }
});

// POST create enclosure
app.post('/enclosures', (req, res) => {
    const error = validateEnclosure(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    const {
        name,
        minTemperature,
        maxTemperature,
        minHumidity,
        maxHumidity,
        enclosureType = null,
        notes = null,
        monitoringMode = 'manual'
    } = req.body;

    const result = db.prepare(`
        INSERT INTO enclosures (
            name,
            min_temperature,
            max_temperature,
            min_humidity,
            max_humidity,
            enclosure_type,
            notes,
            monitoring_mode
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        name.trim(),
        minTemperature,
        maxTemperature,
        minHumidity,
        maxHumidity,
        enclosureType,
        notes == null ? null : notes.trim(),
        monitoringMode
    );

    const enclosure = db.prepare(`
        SELECT * FROM enclosures WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(formatEnclosure(enclosure));
});

// PUT update enclosure
app.put('/enclosures/:id', (req, res) => {
    const { id } = req.params;

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid enclosure ID'
        });
    }

    const error = validateEnclosure(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    const existing = db.prepare(`
        SELECT * FROM enclosures WHERE id = ?
    `).get(Number(id));

    if (!existing) {
        return res.status(404).json({
            error: 'Enclosure not found'
        });
    }

    const {
        name,
        minTemperature,
        maxTemperature,
        minHumidity,
        maxHumidity,
        enclosureType = existing.enclosure_type,
        notes = existing.notes,
        monitoringMode = existing.monitoring_mode
    } = req.body;

    // A mode switch invalidates the previous current reading, never its history.
    // Threshold edits evaluate only the active mode's current observation.
    const switching = monitoringMode !== existing.monitoring_mode;
    const newestHistoryId = db.prepare(`
        SELECT COALESCE(MAX(id), 0) AS id FROM reading_history WHERE enclosure_id = ?
    `).get(Number(id)).id;
    const boundary = switching ? newestHistoryId : existing.monitoring_start_history_id;
    const active = switching ? null : currentObservation(existing);
    const revisedThresholds = {
        min_temperature: minTemperature, max_temperature: maxTemperature,
        min_humidity: minHumidity, max_humidity: maxHumidity
    };
    const isAbnormal = active && evaluateAbnormal(active, revisedThresholds) ? 1 : 0;

    db.prepare(`
        UPDATE enclosures
        SET name = ?, min_temperature = ?, max_temperature = ?,
            min_humidity = ?, max_humidity = ?, enclosure_type = ?,
            notes = ?, monitoring_mode = ?, monitoring_start_history_id = ?,
            is_abnormal = ?
        WHERE id = ?
    `).run(name.trim(), minTemperature, maxTemperature, minHumidity,
        maxHumidity, enclosureType, notes == null ? null : notes.trim(),
        monitoringMode, boundary, isAbnormal, Number(id));

    const updated = db.prepare(`
        SELECT * FROM enclosures WHERE id = ?
    `).get(Number(id));

    res.status(200).json(formatEnclosure(updated));
});

 // DELETE enclosure
app.delete('/enclosures/:id', async (req, res) => {
    const { id } = req.params;

    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid enclosure ID'
        });
    }

    // Check whether the enclosure exists
    const enclosure = db.prepare(`
        SELECT id FROM enclosures WHERE id = ?
    `).get(Number(id));

    if (!enclosure) {
        return res.status(404).json({
            error: 'Enclosure not found'
        });
    }

    // Ask Data Management whether pets are assigned
    try {
        const response = await fetch(
            `http://localhost:3001/enclosures/${id}/pets`,
            { signal: AbortSignal.timeout(3000) }
        );

        if (!response.ok) {
            return res.status(503).json({
                error: 'Could not verify enclosure assignments'
            });
        }

        const pets = await response.json();

        if (!Array.isArray(pets)) {
            return res.status(503).json({
                error: 'Invalid response from Data Management Service'
            });
        }

        if (pets.length > 0) {
            return res.status(409).json({
                error: 'Cannot delete an enclosure with assigned pets'
            });
        }

    } catch (error) {
        console.error('Failed to check enclosure assignments:', error.message);

        return res.status(503).json({
            error: 'Data Management Service unavailable'
        });
    }

    // Delete the enclosure only if it has no assigned pets
    db.prepare(`
        DELETE FROM enclosures WHERE id = ?
    `).run(Number(id));

    res.status(204).send();
});

// POST new sensor reading
app.post('/readings', async (req, res) => {
    const { enclosureId, temperature, humidity } = req.body || {};

    // Validate input
    if (!Number.isSafeInteger(enclosureId) || enclosureId <= 0 ||
        typeof temperature !== 'number' || !Number.isFinite(temperature) ||
        typeof humidity !== 'number' || !Number.isFinite(humidity) ||
        humidity < 0 || humidity > 100) {

        return res.status(400).json({
            error: 'Invalid sensor reading'
        });
    }

    // Find the enclosure
    const enclosure = db.prepare(`
        SELECT * FROM enclosures WHERE id = ?
    `).get(enclosureId);

    if (!enclosure) {
        return res.status(404).json({
            error: 'Enclosure not found'
        });
    }

    if (enclosure.monitoring_mode !== 'automatic') {
        return res.status(409).json({ error: 'Enclosure is configured for manual monitoring' });
    }

    // Check environmental thresholds
    const temperatureLow = temperature < enclosure.min_temperature;
    const temperatureHigh = temperature > enclosure.max_temperature;
    const humidityLow = humidity < enclosure.min_humidity;
    const humidityHigh = humidity > enclosure.max_humidity;

    const isAbnormal =
        temperatureLow || temperatureHigh ||
        humidityLow || humidityHigh;

    // Previous state, needed for notifications later
    const wasAbnormal = enclosure.is_abnormal === 1;


    // Store the reading and update the state atomically
    try {
        db.exec('BEGIN TRANSACTION');

        db.prepare(`
            INSERT INTO readings (
                enclosure_id,
                temperature,
                humidity,
                recorded_at
            )
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(enclosure_id) DO UPDATE SET
                temperature = excluded.temperature,
                humidity = excluded.humidity,
                recorded_at = CURRENT_TIMESTAMP
        `).run(enclosureId, temperature, humidity);

        // Preserve this measurement in environmental history
        db.prepare(`
            INSERT INTO reading_history (
                enclosure_id,
                temperature,
                humidity,
                source
            )
            VALUES (?, ?, ?, 'sensor')
        `).run(enclosureId, temperature, humidity);

        db.prepare(`
            UPDATE enclosures
            SET is_abnormal = ?
            WHERE id = ?
        `).run(isAbnormal ? 1 : 0, enclosureId);

        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');

        console.error('Failed to save sensor reading:', error);

        return res.status(500).json({
            error: 'Failed to save sensor reading'
        });
    }


    // Identify a transition from normal to abnormal
    const newAlert = isAbnormal && !wasAbnormal;

    let alertSent = false;

    // Notify only when changing from normal to abnormal
    if (newAlert) {
        const problems = [];

        if (temperatureLow) {
            problems.push('Temperature too low');
        }

        if (temperatureHigh) {
            problems.push('Temperature too high');
        }

        if (humidityLow) {
            problems.push('Humidity too low');
        }

        if (humidityHigh) {
            problems.push('Humidity too high');
        }

        const alert = {
            enclosureId,
            temperature,
            humidity,
            message: problems.join(' and ')
        };

        try {
            const response = await fetch(
                'http://localhost:3004/alerts',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(alert),
                    signal: AbortSignal.timeout(3000)
                }
            );

            if (response.ok) {
                alertSent = true;
                console.log('Alert sent to Notification Service');
            } else {
                console.error(
                    `Notification Service returned HTTP ${response.status}`
                );
            }
        } catch (error) {
            console.error(
                'Notification Service unavailable:',
                error.message
            );
        }
    }

    res.status(201).json({
        enclosureId,
        temperature,
        humidity,
        isAbnormal,
        newAlert,
        alertSent
    });

});

 // POST manual historical reading
app.post('/enclosures/:id/readings/manual', (req, res) => {
    const { id } = req.params;

    // Validate enclosure ID
    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid enclosure ID'
        });
    }

    const { temperature, humidity, recordedAt } = req.body || {};

    // Validate environmental measurements
    if (typeof temperature !== 'number' ||
        !Number.isFinite(temperature) ||
        typeof humidity !== 'number' ||
        !Number.isFinite(humidity) ||
        humidity < 0 || humidity > 100) {

        return res.status(400).json({
            error: 'Invalid environmental measurements'
        });
    }

    // Require a UTC timestamp with seconds
    if (typeof recordedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(recordedAt)) {

        return res.status(400).json({
            error: 'recordedAt must use YYYY-MM-DDTHH:mm:ssZ'
        });
    }

    const date = new Date(recordedAt);

    // Reject impossible dates and future observations
    if (Number.isNaN(date.getTime()) ||
        date.toISOString().replace('.000Z', 'Z') !== recordedAt ||
        date.getTime() > Date.now()) {

        return res.status(400).json({
            error: 'Invalid or future measurement date'
        });
    }

    const enclosure = db.prepare('SELECT * FROM enclosures WHERE id = ?').get(Number(id));
    if (!enclosure) return res.status(404).json({ error: 'Enclosure not found' });

    const databaseDate = recordedAt.replace('T', ' ').replace('Z', '');
    try {
        db.exec('BEGIN TRANSACTION');
        const result = db.prepare(`
            INSERT INTO reading_history (enclosure_id, temperature, humidity, recorded_at, source)
            VALUES (?, ?, ?, ?, 'manual')
        `).run(Number(id), temperature, humidity, databaseDate);

        if (enclosure.monitoring_mode === 'manual') {
            const current = currentObservation(enclosure);
            db.prepare('UPDATE enclosures SET is_abnormal = ? WHERE id = ?')
                .run(current && evaluateAbnormal(current, enclosure) ? 1 : 0, Number(id));
        }
        db.exec('COMMIT');
        res.status(201).json({
            id: Number(result.lastInsertRowid), enclosureId: Number(id),
            temperature, humidity, recordedAt, source: 'manual'
        });
    } catch (error) {
        db.exec('ROLLBACK');
        console.error('Failed to save manual reading:', error);
        return res.status(500).json({ error: 'Failed to save manual reading' });
    }
});

 // GET environmental reading history
app.get('/enclosures/:id/readings/history', (req, res) => {
    const { id } = req.params;

    // Validate enclosure ID
    if (!isValidId(id)) {
        return res.status(400).json({
            error: 'Invalid enclosure ID'
        });
    }

    // Validate result limit
    const limit = req.query.limit === undefined
        ? 100
        : Number(req.query.limit);

    if (!Number.isSafeInteger(limit) ||
        limit < 1 || limit > 1000) {

        return res.status(400).json({
            error: 'Limit must be an integer between 1 and 1000'
        });
    }

    const { from, to } = req.query;

    // Validate calendar dates in YYYY-MM-DD format
    function isValidDate(value) {
        if (typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        const date = new Date(value + 'T00:00:00Z');

        return !Number.isNaN(date.getTime()) &&
            date.toISOString().slice(0, 10) === value;
    }

    if ((from !== undefined && !isValidDate(from)) ||
        (to !== undefined && !isValidDate(to))) {

        return res.status(400).json({
            error: 'Dates must be valid and use YYYY-MM-DD'
        });
    }

    // Ensure the starting date is not after the ending date
    if (from && to && from > to) {
        return res.status(400).json({
            error: 'From date must not be after to date'
        });
    }

    // Verify that the enclosure exists
    const enclosure = db.prepare(`
        SELECT id FROM enclosures WHERE id = ?
    `).get(Number(id));

    if (!enclosure) {
        return res.status(404).json({
            error: 'Enclosure not found'
        });
    }

    // Build the query using optional date filters
    let query = `
        SELECT
            id,
            enclosure_id,
            temperature,
            humidity,
            recorded_at,
            source
        FROM reading_history
        WHERE enclosure_id = ?
    `;

    const parameters = [Number(id)];

    if (from) {
        query += ' AND recorded_at >= ?';
        parameters.push(from + ' 00:00:00');
    }

    if (to) {
        query += ' AND recorded_at <= ?';
        parameters.push(to + ' 23:59:59');
    }

    query += `
        ORDER BY recorded_at DESC, id DESC
        LIMIT ?
    `;

    parameters.push(limit);

    const readings = db.prepare(query).all(...parameters);

    // Convert database fields to API format
    const history = readings.map(reading => ({
        id: reading.id,
        enclosureId: reading.enclosure_id,
        temperature: reading.temperature,
        humidity: reading.humidity,
        recordedAt: reading.recorded_at.replace(' ', 'T') + 'Z',
        source: reading.source
    }));

    res.status(200).json(history);
});

// Handle malformed JSON
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 &&
        'body' in err) {
        return res.status(400).json({
            error: 'Malformed JSON'
        });
    }

    next(err);
});

// Start server
app.listen(PORT, () => {
    console.log(`Enclosure Service running on port ${PORT}`);
});

