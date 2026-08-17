# Performance Budgets

This document closes issue `#10` by defining the current enforced budgets and the
runtime telemetry we track to catch regressions early.

## Requirements Covered

Issue `#10` asked for:

- frame time
- memory
- draw calls
- chunk latency
- long tasks
- bundle size
- representative desktop/mobile benchmark gates

All seven are now covered by a mix of runtime telemetry, benchmark tests, and build
checks.

## Runtime Telemetry

The runtime now tracks a lightweight performance snapshot on every active session.

Public debug surface:

- `window.__ALOHAYO_WORLD_PERF__`
- canvas `data-*` attributes for Playwright and local inspection

Tracked fields:

- `avgFrameMs`
- `maxFrameMs`
- `p50FrameMs`, `p95FrameMs`, and `p99FrameMs`
- `onePercentLowFps` and `droppedFrameCount`
- `qualityTier` and `qualityResolutionScale`
- `fps`
- `lastChunkGenerationMs`
- `maxChunkGenerationMs`
- `estimatedDrawCalls`
- `loadedChunks`
- `longTaskCount`
- `maxLongTaskMs`
- `memoryUsedMB`
- `memoryLimitMB`

## Movement frame pacing

The fixed-step movement loop keeps visual interpolation on the ticker, but schedules
world work by the smallest state boundary that can change it:

- neighborhood requests and far-chunk eviction run only when the explorer enters a new
  chunk, not on every 60 Hz simulation step;
- discovery fog and the 26×26 minimap sample run only when the explorer enters a new cell
  (or an explicit UI/theme/resize action requests a redraw);
- sub-cell movement still advances the character and camera every fixed step, preserving
  smooth motion without rebuilding world overlays.

The engine also emits `alohayo-world:lifecycle` (`starting`, `active`, `paused`,
`destroyed`) on the mount container. Hosts can use this signal to suspend decorative
canvases while the world is active. The blog host hides Live2D during `loading`/`running`
and restores it when the game is left, avoiding a second animated canvas competing for
compositing time.

Notes:

- `estimatedDrawCalls` is intentionally named as an estimate. For the current PixiJS
  stack we derive it from visible render layers and overlays, which is stable enough for
  regression tracking even though it is not a GPU-driver truth source.
- memory uses `performance.memory` when the browser exposes it. When unavailable, the
  metric remains `null` instead of inventing a fake number.
- long tasks use `PerformanceObserver` when supported.

The runtime now samples a rolling 600-frame trace and evaluates 60-frame windows through a
hysteretic controller. Three bad windows lower the presentation tier and six good windows
raise it again. The controller changes Pixi renderer resolution only; fixed-step simulation,
world generation, saves, and worker contracts are not quality-dependent. `high`, `balanced`,
and `safe` tiers use resolution scales `1.00`, `0.85`, and `0.68`, with reduced-motion and
low-memory callers selecting the safe terrain-atlas LOD.

The browser acceptance suite runs serially on CI's two-core SwiftShader runner and waits for
the canvas `data-initial-presentation="complete"` marker before sampling. This keeps frame
metrics tied to a fully presented world while preserving the local parallel default.

## Enforced Budgets

### Generation and chunk budgets

Benchmarks in `tests/benchmarks/performance.test.ts` enforce:

| Scenario       | Budget       |
| -------------- | ------------ |
| desktop atlas  | `< 1000 ms`  |
| mobile atlas   | `< 600 ms`   |
| streamed chunk | `< 120 ms`   |
| chunk hot data | `< 0.04 MiB` |

These are broad CI-safe gates, not ideal local targets.

### Build artifact budgets

`scripts/check-performance-budgets.mjs` enforces:

| Artifact                  | Budget     |
| ------------------------- | ---------- |
| `dist/app.js`             | `< 8 KB`   |
| `dist/embed/bootstrap.js` | `< 1 KB`   |
| engine runtime chunk      | `< 390 KB` |
| i18n chunk                | `< 50 KB`  |

### Runtime smoke expectations

The E2E suite reads runtime telemetry after launch and checks broad expectations for:

- desktop runtime
- mobile runtime

Those checks are deliberately forgiving because CI browsers are noisy, but they still
catch broken instrumentation and obvious regressions.

## CI Enforcement

The `CI` workflow enforces:

1. benchmark tests through `yarn test`
2. production artifact budgets through `yarn check:perf`

The `E2E` workflow enforces:

1. lazy-load behavior
2. runtime performance telemetry on desktop
3. runtime performance telemetry on mobile

## Follow-On Work

Future iterations can tighten this system by:

- replacing draw-call estimates with direct renderer statistics if PixiJS exposes a
  stable public counter
- storing benchmark history per release
- splitting budgets by renderer backend or device tier
- adding explicit regression comments to release notes and roadmap entries
- capturing a hardware/GPU matrix for movement p50/p95/p99 and the 1%-low target in issue
  `#58`; local and software-browser telemetry is not a substitute for that matrix
