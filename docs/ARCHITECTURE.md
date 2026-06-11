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

The worker first attempts the generated Rust/Wasm module. If unavailable, it uses the
bit-compatible TypeScript generator. Browser code does not wait for Wasm compilation on
the main thread.

## Extension

Registries map known IDs to engine capabilities. Content packs can reference registered
generators, render styles, components, systems, and UI panels. JSON cannot provide code.
Plugins declare dependencies and lifecycle hooks and operate through narrow services.

## Persistence

`localStorage` holds seed and preferences in v0.1. IndexedDB becomes authoritative for
chunked saves in v0.2. Saves include schema, engine, and content-pack versions.
