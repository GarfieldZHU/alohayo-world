# Changelog

## Unreleased

- Fix cross-chunk road streaks and the collapsed minimap clock/control overlap.

- Replace the placeholder GitHub Wiki with a versioned bilingual handbook for terrain,
  setting, characters, equipment, architecture, and config-first extension workflows.
- Validate Wiki language pairs, version metadata, internal links, and all localized
  terrain entries before publication.
- Persist versioned topology aliases across saves and browser restarts with typed change
  events, migration recovery, and bounded serialization.
- Define the staged halo, seam-reconciliation, watershed-resolver, and river-graph contract
  for cross-chunk hydrology.

## 0.1.3 - 2026-07-17

- Promote deterministic chunk base-layer generation to the Rust/Wasm worker path after
  parity, startup, transfer, fallback, and browser performance gates passed.
- Promote the pure hydrology raster to Rust/Wasm with byte-identical drainage fields,
  unchanged chunk hashes, explicit fallback, and measured worker acceleration.
- Split regional weather simulation into explicit state/persistence and consumer stages.
- Split transport structures/traversal from settlement traffic, maintenance, mounts, and
  vehicles so both stages share one deterministic movement contract.
- Conclude the first Rust/Wasm migration program with stable chunk-layer and hydrology
  batches; isolate render-hint and contour promotion as measured follow-ups.

- Add config-driven erosion, sediment, deposition, and floodplain metadata to generated
  worlds and streamed chunks.
- Add a localized local save manager with named slots, recovery feedback, import/export,
  rename, duplicate, load, and delete controls.
- Add deterministic runtime authored entities, protected overlay regions, and
  config-driven settlement bias.

- Added deterministic smoothed mask contours for layered shorelines, seam refresh, and an
  adaptive sub-cell discovery fog with a feathered active-vision boundary.
- Fixed minimap clock/control overlap and made the complete overlapping control hit area
  interactive.
- Added a bounded worker request queue and atomic initial viewport presentation so startup
  shows a loading state before revealing a complete first frame.
- Added a checked-in GitHub Wiki blueprint for terrain, setting, characters, roles,
  equipment, items, and map interactions.
- Added an optional config-first character-rules package with derived resources,
  background roles, equipment families, and terrain traversal queries.
- Fixed the standalone launcher version label for the `v0.1.2` release.

## 0.1.2 - 2026-07-17

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
- Fixed dependency auditing with a supported Yarn release and patched Vite, esbuild, and
  undici resolutions.
- Fixed production world startup by capability-gating Wasm worker batches, adding
  structured fallback diagnostics, message-error handling, and request timeouts.
- Made startup center-first and added viewport-lazy PixiJS chunk geometry/culling so
  background streaming stays responsive; throttled lighting and cached vision overlays
  avoid redundant full-screen paints while telemetry measures rendered frames accurately.
- Added deterministic content-pack provenance reports and source-rich duplicate area
  diagnostics for CI and future developer inspectors.

## 0.1.0-demo

- Initial PixiJS world explorer and lazy embed API.
- Deterministic worker-based terrain generation.
- Configurable biomes, diagnostics, pan, zoom, seed regeneration, and tile inspection.
- Rust/Wasm generator crate and TypeScript fallback.
- GitHub Actions CI, Pages, release, security, and end-to-end workflows.
