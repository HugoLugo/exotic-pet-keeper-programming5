# Exotic Pet Keeper

A Programming 5 university project demonstrating a backend for managing
exotic pets, feeding records, enclosure configurations, and simulated
environmental measurements.

## Project Overview

Developed for the Programming 5 course at the University of Pécs.
The implemented backend consists of four independently running services:

1. **Data Management Service** (port 3001) — pet records, feeding history,
   and optional pet-to-enclosure assignments.
2. **Enclosure Service** (port 3002) — enclosure configuration, environmental
   measurements and history, abnormal-condition detection, and occupancy
   checks before deleting an enclosure.
3. **Sensor Service** (no HTTP port) — independently simulates and sends
   temperature and humidity readings to the Enclosure Service.
4. **Notification Service** (port 3004) — receives abnormal-condition alerts
   over REST and broadcasts them to connected WebSocket clients.

Services communicate using REST over HTTP. Data Management and Enclosure
store their own data in separate SQLite databases. The Notification Service
uses WebSocket for real-time alerts.

**Implementation status:** The four backend services are implemented.
A mobile-friendly HTML/CSS/JavaScript web client is planned but **not
implemented**; whether it is needed will depend on the course requirements.
The backend can be exercised directly through HTTP requests and a WebSocket
client.

## Technologies

Implemented: JavaScript, Node.js, Express.js, SQLite, WebSocket (`ws`),
Git and GitHub.

Planned client technologies: HTML, CSS, JavaScript.

## Documentation

Detailed information is available in [`docs/`](docs/):

- [`project-description.md`](docs/project-description.md) — purpose and scope.
- [`architecture.md`](docs/architecture.md) — service responsibilities,
  data ownership, diagrams, and limitations.
- [`api-design.md`](docs/api-design.md) — implemented endpoints, payloads,
  validations, and error responses.
