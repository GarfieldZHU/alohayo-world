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

The pure hydrology raster is a promoted Rust/Wasm worker batch: priority flood, slope,
D8 direction, accumulation, watershed IDs, and depression depth. TypeScript remains the
reference fallback and owns water masks, geomorphology policy, terrain classification,
rivers, roads, overlays, and rendering.

## Next Slice

Cross-chunk drainage and rivers, minimap LOD, benchmark budgets, shared shape hints consumed by the water
module, and a resolved content-pack overlay stream with dependency-safe provenance.

Issue `#38` follows the staged contract in `../CROSS_CHUNK_HYDROLOGY.md`. A fixed halo is
only provisional; exact seam behavior comes from deterministic pairwise reconciliation and
a map-owned watershed/river resolver.

## Issue #12: Cross-Chunk Topology Delivery Stages

Issue `#12` promotes current chunk-local `sea`, `lake`, `mainland`, and `island`
labels into cross-chunk topology identities. Complete these stages in order; do not make
renderer-only guesses about topology.

1. **Complete: contract and fixtures.** `ChunkTopologySummary` carries typed local
   component labels, cardinal edge samples, medium metadata, and explicit provisional
   identity state. Regression fixtures include negative coordinates.
2. **Complete: deterministic summaries.** Summaries are generated with each worker
   chunk from the same typed biome/water data as its interior, then transferred without
   renderer involvement.
3. **Complete: retained-horizon resolver.** The map-owned union-find joins matching
   north/east/south/west components in a fixed order. Canonical aliases are deterministic
   even when chunks arrive in a different order.
4. **Complete: runtime lifecycle.** The streamed engine registers summaries on chunk
   arrival and releases retained summaries on eviction while preserving alias parents for
   a later reload. Save serialization is deliberately tracked with persistent discovery
   expansion, not hidden in PixiJS state.
5. **Complete: core consumer bridge.** Cell queries expose resolved topology identity;
   terrain rendering already samples global neighboring cells for seams. Wider hydrology,
   road, and minimap semantics consume this map contract in their own modules.
6. **Complete: regression coverage.** Tests cover load order, eviction/reload, negative
   coordinates, and deterministic generated summaries. Diagonal-stream stress remains a
   performance extension rather than a correctness blocker.
7. **Handoff.** Issue `#9` can consume continuous topology for drainage/rivers and #20
   can consume seam-safe contour inputs. Erosion/floodplain metadata remains in #29;
   Wasm ownership remains in #30.

The resolver may report a provisional identity at the exploration frontier because an
unbounded world cannot prove global connectivity from unloaded space. Its canonical ID
and alias chain remain deterministic for the retained horizon.

Issue `#37` completed persistent alias history and explicit topology-change events. The
ledger stores only non-canonical aliases, is capped at 20,000 aliases and 2 MiB serialized,
and is restored before the first streamed chunk. Merge/frontier notifications are map-owned;
the engine refreshes minimap and inspection state, while hydrology, roads, settlements, and
future habitat systems must either resolve IDs at read time or subscribe before caching.

Legacy schema-one saves without a ledger migrate to an empty version-one ledger. Invalid
records fail as `corrupt`; unsupported resolver/schema versions fail as
`unsupported-version`. Regression coverage includes negative coordinates, load order,
eviction/reload, diagonal travel, save round trips, legacy migration, and browser restart.

Read `../CONTENT_PACKS.md` when the work touches authored overlays, pack discovery,
optional map-area activation, or future overlay conflict tooling.

## Tests

Seed determinism, topology connectivity, terrain code validity, chunk seam parity,
worker transfer, dimension bounds, and generation latency.
