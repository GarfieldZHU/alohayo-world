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
- [ ] Infinite chunk streaming and eviction.
- [ ] Seam-safe coastlines, slope, drainage, rivers, erosion, and authored overlays.
- [ ] World Mode readouts for coordinates, elevation/z-band, terrain identity, and movement affordances.
- [ ] Explorer entity movement, minimap, discovery, and IndexedDB saves.
- [ ] Fixed-camera Game Mode with a basic main-character model and HUD skeleton.
- [ ] Movement-state expansion for walk, run, swim, and fly.
- [ ] Seeded settlement/site generation for villages, towns, cities, caves, and dungeons.
- [ ] Terrain-aware road hierarchy and movement-speed modifiers.
- [ ] Content-pack dependency loading and schema migrations.
- [ ] Explicit desktop/mobile performance budgets and benchmark history.

## Staged Modules

Detailed independent plans now live in `docs/modules/` for characters, weather,
settlements, economy, combat, vehicles, creatures, exploration, and roads. The next
implementation target is streamed chunks plus drainage; Game Mode systems should stay
behind stable spatial queries and shared terminology from World Mode.
