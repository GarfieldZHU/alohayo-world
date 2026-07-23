# World and Terrain

> **Wiki page version:** EN 1.1.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-23
> **中文:** [世界与地形](World-and-Terrain-zh-CN) · **Translation status:** synced with EN 1.1.0

The map is the central simulation model. Terrain is derived from continuous geography,
not painted first and rationalized later. The same stable fields support exploration,
roads, settlements, creatures, weather, combat positioning, and authored regions.

## Geographic Layers

| Layer             | Examples                                                       | Authority                        |
| ----------------- | -------------------------------------------------------------- | -------------------------------- |
| continuous fields | elevation, moisture, temperature, slope                        | deterministic generator          |
| hydrology         | filled elevation, D8 flow, accumulation, watershed, depression | map/Wasm raster                  |
| topology          | ocean/lake body, mainland/island identity, retained aliases    | map topology resolver            |
| geomorphology     | erosion potential, sediment, deposition, floodplain            | deterministic metadata           |
| terrain/material  | forest, desert, wetland, mountain, glacier                     | biome classification + config    |
| features          | rivers, roads, settlements, authored overlays                  | typed feature layers             |
| surfaces          | water, mud, snow, frost, ash, burn scars                       | reversible weather/action layers |
| presentation      | contours, transitions, details, fog, lighting                  | engine renderer                  |

Ocean versus lake and mainland versus island are topology. River is a linear hydrology
feature that crosses cells. Bay, gulf, strait, delta, cave, peninsula, cliff, and valley
belong to feature/landform layers. Keeping these separate avoids duplicate biomes and lets
gameplay ask precise questions.

## Core Terrain Catalog

| Stable ID          | English        | 中文     | Frequency | Primary condition and gameplay identity                       |
| ------------------ | -------------- | -------- | --------- | ------------------------------------------------------------- |
| `core:deep-ocean`  | Deep Ocean     | 深海     | common    | very low, remote ocean; blocks ordinary foot travel           |
| `core:ocean`       | Open Ocean     | 远洋     | common    | edge-connected water beyond shallows; navigation and storms   |
| `core:shallow-sea` | Shallow Sea    | 浅海     | common    | near-land low-depth water; boats, shoals, sediment            |
| `core:coast`       | Coast          | 海岸     | common    | near sea level and water; ports, tides, flooding              |
| `core:lake`        | Lake           | 湖泊     | uncommon  | enclosed inland water; freshwater, boats, drainage            |
| `core:beach`       | Beach          | 海滩     | uncommon  | sandy low-slope coast; loose/wet sand transitions             |
| `core:basin`       | Basin          | 盆地     | uncommon  | low relief enclosed by higher land; fertile but flood-prone   |
| `core:lowland`     | Lowland Plain  | 低地平原 | common    | low relief; easiest roads, farms, towns, and travel           |
| `core:grassland`   | Grassland      | 草原     | common    | moderate open land; fast travel, herds, fire                  |
| `core:forest`      | Forest         | 森林     | common    | moist temperate land; resources, concealment, slower movement |
| `core:desert`      | Desert         | 沙漠     | uncommon  | hot and dry; heat, thirst, loose sand, storms                 |
| `core:wetland`     | Wetland        | 湿地     | uncommon  | saturated low ground; mud, flood, causeways                   |
| `core:highland`    | Highland       | 高地     | common    | elevated broken ground; wind, cold rain, passes               |
| `core:bare-rock`   | Bare Rock      | 裸岩     | uncommon  | thin soil and exposed stone; scree, minerals, poor roads      |
| `core:mountain`    | Mountain       | 高山     | uncommon  | very high rugged relief; climbing, falls, barrier routes      |
| `core:snow`        | Snowfield      | 雪原     | uncommon  | cold snow-covered land; traction, cold, whiteout              |
| `core:tundra`      | Tundra         | 苔原     | uncommon  | cold treeless land; frozen travel and thaw cycles             |
| `core:savanna`     | Savanna        | 稀树草原 | uncommon  | hot seasonal grass/trees; open travel, heat, fire             |
| `core:rainforest`  | Rainforest     | 雨林     | rare      | hot and very wet; biomass, disease, poor visibility           |
| `core:marsh`       | Marsh          | 沼泽     | rare      | very wet warm lowland; sink mud, reeds, boats                 |
| `core:plateau`     | Plateau        | 高原     | rare      | high but locally level ground; open upland and scarps         |
| `core:canyon`      | Canyonlands    | 峡谷荒原 | rare      | dry rugged relief; chokepoints, cliffs, flash floods          |
| `core:reef`        | Coral Reef     | 珊瑚礁   | rare      | warm shallow water; biodiversity and boat hazards             |
| `core:oasis`       | Oasis          | 绿洲     | rare      | groundwater refuge in arid land; settlement pressure          |
| `core:volcano`     | Volcanic Field | 火山地   | very rare | rugged hotspot; heat, gas, ash, rare resources                |
| `core:glacier`     | Glacier        | 冰川     | very rare | cold high ice mass; crevasses, sliding, melt                  |

