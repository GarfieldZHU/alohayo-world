# Release Checkpoints

## v0.1.2 - World Foundation Checkpoint

This release consolidates the work completed after the original atlas demo into a stable
baseline for gameplay modules.

### Included

- unbounded streamed chunks with bounded retention, explorer-follow camera, discovery,
  minimap, and IndexedDB saves;
- 26 terrain/material definitions, authored areas, retained topology, hydrology fields,
  flow-following rivers, roads, weather surfaces, and day/night lighting;
- a shared deterministic player/NPC/enemy character foundation with configurable
  abilities, appearance, equipment slots, actions, and movement;
- content-pack dependency ordering, source provenance, overlap diagnostics, and stable
  resolution hashes;
- worker fallback diagnostics, center-first rendering, viewport culling, performance
  budgets, and staged Rust/Wasm worker batches.

### Verified Boundary

The release preserves client-only execution, explicit lazy loading, deterministic
TypeScript fallbacks, English/Chinese UI catalogs, and the public `mountGame` lifecycle.
Gameplay combat, inventory ownership, role progression, regional weather, settlement
traffic, cross-chunk rivers, and natural contour rendering remain tracked future work.

## v0.1.0-demo

Initial deterministic PixiJS geography explorer, worker generation, lazy embed API,
GitHub Pages distribution, and release packaging.
