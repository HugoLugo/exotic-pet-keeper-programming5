# Frontend dashboard preview (Phase 1)

This is a **dependency-free, static design prototype** for the Programming 5 Exotic Pet Keeper project.

## Run locally

From the repository root, run:

```powershell
cd frontend
npx --yes http-server . -p 5500 -c-1
```

Then visit `http://localhost:5500`. If Python is available, `python -m http.server 5500` also works. Alternatively open `frontend/index.html` directly; a local server is recommended.

## Current scope

- Responsive dashboard layout following the approved Soft Illustrative Cards direction.
- Reuses the four approved WebP illustrations from `frontend/public/assets/illustrations/animals`.
- Example statistics, environmental readings, pet cards, alerts, and feeding history.
- Pet search filters example cards. Navigation displays placeholder content for unimplemented pages.
- "Add Pet" and "View History" intentionally do not save or retrieve data; they display explanatory messages.

**Important:** Displayed sample values are not fetched from the backend. No authentication, persistence, API fetches, or WebSocket integration are implemented in this phase.

## Next steps

1. Review and approve visual layout, responsive behavior, and design tokens.
2. Implement Pets and Enclosures screens and reusable data components.
3. Connect the real endpoints from `docs/api-design.md` (Data Management at :3001, Enclosure at :3002, Notification WebSocket at :3004); confirm CORS/or use a same-origin development proxy.
4. Implement loading, empty, error, and live-update states, and test with running services.

## Dashboard visual revision (14 November 2026)

- Retained the existing temporary star-shaped brand mark, without introducing a new logo asset.
- Removed the demo profile initial, since the current Programming 5 scope does **not** include authentication or per-user accounts. Do not infer account support from the UI.
- Adjusted gecko positioning in the Registered Pets tile to avoid cutting off its head.
- Replaced placeholder enclosure and alert glyphs with modest inline SVG illustrations.
- Adjusted the scorpion's presentation independently inside the pet card without editing the approved WebP.
- All values and interactions remain a design preview and are not connected to services.
- Using `npx http-server` is a local development choice; it does not change the backend architecture.
