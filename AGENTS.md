# Alohayo World Agent Guide

This repository is designed for AI-assisted development. Keep decisions explicit,
contracts narrow, and documentation close to the code it governs.

## Read First

1. Read this file.
2. Read `docs/README.md` for the documentation map.
3. Read the nearest nested `AGENTS.md` before changing a directory.
4. Read the relevant module document in `docs/modules/`.
5. Run the smallest useful check while developing, then the full verification set.

Nested `AGENTS.md` files add local rules. The closest guide to a changed file takes
precedence when it is more specific.

## First-Priority Delivery Pattern

For any multi-step feature or fix set, follow this workflow in order:

1. Work the task list one item at a time.
2. Finish and verify the current item before starting the next one.
3. After implementation, review the result against the original expectation instead of
   assuming the first pass is good enough.
4. Update the smallest relevant docs and `CHANGELOG.md` as part of the same change.
5. Commit focused stages, push, monitor GitHub Actions and downstream deploys, and
   verify the live surface when the work affects a published experience.
6. Publish or update the release only after the verified changes are on the intended
   branch and the automation state is healthy.
7. If an unexpected error or context/token limit interrupts progress, leave a concise
   memo covering what is done, what remains, what was verified, and the next exact step
   so another agent can continue cleanly.

This pattern is mandatory unless a task explicitly asks for planning-only work.

## Issue-Fix Workflow

When work is driven by a GitHub issue or a live regression report, use this sequence:

1. Read the current issue state before editing code.
2. If the work needs its own track, create or update the issue first with the problem and
   the fix plan before implementation.
3. Implement the fixes one item at a time and verify each item before moving on.
4. Update the issue with the latest result, including screenshot evidence for published UI
   work when practical.
5. Close the issue only after local checks, live verification, and issue notes all agree
   that the user-visible behavior is fixed.

## Mission

Build a fast, extensible, map-first single-player web game. The world is local-only,
deterministic from versioned configuration, and embeddable without loading game code
until the player explicitly starts it.

Content selects registered capabilities. JSON and assets never execute arbitrary code.
Gameplay systems are plugins over a stable world model, not hard-coded branches in the
renderer.

## Repository Map

| Path                 | Responsibility                                      |
| -------------------- | --------------------------------------------------- |
| `apps/game`          | Standalone browser shell and GitHub Pages demo      |
| `packages/config`    | Public runtime and content contracts                |
| `packages/map`       | Deterministic geography, topology, worker protocol  |
| `packages/character` | Shared abilities, appearance, gear, and generation  |
| `packages/engine`    | Lifecycle, PixiJS adapter, input, diagnostics       |
| `packages/embed`     | Lazy public `mountGame` surface                     |
| `crates/world-core`  | Profiled deterministic hot loops compiled to Wasm   |
| `content`            | Versioned, validated world and gameplay definitions |
| `assets`             | Original or verified CC0 resources and provenance   |
| `tests`              | Contract, determinism, benchmark, and browser tests |
| `.github`            | CI, Pages, release, security, and issue automation  |

## Architecture Invariants

- Simulation and geography data do not depend on PixiJS display objects.
- Generation is deterministic for `(generatorVersion, seed, dimensions, content)`.
- Continuous geography fields and categorical display terrain remain separate concepts.
- Ocean versus lake and mainland versus island are topology, not climate biomes.
- Large numeric layers use typed arrays and transferable worker messages.
- The main thread never performs full-world generation.
- Wasm is introduced only for measured CPU-heavy work and keeps a deterministic
  TypeScript reference or fallback.
- Move renderer-adjacent hot loops to Wasm only as worker-produced render hints or other
  coarse typed-array batches. PixiJS draw calls, DOM UI, and per-frame scene ownership
  stay in TypeScript.
- Every worker, listener, animation loop, GPU object, and DOM node is owned by a
  `GameHandle` and released by `destroy`.
- No network gameplay, telemetry, account, or server-side save system is added.
- New maps, terrain definitions, entities, and gameplay modes begin as data schemas and
  registries before bespoke code.

## I18n Priority

- Any new player-visible string must be added to the repository `i18n/` catalogs before
  it is referenced from UI code.
