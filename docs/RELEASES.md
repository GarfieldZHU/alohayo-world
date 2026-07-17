# Release Checkpoints

## v0.1.3 - Streamed World and Wasm Foundation

This release turns the world-foundation work into a verified production checkpoint while
keeping optional gameplay and simulation modules independently replaceable.

### Included

- atomic initial viewport presentation, corrected minimap controls, smoother shared
  shoreline/fog contours, and viewport-lazy streamed rendering;
- authored entity/protected-region overlays, named local save management, deterministic
  erosion/deposition/floodplain metadata, and config-first character rules;
- stable Rust/Wasm chunk base-layer and hydrology batches with exact TypeScript parity,
  structured fallback diagnostics, worker transfer gates, and measured acceleration;
- decomposed weather, transport, render-hint, and contour follow-ups with explicit module
  ownership and acceptance gates.

### Verified Boundary

PixiJS, UI, content orchestration, saves, and embed lifecycle remain TypeScript-owned.
The game remains client-only, lazy-loaded, bilingual, deterministic, and functional when
Wasm falls back to the reference implementation.

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
