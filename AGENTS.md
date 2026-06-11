# Agent Guide

## Mission

Build a fast, extensible, map-first single-player web game. Gameplay is selected by
configuration and registered plugins; content data never executes arbitrary code.

## Boundaries

- `apps/game`: browser shell and standalone demo.
- `packages/engine`: lifecycle, renderer, input, diagnostics.
- `packages/map`: deterministic terrain model and worker protocol.
- `packages/config`: public types and content validation.
- `packages/embed`: stable embedding surface.
- `crates/world-core`: profiled deterministic hot loops compiled to Wasm.
- `content`: versioned game definitions. `assets`: licensed resources only.

## Required checks

Run `yarn format:check`, `yarn lint`, `yarn typecheck`, `yarn validate:content`,
`yarn validate:assets`, `yarn test`, and `yarn build`. Browser-facing changes also run
`yarn test:e2e`.

## Engineering rules

- Keep simulation state independent from PixiJS display objects.
- Use fixed simulation steps and render interpolation for future moving entities.
- Preserve seed determinism; add hash fixtures when changing generation.
- Prefer typed arrays, chunk-local work, pooling, and measured optimizations.
- Add Wasm only for measured CPU-heavy work and retain a deterministic fallback.
- New biomes, maps, entities, and modes begin as content definitions.
- Do not add networked gameplay or telemetry.
- Assets must be original or CC0 and registered with source, license, checksum, and size.

## Git

Use focused conventional commits. Do not commit build output. Update `CHANGELOG.md`,
`docs/ROADMAP.md`, and milestone status for releases.

## Milestones

Current: `v0.1.0-demo`, a published geography explorer embedded in alohayo.me.

Next: `v0.2.0-world-foundation`: infinite chunk streaming, rivers, coast continuity,
authored overlays, minimap, explorer movement, IndexedDB saves, content packs, and
performance budgets. Combat, building, NPCs, vehicles, and creature collection remain
later plugin milestones.