- English and Simplified Chinese are first-class locales. New work must preserve both.
- Launcher UI, HUD text, dev panels, diagnostics, tooltips, and content-derived labels
  should resolve through locale helpers keyed by stable IDs or stable message keys.
- When a content entry is visible in the UI, prefer translating by the content ID rather
  than duplicating raw display strings in runtime code.
- Locale support must stay additive: adding a new language should mean adding a catalog
  file and wiring it into the locale registry, not rewriting feature code.

## Common Change Recipes

### Add or change terrain

1. Update the geographic model in `packages/map`.
2. Update definitions in `content/core`.
3. Keep `content/core/biomes.json`, `content/core/terrain-rules.json`, and both
   `i18n/` catalogs in lockstep.
4. Update `docs/MAP_SYSTEM.md`, `docs/TERRAIN_RULES.md`, and `docs/GIS_FOUNDATIONS.md`.
5. Preserve deterministic tests and validate all terrain codes.
6. Check rendering and inspection in both standalone and embedded launchers.

### Change water, coast, river, or lake presentation

1. Read `docs/modules/WATER.md`, `docs/MAP_SYSTEM.md`, and `docs/NATURAL_WORLD_POLISH.md`.
2. Keep generation hints in `packages/map` and rendering language in `packages/engine`.
3. Prefer shared helpers or submodules over growing `streamed.ts` inline water logic.
4. Treat natural visual polish as contour/shape work, not just more per-cell decoration.
5. Re-check chunk seams, movement masks, and game-mode readability after every change.

### Add a gameplay module

1. Start with its file in `docs/modules/`.
2. Define data contracts in `packages/config`.
3. Add content schemas and examples.
4. Register a narrow engine capability; do not let configuration execute code.
5. Add unit tests, lifecycle cleanup tests, and a small playable vertical slice.

### Add an authored map area

1. Read `docs/config/MAPS.md`.
2. Read `docs/CONTENT_PACKS.md` if the change affects pack boundaries, dependencies,
   optional overlays, or merge order.
3. Add JSON under `content/maps/<pack>/areas/`; build discovery is automatic.
4. Validate terrain references and deterministic overlay output.
5. Keep large areas patch-based instead of listing thousands of cells.

### Add or change a content pack

1. Read `docs/CONTENT_PACKS.md`, `docs/CONTENT_GUIDE.md`, and the nearest content
   `AGENTS.md`.
2. Keep pack dependencies explicit, acyclic, and deterministic.
3. Prefer additive stable IDs; do not silently overwrite another pack's exported IDs.
4. Add or update fixtures that prove pack order, conflict handling, and world-hash
   stability.
5. If the work introduces a new overlay family, document merge policy and provenance
   before runtime code depends on it.

### Add a character or ability

1. Read `docs/config/CHARACTERS.md` and `packages/character/AGENTS.md`.
2. Extend the catalogs under `content/characters/`.
3. Use the shared archetype model for players, NPCs, and enemies.
4. Validate slot/item/pool references and deterministic generation.

### Change movement or actions

1. Read `docs/MOVEMENT_AND_ACTIONS.md`.
2. Keep motion state and stepping in `packages/character`; the engine supplies input and
   world queries.
3. Preserve fixed-step simulation and the one-ninth terrain-cell footprint.
4. Add unit tests for state transitions/collision and E2E coverage for controls.

### Change streamed world behavior

1. Read `docs/MAP_SYSTEM.md`, `docs/GAMEPLAY.md`, and `docs/modules/MAP.md`.
2. Keep chunk generation deterministic by `(seed, chunkX, chunkY, chunkSize, content)`.
3. Treat `width` and `height` launch inputs as survey hints and authored-overlay anchors,
   not finite world boundaries.
4. Retain only near chunks in memory, document eviction rules, and surface diagnostics in
   the browser contract.
5. Update unit tests for chunk determinism and E2E coverage for loaded/discovered state.

### Change clock, day/night, or global lighting

1. Read `docs/modules/DAY_NIGHT.md` and `docs/ARCHITECTURE.md`.
2. Keep time-of-day as deterministic clock plus wrapped world-space lighting, not a
   player-centered light source.
