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
- Keep browser diagnostics visible through stable canvas data attributes whenever a new
  exploration feature lands.
- The engine may request chunks opportunistically, but it must tolerate frontier cells
  not being loaded yet and cleanly release evicted chunk display objects.
- Verify browser-facing changes with E2E tests.
