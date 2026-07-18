# Repository Architecture

> **Wiki page version:** EN 1.0.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-07-18
> **中文:** [仓库架构](Repository-Architecture-zh-CN) · **Translation status:** synced with EN 1.0.0

## Dependency Direction

`config → map/character → engine → embed → host`

Configuration defines serializable contracts. Domain packages implement deterministic
queries. The engine owns browser lifecycle and rendering. The embed package exposes a
small lazy API. The blog or standalone app is a host, not a gameplay authority.

## Workspace Ownership

| Path                       | Owns                                                        | Must not own                     |
| -------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `apps/game`                | standalone launcher, Pages shell                            | simulation rules                 |
| `packages/config`          | public types, schemas, catalogs, i18n contracts             | rendering or executable content  |
| `packages/map`             | deterministic fields, chunks, topology, hydrology, overlays | DOM/PixiJS objects               |
| `packages/character`       | identity, appearance, slots, fixed-step motion              | host UI and map mutation         |
| `packages/character-rules` | optional pure resource/equipment/terrain queries            | saves, input, workers, rendering |
| `packages/engine`          | runtime, PixiJS, camera, input, HUD, diagnostics, cleanup   | content-pack authority           |
| `packages/embed`           | `mountGame`, lazy assets, public lifecycle                  | host navigation or theme policy  |
| `crates/world-core`        | profiled deterministic typed-array batches                  | per-frame scene ownership        |
| `content`                  | validated data packs and authored areas                     | arbitrary scripts                |

## Runtime Lifecycle

1. The host renders a lightweight launcher; no engine, worker, Wasm, or game assets load.
2. Explicit Start imports `embed/bootstrap.js`.
3. `mountGame` creates a scoped `GameHandle`, engine, worker, canvas, overlays, and input.
4. The worker generates initial center-first chunks and transfers typed arrays.
5. The engine reveals the canvas only after the first viewport is complete.
6. Streaming loads nearby chunks and evicts distant chunks within configured radii.
7. `pause`, `resume`, locale/theme updates, and `destroy` stay host-safe.
8. `destroy` releases workers, RAF loops, listeners, DOM, and GPU resources.

## Rust/Wasm Boundary

Rust/Wasm accelerates measured worker-side numeric batches. Stable v0.1.3 batches are
chunk base layers and the pure hydrology raster. TypeScript remains the deterministic
reference and fallback. PixiJS draw calls, UI, content resolution, save formats, roads,
terrain classification, and world mutations remain TypeScript-owned.

Every new candidate needs exact parity, worker transfer tests, fallback tests, browser
coverage, and at least 15% median CPU improvement without more than 5% transfer growth.

## Persistence and Local-Only Policy

IndexedDB stores versioned local snapshots, discovery, explorer state, content-pack
resolution metadata, and named save slots. No account, telemetry, remote save, or network
gameplay service is part of the architecture. Imports validate schema and compatibility
before becoming active state.

## Verification Gates

Use `yarn lint`, `yarn typecheck`, `yarn validate:content`, `yarn validate:assets`,
`yarn validate:wiki`, `yarn test`, Rust test/fmt/clippy, required Wasm build, production
build, performance budgets, and Playwright E2E. Published UI work is additionally checked
on GitHub Pages and the blog after Vercel reaches Ready.
