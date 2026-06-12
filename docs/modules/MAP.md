# Map Module

**Status:** active foundation.

## Owns

Coordinates, chunks, geographic fields, topology, generation passes, authored overlays,
spatial queries, map hashes, and map persistence boundaries.

## Public Capabilities

- query terrain, elevation, climate, landmass, waterbody, and overlays;
- request/retain/release chunks;
- convert cell, world, and screen coordinates;
- subscribe to chunk-ready and overlay-changed events.

## First Vertical Slice

Bounded large atlas with ocean depth, lakes, lowland, highland, rock, mountain, snow,
ecological cover, mainland/island inspection, and worker-applied authored area configs
with landmarks.

## Next Slice

Infinite chunk streaming, real slope, drainage, rivers, watersheds, authored landmarks,
minimap LOD, and benchmark budgets.

## Tests

Seed determinism, topology connectivity, terrain code validity, chunk seam parity,
worker transfer, dimension bounds, and generation latency.
