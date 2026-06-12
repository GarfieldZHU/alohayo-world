# Gameplay

## Explorer demo

- Enter a seed and generate a deterministic atlas.
- Walk with WASD/arrow keys; hold Shift to run.
- Use E or Space to interact with a nearby landmark.
- Drag to pan the camera; use wheel or trackpad to zoom toward the pointer.
- Hover/click cells to inspect biome, elevation, moisture, temperature, and coordinates.
- Regenerate without reloading. The last seed is remembered locally.

The character occupies one ninth of a terrain cell's area and moves continuously within
cell coordinates. See `MOVEMENT_AND_ACTIONS.md`.

## Planned modules

RPG movement and encounters consume terrain movement cost and encounter tables.
Settlement building consumes occupancy, resources, suitability, and road layers.
Life simulation consumes time, needs, schedules, homes, and social graphs. Vehicles
consume roads, slopes, surfaces, and navigation graphs. Creature gameplay consumes
habitats, climate ranges, rarity, behavior, and capture systems.

Each module is a registered plugin with data schemas; none may require changing the map
core.

## World Mode and Game Mode

- **World Mode** keeps the current free camera and atlas-scale inspection workflow.
- **Game Mode** is the next player-facing loop with a fixed follow camera, embodied traversal, HUD, and seeded sites.
- World Mode should expose coordinate, elevation/z-band, terrain, and route information that Game Mode later consumes through HUD panels instead of a full-map camera.

## Planned Game Mode HUD

- status: health, stamina, condition, and active movement mode;
- actions: interact, inspect, rest, tools, and future abilities;
- minimap: roads, settlements, discovered sites, and camera orientation;
- world readouts: coordinates, terrain, elevation band, nearest road/site.
