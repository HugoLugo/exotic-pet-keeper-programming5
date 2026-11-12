# Exotic Pet Keeper — Project Description

## 1. Project Overview

Exotic Pet Keeper is a mobile-friendly application designed
to help exotic animal owners manage their pets, feeding
records, and enclosure environmental conditions.

The application focuses on animals such as reptiles,
tarantulas, scorpions, and other exotic pets.

This project is developed for the Programming 5 course
at the University of Pécs.

The main objective is to demonstrate communication
between independent microservices using REST APIs
and real-time communication using WebSockets.

## 2. Project Objectives

The main objectives are:

- Develop four independent backend microservices.
- Implement REST API communication.
- Implement real-time notifications using WebSockets.
- Store and retrieve pet and feeding records.
- Monitor simulated environmental sensor readings.
- Detect abnormal enclosure conditions.
- Provide a mobile-friendly client application.

## 3. System Components

The system consists of four microservices and one client.

### 3.1 Data Management Service

Responsible for storing and managing pet information.

Main functions:
- Add, edit, delete, and view pets.
- Store species and basic animal information.
- Record feeding events.
- Retrieve feeding history.

### 3.2 Enclosure Service

Responsible for monitoring environmental conditions.

Main functions:
- Receive temperature and humidity readings.
- Store the latest enclosure measurements.
- Compare measurements against configured ranges.
- Detect abnormal environmental conditions.
- Send alert events to the Notification Service.

### 3.3 Sensor Service

Responsible for simulating environmental sensors.

Main functions:
- Generate simulated temperature measurements.
- Generate simulated humidity measurements.
- Send measurements periodically to the Enclosure Service.
- Generate normal and abnormal readings for testing.

Physical sensor hardware is not required.

### 3.4 Notification Service

Responsible for delivering real-time environmental alerts.

Main functions:
- Receive abnormal-condition events.
- Prepare notification messages.
- Deliver alerts through WebSocket.
- Notify connected clients immediately.

## 4. Client Application

The system includes one mobile-friendly web application.

Users will be able to:
- View and manage pets.
- Record feeding events.
- View feeding history.
- Check enclosure conditions.
- Receive real-time environmental alerts.

## 5. Communication

The application uses two communication mechanisms.

### REST API

REST APIs are used for:
- Client requests to backend services.
- Communication between the Sensor and Enclosure Services.
- Sending alert events from the Enclosure Service
  to the Notification Service.

### WebSocket

WebSocket is used to deliver real-time environmental
alerts from the Notification Service to connected clients.

Normal environmental readings do not trigger notifications.

## 6. Data Persistence

The application stores:

- Pet information.
- Feeding records.
- Enclosure configuration.
- Latest environmental readings.

SQLite will be used for local data persistence.

The Data Management Service and Enclosure Service will
manage their own data independently.

## 7. Technologies

- JavaScript
- Node.js
- Express.js
- WebSocket (ws)
- SQLite
- HTML
- CSS
- Git and GitHub

## 8. Project Scope

The project focuses on demonstrating microservice
architecture and distributed communication.

The following features are excluded:

- User authentication.
- Physical IoT sensors.
- Advanced statistics.
- Social features.
- Complex feeding schedules.

The goal is to develop a small but functional distributed
system rather than a commercial application.
