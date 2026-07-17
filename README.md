# Alohayo World

A map-first, data-driven web game runtime built with TypeScript, PixiJS, Web Workers,
and an optional Rust/WebAssembly acceleration layer.

The current foundation release is a deterministic streamed-world explorer. It combines
26 configurable terrain/material definitions with topology, hydrology, roads, weather,
day/night lighting, discovery, local saves, and a generated explorer shared by the
player/NPC/enemy character model. The world remains entirely client-side and the blog
embed loads game resources only after the player presses Start.

## Commands

```bash
yarn
yarn validate:content
yarn test
yarn dev
yarn build
```

For the Rust/Wasm toolchain, local artifact verification, and the complete development
checklist, see [Local Development Setup](docs/LOCAL_DEVELOPMENT.md).

The production build is written to `dist/`. The integration entry is
`dist/embed/bootstrap.js`; distribute it together with the sibling `dist/assets/`
directory referenced by the module.

## Embed

```ts
const { mountGame } = await import('https://garfieldzhu.github.io/alohayo-world/embed/bootstrap.js')
const game = await mountGame({ container, initialWorld: { seed: 'alohayo' } })
await game.destroy()
```

See [AGENTS.md](AGENTS.md), [the documentation map](docs/README.md), [the architecture](docs/ARCHITECTURE.md),
and [the roadmap](docs/ROADMAP.md) before extending the runtime. The current module
status and ownership boundaries are summarized in [the module catalog](docs/MODULE_CATALOG.md).
