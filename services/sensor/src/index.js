
const ENCLOSURE_URL = 'http://localhost:3002';

const enclosureId = Number(process.env.ENCLOSURE_ID || 1);
const interval = Number(process.env.SENSOR_INTERVAL_MS || 5000);

// Validate configuration
if (!Number.isSafeInteger(enclosureId) || enclosureId <= 0) {
    console.error('ENCLOSURE_ID must be a positive integer');
    process.exit(1);
}

if (!Number.isSafeInteger(interval) || interval < 1000) {
    console.error('SENSOR_INTERVAL_MS must be at least 1000');
    process.exit(1);
}

// Repeatable sensor simulation
const scenarios = [
    'normal',
    'hot',
    'hot',
    'normal',
    'dry',
    'dry'
];

let scenarioIndex = 0;

// Generate measurements based on enclosure thresholds
function generateReading(enclosure, scenario) {
    const temperature = (
        enclosure.minTemperature + enclosure.maxTemperature
    ) / 2;

    const humidity = (
        enclosure.minHumidity + enclosure.maxHumidity
    ) / 2;

    if (scenario === 'hot') {
        return {
            enclosureId,
            temperature: enclosure.maxTemperature + 2,
            humidity
        };
    }

    if (scenario === 'dry') {
        return {
            enclosureId,
            temperature,
            humidity: Math.max(0, enclosure.minHumidity - 5)
        };
    }

    return {
        enclosureId,
        temperature,
        humidity
    };
}

// Execute one sensor cycle
async function runCycle() {
    try {
        // Get the latest enclosure thresholds
        const enclosureResponse = await fetch(
            `${ENCLOSURE_URL}/enclosures/${enclosureId}`,
            { signal: AbortSignal.timeout(3000) }
        );

        if (!enclosureResponse.ok) {
            throw new Error(
                `Failed to get enclosure: HTTP ${enclosureResponse.status}`
            );
        }

        const enclosure = await enclosureResponse.json();

        const scenario = scenarios[scenarioIndex];
        const reading = generateReading(enclosure, scenario);

        // Send simulated measurement
        const response = await fetch(
            `${ENCLOSURE_URL}/readings`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reading),
                signal: AbortSignal.timeout(3000)
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to send reading: HTTP ${response.status}`
            );
        }

        const result = await response.json();

        console.log(
            `[${scenario.toUpperCase()}] ` +
            `Enclosure ${enclosureId} | ` +
            `${reading.temperature.toFixed(1)}°C | ` +
            `${reading.humidity.toFixed(1)}% | ` +
            `Abnormal: ${result.isAbnormal} | ` +
            `New alert: ${result.newAlert} | ` +
            `Alert sent: ${result.alertSent}`
        );

        // Advance only after a successful reading
        scenarioIndex = (scenarioIndex + 1) % scenarios.length;

    } catch (error) {
        console.error('Sensor cycle failed:', error.message);
    } finally {
        // Schedule the next cycle, even after a failure
        setTimeout(runCycle, interval);
    }
}

console.log('Sensor Service started');
console.log(`Enclosure ID: ${enclosureId}`);
console.log(`Interval: ${interval} ms`);

runCycle();
