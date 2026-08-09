# Repository Architecture

> **Wiki page version:** EN 1.6.0 · **Product baseline:** v0.1.3 · **Updated:** 2026-08-09
> **中文:** [仓库架构](Repository-Architecture-zh-CN) · **Translation status:** synced with EN 1.5.0

## Dependency Direction

`config → map/character → engine → embed → host`

Configuration defines serializable contracts. Domain packages implement deterministic
queries. The engine owns browser lifecycle and rendering. The embed package exposes a
small lazy API. The blog or standalone app is a host, not a gameplay authority.

## Workspace Ownership

| Path                          | Owns                                                                                 | Must not own                        |
| ----------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| `apps/game`                   | standalone launcher, Pages shell                                                     | simulation rules                    |
| `packages/config`             | public types, schemas, catalogs, i18n contracts                                      | rendering or executable content     |
| `packages/map`                | deterministic fields, chunks, topology, hydrology, overlays, dynamic corridor ledger | DOM/PixiJS objects                  |
| `packages/character`          | identity, appearance, slots, fixed-step motion                                       | host UI and map mutation            |
| `packages/character-renderer` | renderer-neutral poses and Pixi layer adapter                                        | simulation authority and save rules |
| `packages/character-rules`    | optional pure resource/equipment/terrain queries                                     | saves, input, workers, rendering    |
| `packages/engine`             | runtime, PixiJS, camera, input, HUD, diagnostics, cleanup                            | content-pack authority              |
| `packages/embed`              | `mountGame`, lazy assets, public lifecycle                                           | host navigation or theme policy     |
| `crates/world-core`           | profiled deterministic typed-array batches                                           | per-frame scene ownership           |
| `content`                     | validated data packs and authored areas                                              | arbitrary scripts                   |

## Runtime Lifecycle

1. The host renders a lightweight launcher; no engine, worker, Wasm, or game assets load.
2. Explicit Start imports `embed/bootstrap.js`.
3. `mountGame` creates a scoped `GameHandle`, engine, worker, canvas, overlays, and input.
4. The worker generates initial center-first chunks and transfers typed arrays.
5. The engine reveals the canvas only after the first viewport is complete.
6. Streaming loads nearby chunks and evicts distant chunks within configured radii.
7. Map-owned authored entity IDs are retained by chunk owners; logical entities leave
   only after their final owner releases them.
8. Dynamic geomorphology outlets are batched through the canonical topology resolver;
   the bounded ledger is the only cross-chunk handoff store and can be evicted/rehydrated.
9. `pause`, `resume`, locale/theme updates, and `destroy` stay host-safe.
10. `destroy` releases workers, RAF loops, listeners, DOM, and GPU resources.

## Recent Runtime Contracts

- Dynamic geomorphology cross-chunk outlets now pass through the bounded
  `DynamicGeomorphologyLedger`. It aggregates canonical topology identities atomically,
  folds resolver aliases on merge, and supports bounded eviction/rehydration without
  making terrain rendering authoritative. Seasonal flooding, delta growth, and save
  promotion remain in follow-up #57.
- Movement keeps the fixed-step simulation but gates neighborhood streaming and eviction
  to chunk crossings, and discovery/fog/minimap rebuilds to cell crossings. The engine
  emits `alohayo-world:lifecycle` (`starting`, `active`, `paused`, `destroyed`) so hosts
  can suspend competing animation; the blog uses it alongside its loading/running state
  to suspend Live2D. Hardware trace and adaptive-quality work remains in follow-up #58.
- The closeable slices were verified with 130 Vitest tests, 9 Playwright E2E checks,
  lint/typecheck, production build, Wiki validation, green Pages/CI, and a READY Vercel
  deployment. These are regression gates, not a replacement for #57/#58 evidence.
- Regional weather sampling, transport structure records, capability-aware traversal,
  aggregate settlement traffic, and mount/vehicle profiles are now deterministic map
  consumers. Regional weather also keeps bounded fixed-step state and optional save
  snapshots; its diagnostics stay on the canvas dataset and do not add normal HUD chrome.
  Moving traffic remains an optional follow-up (#60).
- Character presentation is now a replaceable boundary in `@alohayo/character-renderer`:
  deterministic pose frames resolve appearance/equipment/weapon IDs into explicit shadow,
  aura, body, head, equipment, and weapon layers. Reduced-motion and debug capture paths
  are covered without moving collision or save authority into Pixi; sprite/GLB manifests
  remain an additive asset seam for the next visual phase (#63).

## Rust/Wasm Boundary

Rust/Wasm accelerates measured worker-side numeric batches. Stable v0.1.3 batches are
chunk base layers, render hints, and the pure hydrology raster. TypeScript remains the
deterministic reference and fallback. PixiJS draw calls, UI, content resolution, save
formats, roads, terrain classification, and world mutations remain TypeScript-owned.

Render hints are default-on after exact 16/64/128 Wasm parity, negative-coordinate and
seam fixtures, worker fallback validation, browser coverage, and a measured 86.2% median
CPU reduction with 0% transfer growth. The batch only prepares typed arrays; smoothing,
LOD, and presentation remain in the engine.

Issue #50 now has a renderer-independent contour candidate in `crates/world-core`: one
coarse call consumes an inside mask plus an explicit known-data halo and returns typed,
chunk-local path buffers with an ABI version and world origin. Unknown streamed samples
never become guessed coastlines. This candidate is deliberately outside the worker's
default capability list until transfer/fallback, seam reload, benchmark, and browser
visual gates pass; the TypeScript contour tracer remains authoritative.

Every new candidate needs exact parity, worker transfer tests, fallback tests, browser
coverage, and at least 15% median CPU improvement without more than 5% transfer growth.

## Persistence and Local-Only Policy

IndexedDB stores versioned local snapshots, discovery, explorer state, topology aliases,
persistent authored-entity despawns, content-pack resolution metadata, and named slots.
Replacing a slot keeps a bounded rolling history; each record is validated independently,
and recovery is explicit. The engine reports whether a save is current, remountable, or
hard-incompatible before mutation. The launcher confirms remounts, writes a temporary
recovery slot, and rolls back when loading the target world fails. Journey cards remain
lightweight, keyboard-selectable, and localized; schema-one archives cap at 64 records and
report malformed, duplicate, cancelled, and rejected entries independently. Browser quota
estimates are advisory. No account, telemetry, remote save, or network gameplay service is
part of the architecture. Optional visual thumbnails and chunk-history compression remain
follow-up work in #62.

#52/#53 verification includes a controllable quota retry that prunes the oldest backup, an
injected corrupt-record browser fixture that leaves healthy journeys visible, and
keyboard/narrow-viewport save-card coverage alongside the cross-seed remount rollback path.

## Verification Gates

Use `yarn lint`, `yarn typecheck`, `yarn validate:content`, `yarn validate:assets`,
`yarn validate:wiki`, `yarn test`, Rust test/fmt/clippy, required Wasm build, production
build, performance budgets, and Playwright E2E. Published UI work is additionally checked
on GitHub Pages and the blog after Vercel reaches Ready.
