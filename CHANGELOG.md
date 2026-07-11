# Changelog

## Unreleased

- Added AI-first repository and module agent guides with staged extension plans.
- Added the repo-first delivery workflow to `AGENTS.md` so multi-step work is implemented,
  verified, pushed, monitored, and handed off consistently.
- Expanded geography with bathymetry, lakes, lowlands, highlands, bare rock, and
  mainland/island topology.
- Increased the default atlas size and added bounded enlargement presets.
- Added deterministic terrain transitions, cursor-centered zoom, and zoom-dependent
  regional and close terrain details.
- Added plug-in authored map-area configs with worker application and landmarks.
- Added shared configurable character abilities, appearance, wearable/decorator slots,
  item pools, and switchable weapon loadouts for players, NPCs, and enemies.
- Added the one-ninth-cell character scale, fixed-step walking/running, terrain-aware
  collision, facing animation, camera follow, and configurable interaction actions.
- Fixed dev battle-shadow reveal so the toggle now affects the actual discovery fog on
  loaded chunks.
- Added a collapsible, locale-aware, theme-aware dev panel with remembered local state.
- Added dev flight traversal across blocked terrain, plus fly debug visuals and keybinding.
- Tightened game-mode camera behavior to locked follow/zoom while keeping dev free camera
  controls.
- Tuned seeded sea-level variance so worlds usually land between 30% and 60% water, with
  deterministic wider outliers still bounded to the configured extreme range.
- Added content-tuned medieval road profiles with movement multipliers, smoother curved
  geometry, and terrain-aware road surfacing.
- Added first-pass deterministic weather surface overlays for rain, snow, and thaw
  without yet promoting weather to full gameplay simulation.
- Added authoritative terrain material rules, locale coverage checks, and a dev-only
  all-terrain showcase area.
- Improved fog-of-war and minimap UI polish, including lighter controls, better control
  states, and a cleaner hidden-side mist model.
- Added the first natural-water foundation: extracted shared water render helpers,
  shaped river paths with deterministic meander/smoothing settings, and documented the
  contour-based next step for coasts, lakes, rivers, and fog.
- Documented the safe Wasm refactor target for streamed chunk terrain generation and the
  current Rust tooling/build-order blockers.
- Reworked the minimap into a lighter local-map HUD with a persistent collapsed affordance,
  improved expanded-shell recovery, and issue-first verification workflow notes for
  future regressions.
- Tuned the minimap header polish again so the collapse control lives on the map corner
  with arrow icons and the clock aligns cleanly to the minimap edge.
- Fixed the minimap collapse affordance click target, moved it outside the map frame,
  and stabilized dev tool tabs with persistent selection, fixed footer chrome, and
  localized tab hints.
- Added the first real content-pack loader slice: manifest discovery, dependency DAG
  validation, deterministic pack ordering, example dependent overlays, and CI content
  validation for authored area packs.
- Extended content-pack contracts with explicit file-ownership rules and authored
  overlay provenance metadata so later overlay families can merge without losing source
  identity.
- Added schema-validated authored entities, protected regions, and generator modifiers
  to authored map areas, plus example pack fixtures and docs for the next `#7` slice.
- Added content-pack resolution reports, save-ready pack metadata, a public migration
  registry shape, and deterministic conflict/hash coverage to finish the closeable `#7`
  loader-contract work.
- Added IndexedDB autosaves with versioned snapshot contracts, discovery/explorer restore,
  import/export helpers, migration guards, and typed corruption/quota compatibility
  handling for `#11`.
- Added runtime performance telemetry, desktop/mobile benchmark gates, and build-size
  budget enforcement for frame time, chunk latency, long tasks, memory sampling, and
  bundle-size regressions.
- Added a deterministic hydrology pass with depression handling, slope, flow direction,
  accumulation, watershed IDs, and flow-following river generation for issue `#9`.
- Added the first Rust/Wasm renderer-adjacent migration slice: worker-produced chunk
  render hints for noise, transition masks, and detail markers with a deterministic
  TypeScript fallback and unit tests.
- Added local Rust/Wasm bootstrap and verification guidance, required real Wasm artifacts
  for CI/Pages/releases, and started worker-side `ChunkBaseLayers` migration with
  deterministic TypeScript and cross-language parity coverage.
- Added retained-horizon chunk topology summaries and deterministic seam resolution for
  streamed land and water identities, including load-order and eviction regression tests.
- Added deterministic per-cell weather surface conditions and configurable road movement/
  traffic modifiers for wet, muddy, snowy, slushy, and flooded routes.

## 0.1.0-demo

- Initial PixiJS world explorer and lazy embed API.
- Deterministic worker-based terrain generation.
- Configurable biomes, diagnostics, pan, zoom, seed regeneration, and tile inspection.
- Rust/Wasm generator crate and TypeScript fallback.
- GitHub Actions CI, Pages, release, security, and end-to-end workflows.
