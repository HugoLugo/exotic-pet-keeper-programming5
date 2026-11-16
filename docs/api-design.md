# Exotic Pet Keeper — Implemented API Reference

**Snapshot:** 16 November 2026. Routes below are derived from the actual Express handlers; this reference intentionally describes implemented behavior, not planned endpoints.

## Access and routing

Services expose routes **without** the `/api` prefix. The frontend development server (`http://localhost:5500`) exposes a proxy prefix `/api`, forwarded to either Data Management (3001) or Enclosure (3002). Direct examples use the backend ports, e.g. `GET http://localhost:3001/pets`. No authentication is implemented.

### Data Management Service — `http://localhost:3001`

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Health status |
| GET / POST | `/pets` | List/create animals |
| GET / PUT / DELETE | `/pets/:id` | Read/edit/delete one animal |
| GET | `/enclosures/:id/pets` | Animals currently assigned to enclosure ID |
| GET / POST | `/feeding-groups` | List/create named feeding groups |
| PUT / DELETE | `/feeding-groups/:id` | Edit/remove group |
| POST | `/feedings/bulk` | Record quick/bulk feeding responses |
| GET | `/feedings/recent` | Recent feeding records |
| GET / POST | `/pets/:id/feedings` | Feeding history and create record |
| GET / PUT / DELETE | `/pets/:id/feedings/:feedingId` | Individual feeding record |
| GET / POST | `/pets/:id/events` | List recorded animal events (including automatic enclosure changes) / add an event |
| GET / PUT / DELETE | `/pets/:id/events/:eventId` | Individually entered event record |
| GET | `/pets/:id/export` | Download selected animal care history as PDF or CSV ZIP |

`/pets/:id/export` requires `format=pdf` or `format=csv`. Optional query parameters are `from=YYYY-MM-DD`, `to=YYYY-MM-DD` and `categories` (comma-separated, unique category names). Inclusive dates apply to feeding/event observation dates; enclosure-change events are filtered by the UTC date of their recorded timestamp. Categories: `feeding`, `molting`, `weight`, `length`, `behavior`, `health`, `husbandry`, `other`, `enclosure_change`. CSV exports are supplied as a ZIP including `animal.csv`, `feeding_records.csv`, `animal_events.csv`, `enclosure_changes.csv`, and `export_metadata.csv`.

Historical sensor readings are **not** exported as animal records. Keeper-entered environmental context attached to individual records may be included. Enclosure changes identify observed changes only, not inferred occupancy intervals.

### Enclosure Service — `http://localhost:3002`

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Health status |
| GET / POST | `/enclosures` | List/create enclosures |
| GET / PUT / DELETE | `/enclosures/:id` | Read/edit/delete enclosure |
| PATCH | `/enclosures/:id/featured-pet` | Select featured pet ID |
| GET | `/enclosures/:id/readings/current` | Current mode-appropriate observation and condition, or `no_reading` |
| GET | `/enclosures/:id/readings/latest` | Most recently recorded reading, subject to endpoint semantics |
| POST | `/readings` | Receive automated/sensor measurement |
| POST | `/enclosures/:id/readings/manual` | Enter manual historical observation |
| GET | `/enclosures/:id/readings/history` | Query historical sensor/manual readings |

Enclosure creation/update requires a non-empty name, numeric min/max temperature and humidity thresholds with minimum lower than maximum, and optional habitat metadata. `monitoringMode` supports `manual` or `automatic`. Readings contain temperature and humidity; automatic requests identify the enclosure with `enclosureId`. History supports `from`, `to` as `YYYY-MM-DD` and `limit` between 1 and 1000 (default 100). The two monitoring sources remain distinct.

### Notification Service — `http://localhost:3004`

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Health status |
| POST | `/alerts` | Receive an environmental alert/recovery event and broadcast it |
| WebSocket | `ws://localhost:3004` | Subscribe to live events |

The notification service stores **no persistent history**. Connected browsers receive broadcasts; after a disconnection, missed messages are not replayed. The frontend reconciles by fetching current enclosure conditions.

### Sensor Simulator — outgoing requests only

The independent `services/sensor/src/index.js` process has **no inbound listening endpoint**. It calls `GET http://localhost:3002/enclosures/:id` and `POST http://localhost:3002/readings`; configure `ENCLOSURE_ID` (defaults to 1) and `SENSOR_INTERVAL_MS` (defaults to 5000, minimum 1000). The enclosure must exist and be suitable for automatic monitoring.

## HTTP conventions

Express APIs accept and return JSON for ordinary operations. Invalid IDs, malformed request bodies, nonexistent records and unavailable dependent services produce error responses (specific HTTP status and message depend on route). Successful deletion may return 204 with no JSON. Export responses are binary `application/pdf` or `application/zip` with attachment headers.

The frontend proxy returns 502 when an upstream HTTP service cannot be contacted and imposes a five-second upstream request timeout. Direct WebSocket traffic does not pass through this proxy.

## Data storage and security boundaries

Data Management owns `services/data-management/data/pets.db`; Enclosure owns `services/enclosure/data/enclosures.db`. The databases are initialized/migrated on service startup and excluded from Git. Routes do **not** enforce user identities or private ownership. This API is designed for a controlled local project demonstration, not public exposure.

For workflow descriptions see [architecture](architecture.md), and for local launch commands see [setup and demonstration](setup-and-demo.md).
