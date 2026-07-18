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
- Queue chunk-generation RPCs at the worker boundary. A request timeout starts only when
  the worker begins that request, not while it is waiting behind other chunk work.
- Keep the canvas hidden behind the localized surveying state until every chunk
  intersecting the initial viewport has rendered. Never expose chunk-by-chunk startup
  paint to the host page.
- Verify browser-facing changes with E2E tests.
- Saves use one versioned snapshot contract for autosave, manual slots, and imports.
  Preserve typed errors, deterministic summary ordering, world/content compatibility
  gates, and explicit slot kinds; never silently partially restore an incompatible save.
- Restore the topology ledger before requesting startup chunks. Topology merge events
  invalidate minimap/inspection state; consumers must not retain unresolvable alias IDs.
- Every worker request needs a bounded timeout plus `error` and `messageerror` cleanup.
  Keep worker implementation/fallback diagnostics on stable canvas data attributes so
  browser tests can distinguish TypeScript fallback from an enabled Wasm batch.
- HUD, tooltip, and dev-panel strings must resolve through the shared locale helpers.
- When adding a new visible label, put it in `i18n/` first and then thread the message
  key or translated content ID through the engine.
- Keep HUD controls embedded in their own surface when possible. Minimap zoom/collapse
  controls belong inside the minimap frame, should be partially transparent at rest, and
  should become solid on hover/focus.
- Minimap collapse should reduce the HUD without removing the pointer-visible expand
  affordance. A collapsed map must still be recoverable without relying on keyboard-only
  shortcuts.
- The minimap should communicate local discovered terrain, not only chunk ownership.
  When the explorer moves, the minimap picture should visibly update with them.
- Dev tools are tabbed by function. Add movement/debug toggles under Move, world/HUD/time
  controls under World, and equipment/content overrides under Gear before considering a
  new top-level panel.
- Dev locomotion overrides such as flight must stay clearly debug-scoped until the
  corresponding content-driven movement capability exists in character/equipment data.

- Roads and settlements are renderer consumers of deterministic map output; do not let
  the view invent or mutate transport topology.
- When new terrain classes land, extend terrain accents, roads, and settlement markers
  together so the world still reads clearly at low and medium zoom.
- Keep water presentation logic centralized. Coast, lake, and river polish should flow
  through `water-render.ts` or a successor module rather than scattering new drawing
  rules across `streamed.ts`.
- Shoreline paths consume map-owned mask contours. When a cardinal neighbor arrives,
  refresh only the loaded seam neighbors so contours agree without rebuilding the world.
- Keep day/night as a wrapped world-space overlay derived from clock and visible world X
  range. Do not let it collapse into a player-centered light source.
