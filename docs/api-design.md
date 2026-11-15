# Exotic Pet Keeper — API Design

## 1. Overview

This document defines the REST APIs and communication
interfaces used by the Exotic Pet Keeper application.

The system consists of four independent microservices:

1. Data Management Service
2. Enclosure Service
3. Sensor Service
4. Notification Service

REST over HTTP is used for communication between the
client and backend services, as well as between
microservices.

WebSocket is used to deliver real-time environmental
alerts to the client.

All REST APIs exchange data using JSON.

## 2. Service Configuration

| Component | Technology | Port |
|---|---|---|
| Data Management | Node.js, Express, SQLite | 3001 |
| Enclosure | Node.js, Express, SQLite | 3002 |
| Sensor | Node.js | None |
| Notification | Node.js, Express, ws | 3004 |
| Web Client | HTML, CSS, JavaScript | 5500 |

The Sensor Service runs as an independent process
and periodically sends measurements to the
Enclosure Service. It does not expose an HTTP API.

## 3. Data Management Service

Base URL: `http://localhost:3001`

This service manages pet information and feeding records.

### 3.1 REST Endpoints (Implemented)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check whether the service is running |
| GET | `/pets` | Retrieve all pets |
| POST | `/pets` | Create a new pet |
| GET | `/pets/:id` | Retrieve a specific pet |
| PUT | `/pets/:id` | Replace editable pet fields (name and species required; optional enclosure assignment) |
| DELETE | `/pets/:id` | Delete a pet and its feeding history and group memberships atomically |
| GET | `/enclosures/:id/pets` | List pets assigned to an enclosure ID |
| GET | `/pets/:id/feedings` | Retrieve a pet's feeding history (newest first) |
| POST | `/pets/:id/feedings` | Record a feeding event for a pet |
| GET | `/pets/:id/feedings/:feedingId` | Retrieve a specific feeding record belonging to the pet |
| PUT | `/pets/:id/feedings/:feedingId` | Update a feeding record |
| DELETE | `/pets/:id/feedings/:feedingId` | Delete a feeding record |

### 3.2 Example Pet Data

A request to `POST /pets` supplies `name`, `species`, and optionally
`enclosure_id` (a positive integer referencing an existing enclosure or `null`):

```json
{
  "name": "Silvie",
  "species": "Davus pentaloris",
  "enclosure_id": 4
}
```

An example response is:

```json
{
  "id": 1,
  "name": "Silvie",
  "species": "Davus pentaloris",
  "created_at": "2026-11-12 19:30:00",
  "enclosure_id": 4
}
```

`enclosure_id` is optional and defaults to `null` for new pets. One pet
may be assigned to at most one enclosure, while an enclosure may contain
multiple pets. On `PUT /pets/:id`, supply the current `enclosure_id` to
keep an existing assignment: omitting it clears the assignment (the PUT
request replaces editable fields, rather than partially updating them).

When a non-null `enclosure_id` is supplied on create or update, Data
Management calls `GET http://localhost:3002/enclosures/:id` with a
three-second timeout. A nonexistent enclosure or an invalid ID is rejected
with `400 Bad Request`. If Enclosure cannot be contacted or cannot
validate the ID, the request returns `503 Service Unavailable` and the
pet is not updated. An unassigned pet can be created without contacting
Enclosure.

`GET /enclosures/:id/pets` returns a JSON array of pets assigned to the
specified ID, or `[]` if there are none. It reads only the Data Management
database; it does not confirm that the enclosure itself exists. An invalid
ID returns HTTP 400. This endpoint also allows the Enclosure Service to
check occupancy before deletion.

### 3.3 Example Feeding Record

Request: `POST /pets/1/feedings`

```json
{
  "food": "Crickets",
  "feeding_date": "12/11/2026",
  "notes": "Ate without problems"
}
```

Example response:

