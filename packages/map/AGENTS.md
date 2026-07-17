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
- Runtime authored overlays are resolved by `authored-overlays.ts`. Preserve area-order
  precedence, world-coordinate provenance, and bounds filtering. Protected regions
  block later authored layers and procedural layers, never content from their own area.
- `settlement-bias` is the first registered generator modifier. Add new modifier
  consumers explicitly, keep unknown kinds inert, and test overlap/clamping behavior.
- When new overlay families are added, document whether they are additive, overriding,
  or conflict-failing before implementing merge code.
- Chunk-local `region` labels are an exploration/runtime aid today, not a substitute for
  future cross-chunk global topology IDs.
- Update deterministic, connectivity, bounds, and benchmark tests after generator work.
- Rust/Wasm output must have parity tests before becoming authoritative.
- Worker requests must carry the versioned capability contract. TypeScript is the default;
  never load a Wasm batch merely because an asset URL exists. Worker failures must return
  structured request-scoped errors instead of leaving callers pending.
- The first stable Wasm production path is `ChunkBaseLayers`: elevation, moisture, and
  temperature from one coarse worker call. Preserve typed-array transfer semantics and
  keep TypeScript topology, hydrology, biome classification, overlays, and fallback as
  the reference fallback. Issue `#35` passed the 16/64/128 parity, benchmark, transfer,
  startup, and browser gates; do not expand the default batch list without repeating them.
- Water generation should separate hydrology truth from renderer polish hints. River
  meanders, lake outlines, shoreline distance, and future drainage fields must remain
  deterministic and config-driven.
- Cell-mask frontiers use `extractMaskContours` and typed-array paths. Extend that shared
  tracer instead of adding renderer-owned edge walks or per-biome shoreline algorithms.
- The current hydrology truth is: priority-flood depression handling, downhill
  `flowDirection`, upstream `flowAccumulation`, per-cell `watershed`, and flow-following
  river tracing. Extend that graph before adding new wetland, floodplain, lake, or
  erosion heuristics.
- Static geomorphology metadata is config-driven and typed: `erosionPotential`,
  `sedimentLoad`, `deposition`, and `floodplain`. Include new fields in worker transfer
  lists and deterministic hashes. Do not mutate elevation or imply time evolution in
  this layer.
