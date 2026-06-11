# Development Stages

## Stage A: Geographic Foundation

- Layered terrain classes, ocean depth, lakes, mainland/island topology.
- Larger bounded map presets and responsive camera fitting.
- Agent guides, GIS model, module contracts, and deterministic tests.

Gate: CI and Pages pass; the blog can select and regenerate larger worlds.

## Stage B: Streamed World

- Chunk address space, generation cache, culling, eviction, and seam tests.
- Slope, drainage, rivers, watersheds, coast continuity, authored overlays.
- Minimap, discovery layer, IndexedDB save snapshots, performance budgets.

Gate: continuous travel across generated chunks without visible seams or unbounded
memory growth.

## Stage C: Living Explorer

- Character definitions, movement, collision, path queries, time, weather.
- One explorer sprite and one inspect/interact loop.
- Save migration and content-pack dependency loading.

Gate: a player can travel, inspect, rest, and resume locally.

## Stage D: Settlement Simulation

- Resources, inventories, construction footprints, jobs, local economy.
- Settlement growth driven by config and world suitability.

Gate: one small settlement can be founded and simulated deterministically.

## Stage E: Optional Gameplay Plugins

- Combat and equipment.
- Vehicles and road travel.
- Creature ecology, observation, and collection.
- Scenario packs combining systems without changing engine code.

Gate: each plugin can be disabled, replaced, or configured independently.

## Release Discipline

Each stage updates public schemas, module documents, benchmarks, migration notes, and
the roadmap. A feature is not complete until standalone Pages and the blog embed remain
green.