```json
{
  "id": 1,
  "pet_id": 1,
  "food": "Crickets",
  "feeding_date": "12/11/2026",
  "notes": "Ate without problems"
}
```

The pet ID is supplied in the URL; `food` and `feeding_date`
are required, and `notes` is optional (string or null).
The current schema does not have a separate `quantity` field;
quantities can be included in `food` or `notes` if needed.

### 3.4 Feeding Dates and Validation

- **API requests and responses:** `DD/MM/YYYY` (for example, `12/11/2026`).
- **SQLite storage:** `YYYY-MM-DD` (for example, `2026-11-12`).
- The service converts between these formats automatically.
- The API checks that dates actually exist, including leap-year rules;
  `31/02/2026` is rejected.
- Existing SQLite records stored as `YYYY-MM-DD` remain readable
  and are returned in `DD/MM/YYYY` format.
- Keeping dates in `YYYY-MM-DD` internally supports correct sorting
  in the feeding-history endpoint.

For pet creation and updates, both `name` and `species` must be
non-empty strings. Feeding creation and updates require non-empty
`food`, a valid `feeding_date`, and optional string/null `notes`.
Both `PUT` endpoints expect all required editable fields, not
partial updates. IDs must be positive safe integers.

A feeding record can only be read, updated, or deleted through
the correct pet ID. Pet deletion transactionally removes the pet, its feeding records,
and feeding-group memberships. A successful deletion returns `204 No Content`.

Malformed JSON and invalid required input return `400 Bad Request`.

## 4. Enclosure Service

Base URL: `http://localhost:3002`

This service stores enclosure configurations,
receives sensor measurements, and detects
abnormal environmental conditions.

### 4.1 REST Endpoints (Implemented)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check whether the service is running |
| GET | `/enclosures` | Retrieve all enclosures |
| GET | `/enclosures/:id` | Retrieve one enclosure |
| POST | `/enclosures` | Create an enclosure |
| PUT | `/enclosures/:id` | Update enclosure configuration |
| DELETE | `/enclosures/:id` | Delete an empty enclosure, its latest reading, and its history; reject deletion if pets are assigned |
| POST | `/readings` | Store a sensor reading, preserve history, and evaluate environmental conditions |
| POST | `/enclosures/:id/readings/manual` | Save a manual historical observation without changing the live state |
| GET | `/enclosures/:id/readings/history` | Retrieve historical readings, optionally filtered by date and limited |

### 4.2 Example Enclosure Data

```json
{
  "id": 1,
  "name": "Silvie's Enclosure",
  "minTemperature": 22,
  "maxTemperature": 28,
  "minHumidity": 60,
  "maxHumidity": 75
}
```

Temperature values are measured in degrees Celsius,
and humidity values are expressed as percentages.

Acceptable environmental ranges are configured
individually for each enclosure.

### 4.3 Example Sensor Reading

Request:

`POST /readings`

```json
{
  "enclosureId": 1,
  "temperature": 25,
  "humidity": 68
}
```

The Enclosure Service stores the reading and
compares the measurements against the configured
acceptable ranges.

If both values are within range, no alert is sent.

If either value is outside its configured range, the service marks the
enclosure as abnormal. An alert is sent only when the state changes
from normal to abnormal; continuing abnormal values do not trigger
duplicate notifications.

### 4.4 Sensor Reading Responses and Validation

The Enclosure Service validates incoming temperature and humidity
values, verifies that the enclosure exists, and stores the latest
reading using SQLite UPSERT.

The `readings` table retains one latest reading per enclosure. Each successful
sensor reading is also inserted into `reading_history` with source `sensor`.
The dedicated `GET /enclosures/:id/readings/latest` endpoint retrieves the
latest automatic sensor measurement directly from `readings`. `GET /enclosures/:id`
continues to return enclosure configuration and `isAbnormal`, not measurement
values. `GET /enclosures/:id/readings/history` continues to return both sensor
measurements and manual observations and is not a substitute for the latest
sensor reading endpoint.

