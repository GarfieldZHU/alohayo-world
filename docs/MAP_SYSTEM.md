# Map System

Read `GIS_FOUNDATIONS.md` for the geographic reasoning, `TERRAIN_RULES.md` for
terrain material/physics rules, `modules/MAP.md` for the implementation boundary, and
`modules/WATER.md` plus `NATURAL_WORLD_POLISH.md` for the next natural-rendering slice.

## Coordinates and Scale

The logical map uses integer square cells `(x, y)` and floating-point world positions
for actors. Square cells support buildings, roads, RPG movement, vehicles, and strategy;
rendered terrain may blend beyond cell boundaries.

The streamed demo survey presets are:

| Name     |  Survey Hint | Chunk Radius | Minimap Radius |
| -------- | -----------: | -----------: | -------------: |
| Frontier |  `512 x 384` |            2 |              6 |
| Expanse  |  `768 x 576` |            3 |              8 |
| Horizon  | `1024 x 768` |            4 |             10 |

Cell resolution, pixels per cell, chunk size, and streamed world extent are independent.
The survey hint anchors authored overlays and initial retention budgets; it is not a hard
world boundary.

## Layer Families

### Physical fields

`elevation`, `moisture`, and `temperature` are continuous `Uint8Array` samples.
Bathymetric depth is derived from elevation below sea level. `v0.2` adds slope.

### Render terrain

The compact `biomes` layer currently combines useful visible classes:

deep ocean, open ocean, shallow sea, reef, coast, beach, lake, basin, lowland plain,
grassland, savanna, forest, rainforest, desert, oasis, wetland, marsh, plateau,
highland, canyonlands, bare rock, mountain, volcano, snowfield, tundra, and glacier.

These codes are stable content identifiers, not the complete geographic truth.
The gameplay and material rules for each code live in
`content/core/terrain-rules.json` and are summarized in `TERRAIN_RULES.md`.

### Topology

`waterbody` assigns IDs to connected water. ID `1` is edge-connected ocean; enclosed
regions are lakes. `landmass` assigns IDs to connected land; `mainlandId` is the largest
finite land region and the rest are islands.

This lets inspection and future systems distinguish a forest on the mainland from a
forest on an island without inventing duplicate biome codes.

For streamed chunks, the runtime currently exposes chunk-local `region` labels:
`sea`, `lake`, `mainland`, and `island`. These are stable enough for inspection,
discovery, and movement decisions, but they are not yet cross-chunk global identities.

### Future layers

Slope, flow direction, accumulation, watershed, river, soil, resources, occupancy,
discovery, borders, roads, settlements, creature habitats, and authored overlays are
separate typed arrays or sparse chunk data.

The current river system is generated as an overlay path, not as a duplicate biome. That
lets a river cross basin, lowland, grassland, forest, canyon floor, or coast while preserving
the underlying terrain and its own movement/material rules.

The current river path is now shaped before rendering through deterministic meander and
smoothing parameters. This is a foundation step, not the final hydrology model.

## Generation Pipeline

1. Hash seed and versioned generator inputs.
2. Generate continuous elevation, moisture, and temperature fields.
3. For finite atlas generation, apply continental edge shaping.
4. For finite atlas generation, flood-fill edge-connected submerged cells as ocean.
5. For finite atlas generation, flood-fill enclosed submerged cells as lakes.
6. For finite atlas generation, flood-fill land regions and select the largest as mainland.
7. For streamed generation, classify each cell directly from deterministic global noise
   and local neighborhood samples.
8. Apply authored overlays after base classification.
9. Hash output layers and transfer buffers from the worker.

Neighbor order is fixed north, east, south, west. Changes that alter output require a
generator version and deterministic test updates.

## Chunks and Streaming

`chunkSize: 64` is the active storage and render boundary. The runtime requests chunks
around the explorer, retains a larger square neighborhood, and evicts distant chunks
from both memory and GPU display lists.

Current behavior:

- unbounded integer chunk coordinates;
- worker-generated typed-array chunk payloads;
- distance-based retention and eviction;
- zoom-dependent chunk detail layers;
- per-cell discovery tracked only for loaded chunks;
- minimap summaries built from discovered chunk data.

Still pending:

- seam-safe coastline blending at chunk borders;
- global landmass, waterbody, and watershed identity merge across chunk boundaries;
- chunk persistence in IndexedDB;
- benchmarked memory budgets for larger retention radii.
- contour-based fog and shoreline rendering that no longer reads as cell-decorated edges.

## Hydrology

Current lakes use connectivity only. The next pipeline adds depression handling, slope,
flow direction, accumulation, rivers, and watersheds. Wetland classification then moves
from a moisture heuristic to drainage and saturation evidence.

## Rendering and LOD

The demo uses layered PixiJS graphics and automatically fits the initial streamed survey.
Neighboring terrain classes receive deterministic edge strips and sparse accent pixels
so boundaries read as natural transitions instead of a hard checkerboard.

Water rendering is now partially centralized in `packages/engine/src/water-render.ts`.
The current stage provides shared coast and river drawing helpers plus deterministic
river shaping. The next stage replaces repeated per-cell water edges with contour-driven
shoreline and bank geometry.

Zoom is cursor-anchored and reveals detail in stages:

- atlas zoom: base geography and blended boundaries;
- regional zoom: elevation/terrain texture accents;
- close zoom: water glints, forest canopy marks, wetland reeds, and rock/highland
  ridges.

Chunk detail layers are built once per loaded chunk and toggled by zoom threshold, so
wheel input does not regenerate geometry. Pan and zoom modify only the viewport. Render
code consumes chunk snapshots and owns no simulation truth.

The next renderer iteration replaces ad hoc per-chunk graphics with chunk meshes or
atlases, stronger camera culling, and zoom-level overlays. Low zoom emphasizes landmass
and bathymetry; high zoom reveals ecological cover, roads, entities, and cell inspection.

## Authored Maps

An authored map is a content-pack overlay: bounds, cell patches, entities, portals,
landmarks, generator parameters, and protected regions. Procedural base passes run
first; authored overlays apply afterward. In the finite atlas, normalized placement is
relative to atlas dimensions. In the streamed world, normalized placement is anchored
against the survey hint and centered around the origin so reusable authored areas remain
reachable without inventing a finite world edge.

## Roads and Settlements

`v0.2` adds a first deterministic human geography layer above terrain:

- settlement candidates are sampled from a global anchor grid and scored from biome
  suitability, comfort, ruggedness, and water access;
- roles such as port, oasis stop, village, town, city, fort, watchpost, and mine are
  selected from terrain-aware rules;
- roads connect nearby hubs through terrain-cost pathfinding, so plains carry denser
  networks while mountains, marshes, reef water, and glaciers resist them.

Road behavior is now split into content-tuned tiers:

- `trail`: narrow fast-enough foot travel through light terrain;
- `road`: packed local roads with stronger movement bonus and visible edging;
- `trade-route`: the broadest and fastest maintained travel corridor;
- `pass`: constrained mountain or canyon routes that stay slower but still guide travel.

The geometry path is smoothed after pathfinding so roads curve through the world instead
of reading only as stair-stepped diagonals and hard elbows. Render-side road surfacing
also samples underlying biome and current weather phase to add mud, snow, gravel, grass,
or rock accents without rewriting the authoritative road network.

This is intentionally a first-pass transport model, not a final civil-engineering or
historical simulation. It creates believable travel corridors that later vehicles, trade,
quests, and faction control can reuse.
