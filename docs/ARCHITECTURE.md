# Architecture

## Runtime

The host calls `mountGame`. The embed module dynamically imports the engine, validates
content, starts a generation worker, and initializes PixiJS. `GameHandle` owns every
worker, event listener, animation callback, texture, and DOM node and releases them from
`destroy`.

Simulation uses a fixed 60 Hz clock. Rendering reads snapshots and may interpolate
without mutating authoritative state. PixiJS is an adapter, never the world model.
The day/night module derives a wrapped east-west lighting field from the simulation
clock plus the visible world X range; it is a render overlay, not a mutation of terrain
state.

## Data flow

`WorldDefinition -> validator -> generator worker -> typed terrain layers -> biome
classifier -> day/night/weather overlays -> render chunks -> inspector/diagnostics`.

Authored map-area JSON is discovered at build time, transferred with the generation
request, applied in the worker after procedural classification, and followed by
topology/hash recalculation.

Character catalogs flow through `@alohayo/character`, which deterministically resolves
ability rolls, appearance pools, equipment choices, and active weapon slots for every
role. The engine consumes generated snapshots and does not own character definition
logic.

The active browser generator is currently TypeScript inside a Web Worker. The Rust crate
contains deterministic primitives and a Wasm build path, but it does not become
authoritative until a worker-side loader, coarse batch API, and cross-language parity
suite are complete. Browser code must never compile or run full-world generation on the
main thread.

The streamed-map loop is the first credible Wasm refactor target because it repeatedly
builds typed `elevation`, `moisture`, `temperature`, and `biomes` buffers for each
chunk. The production boundary should stay coarse: the worker asks Wasm for a complete
chunk-layer batch, then TypeScript continues to apply authored overlays, settlements,
roads, topology helpers, rendering contracts, and fallback behavior. Do not move PixiJS
or per-frame rendering into Wasm.

## Extension

Registries map known IDs to engine capabilities. Content packs can reference registered
generators, render styles, components, systems, and UI panels. JSON cannot provide code.
Plugins declare dependencies and lifecycle hooks and operate through narrow services.
See `MODULE_CATALOG.md` and `modules/` for the planned service boundaries.

## Persistence

`localStorage` still mirrors lightweight UI preferences, but IndexedDB is now the
authoritative home for autosave snapshots in v0.2. Saves include schema version, engine
version, content-pack resolution metadata, world identity, explorer state, and
discovery chunks. Import/export and migration checks operate on the same snapshot
contract, while incompatible content or unsupported schema versions fail explicitly
instead of partially restoring stale state.
