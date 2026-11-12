
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

### 3.1 REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/pets` | Retrieve all pets |
| GET | `/pets/:id` | Retrieve a specific pet |
| POST | `/pets` | Create a new pet |
| PUT | `/pets/:id` | Update pet information |
| DELETE | `/pets/:id` | Delete a pet |
| GET | `/pets/:id/feeding` | Retrieve feeding history |
| POST | `/pets/:id/feeding` | Record a feeding event |

### 3.2 Example Pet Data

```json
{
  "id": 1,
  "name": "Silvie",
  "species": "Davus pentaloris",
  "enclosureId": 1
}
```

The `enclosureId` field references an enclosure
managed by the Enclosure Service.

It can be null if the pet has no assigned enclosure.

### 3.3 Example Feeding Record

```json
{
  "id": 1,
  "petId": 1,
  "food": "Crickets",
  "quantity": 2,
  "date": "2026-11-12"
}
```

Feeding records belong to a specific pet and
are managed within the Data Management Service.

## 4. Enclosure Service

Base URL: `http://localhost:3002`

This service stores enclosure configurations,
receives sensor measurements, and detects
abnormal environmental conditions.

### 4.1 REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/enclosures` | Retrieve all enclosures |
| GET | `/enclosures/:id` | Retrieve enclosure information |
| POST | `/enclosures` | Create a new enclosure |
| PUT | `/enclosures/:id` | Update enclosure settings |
| POST | `/readings` | Receive a sensor measurement |

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

## 7. Data Persistence

SQLite is used to store application data.

Each service owns its own data and does not
directly access another service's database.

### 7.1 Data Management Database

**pets**

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Pet name |
| species | TEXT | Animal species |
| enclosure_id | INTEGER | Optional enclosure reference |

**feedings**

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| pet_id | INTEGER | Reference to pet |
| food | TEXT | Food type |
| quantity | INTEGER | Food quantity |
| date | TEXT | Feeding date |

The `pet_id` field references a pet within the
same database.

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
| 500 Internal Server Error | Unexpected server error |
| 503 Service Unavailable | Required service is unavailable |

Input validation will be implemented for
pet information, feeding records, enclosure
configurations, and sensor measurements.

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
