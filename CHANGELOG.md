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
- Added a collapsible, locale-aware dev panel with remembered local state.
- Added dev flight traversal across blocked terrain, plus fly debug visuals and keybinding.
- Tightened game-mode camera behavior to locked follow/zoom while keeping dev free camera
  controls.
- Tuned seeded sea-level variance so worlds usually land between 30% and 60% water, with
  deterministic wider outliers still bounded to the configured extreme range.

## 0.1.0-demo

- Initial PixiJS world explorer and lazy embed API.
- Deterministic worker-based terrain generation.
- Configurable biomes, diagnostics, pan, zoom, seed regeneration, and tile inspection.
- Rust/Wasm generator crate and TypeScript fallback.
- GitHub Actions CI, Pages, release, security, and end-to-end workflows.
