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
- `fps`
- `lastChunkGenerationMs`
- `maxChunkGenerationMs`
- `estimatedDrawCalls`
- `loadedChunks`
- `longTaskCount`
- `maxLongTaskMs`
- `memoryUsedMB`
- `memoryLimitMB`

Notes:

- `estimatedDrawCalls` is intentionally named as an estimate. For the current PixiJS
  stack we derive it from visible render layers and overlays, which is stable enough for
  regression tracking even though it is not a GPU-driver truth source.
- memory uses `performance.memory` when the browser exposes it. When unavailable, the
  metric remains `null` instead of inventing a fake number.
- long tasks use `PerformanceObserver` when supported.

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
| i18n chunk                | `< 30 KB`  |

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
