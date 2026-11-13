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
| PUT | `/pets/:id` | Update an existing pet (name and species required) |
| DELETE | `/pets/:id` | Delete a pet if it has no feeding records |
| GET | `/pets/:id/feedings` | Retrieve a pet's feeding history (newest first) |
| POST | `/pets/:id/feedings` | Record a feeding event for a pet |
| GET | `/pets/:id/feedings/:feedingId` | Retrieve a specific feeding record belonging to the pet |
| PUT | `/pets/:id/feedings/:feedingId` | Update a feeding record |
| DELETE | `/pets/:id/feedings/:feedingId` | Delete a feeding record |

### 3.2 Example Pet Data

A request to `POST /pets` supplies `name` and `species`:

```json
{
  "name": "Silvie",
  "species": "Davus pentaloris"
}
```

An example response is:

```json
{
  "id": 1,
  "name": "Silvie",
  "species": "Davus pentaloris",
  "created_at": "2026-11-12 19:30:00"
}
```

The Data Management pet schema currently does **not** include
an enclosure reference. Enclosures are maintained separately
by the Enclosure Service; any future pet-to-enclosure association
would need to be designed and implemented explicitly.

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
the correct pet ID. Deleting a pet with feeding records returns
`409 Conflict` to protect feeding history. A successful deletion
returns `204 No Content`.

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
| DELETE | `/enclosures/:id` | Delete an enclosure and its latest reading |
| POST | `/readings` | Store a sensor reading and evaluate environmental conditions |

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

If either value is outside its configured range,
the service sends an alert to the Notification Service.

### 4.4 Sensor Reading Responses and Validation

The Enclosure Service validates incoming temperature and humidity
values, verifies that the enclosure exists, and stores the latest
reading using SQLite UPSERT.

Only one reading per enclosure is retained.

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

The reading and abnormal state are updated in one SQLite
transaction.

Invalid measurements return HTTP 400.
Nonexistent enclosures return HTTP 404.

Enclosure creation and updates require a nonempty name,
finite numeric temperature and humidity thresholds,
minimum values below maximum values, and humidity
thresholds between 0 and 100.

Deleting an enclosure also deletes its latest reading.
Successful deletion returns HTTP 204.

## 5. Sensor Service

The Sensor Service simulates environmental measurements.

It does not require a database or an HTTP server.

### 5.1 Responsibilities

- Generate simulated temperature values.
- Generate simulated humidity values.
- Send measurements to the Enclosure Service.
- Support normal and abnormal test scenarios.

### 5.2 Communication

The service periodically sends an HTTP POST request to:

`http://localhost:3002/readings`

Example measurement:

```json
{
  "enclosureId": 1,
  "temperature": 26,
  "humidity": 65
}
```

Initially, measurements will be generated every
five seconds.

No physical sensors are required.

## 6. Notification Service

REST base URL: `http://localhost:3004`

WebSocket URL: `ws://localhost:3004`

This service receives abnormal-condition events
and delivers real-time alerts to connected clients.

### 6.1 REST Endpoints

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

The Enclosure Service sends this event when
it detects abnormal environmental conditions.

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

SQLite is used to store application data.

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
| recorded_at | TEXT | Measurement timestamp |

The readings table stores only the latest
measurement for each enclosure.

The `is_abnormal` field tracks whether an
enclosure is currently outside its acceptable
environmental ranges.

The `readings.enclosure_id` field references `enclosures.id`
with `ON DELETE CASCADE`.

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

The REST APIs will use standard HTTP status codes.

| Status | Meaning |
|---|---|
| 200 OK | Successful request |
| 201 Created | Resource successfully created |
| 204 No Content | Successful request without response body |
| 400 Bad Request | Invalid request data |
| 404 Not Found | Requested resource does not exist |
| 409 Conflict | Pet deletion blocked by existing feeding records |
| 500 Internal Server Error | Unexpected server error |
| 503 Service Unavailable | Required service is unavailable |

Input validation is implemented for pet information and feeding
records in the Data Management Service. Validation for enclosure
configurations and sensor measurements is planned as those services
are developed.

Service-to-service HTTP requests will use
timeouts to avoid waiting indefinitely.

## 9. Alert Behavior

The Enclosure Service compares incoming readings
against each enclosure's configured ranges.

Example:

- Temperature range: 22–28°C
- Humidity range: 60–75%

**Normal measurement:**

- Temperature: 25°C
- Humidity: 68%

The reading is stored and no notification is sent.

**Abnormal measurement:**

- Temperature: 31°C
- Humidity: 42%

The reading is stored, and the Enclosure Service
sends an alert event to the Notification Service.

To prevent duplicate notifications, the initial
implementation will generate an alert when an
enclosure changes from normal to abnormal.

If abnormal conditions continue, another identical
alert is not generated.

When readings return to normal, the abnormal state
is cleared.

A new abnormal condition can then generate
another alert.

Handling delivery failures will be included in
testing. The initial implementation will not
guarantee delivery if the Notification Service
is unavailable.

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

The objective is to demonstrate a functional
distributed application with four independently
running microservices, REST communication,
data persistence, and real-time WebSocket alerts.