#### GET /enclosures/:id/readings/latest (Implemented — Stage 3D.3.1)

Returns `200 OK` for an existing enclosure. It does not write to the database,
trigger notifications, or modify history. A saved reading returns:

```json
{
  "enclosureId": 1,
  "temperature": 25.5,
  "humidity": 68,
  "recordedAt": "2026-11-15T10:30:00Z",
  "isAbnormal": false,
  "status": "normal"
}
```

`recordedAt` is a UTC ISO-8601 timestamp derived from SQLite's
`CURRENT_TIMESTAMP` value. `status` is `normal` or `abnormal` according
to the enclosure's current persisted `is_abnormal` state, which is also
re-evaluated when thresholds change. This endpoint does not implement
staleness detection; consumers must check the reading timestamp.

If the enclosure exists but has never received an automatic sensor reading,
it returns `200 OK` with an explicit empty state:

```json
{
  "enclosureId": 1,
  "temperature": null,
  "humidity": null,
  "recordedAt": null,
  "isAbnormal": null,
  "status": "no_reading"
}
```

Manual history entries do not populate this endpoint. Invalid enclosure IDs
return `400` (`Invalid enclosure ID`); nonexistent enclosures return `404`
(`Enclosure not found`).

The service compares each measurement against the enclosure's
configured environmental thresholds and updates `is_abnormal`.

Example response:

```json
{
  "enclosureId": 1,
  "temperature": 31,
  "humidity": 42,
  "isAbnormal": true,
  "newAlert": true,
  "alertSent": true
}
```

- `isAbnormal` indicates whether the current reading is outside
  the configured thresholds.
- `newAlert` is true only when the enclosure changes from
  normal to abnormal.
- `alertSent` is true when the Notification Service returns
  a successful HTTP response. It does not guarantee client delivery.

The latest reading, historical insert, and abnormal state are updated in
one SQLite transaction. The HTTP response to `POST /readings` uses
`201 Created`.

Invalid measurements return HTTP 400.
Nonexistent enclosures return HTTP 404.

Enclosure creation and updates require a nonempty name,
finite numeric temperature and humidity thresholds,
minimum values below maximum values, and humidity
thresholds between 0 and 100.

Before deleting an enclosure, the service calls Data Management at
`GET http://localhost:3001/enclosures/:id/pets` with a three-second
timeout. If pets are assigned, deletion returns `409 Conflict`. If Data
Management is unavailable or the occupancy check fails, deletion is
blocked with `503 Service Unavailable`. A nonexistent enclosure returns
`404 Not Found`. Only an empty enclosure can be deleted; successful
deletion returns HTTP 204 and also deletes its latest reading and history
through SQLite foreign-key cascading.

### 4.5 Manual Historical Observations (Implemented)

`POST /enclosures/:id/readings/manual` records a manually measured temperature
and humidity for an existing enclosure. It inserts a history row with
`source: "manual"` and **does not** change the latest reading, the current
`is_abnormal` state, or real-time notifications. Manual entries are historical
observations, even when submitted immediately after measuring.

Example request to `POST /enclosures/2/readings/manual`:

```json
{
  "temperature": 27.5,
  "humidity": 65,
  "recordedAt": "2026-11-12T14:30:00Z"
}
```

Example successful response (`201 Created`):

```json
{
  "id": 16,
  "enclosureId": 2,
  "temperature": 27.5,
  "humidity": 65,
  "recordedAt": "2026-11-12T14:30:00Z",
  "source": "manual"
}
```

Temperature must be a finite number; humidity must be a finite number
between 0 and 100. `recordedAt` must be a real, non-future UTC timestamp
using exactly `YYYY-MM-DDTHH:mm:ssZ`. The service returns `400` for invalid
input and `404` for a nonexistent enclosure.

