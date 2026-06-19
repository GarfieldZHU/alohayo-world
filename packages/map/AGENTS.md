# Map Package Agent Guide

This package owns deterministic geography and worker-safe data.

- Read `docs/MAP_SYSTEM.md`, `docs/TERRAIN_RULES.md`, `docs/GIS_FOUNDATIONS.md`, and
  `docs/modules/MAP.md`.
- Keep physical fields, hydrology, landform, ecology, and topology distinguishable.
- Use typed arrays; avoid per-cell objects.
- Iterate neighbors in a documented fixed order.
- Transfer large buffers from workers instead of cloning.
- Streamed chunks are keyed only by integer `(chunkX, chunkY)` and must stay stable across
  sessions for the same seed and content.
- Normalized authored areas use finite-atlas placement in `generateWorld` and
  origin-centered survey placement in streamed chunk generation; do not collapse those
  two contracts together.
- Chunk-local `region` labels are an exploration/runtime aid today, not a substitute for
  future cross-chunk global topology IDs.
- Update deterministic, connectivity, bounds, and benchmark tests after generator work.
- Rust/Wasm output must have parity tests before becoming authoritative.
- The first Wasm production path should be chunk-layer generation as one coarse worker
  call, not per-cell calls from TypeScript. Preserve typed-array transfer semantics and
  keep the TypeScript fallback as the reference until CI runs Rust and Wasm parity.
