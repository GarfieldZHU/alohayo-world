# ADR 0006: Public retained hydrology query surface

## Status

Accepted for the current additive `GameHandle` API.

## Decision

Expose read-only hydrology through optional `GameHandle` methods:

- `queryHydrologyCell(x, y)` returns fields only for a currently retained cell and returns
  `null` for an unknown cell;
- `getRiverGraph()` returns stable world-coordinate D8 links for retained chunks, uses
  schema version 2, caps the snapshot at 16,384 segments, and marks unknown upstream and
  downstream cells as provisional frontiers;
- `subscribeHydrology(listener)` reports chunk load, seam reconciliation, and eviction, and
  returns an unsubscribe function.

Canonical watershed identities come from the map-owned resolver. Local array labels and
renderer state do not escape through these queries. The graph is complete for selected river
links in loaded chunks. Signed corrections propagate along loaded downstream paths. Incoming
halo links use coordinate-stable IDs and switch to raster-derived links when their source
chunk is retained. Hydrology beyond the deterministic halo and retained horizon remains
provisional; consumers must not treat a frontier as proof that a river ends.

The resolver propagates signed seam accumulation deltas through loaded downstream D8 paths
and stops at explicit unknown frontiers. `GameHandle.destroy()` clears subscriptions with the
rest of the runtime. The API is read-only; it does not add network persistence or let
consumers mutate hydrology.

## Consequences

Road, bridge, settlement, flooding, and minimap systems can share one canonical query surface
instead of reading Pixi objects or duplicating per-chunk hydrology logic. Consumers must check
cell availability and graph completeness. Future graph expansion can add interior links while
preserving these query methods and the current major version.