The observation time comes from the user, not the time the request arrives.
The web client will need to convert local entry times to UTC.

### 4.6 Environmental History Retrieval (Implemented)

`GET /enclosures/:id/readings/history` returns observations from both sources,
ordered by `recorded_at` descending and then ID descending. A manual
observation entered later still appears according to when it was measured.

Optional query parameters:

| Parameter | Format | Description |
|---|---|---|
| `from` | `YYYY-MM-DD` | Earliest UTC calendar date to include (inclusive) |
| `to` | `YYYY-MM-DD` | Latest UTC calendar date to include (inclusive) |
| `limit` | Integer 1–1000 | Maximum records returned; default 100 |

Example: `GET /enclosures/2/readings/history?from=2026-11-12&to=2026-11-13&limit=10`

Example response (`200 OK`):

```json
[
  {
    "id": 16,
    "enclosureId": 2,
    "temperature": 27.5,
    "humidity": 65,
    "recordedAt": "2026-11-12T14:30:00Z",
    "source": "manual"
  }
]
```

Invalid calendar dates, reversed date ranges, invalid limits, and invalid
IDs return `400`; nonexistent enclosures return `404`. Both date filters are
optional. Results are limited even when a date range is specified; pagination
and time-based aggregation are not implemented.

## 5. Sensor Service

The Sensor Service is an independent Node.js process that simulates environmental measurements for an enclosure.

It does not require a database, an HTTP server, or additional npm dependencies.

### 5.1 Responsibilities

- Generate simulated temperature and humidity measurements.
- Retrieve the enclosure's configured environmental thresholds.
- Send measurements to the Enclosure Service using REST.
- Simulate normal and abnormal environmental conditions.
- Continue operating when the Enclosure Service is temporarily unavailable.

### 5.2 Communication

The Sensor Service communicates with the Enclosure Service through two HTTP endpoints:

**GET /enclosures/:id**

Retrieves the enclosure's temperature and humidity thresholds to generate appropriate simulated readings.

**POST /readings**

Sends the generated measurements to the Enclosure Service.

Example request:

```json
{
  "enclosureId": 2,
  "temperature": 30,
  "humidity": 67.5
}
```

The Enclosure Service is responsible for storing the latest reading, detecting abnormal conditions, and triggering notifications when necessary.

### 5.3 Simulation

The Sensor Service uses a repeatable sequence of environmental conditions:

1. Normal temperature and humidity.
2. Temperature above the configured maximum (`hot`).
3. Repeated high temperature (`hot`) to test duplicate-alert prevention.
4. Return to normal conditions.
5. Temperature below the configured minimum (`cold`).
6. Return to normal conditions.
7. Humidity below the configured minimum (`dry`).
8. Return to normal conditions.
9. Humidity above the configured maximum (`humid`).
10. Return to normal conditions.

Normal values use the midpoint of the configured thresholds. High and low
values use an offset of 2 degrees Celsius or 5 percentage points of humidity,
respectively. Humidity is always within 0–100%. If the minimum humidity is 0%,
the dry scenario is skipped; if the maximum humidity is 100%, the humid scenario
is skipped. Skipped scenarios do not submit readings or change the enclosure's
status. All other successful readings are persisted by the Enclosure Service.

Each successful simulated reading logs the scenario number, temperature,
humidity, resulting status, new-alert flag, and alert-delivery flag. The
Enclosure Service emits a new alert only when conditions transition from normal
to abnormal; recovery is recorded but does not generate a recovery notification.
The ten-step simulation repeats continuously (approximately 50 seconds per
round at the default five-second interval, plus request processing time).

### 5.4 Configuration

The Sensor Service uses two environment variables:

| Variable | Default | Description |
|---|---|---|
| `ENCLOSURE_ID` | `1` | ID of the enclosure being monitored |
| `SENSOR_INTERVAL_MS` | `5000` | Delay between simulation cycles in milliseconds |

