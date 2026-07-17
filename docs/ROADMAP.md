# Roadmap

## v0.1.2-foundation-checkpoint

- [x] Streamed chunk retention/eviction, explorer movement, discovery, minimap, and
      versioned local saves.
- [x] Terrain/material catalog, topology resolver, hydrology foundation, tiered roads,
      reversible weather surfaces, and wrapped day/night lighting.
- [x] Configurable shared character generation with abilities, appearance, slots, gear,
      actions, and one-ninth-cell movement.
- [x] Content-pack ordering, provenance, overlap diagnostics, and save-compatible
      resolution hashes.
- [x] Worker startup/fallback diagnostics, center-first rendering, viewport culling,
      performance budgets, and Rust/Wasm parity boundaries.
- [x] CI and Pages verification for the release head; blog integration consumes a pinned
      immutable revision.

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
- [x] Configurable medieval road tiers with curved routing, movement bonuses, and
      terrain-aware surfacing.
- [x] Basic deterministic weather surfacing over terrain and roads.
- [x] Terrain material rule pack with English/Chinese coverage checks and a dev-only
      all-terrain showcase map.
- [x] Extracted shared water-render helpers and added deterministic river path shaping
      for the first natural-water foundation slice.
- [x] Deterministic hydrology pass with slope, depression handling, flow direction,
      accumulation, watersheds, and flow-following river source selection.
- [ ] Cross-chunk watershed aliases, seam-safe drainage outlets, and continuous river
      graph segments in issue `#38`.
- [x] Deterministic erosion-risk, sediment-load, deposition, and floodplain metadata over
      the drainage graph.
- [ ] Fully natural fog, coastline, lake, and river presentation through contour-driven
      rendering instead of cell-derived edge decoration.
- [ ] Seam-safe coastlines across chunk borders plus later erosion and floodplain polish.
- [x] Retained-horizon landmass/waterbody identity merge beyond chunk-local region labels;
      persistent aliases and change events continue in issue `#37`.
- [~] Worker-side Wasm batch generation for streamed chunk terrain layers: base climate
  layers are now a coarse worker batch with TypeScript fallback and parity fixtures;
  topology/hydrology/biome authority remains staged under issue `#30`.
- [x] IndexedDB discovery/save snapshots, import/export, migration guards, and
      restoration, including named-slot management and visible recovery states.
- [x] Content-pack dependency loading, authored overlay provenance, and schema
      migration planning. See `docs/CONTENT_PACKS.md` and issue `#7`.
- [x] Dev demo mode: reveal battle shadow, fast move, fly, teleport, and test
      equipment/weapon overrides.
- [ ] Convert debug flight into a real locomotion capability granted by gear, mounts,
      vehicles, or abilities instead of a dev-only bypass.
- [~] Deterministic reversible weather surfaces and road movement effects are active;
  regional fronts, persistence, settlements, creatures, and cities continue in issue `#31`.
- Planned long-term: custom map authoring workflow with import, editing, and test tooling.
- [x] Explicit desktop/mobile performance budgets with runtime telemetry, benchmark
      gates, and build-budget enforcement. See `docs/PERFORMANCE_BUDGETS.md` and issue
      `#10`.

## Staged Modules

Detailed independent plans now live in `docs/modules/` for characters, weather,
settlements, economy, combat, vehicles, creatures, and water. The next implementation
target is global topology continuity plus drainage, with natural-water contour work
running beside it as the main visual polish track. Gameplay plugins now wait on stable
cross-chunk spatial queries and persistence. Dev-demo tooling should stay debug-only and
must never weaken the public embed contract or lazy-load boundary.

The next gameplay track is a standalone character-domain expansion: derived resources,
roles/backgrounds, inventory item instances, weapon/armor rules, terrain interactions,
and an optional combat adapter. It must remain reversible as one package/content-pack
delta and must not move gameplay authority into PixiJS.

### Character Domain (`#39`)

- [x] Wiki and repository blueprint for setting, abilities, roles, equipment, items, and
      terrain interactions.
- [x] Optional config-first rules package with derived resources and neutral rollback.
- [x] First original role, weapon-family, armor-profile, item-category, and traversal pack.
- [ ] Inventory instances, load calculation, durability, transactions, and save migration.
- [ ] Action economy, requirement/scaling consumers, poise, conditions, and combat adapter.
- [ ] Role/faction progression, teachers, NPC parity, and authored spawn integration.
