# Changelog

## Unreleased

- Add the first closeable follow-up contracts for issues #57, #60, #61, #62, #63, and
  #64: seasonal geomorphology forcing/proposals with bounded save validation, deterministic
  settlement agents, a versioned contour-geometry worker batch with fallback diagnostics,
  gzip archive/thumbnail helpers, character directional-clip manifests with residency, and
  an original eight-family terrain atlas with LOD/residency budgets. The full promotion gates
  for hardware evidence, cross-chunk hydrology, authored character assets, and bitmap shipping
  remain explicit rather than being claimed by the contracts alone.

- Pin every GitHub Actions dependency to an immutable commit and refresh the Yarn security
  resolutions. `yarn npm audit --all --recursive` now reports no audit suggestions.

- Stabilize the CI browser contract for the two-core SwiftShader runner: serialize Playwright
  workers, disable shared-memory pressure, wait on the streamed world's explicit ready marker,
  and verify responsive controls through geometry, actionability, and state transitions.

- Stop per-frame Chronicle and Dossier DOM reconstruction when their snapshot content is unchanged,
  preserving live updates while keeping hidden UI surfaces and open controls stable under load.

- Harden issue #62 save archives with gzip/plain migration fallback, four-megabyte compressed and
  eight-megabyte decompressed budgets, bounded streaming decompression, idle thumbnail capture,
  localized corruption/size errors, archive benchmarks, and desktop/narrow browser round-trip
  coverage. Release-artifact main CI, Pages, and published-entry verification complete the
  promotion gate.

- Complete issue #66 by migrating pinned GitHub Actions to Node24-native checkout, setup-node,
  Pages, deployment, and release action revisions while preserving immutable SHA pinning and
  existing workflow permissions. Disable setup-node's pre-Corepack package-manager cache so
  Yarn 4 is not probed through the runner's global Yarn 1 binary.

- Start issue #69 by evaluating setup-node v7's ESM/dependency refresh as a targeted fix for the
  remaining Node DEP0040 punycode warning in action setup and cleanup logs.

- Expand the Wayfinder Dossier into a detailed ability/items surface: generated slate and
  vellum material assets, catalog-backed ability groups with segmented preview meters,
  point-reserve plate, generated loadout records, and a truthful field item catalog with
  tags, modifier summaries, appearance tints, and explicit inventory boundaries.

- Narrow the gameplay shortcut strip to `Esc` Settings, `M` Map, and `I` Abilities / items;
  make `M` open the Field map, `Esc` open Settings when idle, and `I` open the ability ledger.
  Add the `I` shortcut to the Tour guide and keep its map guidance aligned with `M`.

- Rework the character panels into a larger readable corner dock: remove the unexpected
  Field Dossier eyebrow, stop replaying panel arrival animations during every interaction,
  increase ability controls and copy sizing, and use a stable translucent map-safe backing.

- Simplify Chronicle rail icons into direct glyphs without circular wrappers, preserving
  the rail's active selection line, labels, focus treatment, and mobile tab behavior.

- Give Bestiary reference cards a more tactile field-record treatment with kind-specific
  accents, layered atlas contour/compass detailing, and restrained hover lift/glow feedback.

- Extend the field-record material across the Chronicle's Guide, Terrain, Save, Field Map,
  and Settings blades with shared textured backgrounds, registration marks, accent tints,
  keyboard focus feedback, and responsive hover lift.

- Constrain the Chronicle menu to the game surface rather than the browser viewport. Keep
  the desktop navigation rail and mobile tab row fixed while limiting scrolling to the
  active right-side reading pane.

- Redesign the splash threshold as a tactile Wayfinder field plate: brass corner registration
  marks, contour-line and scanline texture, compass detailing, a serif title lockup, gold
  primary action, dark secondary action, local-world status, explicit field controls,
  responsive mobile spacing, concise accessible labels, and an `M` shortcut into Settings
  while the game is still gated.

- Add the feature-branch terrain texture rendering foundation: a deterministic
  `terrain-texture-hints` Rust/Wasm batch with TypeScript parity/fallback, compact worker
  diagnostics, world-coordinate procedural water/coast/grass/forest/wetland/rock/snow/
  volcanic motifs in the existing Pixi regional-details batch, and desktop/mobile evidence.
  Keep the optional authored 2D atlas and its residency/LOD budget in follow-up issue #64;
  no GLB or bitmap runtime dependency is introduced.

- Redesign the in-game Adventurer's Chronicle into independent Save, Guide, Terrain
  Manual, Bestiary, Field Map, and Settings sections. The Save section now writes a real
  manual progress marker through the local save store; terrain and creature content stays
  explicit about catalog/reference versus unavailable encounter authority. Add bilingual
  copy, responsive folio styling, keyboard section shortcuts, and desktop/mobile coverage.
  Refresh the enforced bilingual artifact budget to account for the expanded player-facing
  catalog.

- Close #52/#53 save safety follow-through: add controllable quota/pruning and injected
  corrupt-record browser fixtures, keyboard/narrow-viewport journey coverage, and document
  non-destructive cross-seed remount rollback guarantees.