The default delay is five seconds to make testing and demonstrations faster. A longer delay, such as 60 seconds, can be configured for more realistic operation.

### 5.5 Error Handling

If the Enclosure Service is unavailable, the Sensor Service logs the connection failure and continues running.

It automatically attempts communication again during the next cycle without requiring a restart.

Failed measurements are not stored or queued for later delivery. The current
scenario is retried after a failure rather than advancing to the next step.

The Sensor Service does not directly generate notifications or store environmental history. These responsibilities belong to the Enclosure Service.

## 6. Notification Service

REST base URL: `http://localhost:3004`

WebSocket URL: `ws://localhost:3004`

This service receives abnormal-condition events
and delivers real-time alerts to connected clients.

### 6.1 REST Endpoints (Implemented)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/alerts` | Receive an environmental alert |

### 6.2 Example Alert Event

Request:

`POST /alerts`

```json
{
  "enclosureId": 1,
  "temperature": 31,
  "humidity": 42,
  "message": "Temperature too high and humidity too low"
}
```

The Enclosure Service sends this event when an enclosure
transitions from normal to abnormal conditions.

### 6.3 WebSocket Communication

The Notification Service maintains WebSocket
connections with active clients.

When an alert is received, the service sends
a JSON message to connected clients.

Example WebSocket message:

```json
{
  "type": "environment_alert",
  "enclosureId": 1,
  "message": "Temperature too high and humidity too low",
  "temperature": 31,
  "humidity": 42
}
```

The client displays the alert immediately
without requiring a page refresh.

Normal sensor readings do not generate
WebSocket notifications.

### 6.4 Implementation Status

The Notification Service is implemented using Express and
the `ws` library.

It accepts validated environmental alerts through
`POST /alerts` and broadcasts them to connected WebSocket
clients.

Both HTTP and WebSocket communication use port 3004.

The service also provides `GET /health`.

Notifications are not stored permanently.

## 7. Data Persistence

SQLite is used to store application data in the two database-owning services.

Each service owns its own data and does not
directly access another service's database.

### 7.1 Data Management Database (Implemented)

**pets**

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Autoincrement primary key |
| name | TEXT | Required pet name |
| species | TEXT | Required animal species |
| created_at | TEXT | Required creation timestamp, default `CURRENT_TIMESTAMP` |
| enclosure_id | INTEGER | Optional enclosure identifier, `NULL` when unassigned |

**feeding_records**

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Autoincrement primary key |
| pet_id | INTEGER | Required foreign key referencing `pets.id` |
| food | TEXT | Required food description |
| feeding_date | TEXT | Required feeding date stored as `YYYY-MM-DD` |
| notes | TEXT | Optional notes |

SQLite foreign-key enforcement is enabled. A feeding record
cannot reference a pet that does not exist. The database does
not automatically cascade-delete feeding records when a pet is
deleted; the REST API rejects such pet deletions with HTTP `409`.

Because the Enclosure Service owns a separate database, `pets.enclosure_id`
is not a SQLite foreign key to an enclosure. New assignments are checked
through REST. The schema adds the nullable column to existing databases
using a conditional migration, preserving existing pet records.

The local database file is stored at
`services/data-management/data/pets.db` and is excluded from Git.

### 7.2 Enclosure Database

**enclosures**

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Enclosure name |
| min_temperature | REAL | Minimum temperature |
| max_temperature | REAL | Maximum temperature |
| min_humidity | REAL | Minimum humidity |
| max_humidity | REAL | Maximum humidity |
| is_abnormal | INTEGER | Current alert state (0 or 1) |

**readings**

| Field | Type | Description |
|---|---|---|
| enclosure_id | INTEGER | Primary key and enclosure reference |
| temperature | REAL | Latest temperature |
| humidity | REAL | Latest humidity |
| recorded_at | TEXT | Measurement timestamp (UTC) |

The `readings` table stores only the latest measurement per enclosure.

