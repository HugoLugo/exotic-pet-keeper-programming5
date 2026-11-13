# Exotic Pet Keeper — Project Description

## 1. Project Overview

Exotic Pet Keeper is a university backend project designed to support the
management of exotic pets, feeding records, enclosure configurations, and
simulated environmental conditions. It is intended for animals such as
reptiles, tarantulas, scorpions, and other exotic pets.

The project is developed for the Programming 5 course at the University of
Pécs. Its main objective is to demonstrate independent services communicating
through REST APIs and delivering real-time alerts through WebSocket.

**Current status:** All four backend services are implemented. A
mobile-friendly web client is planned but has not been implemented, pending
confirmation of course requirements.

## 2. Project Objectives

The implemented backend demonstrates:

- Four independently running backend services with distinct responsibilities.
- REST communication between services.
- Real-time alert broadcasting using WebSocket.
- Persistent pet records and feeding history.
- Optional pet-to-enclosure assignment with REST validation.
- Enclosure configuration, automated measurement history, and manual
  historical observations.
- Simulated temperature and humidity readings, abnormal-condition detection,
  and alerts on transitions from normal to abnormal.
- Prevention of enclosure deletion while pets are assigned, including safe
  rejection when the occupancy check cannot be completed.

A mobile-friendly interface is a **planned**, not implemented, part of the
original application concept.

## 3. System Components

### 3.1 Data Management Service — Port 3001

Owns its own SQLite database and provides APIs to:

- Create, retrieve, update, and delete pets.
- Record, retrieve, edit, and delete feeding records.
- Retrieve feeding history for each pet.
- Store a nullable `enclosure_id` for each pet.
- Verify an assigned enclosure through the Enclosure Service and list pets
  assigned to a particular enclosure.

### 3.2 Enclosure Service — Port 3002

Owns a separate SQLite database and provides APIs to:

- Create, retrieve, update, and delete enclosure configurations.
- Store the latest received sensor reading and a timestamped history.
- Accept manual historical observations without changing the live state.
- Retrieve environmental history, optionally filtered by UTC date range.
- Compare live readings against temperature and humidity thresholds.
- Trigger an alert only when the state changes from normal to abnormal.
- Check for assigned pets through Data Management before deleting an
  enclosure. Occupied enclosures are rejected; unavailable occupancy checks
  prevent deletion.

The latest sensor reading is stored internally, but there is **no dedicated
GET endpoint** for returning the latest temperature and humidity. The
existing `GET /enclosures/:id` returns configuration and abnormal-state
information; the history endpoint returns recorded observations.

### 3.3 Sensor Service — No HTTP Port

Runs independently as a Node.js process. It retrieves an enclosure's
configured thresholds, simulates normal and abnormal temperature/humidity
readings, and periodically submits them to the Enclosure Service through
REST. No physical sensor hardware or database is required.

### 3.4 Notification Service — Port 3004

Receives abnormal-condition alerts over REST and broadcasts them to
currently connected WebSocket clients. It does not persist notifications.
A successful alert HTTP response does not guarantee that a user received it.

## 4. Planned Client Application

The original design includes a mobile-friendly HTML/CSS/JavaScript web client
for pet management, feeding records, enclosure information, historical
measurements, and real-time alerts. **This client is not implemented.**

The backend endpoints and WebSocket server can be tested without a custom
frontend. Displaying exact current measurements would require either an
appropriate API extension or a deliberate client-side approach using the
existing sensor history; the latter is not a dedicated latest-reading API.

## 5. Communication

- **REST:** Pet and feeding operations; enclosure operations; Sensor to
  Enclosure readings; Data Management to Enclosure assignment validation;
  Enclosure to Data Management occupancy checks; and Enclosure to
  Notification alert events.
- **WebSocket:** Notification broadcasts alert events to currently connected
  clients. Normal readings do not generate alerts, and continued abnormal
  readings do not repeatedly send the same transition alert.

## 6. Data Persistence

Data Management stores pets, feeding records, and optional pet-to-enclosure
references in its SQLite database. Enclosure stores configurations, latest
readings, and reading history in its separate SQLite database.

No service directly accesses the other service's database. Cross-service
assignments rely on REST checks rather than cross-database foreign keys.

## 7. Technologies

Implemented: JavaScript, Node.js, Express.js, SQLite, WebSocket (`ws`),
Git and GitHub. Planned frontend: HTML, CSS, and JavaScript.

## 8. Project Scope and Limitations

This is an educational backend demonstration, not a production-ready pet
monitoring platform. The following are outside the implemented scope:

- User authentication and authorization.
- Physical IoT sensors.
- Advanced analytics and feeding/environmental correlations.
- Social features and complex feeding schedules.
- Persisted notification history and guaranteed alert delivery.
- Distributed transactions across service databases.
- Mobile-friendly web client (planned; requirement pending confirmation).

The emphasis is a small, understandable distributed backend whose services,
interfaces, and limitations can be clearly explained and tested.