- Implement the first #59 character presentation pipeline: extract deterministic pose and
  equipment resolution into `@alohayo/character-renderer`, keep Pixi layers explicit and
  disposable, support reduced-motion/debug capture, and leave sprite/GLB manifests as an
  additive seam for the follow-up asset issue.

- Add the first Wayfinder Dossier character surface: a low-chrome right dock/bottom sheet
  with independently collapsible overview, ability-point preview, equipment, skills, and
  field-system panels; `C` plus `1`–`5` shortcuts; bilingual copy; truthful preview/
  unavailable states; and desktop/mobile Playwright coverage.

- Close #43/#54 save recovery work: classify current/remountable/incompatible worlds before
  mutation, confirm cross-seed remounts with a temporary recovery slot and rollback path, and
  require replacement confirmation across save, rename, duplicate, and import flows. Add
  accessible journey cards, schema-one bounded multi-slot archives with partial-import reports,
  and advisory browser storage estimates. Optional thumbnails and chunk-history compression are
  intentionally deferred to follow-up #62.

- Complete #45 with a deterministic fixed-step regional weather state: bounded retained
  cells, pressure/humidity/precipitation/wind/front fields, short changed-cell history,
  optional versioned save snapshots, deterministic restore, pure visibility/drainage
  queries, and pause-aware engine integration.

- Promote #49 render-hint batches to the default Wasm worker capability after exact
  16/64/128 parity, negative-coordinate/seam fixtures, fallback validation, browser
  coverage, and measured CPU/transfer gates. TypeScript remains the presentation authority.

- Complete #46/#47/#48 with deterministic regional weather sampling, shared bridge/
  causeway/ferry/switchback traversal records, aggregate settlement traffic diagnostics,
  and config-driven mount/vehicle profiles. Narrow game-mode camera framing to roughly
  22 x 15 terrain cells and document the standalone character presentation follow-up
  in #59.

- Polish the splash and HUD toward a blog-adapted fantasy language: rounded slate cards,
  cyan focus states, quiet brass compass details, responsive light/dark tokens, and one
  clear field-map surface. Add the ImageGen direction board to the UI design references.

- Align the DOM minimap controls with the Pixi field-map frame and hide the full minimap
  surface during the splash for a cleaner game start.

- Restore the playable field map as a first-class Wayfinder HUD surface, add visible
  `M`/`H`/`N` shortcut hints and settings controls, and refine the edge treatment into a
  darker brass-and-cartography presentation that stays readable in either host theme.

- Add the first #56 Wayfinder Relic UI slice: configurable game-only splash, light HUD,
  six-tab JRPG menu, bilingual copy, modal input gating, responsive layout, lifecycle
  controls, visual concept boards, architecture documentation, and browser regression tests.

- Start #44 Phase 0 with a disabled-by-default, typed active-corridor erosion/flood/
  deposition kernel, exact integer water/sediment accounting, deterministic pause/resume,
  sparse changed-cell output, and explicitly provisional local outlet exports.
- Complete the closeable #44 Phase 1 handoff contract with canonical topology identities,
  atomic order-independent aggregation, alias merge reconciliation, eviction/rehydration,
  and bounded per-tick/entry/serialized-byte budgets.
- Reduce #55 movement-loop contention by gating chunk streaming to chunk crossings and
  discovery/fog/minimap work to cell crossings; add a mount lifecycle signal and suspend
  the blog's decorative Live2D canvas while the world is active.
- Complete the #41 natural-rendering pass with loaded-neighbor halo shoreline distances,
  specialized ocean/lake/estuary/delta/marsh/reef materials, downstream river width
  profiles, and one filtered GPU discovery-fog texture whose dirty updates match full
  rebuilds and the CPU action threshold.
- Fix visible world seams by removing isolated per-chunk fog blur and suppressing false
  shoreline contours where streamed neighbor geography is still unknown; discovery fog now
  uses one world-space graphics layer and world-coordinate visibility noise.

- Organize Rust/Wasm typed batch outputs and shared raster-dimension checks into dedicated
  modules while preserving current promoted-batch parity and worker ownership.
- Add a deterministic, non-executable authored-entity lifecycle registry with streamed
  reference-counted ownership, closed capability kinds, respawn policy, persistent
  never-respawn deltas, localized dev diagnostics, and browser/save regression tests.
- Add compact journey previews, three-version rolling local backups, per-record corruption
  isolation, deterministic quota pruning, and explicit previous-version recovery to the
  named save manager.

- Add provisional typed drainage handoff summaries for streamed chunks and deterministic
  seam fixtures; full halo reconciliation remains tracked in #38.
- Add signed local shoreline-distance hints with subtle water material bands as the first
  #41 polish slice, without claiming cross-chunk shoreline authority.
- Add a pure character-loadout terrain adapter so data-defined equipment tags can grant
  traversal capabilities while the optional character rules plugin remains reversible.
- Expand the bilingual Wiki with water terrain/seam authority and equipment-to-terrain
  interaction contracts.

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