3. Game mode defaults to live cycling; dev mode may pin lighting to a documented test
   hour.
4. Put any new clock label or toggle text in `i18n/` before touching UI code.
5. Re-check minimap, fog readability, and theme contrast after lighting changes.

### Add developer demo tooling

1. Keep it debug-only and explicit; production players should not see hidden test powers by accident.
2. Prefer capability flags and local-only controls over ad hoc globals or console hacks.
3. Teleport, fast move, overlay reveal, and loadout override must reuse normal runtime
   contracts so test behavior stays representative.
4. Document the activation path and safety boundary in `docs/GAMEPLAY.md` and roadmap/issue
   notes before implementation.

### Add or change visible UI text

1. Add or update the message in `i18n/en.json` and `i18n/zh-CN.json`.
2. If the text comes from content, translate it by stable content ID through the shared
   i18n helpers.
3. Only after the catalog exists should runtime UI code reference the message key.
4. Verify both locales in the standalone app and the blog embed when the change affects
   launcher or HUD surfaces.

### Change the embed contract

1. Treat `MountGameOptions` and `GameHandle` as public APIs.
2. Keep old optional fields working within the current major version.
3. Update standalone and blog launchers together.
4. Verify zero game bundle requests occur before Start.

## Commands

```sh
yarn dev
yarn format:check
yarn lint
yarn typecheck
yarn validate:content
yarn validate:assets
yarn test
yarn benchmark
yarn build
yarn test:e2e
```

Use Node from `.nvmrc`, Yarn from `packageManager`, and Rust from
`rust-toolchain.toml`.

## Verification Matrix

| Change             | Minimum checks                                        |
| ------------------ | ----------------------------------------------------- |
| Docs only          | `yarn format:check`                                   |
| Content only       | format, `validate:content`, affected tests            |
| TypeScript runtime | format, lint, typecheck, test, build                  |
| Map generation     | runtime checks plus benchmark and deterministic tests |
| Browser/embed      | runtime checks plus `test:e2e`                        |
| Rust/Wasm          | `cargo test`, `build:wasm`, TypeScript parity tests   |
| Assets             | format, `validate:assets`, build                      |
| Workflows          | inspect permissions/pins and verify the GitHub run    |

Before release or handoff, run the complete set listed under Commands.

## Performance Rules

- Measure before optimizing and record budgets in benchmarks or roadmap issues.
- Prefer structure-of-arrays typed data, chunk-local work, transferables, pooling, and
  bounded caches.
- Keep generation off the main thread and rendering proportional to visible content.
- Avoid per-cell objects and per-frame allocation in hot paths.
- Any larger default map must remain responsive on the supported browser matrix.

## Content and Asset Rules

- Config is versioned, schema-validated, deterministic, and contains no executable code.
- IDs use `namespace:name`; numeric terrain codes remain stable once released.
- Assets must be original or CC0 and registered in `assets/ATTRIBUTION.json`.
- Record source, author, license, modifications, checksum, and optimized size.
- Do not add protected franchise names, art, audio, characters, or close imitations.

## Git and Handoff

- Use focused conventional commits and do not commit generated build output.
- Preserve unrelated user changes.
- Update `CHANGELOG.md`, `docs/ROADMAP.md`, and the relevant module status when behavior
  changes.
- A handoff names what is complete, what was verified, known limitations, and the next
  smallest issue an agent can implement.

## Current State

Released: `v0.1.0-demo`, published through GitHub Pages and embedded at
`https://alohayo.me/game`.

Active: `v0.2.0-world-foundation`. Current work expands geographic classification,
world topology, scalable map sizes, streamed chunks, i18n-first UI plumbing, and
agent-readable module plans. The next runtime priority after the active streamed-world
slice is seam-safe global topology merging plus drainage and rivers.

Known boundary: the Rust crate defines and tests portable deterministic primitives, but
the active browser generator is TypeScript until the worker-side Wasm loader and parity
suite are complete. Do not wire Wasm into production as one call per cell. The first
runtime Wasm migration should be a coarse `generate_stream_chunk_layers`-style worker
API that returns transferable elevation, moisture, temperature, and biome buffers for a
whole chunk, with TypeScript parity fixtures and a TypeScript fallback kept active.
