# Exotic Pet Keeper

**Programming 5 · Computer Science Engineering · University of Pécs**
Documentation baseline: 16 November 2026 (Stage 6A).

Exotic Pet Keeper is a locally operated web application for recording exotic-animal husbandry and monitoring enclosure conditions. It includes four independently executable backend components, REST-based inter-service communication, and real-time events delivered to the frontend with WebSockets.

## Implemented features

- **Dashboard:** animal and enclosure summaries, current environmental conditions, conditions requiring attention, and notification bell.
- **Pets:** create, inspect, edit and delete animals; assign enclosures; record individual animal details.
- **Enclosures:** create and edit habitats, set temperature/humidity limits, select automatic or manual monitoring, and inspect current and historical readings.
- **Feeding:** individual records, quick/bulk feeding, feeding groups, accepted/refused responses, and history.
- **Animal events:** molting/shedding, weight, length, behavior, health, husbandry, general observations, and automatic enclosure-assignment changes.
- **Records & Insights:** animal-centered history, filtering, visualizations, and recorded measurement comparisons.
- **Export:** downloadable PDF care-history report or ZIP of CSV files, with selected dates and categories. Exports do **not** attribute enclosure sensor readings to animals without evidence of historical occupancy.

The repository still contains a labeled hardcoded Luna demo record in the Records & Insights frontend; its removal is planned for the later cleanup stage. It is **not** the local five-animal SQLite demonstration dataset.

## Architecture

| Component | Port | Function |
| --- | --- | --- |
| Data Management Service | 3001 | Pets, feeding records and groups, animal events, enclosure changes, care-history exports; own SQLite database |
| Enclosure Service | 3002 | Enclosures, monitoring configuration, readings, environmental evaluation; own SQLite database |
| Notification Service | 3004 | Accepts alert events over HTTP and broadcasts via WebSocket; no durable notification store |
| Sensor Service (simulator) | No listening port | Independent process that reads enclosure settings and posts simulated measurements |
| Frontend development server | 5500 (localhost only) | Serves HTML/CSS/JS and proxies selected REST API requests; **not** a microservice |

The Sensor Service is an autonomous producer/client, not an HTTP-server microservice. Confirm with the instructor if the minimum of four must specifically be four server-style APIs. See [architecture](docs/architecture.md).

## Requirements and runtime

- Node.js **22 or newer** recommended: the project uses `node:sqlite` (`DatabaseSync`), built-in `fetch`, and `AbortSignal.timeout`. Check your installed Node version with `node --version`.
- npm for the three services with dependencies; no root-level `package.json` or root startup command.
- A local machine with ports 3001, 3002, 3004 and 5500 available.
- Browsers capable of modern JavaScript and WebSockets.

## Quick start (PowerShell)

Open **five terminals**, each starting at the repository root. On a first installation, run `npm install` once in `services/data-management`, `services/enclosure` and `services/notification` before `npm start` in those folders. The Sensor Service has no third-party packages.

```powershell
# Terminal 1
cd services/data-management
npm install
npm start
```

```powershell
# Terminal 2
cd services/enclosure
npm install
npm start
```

```powershell
# Terminal 3
cd services/notification
npm install
npm start
```

Create an enclosure in the UI before starting the simulator. Use the ID assigned by your **own** database (it is not always `4`):

```powershell
# Terminal 4, from the repository root
cd services/sensor
$env:ENCLOSURE_ID = "4"  # example only; replace with an existing ID
node src/index.js
```

```powershell
# Terminal 5, from the repository root
cd frontend
node dev-server.js
```

Open **http://localhost:5500** in the browser. The Sensor Service is optional for manual-only demonstrations. An enclosure in automatic mode with a valid ID is needed to produce simulated readings. Its default ID is `1`, which may not exist in your dataset.

### Service health checks

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3002/health
Invoke-RestMethod http://localhost:3004/health
```

## Persistence and demonstration data

On startup the Data Management and Enclosure services create their own SQLite schemas, respectively at `services/data-management/data/pets.db` and `services/enclosure/data/enclosures.db`. These files are intentionally ignored by Git. **Do not copy or overwrite someone's active databases during installation.** A fresh checkout starts with empty records; the fictional five-animal demonstration dataset previously developed locally is **not** in this repository archive. A reusable demo generator has **not yet been implemented**.

See [setup and demonstration](docs/setup-and-demo.md) and [demo-data policy](docs/demo-data.md).

## Limitations and security

- Local single-keeper prototype: **no authentication, user ownership enforcement, or internet-safe authorization**.
- The frontend binds to `127.0.0.1`; this is **not** an installable mobile app, PWA, publicly hosted website, or cross-device deployment.
- Alert broadcasts are transient; WebSockets are not a durable queue. Reconnect logic checks current conditions rather than replaying lost alerts.
- The Sensor Service is a **simulator**, not a physical sensor integration.
- Observations are records, not veterinary diagnoses; historical enclosure assignment changes do not prove occupancy intervals.
- No automated test suite is currently included; integration and export checks remain a separate testing stage.

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api-design.md)
- [Project description](docs/project-description.md)
- [Frontend instructions](frontend/README.md)
- [Visual design system](docs/frontend-visual-design-system.md)
- [Setup and demonstration](docs/setup-and-demo.md)
- [Demonstration data](docs/demo-data.md)
