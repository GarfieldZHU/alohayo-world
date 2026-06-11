# Roadmap

## v0.1.0-demo

- [x] Repository, agent guide, architecture, content guide, and game design.
- [x] Configurable deterministic terrain demo and lazy embed lifecycle.
- [x] Worker generation, optional Rust/Wasm crate, diagnostics, pan/zoom, inspection.
- [x] CI, Pages, release packaging, security checks, and asset provenance.
- [x] Production verification at `alohayo.me/game` after both deployments complete.

## v0.2.0-world-foundation

- [x] AI-first documentation hierarchy with directory-level agent guides.
- [x] GIS foundation and layered geography/topology model.
- [x] Deep ocean, shallow sea, lakes, lowland, highland, bare rock, and
      mainland/island inspection.
- [x] Larger bounded map presets with an explicit enlarge control.
- [x] Deterministic terrain transitions and zoom-dependent geographic detail.
- [ ] Infinite chunk streaming and eviction.
- [ ] Seam-safe coastlines, slope, drainage, rivers, erosion, and authored overlays.
- Explorer entity movement, minimap, discovery, and IndexedDB saves.
- Content-pack dependency loading and schema migrations.
- Explicit desktop/mobile performance budgets and benchmark history.

## Staged Modules

Detailed independent plans now live in `docs/modules/` for characters, weather,
settlements, economy, combat, vehicles, and creatures. The next implementation target
is streamed chunks plus drainage; gameplay plugins wait on stable spatial queries.
