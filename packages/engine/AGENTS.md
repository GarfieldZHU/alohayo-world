# Engine Package Agent Guide

The engine coordinates lifecycle, rendering, input, diagnostics, and module services.

- PixiJS is a rendering adapter, not authoritative world state.
- Keep full-world work out of the main thread.
- Rendering cost should trend toward visible chunks, not total world area.
- Every allocated listener, worker, ticker, display object, and DOM node must be cleaned
  up by `GameHandle.destroy`.
- Maintain pointer, touch, keyboard, resize, pause/resume, and context-loss behavior.
- Verify browser-facing changes with E2E tests.