**reading_history**

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Autoincrement primary key |
| enclosure_id | INTEGER | Foreign key referencing `enclosures.id` |
| temperature | REAL | Measured temperature |
| humidity | REAL | Measured humidity |
| recorded_at | TEXT | Observation timestamp in UTC |
| source | TEXT | `sensor` or `manual` (CHECK constraint) |

Each automatic measurement adds a history row as part of the latest-reading
transaction. Manual observations insert only into history. An index on
`(enclosure_id, recorded_at)` supports retrieval by enclosure and date.

The `is_abnormal` field tracks whether an
enclosure is currently outside its acceptable
environmental ranges.

Both `readings.enclosure_id` and `reading_history.enclosure_id` reference
`enclosures.id` with `ON DELETE CASCADE`.

SQLite foreign-key enforcement is enabled.

The `is_abnormal` field is restricted to 0 or 1.

The database is stored at
`services/enclosure/data/enclosures.db` and excluded from Git.

### 7.3 Services Without Databases

The Sensor Service generates temporary measurements
and does not require data persistence.

The Notification Service delivers alerts to
connected clients without storing notification history.

## 8. Error Handling

The REST APIs use standard HTTP status codes.

| Status | Meaning |
|---|---|
| 200 OK | Successful request |
| 201 Created | Resource successfully created |
| 204 No Content | Successful request without response body |
| 400 Bad Request | Invalid request data |
| 404 Not Found | Requested resource does not exist |
| 409 Conflict | Enclosure deletion blocked by assigned pets, or featured pet does not belong to enclosure |
| 500 Internal Server Error | Unexpected server error |
| 503 Service Unavailable | Required service is unavailable |

Input validation is implemented for pet and feeding records and enclosure
assignment IDs in Data Management, and for enclosure configuration,
automatic readings, manual observations, history dates, and result limits
in the Enclosure Service. Cross-service assignment validation and
occupancy checks use three-second HTTP timeouts; a required check that
cannot be completed returns HTTP 503.

The Enclosure Service uses a three-second timeout when posting alerts.
The Sensor Service uses three-second timeouts for its requests to the
Enclosure Service. Failed sensor requests are logged and retried on the
next simulation cycle; failed measurements are not queued.

## 9. Alert Behavior

The Enclosure Service compares incoming readings
against each enclosure's configured ranges.

Example:

- Temperature range: 22–28°C
- Humidity range: 60–75%

**Normal measurement:**

- Temperature: 25°C
- Humidity: 68%

The reading is stored as the latest reading and added to history; no
notification is sent.

**Abnormal measurement:**

- Temperature: 31°C
- Humidity: 42%

The latest reading and its history record are stored. The Enclosure
Service sends an alert event to Notification **only if the previous state
was normal**. Manual historical observations never trigger alerts.

To prevent duplicate notifications, the implementation generates
an alert when an enclosure changes from normal to abnormal.

If abnormal conditions continue, another identical
alert is not generated.

When readings return to normal, the abnormal state
is cleared.

A new abnormal condition can then generate
another alert.

Delivery failure handling has been tested. The implementation does not
guarantee delivery if the Notification Service is unavailable.

### 9.1 Implemented Alert Delivery

When an enclosure changes from normal to abnormal, the
Enclosure Service sends an HTTP POST request to the
Notification Service at `http://localhost:3004/alerts`.

The request uses a three-second timeout.

If the Notification Service is unavailable, the sensor
reading is still saved successfully, and the failure is
logged. No automatic retry is performed.

Repeated abnormal readings do not generate duplicate alerts.
When conditions return to normal, the abnormal state is
cleared, allowing a future abnormal transition to generate
another alert.

Updating enclosure thresholds recalculates the abnormal
state but does not independently send a notification.

The Notification Service broadcasts alerts through WebSocket
to currently connected clients.

## 10. Scope and Limitations

