# Rust/Wasm Migration Program

**Tracker:** GitHub issue #30.  
**Principle:** Rust/Wasm accelerates deterministic worker batches; TypeScript continues to
own content orchestration, rendering, UI, input, persistence, and public embed APIs.

## Non-Negotiable Boundaries

| Rust/Wasm owns                                            | TypeScript owns                                            |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Pure deterministic numeric batches                        | PixiJS scene graph and all draw calls                      |
| Typed-array generation and geometry preparation           | DOM UI, i18n, input, camera, and GameHandle lifecycle      |
| Worker-only pathfinding/contour preparation when profiled | Content-pack resolution, overlays, plugins, save format    |
| Explicit batch ABI versions and byte parity               | Fallback selection, telemetry, diagnostics, rollout policy |

Never make one Wasm call per terrain cell. Never expose a Wasm object to renderer code.
Every Rust export receives scalar metadata and contiguous typed-array input, then returns
fresh transferable typed arrays with documented ownership.

## Rollout Contract

Each batch follows this state machine:

1. **Reference:** TypeScript implementation plus deterministic fixtures.
2. **Parity:** Rust test, built-Wasm byte parity, negative-coordinate fixtures, and worker
   transfer validation all pass.
3. **Shadow:** worker may compute the Wasm output for sampled debug requests and compare
   hashes without changing the returned world data.
4. **Canary:** an explicit local developer capability enables Wasm for a small percentage
   of chunk requests; diagnostics record batch, artifact version, fallback reason, and
   elapsed time.
5. **Preferred:** benchmarks beat the reference within the published tolerance and browser
   E2E proves startup, navigation, fallback, and destroy behavior.
6. **Stable:** Wasm is default-on but the TypeScript fallback stays tested and loadable.

No browser query string is a production rollout mechanism. The engine must receive an
explicit local developer capability and a versioned worker request field.

The active protocol is `protocolVersion: 1`. The production default enables the promoted
`chunk-base-layers` and `hydrology-raster` batches. A batch may load Wasm only when
`enabled` is true, ABI version 1 is present, and that batch appears in the request list. Responses report per-batch
implementation and fallback reasons; request failures are structured and the engine
rejects stalled requests after 15 seconds.

## Batch ABI

Every migrated message includes:

```ts
type WasmBatchRequest = {
  abiVersion: 1
  batch: 'chunk-base-layers' | 'render-hints' | 'contour-geometry' | 'path-cost-grid'
  seed: number
  chunkX: number
  chunkY: number
  chunkSize: number
}
```

Responses include typed-array buffers, `abiVersion`, deterministic input/output hashes,
implementation (`'typescript' | 'wasm'`), elapsed milliseconds, and an optional
structured fallback reason. Renderer objects and JSON content are never part of this ABI.

## Staged Work

### M0: Toolchain and safety baseline

- Pin Rust, wasm target, rustfmt, clippy, wasm-pack, and generated artifact checks.
- Add worker `error`/`messageerror` protocol coverage and a browser startup timeout that
  surfaces an actionable fallback reason instead of an endless loading state.
- Preserve the current TypeScript implementation as an independently testable reference.

**Gate:** a missing/corrupt Wasm artifact starts the game through TypeScript with stable
canvas diagnostics and no embed API change. The default/fallback browser path is covered
under #33; Wasm-enabled browser parity and promotion remain gated by #35.

### M1: Chunk base layers (stable)

- Inputs: seed, origin, chunk size.
- Outputs: `elevation`, `moisture`, `temperature` `Uint8Array`s.
- Keep topology, biome classification, areas, settlements, rivers, and roads in TypeScript.
- Baseline fixtures cover 16/64 sizes and positive/negative coordinates with exact byte
  equality. Issue `#35` owns the larger 16/64/128 matrix, worker/browser parity, transfer
  metrics, and promotion benchmark.

**Promotion result (#35):** the 16/64/128 byte-parity matrix passes across all coordinate
quadrants. A 60-sample warm benchmark on the release toolchain measured a 1.595 ms
TypeScript median and 0.903 ms Wasm median (43.4% lower), with 1.706/0.966 ms p95,
0% transfer growth, and 0.981 ms module startup. Browser E2E covers both the stable Wasm
path and an explicit forced-TypeScript capability, so this batch is default-on while the
reference fallback remains supported.

### M2: Render hints

- Inputs: biome/elevation buffers plus origin/chunk size.
- Outputs: noise, transition masks, detail classes, and offsets.
- Keep water/terrain drawing and LOD policy in TypeScript.

**Gate:** bitwise parity with `generateChunkRenderHints`, no changed draw-call budget, and
no visible seam regression across chunk borders.

### M3: Contour and frontier geometry

- Produce coast, lake, river, and fog contour segments for issue #20.
- Rust prepares geometry only; TypeScript owns smoothing style, gradient, and Pixi paths.

**Gate:** contour topology handles negative chunks and eviction/reload; visual browser
review and seam fixtures pass.

### M4: Hydrology raster (stable) and path-cost candidates

- The pure hydrology core owns priority flood, slope, D8 flow direction, accumulation,
  watershed IDs, and depression depth for one complete raster batch.
- TypeScript owns water-mask construction, geomorphology derivation, terrain
  classification, rivers, roads, overlays, and rendering.
- Issue #34 passed byte parity for 16/64/128 fixtures, chunk-hash parity, explicit
  fallback, and browser startup gates. A 20-sample benchmark measured 1.444 ms TypeScript
  median versus 0.554 ms Wasm median (61.7% lower), 6.088/2.394 ms p95, 0% transfer
  growth, and 0.570 ms cold startup.
- Profile remaining candidates such as coarse path-cost grids before migrating them.
- Do not move content rules, road tier selection, or world mutations.

**Gate:** deterministic world hashes and downstream river/road fixtures remain identical.

## Benchmark Policy

Report median/p95 generation time, total transferred bytes, heap growth, worker startup
time, and fallback rate for 16, 64, and production chunk sizes. A batch must save at least
15% median worker CPU time without increasing transfer bytes by more than 5%, or remain
behind the explicit developer capability.

## Agent Checklist

1. Read this document, `crates/world-core/AGENTS.md`, `packages/map/AGENTS.md`, and
   `docs/LOCAL_DEVELOPMENT.md`.
2. Add the TypeScript fixture before Rust code.
3. Add Rust unit, `wasm-pack` parity, worker-transfer, and browser fallback tests.
4. Profile both paths on the same fixture matrix.
5. Update #30 and the child issue with measured results, not assumptions.
6. Only then alter rollout state.
