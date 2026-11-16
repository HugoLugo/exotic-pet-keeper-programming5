# Setup and Demonstration — Exotic Pet Keeper

This is a **local developer/demo workflow**, not a public deployment guide. No steps here overwrite or reset active SQLite databases.

## 1. Prerequisites

- Clone or extract repository on a Windows machine with PowerShell.
- Install Node.js 22+ (the source uses `node:sqlite`). Check `node --version` and `npm --version`.
- Keep four backend processes and the frontend server in separate terminal sessions.
- Ensure ports 3001, 3002, 3004 and 5500 are free.

## 2. First-time installation

From the repository root, install packages separately:

```powershell
cd services/data-management
npm install
cd ../enclosure
npm install
cd ../notification
npm install
cd ../..
```

The Sensor Simulator and frontend development server use built-in Node.js modules and have no separate `npm install` step.

## 3. Start services

Open five PowerShell windows at the repository root and run:

| Terminal | Commands |
| --- | --- |
| Data | `cd services/data-management` then `npm start` |
| Enclosure | `cd services/enclosure` then `npm start` |
| Notification | `cd services/notification` then `npm start` |
| Frontend | `cd frontend` then `node dev-server.js` |
| Sensor (optional) | `cd services/sensor` then set `$env:ENCLOSURE_ID = "<existing ID>"` and run `node src/index.js` |

Start the Sensor Simulator **after** you have an existing enclosure set to automatic monitoring. For the original author's local demo data, enclosure ID `4` was used, but fresh databases do not contain it. The simulator defaults to ID `1`, which may also be absent.

Visit `http://localhost:5500`. This development server binds only to loopback and is **not** available to phones on Wi-Fi without future code/configuration changes.

## 4. Read-only checks

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3002/health
Invoke-RestMethod http://localhost:3004/health
Invoke-RestMethod http://localhost:3002/enclosures
Invoke-RestMethod http://localhost:3001/pets
```

These calls do not create records. Starting a service may create an empty SQLite database if one is absent; never start it against copied data without first identifying the intended environment.

## 5. Suggested presentation walkthrough

1. Explain the three REST API services, the independent Sensor Service, and the frontend; show separate terminal processes and the [architecture diagram](architecture.md).
2. Open Dashboard, show current animals and enclosures from SQLite.
3. Open Pets; demonstrate individual details, assignments and an animal event already available in the demonstration dataset.
4. Open Feeding; show quick feeding, outcomes and history (use fictional demo records when testing writes).
5. Open Enclosures; explain manual versus automatic mode and environmental thresholds.
6. Start Sensor Simulator for a **known** automatic enclosure; observe stored readings and WebSocket notification events when values cross thresholds.
7. Open Records & Insights; demonstrate category/date filtering and export a PDF and CSV ZIP for an animal.
8. Explicitly explain that environmental sensor history is enclosure-level and is not falsely attributed to animals after relocation.

Do not claim the demo walkthrough was validated until the separate testing stage is complete. The current source archive **does not include** the author's five-animal demonstration database.

## 6. Troubleshooting

- `npm start` in `frontend` fails: expected; use `node dev-server.js`.
- No readings from Sensor: check `ENCLOSURE_ID` matches a real enclosure and that it is set to automatic mode; inspect Sensor terminal output.
- Proxy 502: the relevant backend service is not running on its expected port, or timed out.
- No WebSocket connection: check Notification on 3004 and browser developer tools; REST proxy does not route WebSockets.
- Empty database on fresh clone: expected; database files are Git-ignored. Follow [demo-data policy](demo-data.md).

## 7. Scope and safety

No authentication or encryption is implemented. Do not port-forward or publicly expose backend ports or the frontend. Physical sensors, mobile/PWA installation, and shared cloud accounts are not part of this release.
