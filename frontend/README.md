# Exotic Pet Keeper — Web Frontend

The implemented web client is built with vanilla HTML, CSS and JavaScript. It is **not** a standalone static mockup: its pages call the running Data Management and Enclosure APIs and connect to the Notification Service WebSocket.

## Start the frontend

From the repository root:

```powershell
cd frontend
node dev-server.js
```

Open `http://localhost:5500`. No frontend `npm install` or `npm start` is available: there is **no frontend package.json**.

**Do not** open `index.html` directly with `file://` or replace the development server with an arbitrary static server: `dev-server.js` performs routing for `/api/*` requests. Start the backend services first; details are in [the root README](../README.md).

## Pages and workflows

- Dashboard: summary cards, environmental condition checks and notification bell.
- Pets: registration, editing, detail views, individual observations and assignments.
- Enclosures: create/edit, select featured animal, set monitoring mode, inspect readings and enter manual observations.
- Feeding: quick/bulk feeding, groups, individual records and outcomes.
- Records & Insights: animal selection, filters, timelines, charts and exports.

The frontend also contains an old hidden fallback page and a labeled hardcoded Luna example. These are **known cleanup items**, not incomplete application sections, and will be reviewed separately in Stage 6B. The active fictional SQLite demo dataset must be preserved.

## API routing and real-time data

- `http://localhost:5500/api/pets*`, `/api/feedings*`, `/api/feeding-groups*`, and `/api/enclosures/:id/pets` → Data Management on 3001.
- Other `http://localhost:5500/api/enclosures*` routes → Enclosure on 3002.
- Live notification WebSocket connects directly to `ws://localhost:3004` based on the browser hostname. It is **not** proxied through port 5500.
- The frontend server is loopback-only (`127.0.0.1`) and is intended for local development, **not** secure public access or phone access across Wi-Fi.

If a service is unavailable, the frontend may show an error or lack current data; the proxy returns HTTP 502 for unavailable upstream HTTP services. Requests currently have a five-second upstream timeout.

## Assets and styling

`index.html`, `styles.css`, and `app.js` are the active frontend. Artwork lives in `public/assets/illustrations/` and navigation icons in `public/assets/icons/`. See [visual design system](../docs/frontend-visual-design-system.md). Do not replace approved illustration assets during documentation work.

## Known limitations

- No login or private per-user accounts.
- No offline/PWA installation or remotely hosted backend.
- WebSocket alerts are best-effort; on reconnection the client may recheck current enclosure conditions.
- Browser responsiveness and accessibility require final manual verification.
