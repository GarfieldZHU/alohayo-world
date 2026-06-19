# GIS Foundations for World Generation

This document translates useful geographic information system concepts into game
design. It is not a scientific simulation specification; it identifies abstractions
that create believable, deterministic worlds without exceeding browser budgets.

## Core Raster Model

A digital elevation model represents terrain as values on a regular raster grid. That
matches Alohayo World's square-cell storage and chunking. Each cell is a sample, not a
claim that the visible terrain is physically square.

Reference: the USGS GTOPO30 archive describes a global digital elevation model stored
as raster tiles: https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-global-30-arc-second-elevation-gtopo30

## Do Not Collapse Geography into One Biome

The map uses distinct layer families:

1. **Physical fields:** elevation, bathymetric depth, slope, moisture, temperature.
2. **Hydrology:** ocean connection, lakes, drainage direction, flow accumulation,
   rivers, wetlands, watersheds.
3. **Landform:** lowland, highland, mountain, ridge, basin, cliff, bare rock.
4. **Ecological cover:** grassland, savanna, forest, rainforest, desert, snow/ice, marsh.
5. **Special terrains:** reef, canyonlands, plateau, volcanic field, oasis, glacier, tundra.
6. **Topology:** landmass region, mainland, island, waterbody region.
7. **Authored and generated overlays:** roads, settlements, landmarks, borders, protected zones.

The renderer may expose a compact combined terrain code, but systems should query the
underlying layers when the distinction matters.

## Bathymetry and Waterbodies

Bathymetry is underwater topography. Ocean cells should be graded into continental
shelf/shallow sea, open ocean, and deep ocean from submerged elevation rather than
painted one blue.

Reference: NOAA defines bathymetry as the depth and shape of underwater terrain and
describes depth contours: https://oceanservice.noaa.gov/facts/bathymetry.html

Ocean and lake classification requires connectivity:

- Flood-fill submerged cells connected to a map boundary as ocean.
- Classify enclosed submerged regions as lakes.
- Assign stable waterbody IDs for later shorelines, fishing, navigation, and ecology.
- Treat small single-cell basins cautiously; future depression filling may merge or
  remove artifacts before lake classification.

## Landmasses

Flood-fill non-water cells with four-neighbor connectivity. The largest connected
region is the current finite world's mainland; other regions are islands. Store a
region ID per cell. “Mainland” is therefore not a biome and may contain forest,
highland, desert, rock, and settlements.

Future wrapped or infinite worlds need a different mainland definition based on region
area and chunk-spanning union data.

## Slope and Landform

Slope is the local rate of elevation change. It should eventually be computed from a
cell neighborhood and used alongside absolute elevation:

- high elevation plus high slope: mountain or cliff;
- high elevation plus low slope: plateau/highland;
- exposed steep or arid terrain: bare rock;
- low slope and low relative elevation: plain, basin, or wetland candidate.

Reference: ArcGIS Pro slope documentation:
https://pro.arcgis.com/en/pro-app/latest/tool-reference/spatial-analyst/how-slope-works.htm

The current demo approximates these from elevation and climate. `v0.2` adds a real
slope layer.

## Drainage and Watersheds

A watershed drains precipitation and streams toward a common outlet. Drainage divides
usually follow ridges and high ground. Slope affects runoff speed, and depressions can
hold lakes.

Reference: USGS watershed and drainage basin overview:
https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins

Planned deterministic pipeline:

1. remove accidental single-cell pits while retaining authored basins;
2. choose downhill flow direction for every land cell;
3. accumulate upstream flow;
4. trace rivers above content-defined thresholds;
5. group cells by outlet into watersheds;
6. derive floodplains, deltas, lake inflows/outflows, and wetland candidates.

Reference algorithm background: ArcGIS Pro flow direction documentation:
https://pro.arcgis.com/en/pro-app/latest/tool-reference/spatial-analyst/how-flow-direction-works.htm

## Wetlands

Wetlands occur where water covers or saturates soil for meaningful periods. They are
not simply “high moisture” pixels. A stronger model combines low slope, shallow water
table, floodplain or shore proximity, and climate.

Reference: US EPA wetland overview:
https://www.epa.gov/wetlands/what-wetland

The demo keeps a moisture/elevation approximation; drainage data will replace it.

## Scale, Resolution, and LOD

- Logical cell resolution controls simulation detail.
- Visual pixels per cell are a renderer concern.
- Chunk size controls streaming and cache locality.
- Map dimensions control finite-demo extent.
- LOD decides which layers are drawn at a zoom level.

Increasing map dimensions must not silently increase cell size or simulation precision.
The demo supports bounded presets; infinite streaming later removes the finite extent.

## Determinism Rules

- Version every algorithm that changes generated output.
- Iterate neighbors in a fixed order.
- Avoid platform-dependent floating-point shortcuts in parity-sensitive code.
- Include dimensions and generator version in hashes and save metadata.
- Keep authored overlays after procedural base passes so content remains stable.

## Terrain Probability and Human Use

The generator now treats terrain as a climate-and-landform outcome with distinct real-world
likelihoods instead of a flat palette. Common combinations such as lowland plains,
grassland, forest, shallow sea, and coast should dominate. Rare terrains such as reef,
oasis, volcanic fields, canyonlands, and glaciers are gated by narrower temperature,
moisture, relief, and hotspot conditions.

The current terrain material rules, surface effects, movement expectations, hazards,
entry requirements, and destructibility are encoded in `content/core/terrain-rules.json`
and summarized in `TERRAIN_RULES.md`.

Settlements and roads should follow the same logic people use in the real world:

- plains, grasslands, coasts, and lake margins attract denser towns and cheaper roads;
- forests and highlands permit settlement but raise traversal and construction cost;
- wetlands, marshes, deep desert, bare rock, glaciers, and reefs strongly suppress roads;
- ports, oasis stops, forts, and mining outposts appear where terrain creates focused value.
