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
