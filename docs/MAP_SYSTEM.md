# Map System

Read `GIS_FOUNDATIONS.md` for the geographic reasoning and `modules/MAP.md` for the
implementation boundary.

## Coordinates and Scale

The logical map uses integer square cells `(x, y)` and floating-point world positions
for actors. Square cells support buildings, roads, RPG movement, vehicles, and strategy;
rendered terrain may blend beyond cell boundaries.

The demo presets are:

| Name        |  Dimensions |   Cells |
| ----------- | ----------: | ------: |
| Large       | `256 x 192` |  49,152 |
| Huge        | `320 x 240` |  76,800 |
| Continental | `384 x 288` | 110,592 |

Cell resolution, pixels per cell, chunk size, and finite map extent are independent.
The presets are bounded until chunk streaming makes world extent independent of memory.

## Layer Families

### Physical fields

`elevation`, `moisture`, and `temperature` are continuous `Uint8Array` samples.
Bathymetric depth is derived from elevation below sea level. `v0.2` adds slope.

### Render terrain

The compact `biomes` layer currently combines useful visible classes:

deep ocean, open ocean, shallow sea, coast, lake, lowland, grassland, forest, desert,
wetland, highland, bare rock, mountain, and snow.

These codes are stable content identifiers, not the complete geographic truth.

### Topology

`waterbody` assigns IDs to connected water. ID `1` is edge-connected ocean; enclosed
regions are lakes. `landmass` assigns IDs to connected land; `mainlandId` is the largest
finite land region and the rest are islands.

This lets inspection and future systems distinguish a forest on the mainland from a
forest on an island without inventing duplicate biome codes.

### Future layers

Slope, flow direction, accumulation, watershed, river, soil, resources, occupancy,
discovery, borders, roads, and authored overlays are separate typed arrays or sparse
chunk data.

## Generation Pipeline

1. Hash seed and versioned generator inputs.
2. Generate continuous elevation, moisture, and temperature fields.
3. Apply continental edge shaping.
4. Flood-fill edge-connected submerged cells as ocean.
5. Flood-fill enclosed submerged cells as lakes.
6. Flood-fill land regions and select the largest as mainland.
7. Classify visible terrain from physical fields plus topology.
8. Hash output layers and transfer buffers from the worker.

Neighbor order is fixed north, east, south, west. Changes that alter output require a
generator version and deterministic test updates.

## Chunks and Streaming

The current finite atlas is generated as one worker job and rendered as one graphics
batch. `chunkSize: 64` defines the next storage boundary but is not yet an active
streaming implementation.

`v0.2` will:

- generate addressable chunk coordinates with seam-safe shared inputs;
- retain visible and near-visible chunks;
- evict distant chunks under a memory budget;
- render only camera-visible batches;
- merge landmass, waterbody, and watershed identity across chunk boundaries.

## Hydrology

Current lakes use connectivity only. The next pipeline adds depression handling, slope,
flow direction, accumulation, rivers, and watersheds. Wetland classification then moves
from a moisture heuristic to drainage and saturation evidence.

## Rendering and LOD

The demo uses layered PixiJS graphics and automatically fits a newly generated map.
Neighboring terrain classes receive deterministic edge strips and sparse accent pixels
so boundaries read as natural transitions instead of a hard checkerboard.

Zoom is cursor-anchored and reveals detail in stages:

- atlas zoom: base geography and blended boundaries;
- regional zoom: elevation/terrain texture accents;
- close zoom: water glints, forest canopy marks, wetland reeds, and rock/highland
  ridges.

The detail layers are built once per generated world and toggled by zoom threshold, so
wheel input does not regenerate geometry. Pan and zoom modify only the viewport. Render
code consumes snapshots and owns no simulation truth.

The next renderer replaces full-map drawing with chunk meshes or atlases, camera
culling, and zoom-level overlays. Low zoom emphasizes landmass and bathymetry; high zoom
reveals ecological cover, roads, entities, and cell inspection.

## Authored Maps

An authored map is a content-pack overlay: bounds, cell patches, entities, portals,
landmarks, generator parameters, and protected regions. Procedural base passes run
first; authored overlays apply afterward. Adding a validated folder and manifest entry
must be enough to load a new map.
