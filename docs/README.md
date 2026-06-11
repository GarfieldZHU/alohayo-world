# Documentation Map

Start with `../AGENTS.md`, then use this index instead of searching the repository
blindly.

## Product

- `GAME_DESIGN.md`: vision, player promise, non-goals, and future modes.
- `GAMEPLAY.md`: current explorer behavior and gameplay conventions.
- `ROADMAP.md`: milestone status and implementation sequence.
- `DEVELOPMENT_STAGES.md`: gates for growing from atlas to extensible game.

## Engineering

- `ARCHITECTURE.md`: runtime ownership, data flow, workers, rendering, and persistence.
- `MAP_SYSTEM.md`: authoritative map layers, generation passes, topology, chunks, LOD.
- `GIS_FOUNDATIONS.md`: geographic concepts translated into game-system rules.
- `CONTENT_GUIDE.md`: config-first authoring and schemas.
- `MODULE_CATALOG.md`: dependency map and extension protocol.

## Module Plans

Each file in `modules/` is independently implementable and records purpose, contracts,
dependencies, first vertical slice, tests, and deferred work.

- `modules/MAP.md`
- `modules/CHARACTERS.md`
- `modules/WEATHER.md`
- `modules/SETTLEMENTS.md`
- `modules/ECONOMY.md`
- `modules/COMBAT.md`
- `modules/VEHICLES.md`
- `modules/CREATURES.md`

## Decisions

Architecture decision records in `adr/` explain choices that should not be casually
reopened. Add a new ADR when changing a public contract, core renderer, cell topology,
Wasm boundary, persistence model, or geographic layer model.

## Maintenance

- Put durable product and engineering knowledge here, not in issue comments alone.
- Put directory-specific commands and invariants in the nearest `AGENTS.md`.
- Link documents instead of duplicating long explanations.
- Update status language when implementation catches up with or diverges from a plan.
