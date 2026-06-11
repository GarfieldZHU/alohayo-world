# Alohayo World

A map-first, data-driven web game runtime built with TypeScript, PixiJS, Web Workers,
and an optional Rust/WebAssembly acceleration layer.

The `v0.1.0-demo` release is a deterministic geography explorer. It generates a world
from a seed, renders eight configurable biomes, supports pan/zoom and inspection, and
can be embedded without loading game resources until the player presses Start.

## Commands

```bash
yarn
yarn validate:content
yarn test
yarn dev
yarn build
```

The production build is written to `dist/`. The integration entry is
`dist/embed/bootstrap.js`; distribute it together with the sibling `dist/assets/`
directory referenced by the module.

## Embed

```ts
const { mountGame } = await import('https://garfieldzhu.github.io/alohayo-world/embed/bootstrap.js')
const game = await mountGame({ container, initialWorld: { seed: 'alohayo' } })
await game.destroy()
```

See [AGENTS.md](AGENTS.md), [the architecture](docs/ARCHITECTURE.md), and
[the roadmap](docs/ROADMAP.md) before extending the runtime.
