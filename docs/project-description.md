# Exotic Pet Keeper — Project Description

**Programming 5 · University of Pécs · implemented system, November 2026**

## Purpose

Exotic Pet Keeper is an educational distributed application for keepers of exotic animals. The system records individual animals, their husbandry and feeding history, and enclosure environmental observations. Its dashboard and Records & Insights pages provide factual, animal-centered views of recorded data. It is not intended to diagnose health problems or establish cause and effect from observations.

## Confirmed academic requirements

The professor communicated a **minimum of four microservices/components**, **real-time WebSocket communication**, and **communication between services**. No official rubric specifying authentication, Docker, hosting, or an exact service taxonomy has been provided. The Sensor Simulator is an independently running producer, but unlike the other three backend components it is not an HTTP API server; whether the professor counts it as a fourth microservice should be confirmed.

## Implemented components

1. **Data Management (3001):** pets, feeding records/groups, animal events, enclosure-change records, PDF and CSV ZIP history exports, persisted in its own SQLite database.
2. **Enclosure (3002):** enclosure CRUD, optional habitat information, monitoring mode, manual/simulated automatic measurements, thresholds, current status and historical readings; its own SQLite database.
3. **Notification (3004):** REST intake of environmental events and WebSocket broadcast to connected browser clients; no persistent message history.
4. **Sensor Simulator (no port):** reads enclosure configuration from Enclosure and sends measurements in repeatable scenarios; uses an independent Node process.
5. **Web frontend (5500):** vanilla HTML/CSS/JavaScript, development server with a local REST proxy; not counted as a microservice.

## Main workflows

- Create an enclosure with target temperature/humidity ranges; optionally assign animals.
- Record an individual animal, feeding response, molting/shedding, weights, lengths or husbandry/behavior observations.
- Switch an enclosure between **manual** and **automatic** monitoring; view environmental history and current condition.
- Run the Sensor Simulator to publish normal and out-of-range readings; the Enclosure Service evaluates conditions and sends events to Notification; Notification broadcasts over WebSocket.
- Review Records & Insights for each animal; filter categories and time ranges; export documented observations in PDF or CSV ZIP.

## Design boundaries

- Each SQLite database belongs to its service. Cross-service IDs are validated using HTTP, not cross-database foreign keys.
- Recorded enclosure-assignment changes are facts about specific changes, **not proof of uninterrupted occupancy**. Sensor histories are not automatically attached to animals in exports.
- Automatic environmental readings are simulated; hardware integration is not claimed.
- Authentication/multiple keeper accounts, internet access, mobile installation, hosting and synchronization are future ideas, not Version 1.0 features.
- A local fictional dataset has been used for presentations but is not tracked in Git; reproducible demo seeding is a separate future task.

For technical details, see [architecture](architecture.md), [API reference](api-design.md) and [setup](setup-and-demo.md).
