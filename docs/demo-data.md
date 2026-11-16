# Demonstration Data — Reproducibility and Preservation

## Current state

The author's local demonstration environment contains a fictional five-animal, five-enclosure dataset, including feeding histories, observations, environmental readings and a relocation example. **The active SQLite databases are ignored by Git and are not included in the archived repository.** A standalone reproducible seed generator is **not yet present**. The labeled hardcoded Luna entry in the frontend is not part of this local SQLite data.

## First-time users

Running the Data Management and Enclosure services for the first time creates empty SQLite databases if the expected files do not exist:

- `services/data-management/data/pets.db`
- `services/enclosure/data/enclosures.db`

Users can then add fictional animals and enclosures using the frontend. Do not expect a fresh clone to contain the original fictional demonstration records or any fixed enclosure IDs.

## Preservation rules

1. Do **not** delete, overwrite, reinitialize, or commit the author's existing local `.db` files.
2. Never assume IDs such as `4` will exist on another computer.
3. Any future seed script must be opt-in, generate *fictional* records, and default to a separate/demo-only environment or explicitly refuse to run when data exists.
4. Cross-service records must be created in an order that preserves enclosure references and animal ownership of feeding and event history.
5. Avoid claiming that archived enclosure sensor readings belong to an animal solely on the basis of a current assignment.

## Future Stage 6D deliverable (not implemented)

A reviewed, deterministic demo generator or documented dataset snapshot should allow a fresh installation to recreate a coherent demonstration **without modifying active user data**. The generator must be tested separately and its output clearly labeled as fictional.
