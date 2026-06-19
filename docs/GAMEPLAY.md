# Gameplay

## Explorer demo

- Enter a seed and generate a deterministic streamed world.
- Choose a survey preset; it changes the initial chunk budget and minimap reach, not the
  ultimate world boundary.
- Walk with WASD/arrow keys; hold Shift to run.
- Use E or Space to interact with a nearby landmark.
- In game mode, the camera stays centered on the explorer with a tight locked zoom tuned
  for traversal and encounters.
- In dev mode, drag pans the camera and wheel/trackpad zooms toward the pointer.
- Hover/click cells to inspect biome, elevation, moisture, temperature, and coordinates.
- Discover nearby cells as you travel; the minimap fills only from discovered chunk data.
- Regenerate or enlarge without reloading. The last seed is remembered locally.

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

## Developer demo

The next debug-only testing surface should allow:

- reveal or hide discovery shadow without entering a full combat mode;
- fast movement multiplier, flight, and instant teleport to any cell/chunk coordinate;
- direct equipment and weapon slot override for the active explorer;
- collapse and reopen the debug panel without leaving the world;
- repeatable test setup without changing public save data or shipping these controls to
  normal players by default.

Longer term, flight should move from a pure debug capability into a registered movement
capability granted by equipment, vehicles, mounts, or ability effects rather than by
special-case runtime branches.
