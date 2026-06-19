# Standalone App Agent Guide

This app is the GitHub Pages reference host. Keep it framework-light and equivalent to
the blog embed behavior.

- Do not import the engine before the Start/submit action.
- Launcher controls may use only the public `@alohayo/config` and `@alohayo/embed`
  contracts.
- Add visible strings to the shared repository `i18n/` catalogs before updating this UI.
- Keep the language switch host-side and lightweight; it must not force eager engine
  loading.
- Preserve keyboard, pointer, touch, loading, retry, and small-screen behavior.
- When changing launch options, update the blog launcher and E2E lazy-load assertions.
- Verify with `yarn build` and `yarn test:e2e`.
