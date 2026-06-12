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
- Every worker, listener, animation loop, GPU object, and DOM node is owned by a
  `GameHandle` and released by `destroy`.
- No network gameplay, telemetry, account, or server-side save system is added.
- New maps, terrain definitions, entities, and gameplay modes begin as data schemas and
  registries before bespoke code.

## Common Change Recipes

### Add or change terrain

1. Update the geographic model in `packages/map`.
2. Update definitions in `content/core`.
3. Update `docs/MAP_SYSTEM.md` and `docs/GIS_FOUNDATIONS.md`.
4. Preserve deterministic tests and validate all terrain codes.
5. Check rendering and inspection in both standalone and embedded launchers.

### Add a gameplay module

1. Start with its file in `docs/modules/`.
2. Define data contracts in `packages/config`.
3. Add content schemas and examples.
4. Register a narrow engine capability; do not let configuration execute code.
5. Add unit tests, lifecycle cleanup tests, and a small playable vertical slice.

### Add an authored map area

1. Read `docs/config/MAPS.md`.
2. Add JSON under `content/maps/<pack>/areas/`; build discovery is automatic.
3. Validate terrain references and deterministic overlay output.
4. Keep large areas patch-based instead of listing thousands of cells.

### Add a character or ability

1. Read `docs/config/CHARACTERS.md` and `packages/character/AGENTS.md`.
2. Extend the catalogs under `content/characters/`.
3. Use the shared archetype model for players, NPCs, and enemies.
4. Validate slot/item/pool references and deterministic generation.

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
world topology, scalable map sizes, and agent-readable module plans. The next runtime
priority after this foundation is chunk streaming plus drainage and rivers.

Known boundary: the Rust crate defines and tests portable deterministic primitives, but
the active browser generator is TypeScript until the worker-side Wasm loader and parity
suite are complete.