The project intentionally excludes:

- User authentication and authorization.
- Physical IoT sensors.
- Advanced analytics.
- Complex feeding schedules.
- Notification history.
- Message brokers and distributed queues.
- Cloud deployment.

Environmental history and manual observations are implemented (Milestone 9).
The mobile-friendly web client is planned. The history API supports UTC
date filtering and up to 1,000 records per response, but does not implement
pagination, graphing, or automatic correlations with feeding history.

Pet-to-enclosure association is implemented (Milestone 10), but automated
correlations between feeding history and environmental history are not yet
implemented. Each service owns its database, so the cross-service link
cannot be enforced by a SQLite foreign key. REST validation and the
occupancy check protect ordinary operations, but concurrent requests
could theoretically assign a pet between an occupancy check and deletion;
there is no distributed transaction or locking protocol across services.

The objective is to demonstrate a functional
distributed application with four independently
running microservices, REST communication,
data persistence, and real-time WebSocket alerts.


### Stage 3D.1 — Optional enclosure profile metadata

`GET /enclosures` and `GET /enclosures/:id` additionally return `enclosureType` and `notes` (both nullable strings). `POST /enclosures` accepts optional `enclosureType` and `notes` alongside the existing required name and four environmental thresholds. `PUT /enclosures/:id` accepts the same optional fields and preserves existing metadata when a legacy caller omits them.

Allowed non-null enclosure types: `Tropical`, `Desert`, `Temperate`, `Aquatic`, `Paludarium`, `Other`. Name is trimmed and limited to 120 characters; notes are limited to 2000 characters and trimmed before storage. All existing threshold rules remain unchanged. The database startup migration adds nullable `enclosure_type` and `notes` columns only if absent, preserving old records and reading history.

The frontend Enclosures collection obtains occupancy by fetching the real `/api/pets` collection and counting `enclosure_id` references. A failed Pets request leaves occupancy explicitly unavailable; it does not prevent listing enclosures. Environmental badges and sensor readings are deferred to Stage 3D.3.


### Stage 3D.2 — Featured pet selection

`PATCH /enclosures/:id/featured-pet` (Enclosure Service, port 3002)

Request body: `{ "featuredPetId": 123 }` for an assigned pet, or `{ "featuredPetId": null }` to clear the preference. Returns the updated enclosure with `featuredPetId` (also included in GET/list responses). The service validates membership against `GET /enclosures/:id/pets` on Data Management; returns 400 for malformed data, 404 for unknown enclosure, 409 when the pet is not assigned, and 503 when Data Management is unavailable. A missing or stale preference is displayed as the first occupant (or none when empty); the frontend attempts to synchronize a stale preference after loading. No animal illustration assets or historical records are changed.

**Pet deletion (implemented behavior):** `DELETE /pets/:id` removes the pet and its related feeding records and feeding-group memberships transactionally (204 on success). It is not blocked by existing feeding history. The frontend requires explicit confirmation.

### Stage 3D.3.3A — Selectable environmental monitoring mode (backend)

An enclosure has a persisted `monitoringMode`: `manual` or `automatic`. Existing
records automatically migrate to `automatic`, preserving sensor monitoring and
all previous history. `POST /enclosures` defaults to `manual` when the optional
`monitoringMode` field is omitted; `PUT /enclosures/:id` preserves the existing
mode when omitted. Invalid values return HTTP 400. All enclosure list, detail,
create, and update responses include `monitoringMode`.

The migration adds `enclosures.monitoring_mode` and
`enclosures.monitoring_start_history_id` only when absent. Switching modes on
`PUT /enclosures/:id` records the latest history row ID as a boundary. All
historical measurements remain stored, but **the newly selected mode displays
`no_reading` until a new measurement of that source arrives**. Submitting
`PUT` again without changing the mode does not discard the current reading.

`GET /enclosures/:id/readings/current` retrieves the current reading for the
selected monitoring mode, evaluating the value against current thresholds:

