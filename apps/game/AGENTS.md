# Standalone App Agent Guide

This app is the GitHub Pages reference host. Keep it framework-light and equivalent to
the blog embed behavior.

- Do not import the engine before the Start/submit action.
- Launcher controls may use only the public `@alohayo/config` and `@alohayo/embed`
  contracts.
- Preserve keyboard, pointer, touch, loading, retry, and small-screen behavior.
- When changing launch options, update the blog launcher and E2E lazy-load assertions.
- Verify with `yarn build` and `yarn test:e2e`.

- Keep World Mode and Game Mode terminology explicit in launcher copy and planning.
- World Mode remains the free-camera atlas/generation surface.
- Game Mode planning assumes a fixed follow camera, player HUD, minimap, settlements, and road-aware traversal.
- If requirements get broader than the current launcher, extend docs in `docs/` before adding ad-hoc host behavior.