## Per-Terrain Physics Contract

Every terrain definition has:

- real-world description and Alohayo behavior;
- generation weight and required environmental conditions;
- allowed surface layers;
- movement, control, exposure, entry capability, and hazard behavior;
- destructibility and transformation methods;
- creature habitat tags, settlement suitability, road cost, and palette.

The machine authority is `content/core/terrain-rules.json` plus
`content/core/biomes.json`. `docs/TERRAIN_RULES.md` is the complete readable catalog.
English and Chinese labels are required before a terrain can pass content validation.

## Surfaces and Transformation

Weather and actions first add temporary surfaces: rain produces water and mud; snow
settles on roads and canopy; thaw creates slush; heat melts ice; fire leaves burn scars.
Surfaces fade or evolve without replacing the base terrain. A transformation changes the
terrain only when the rule explicitly says the underlying material changed, for example
long-term glacier melt toward snowfield/lake or saturated sand toward wet sand and runoff.

Destruction is therefore layered: remove a tree or snow cover without deleting the soil;
excavate a road or mine without pretending rock became grass; flood a plain temporarily
before a persistent geomorphology system decides whether deposition creates new land.

## Streaming and Determinism

Chunks are deterministic for generator version, seed, coordinates, size, and resolved
content. Nearby chunks are retained, distant chunks evicted, and topology summaries kept
beyond the render horizon. Negative coordinates and load order must not change output.
The same seed reproduces hashes and fields; authored overlays apply in stable pack order.

## Water Terrain and Seams

Water has three different authorities which must not be collapsed into one biome label:

| Question                                   | Current authority | Meaning                                               |
| ------------------------------------------ | ----------------- | ----------------------------------------------------- |
| Is this water ocean-connected or enclosed? | topology resolver | ocean/sea vs lake identity                            |
| Which way does local drainage flow?        | hydrology raster  | D8 direction, accumulation, local watershed component |
| How should the renderer soften a shore?    | render hint       | local signed shoreline distance and contours          |

The current shoreline field is signed: negative for water, positive for land, zero on a
water/land boundary, and `+/-127` when no local shoreline is present. It drives a subtle
water material band under the contour renderer; it does not change terrain IDs, movement,
or topology.

Every chunk also publishes a `ChunkDrainageSummary` with its cardinal flow handoffs. Its
state is `provisional`: chunks have not yet reconciled a halo or canonical watershed
identity. Issue [#38](https://github.com/GarfieldZHU/alohayo-world/issues/38) owns
halo generation, pairwise seam reconciliation, graph identities, persistence, and
load-order benchmarks. Issue [#41](https://github.com/GarfieldZHU/alohayo-world/issues/41)
owns the halo-aware shoreline field, GPU fog mask, and specialized lake/estuary/delta
materials. Never use a local field as proof that a river ends at a chunk edge.

## Developer Showcase

`core:terrain-showcase` places all 26 types near the origin for i18n, rendering, movement,
road, weather, and rule testing. It is opt-in dev content and never part of normal world
generation.
