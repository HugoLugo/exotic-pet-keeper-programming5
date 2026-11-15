
const express = require('express');
const http = require('node:http');
const WebSocket = require('ws');
const { randomUUID } = require('node:crypto');

const app = express();
const PORT = 3004;

app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the same port
const wss = new WebSocket.Server({ server });

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'notification'
    });
});

// Receive environmental alerts
app.post('/alerts', (req, res) => {
    const {
        enclosureId,
        temperature,
        humidity,
        message, source, status, problems, enclosureName, recordedAt
    } = req.body || {};

    if (!Number.isSafeInteger(enclosureId) ||
        enclosureId <= 0 ||
        typeof temperature !== 'number' ||
        !Number.isFinite(temperature) ||
        typeof humidity !== 'number' ||
        !Number.isFinite(humidity) ||
        humidity < 0 || humidity > 100 ||
        typeof message !== 'string' ||
        message.trim() === '' ||
        (source !== undefined && !['sensor', 'manual'].includes(source)) ||
        (status !== undefined && !['abnormal', 'recovered'].includes(status)) ||
        (enclosureName !== undefined && (typeof enclosureName !== 'string' || enclosureName.trim().length > 120)) ||
        (problems !== undefined && (!Array.isArray(problems) || problems.length > 4 ||
            !problems.every(p => ['Temperature too low', 'Temperature too high', 'Humidity too low', 'Humidity too high'].includes(p)))) ||
        (recordedAt !== undefined && (typeof recordedAt !== 'string' ||
            !Number.isFinite(Date.parse(recordedAt)))) ) {

        return res.status(400).json({
            error: 'Invalid alert data'
        });
    }

    const alert = {
        type: 'environment_alert',
        enclosureId,
        message: message.trim(),
        temperature,
        humidity,
        eventId: randomUUID(),
        source: source || 'sensor',
        status: status || 'abnormal',
        enclosureName: enclosureName?.trim() || `Enclosure ${enclosureId}`,
        problems: problems || [],
        recordedAt: recordedAt || new Date().toISOString(),
        emittedAt: new Date().toISOString()
    };

    // Send alert to all connected WebSocket clients
    const payload = JSON.stringify(alert);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });

    res.status(200).json({
        message: 'Alert received and broadcast',
        connectedClients: [...wss.clients].filter(
            client => client.readyState === WebSocket.OPEN
        ).length
    });
});

// Handle malformed JSON
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError &&
        err.status === 400 &&
        'body' in err) {

        return res.status(400).json({
            error: 'Malformed JSON'
        });
    }

    next(err);
});

// WebSocket connection tracking
wss.on('connection', ws => {
    console.log('WebSocket client connected');

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Notification Service running on port ${PORT}`);
});
