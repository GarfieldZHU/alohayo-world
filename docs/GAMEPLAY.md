# Gameplay

## Explorer demo

- Enter a seed and generate a deterministic atlas.
- Drag or use WASD/arrow keys to pan; use wheel or controls to zoom.
- Hover/click cells to inspect biome, elevation, moisture, temperature, and coordinates.
- Regenerate without reloading. The last seed is remembered locally.

## Planned modules

RPG movement and encounters consume terrain movement cost and encounter tables.
Settlement building consumes occupancy, resources, suitability, and road layers.
Life simulation consumes time, needs, schedules, homes, and social graphs. Vehicles
consume roads, slopes, surfaces, and navigation graphs. Creature gameplay consumes
habitats, climate ranges, rarity, behavior, and capture systems.

Each module is a registered plugin with data schemas; none may require changing the map
core.
