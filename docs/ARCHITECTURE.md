# Architecture

## Runtime

The host calls `mountGame`. The embed module dynamically imports the engine, validates
content, starts a generation worker, and initializes PixiJS. `GameHandle` owns every
worker, event listener, animation callback, texture, and DOM node and releases them from
`destroy`.

Simulation uses a fixed 60 Hz clock. Rendering reads snapshots and may interpolate
without mutating authoritative state. PixiJS is an adapter, never the world model.

## Data flow

`WorldDefinition -> validator -> generator worker -> typed terrain layers -> biome
classifier -> render chunks -> inspector/diagnostics`.

The active browser generator is currently TypeScript inside a Web Worker. The Rust crate
contains deterministic primitives and a Wasm build path, but it does not become
authoritative until a worker-side loader, coarse batch API, and cross-language parity
suite are complete. Browser code must never compile or run full-world generation on the
main thread.

## Extension

Registries map known IDs to engine capabilities. Content packs can reference registered
generators, render styles, components, systems, and UI panels. JSON cannot provide code.
Plugins declare dependencies and lifecycle hooks and operate through narrow services.
See `MODULE_CATALOG.md` and `modules/` for the planned service boundaries.

## Persistence

`localStorage` holds seed and preferences in v0.1. IndexedDB becomes authoritative for
chunked saves in v0.2. Saves include schema, engine, and content-pack versions.
