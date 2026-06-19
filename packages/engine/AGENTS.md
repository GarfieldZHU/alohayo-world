# Engine Package Agent Guide

The engine coordinates lifecycle, rendering, input, diagnostics, and module services.

- PixiJS is a rendering adapter, not authoritative world state.
- Keep full-world work out of the main thread.
- Rendering cost should trend toward visible chunks, not total world area.
- Every allocated listener, worker, ticker, display object, and DOM node must be cleaned
  up by `GameHandle.destroy`.
- Maintain pointer, touch, keyboard, resize, pause/resume, and context-loss behavior.
- Read `docs/MOVEMENT_AND_ACTIONS.md` before changing character input or simulation.
- Keep motion fixed-step in cell coordinates; render animation never owns position.
- Preserve the one-ninth terrain-cell footprint and separate it from UI halos.
- Clear held keys on blur and ignore gameplay input while the user edits form fields.
- Chunk retention, discovery fog, minimap summaries, and camera follow must consume
  streamed data without promoting the renderer into authoritative simulation state.
- Preserve the mode split: game mode owns a tight follow camera with locked zoom, while
  dev mode keeps explicit free-camera inspection controls.
- Keep browser diagnostics visible through stable canvas data attributes whenever a new
  exploration feature lands.
- The engine may request chunks opportunistically, but it must tolerate frontier cells
  not being loaded yet and cleanly release evicted chunk display objects.
- Verify browser-facing changes with E2E tests.
- HUD, tooltip, and dev-panel strings must resolve through the shared locale helpers.
- When adding a new visible label, put it in `i18n/` first and then thread the message
  key or translated content ID through the engine.
- Dev locomotion overrides such as flight must stay clearly debug-scoped until the
  corresponding content-driven movement capability exists in character/equipment data.

- Roads and settlements are renderer consumers of deterministic map output; do not let
  the view invent or mutate transport topology.
- When new terrain classes land, extend terrain accents, roads, and settlement markers
  together so the world still reads clearly at low and medium zoom.
