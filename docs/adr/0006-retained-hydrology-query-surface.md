# ADR 0006: Public retained hydrology query surface

## Status

Accepted for the current additive `GameHandle` API.

## Decision

Expose read-only hydrology through optional `GameHandle` methods:

- `queryHydrologyCell(x, y)` returns fields only for a currently retained cell and returns
  `null` for an unknown cell;
- `getRiverGraph()` returns stable world-coordinate seam segments and reports its current
  `reconciled-seams` coverage explicitly;
- `subscribeHydrology(listener)` reports chunk load, seam reconciliation, and eviction, and
  returns an unsubscribe function.

Canonical watershed identities come from the map-owned resolver. Local array labels and
renderer state do not escape through these queries. The graph snapshot is intentionally
partial until within-chunk links, accumulation propagation, and source-to-mouth traversal are
implemented. Consumers must not treat missing graph coverage as proof that a river ends.

`GameHandle.destroy()` clears subscriptions with the rest of the runtime. The API is
read-only; it does not add network persistence or let consumers mutate hydrology.

## Consequences

Road, bridge, settlement, flooding, and minimap systems can share one canonical query surface
instead of reading Pixi objects or duplicating per-chunk hydrology logic. Consumers must check
cell availability and graph completeness. Future graph expansion can add interior links while
preserving these query methods and the current major version.
