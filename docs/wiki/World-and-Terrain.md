# World and Terrain

The world is generated from continuous elevation, moisture, temperature, topology,
hydrology, and local surface layers. Display terrain is a classification of those fields,
not the source of truth. Ocean versus lake and mainland versus island are topology;
forest, desert, snow, and wetland are climate and material outcomes.

## Gameplay Contract

Every terrain exposes stable IDs and data-defined behavior: generation conditions,
frequency weight, movement and control costs, exposure, permitted surface effects,
required traversal capabilities, and reversible transformations. Roads, weather, water,
characters, and settlements consume those rules rather than duplicating them.

Examples:

- marsh slows unprepared travelers and accepts water, mud, frost, and snow surfaces;
- mountain rewards climbing equipment and favors defensible passes over direct roads;
- desert raises heat and water pressure while roads cluster around reliable routes;
- rivers cross cells as a hydrology feature and require ford, bridge, swimming, boat, or
  flight capability instead of becoming a climate biome;
- beaches are coastal material bands, while basins are low-relief landforms surrounded by
  higher terrain.

## Authoritative References

- `docs/TERRAIN_RULES.md`: readable rule catalog.
- `content/core/terrain-rules.json`: machine-readable physics and transformations.
- `content/core/biomes.json`: climate classification and palette.
- `docs/GIS_FOUNDATIONS.md`: geographic reasoning.
- `docs/MAP_SYSTEM.md`: generation, chunks, topology, hydrology, and streaming.

New character content must reference terrain IDs and capability tags. It must not infer
behavior from translated terrain names or renderer colors.
