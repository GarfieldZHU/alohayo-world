# Gameplay Module Plans

These documents are implementation contracts, not promises that every module is active.
Work on one module at a time and preserve the dependency direction in
`../MODULE_CATALOG.md`.

Each module starts with configuration and a minimal vertical slice. Cross-module
behavior goes through public queries, commands, and events rather than shared mutable
objects.

Current module files:

- `MAP.md`
- `WATER.md`
- `ROADS.md`
- `CHARACTERS.md`
- `WEATHER.md`
- `SETTLEMENTS.md`
- `ECONOMY.md`
- `COMBAT.md`
- `FLIGHT.md`
- `VEHICLES.md`
- `CREATURES.md`