```json
{
  "enclosureId": 4,
  "monitoringMode": "manual",
  "temperature": 25,
  "humidity": 68,
  "recordedAt": "2026-11-15T12:00:00Z",
  "source": "manual",
  "isAbnormal": false,
  "status": "normal"
}
```

When no eligible reading exists, `temperature`, `humidity`, `recordedAt`,
`source`, and `isAbnormal` are `null`; `status` is `no_reading`. The endpoint
returns HTTP 400 for an invalid enclosure ID and HTTP 404 for a missing one.
It does not infer sensor connectivity or stale state; the frontend will handle
staleness in Stage 3D.3.3C. Observation time for manual records is supplied by
the caller; the most recent observation **by recorded time** is current, while
backdated records are still retained in history.

`POST /enclosures/:id/readings/manual` retains its existing input and response
contract. In `manual` mode it now updates the enclosure's `isAbnormal` flag
based on the most recent active manual observation. In `automatic` mode it
remains history-only and does not replace sensor status. Manual observations
do not send notifications in this stage.

`POST /readings` rejects sensor submissions with HTTP 409 when the enclosure
is in `manual` mode. This prevents a still-running simulator from replacing
manual monitoring status. The simulator should be stopped or redirected to an
automatically monitored enclosure before changing modes. In `automatic` mode,
sensor ingestion and alert behavior are unchanged.

The existing `GET /enclosures/:id/readings/latest` endpoint continues to
return the last **sensor** measurement regardless of monitoring mode, for
backward compatibility. Its `isAbnormal` reflects that sensor measurement
against current thresholds, not the manual status. It may therefore return an
older sensor observation after a mode change; new clients should use
`/readings/current`. History remains available through
`GET /enclosures/:id/readings/history` with original source labels.

Existing frontend forms are not yet mode-aware: mode selection UI and manual
observation entry are planned for Stages 3D.3.3B and 3D.3.3C.


## Stage 3D.5.3 — Animal Events (implemented)

Data Management owns the `animal_events` table. Observations remain associated with `pet_id`, independent of the animal's current enclosure. Historical enclosure assignments are **not** tracked by the existing schema.

| Method | Endpoint | Meaning |
|---|---|---|
| GET | `/pets/:id/events` | Chronological observations (newest first) |
| POST | `/pets/:id/events` | Create an event |
| GET | `/pets/:id/events/:eventId` | Fetch an event belonging to the pet |
| PUT | `/pets/:id/events/:eventId` | Correct an observation |
| DELETE | `/pets/:id/events/:eventId` | Permanently remove a specific event |

Events use `event_type` (`molting`, `weight`, `behavior`, `health`, `husbandry`, `other`) and `event_date` (ISO `YYYY-MM-DD`). Optional `event_time` is `HH:MM`; `utc_offset_minutes` is nullable, and no timezone is inferred when unavailable. `description` and `notes` are at most 2000 characters. Molting requires `molt_outcome` (`successful`, `incomplete`, `difficulty_observed`, `unknown`); weight requires positive finite `weight_g` (maximum 1,000,000). All other categories require a nonblank description. Type-specific fields for unrelated categories must be null. `created_at` and `updated_at` use SQLite UTC timestamps; backdated `event_date` does not modify entry timestamps. Events are deleted transactionally when their pet is permanently deleted.

Individual feeding `POST` and `PUT` now accept optional `feeding_outcome`: `accepted`, `refused`, or `recorded`. The default `recorded` is retained for older callers and preexisting entries, whose actual outcome was not recorded. Feeding refusals are **not** inserted into `animal_events`; they belong to `feeding_records`. Existing group/bulk feeding behavior remains unchanged and creates `recorded` entries.

The current sidebar Alerts destination is intentionally retained until Stage 3D.5.4 Records & Insights. Environmental history remains enclosure-owned.
