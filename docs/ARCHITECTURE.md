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

Initial presentation is atomic. The engine displays a localized surveying surface while
the generation worker resolves a serialized chunk queue, renders every chunk intersecting
the first viewport, and performs one explicit stage render. Only then does it reveal the
canvas and begin opportunistic neighborhood streaming. Worker RPC timeouts begin when a
queued request actually starts so queued chunks cannot expire before the worker sees them.

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
chunk. The first production batch is `ChunkBaseLayers`: elevation, moisture, and
temperature generated in the worker by Wasm, then validated by buffer length and fed to
the existing TypeScript topology, hydrology, biome classification, authored overlays,
settlements, roads, and fallback path. This keeps world semantics stable while removing
the repeated climate sampling loop from TypeScript. Do not move PixiJS or per-frame
rendering into Wasm.

Rust ownership expands only when the TypeScript reference and built Wasm module match
byte-for-byte for representative positive and negative chunk coordinates. If a module,
asset, initialization, or length check fails, the worker generates the same batch in
TypeScript and continues normally.

The first renderer-adjacent migration slice now follows the same rule: worker-side chunk
render-hint generation may use Wasm for deterministic `noise`, transition masks, and
detail markers, while PixiJS drawing stays in TypeScript on the main thread. Expand this
surface before considering any deeper renderer migration.

## Extension

Registries map known IDs to engine capabilities. Content packs can reference registered
generators, render styles, components, systems, and UI panels. JSON cannot provide code.
Plugins declare dependencies and lifecycle hooks and operate through narrow services.
See `MODULE_CATALOG.md` and `modules/` for the planned service boundaries.

## Persistence

`localStorage` still mirrors lightweight UI preferences, but IndexedDB is now the
authoritative home for autosave, manual, and imported snapshots in v0.2. Saves include schema version, engine
version, content-pack resolution metadata, world identity, explorer state, and
discovery chunks. Import/export and migration checks operate on the same snapshot
contract, while incompatible content or unsupported schema versions fail explicitly
instead of partially restoring stale state.

The standalone save inspector lists summaries without decoding world buffers, and all
rename, duplicate, delete, load, export, and import operations reuse the same validated
snapshot. Runtime loads require the active world identity and content resolution hash to
match; changing seeds remains an explicit remount rather than an unsafe partial restore.
