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
- Content-pack overlay resolution must stay deterministic and should arrive in map code
  as an ordered, validated input, not as ad hoc directory iteration.
- When new overlay families are added, document whether they are additive, overriding,
  or conflict-failing before implementing merge code.
- Chunk-local `region` labels are an exploration/runtime aid today, not a substitute for
  future cross-chunk global topology IDs.
- Update deterministic, connectivity, bounds, and benchmark tests after generator work.
- Rust/Wasm output must have parity tests before becoming authoritative.
- The first Wasm production path is `ChunkBaseLayers`: elevation, moisture, and
  temperature from one coarse worker call. Preserve typed-array transfer semantics and
  keep TypeScript topology, hydrology, biome classification, overlays, and fallback as
  the reference until CI runs Rust/Wasm byte-parity fixtures.
- Water generation should separate hydrology truth from renderer polish hints. River
  meanders, lake outlines, shoreline distance, and future drainage fields must remain
  deterministic and config-driven.
- The current hydrology truth is: priority-flood depression handling, downhill
  `flowDirection`, upstream `flowAccumulation`, per-cell `watershed`, and flow-following
  river tracing. Extend that graph before adding new wetland, floodplain, lake, or
  erosion heuristics.
