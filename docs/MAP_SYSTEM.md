# Map System

## Coordinates and cells

The logical map uses integer square cells `(x, y)` with floating-point world positions
for actors. Square cells support RPG movement, buildings, roads, vehicles, and strategy
while visuals blend beyond the cell boundary.

## Layers

Each chunk stores tightly packed typed arrays for elevation, moisture, temperature,
biome, occupancy, discovery, and optional overlays. v0.1 renders a finite `128 x 96`
atlas as four `64 x 64`-class chunks; v0.2 streams an unbounded coordinate space.

## Generation

Seed hashing feeds octave value noise. Continental elevation is shaped by edge falloff;
temperature combines latitude and elevation; moisture combines noise and ocean
proximity. Ordered biome rules convert these continuous fields into ocean, coast,
grassland, forest, desert, wetland, mountain, and snow.

Later passes add drainage, rivers, erosion, resources, roads, authored landmarks, and
spawn tables. Every pass is deterministic and versioned.

## Rendering

Visible chunks are culled against the camera. Terrain is batched into graphics commands
for the demo and will move to atlases/meshes after profiling. Zoom controls LOD and
overlays. Render code consumes chunk snapshots and owns no simulation truth.

## Authored maps

An authored map is a content-pack overlay: bounds, cell patches, entities, portals,
landmarks, and generator overrides. Adding a folder and manifest entry must be enough to
load a new map.
