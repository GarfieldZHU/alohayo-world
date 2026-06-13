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
- [x] Build-time discovered custom map-area configs, landmarks, and topology refresh.
- [x] Shared configurable character generation for player, NPC, and enemy archetypes.
- [x] One-ninth-cell character scale with fixed-step walk, run, collision, and actions.
- [x] Infinite chunk coordinate runtime with streamed retention and distance-based eviction.
- [x] Explorer traversal across streamed chunks with minimap and local discovery fog.
- [ ] Seam-safe coastlines across chunk borders, slope, drainage, rivers, and erosion.
- [ ] Global landmass/waterbody identity merge beyond chunk-local region labels.
- [ ] IndexedDB discovery/save snapshots and restoration.
- Content-pack dependency loading and schema migrations.
- Explicit desktop/mobile performance budgets and benchmark history.

## Staged Modules

Detailed independent plans now live in `docs/modules/` for characters, weather,
settlements, economy, combat, vehicles, and creatures. The next implementation target
is global topology continuity plus drainage; gameplay plugins now wait on stable
cross-chunk spatial queries and persistence.
