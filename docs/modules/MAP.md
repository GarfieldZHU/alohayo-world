# Map Module

**Status:** streamed exploration foundation active.

## Owns

Coordinates, streamed chunk generation, chunk retention/eviction, geographic fields,
topology, authored overlays, spatial queries, map hashes, discovery boundaries, and map
persistence boundaries.

## Public Capabilities

- query terrain, elevation, climate, landmass, waterbody, and overlays;
- query chunk-local region labels for streamed exploration;
- request/retain/release chunks;
- convert cell, world, and screen coordinates;
- subscribe to chunk-ready and overlay-changed events.

## First Vertical Slice

Unbounded chunk coordinates with streamed terrain, chunk-local sea/lake/mainland/island
labels, discovery-ready authored overlays, and worker-applied landmark configs.

## Next Slice

Global topology continuity, real slope, drainage, rivers, watersheds, persisted
discovery, minimap LOD, benchmark budgets, shared shape hints consumed by the water
module, and a resolved content-pack overlay stream with dependency-safe provenance.

Read `../CONTENT_PACKS.md` when the work touches authored overlays, pack discovery,
optional map-area activation, or future overlay conflict tooling.

## Tests

Seed determinism, topology connectivity, terrain code validity, chunk seam parity,
worker transfer, dimension bounds, and generation latency.
