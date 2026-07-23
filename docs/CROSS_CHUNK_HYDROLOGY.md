# Cross-Chunk Hydrology

**Tracking issue:** `#38`  
**Status:** stage 1 implemented; local chunk hydrology remains provisional until the
stages below pass their gates.

## Goal

Make watershed and river identity continuous across streamed chunk seams without turning
the loaded horizon into a fake ocean edge. Results must be deterministic for positive and
negative coordinates, independent of chunk arrival order, bounded to a small retained
neighborhood, and compatible with the promoted Rust/Wasm hydrology core.

This module owns drainage truth. Coast, lake, river-bank, and fog presentation remain in
the water/rendering work. Erosion, sediment, and floodplain metadata consume drainage but
do not define it.

## Current Failure Mode

`buildHydrologyCoreRaster` correctly treats the edge of a finite raster as an outlet. A
streamed chunk currently passes only its `64 x 64` interior raster, so all four chunk edges
look like real-world drainage boundaries. Consequences:

- flow can terminate at a chunk edge even when lower land exists in the next chunk;
- edge accumulation omits upstream cells from neighboring chunks;
- local watershed integers have no stable cross-chunk meaning;
- independently generated river paths can disagree about the same seam.

The existing feature margin lets a rendered river inspect cells outside one chunk, but it
does not repair the authoritative per-cell hydrology arrays.

## Non-Negotiable Invariants

1. World coordinates, never load order, choose canonical identities.
2. A chunk edge is a provisional frontier, not an outlet, unless water or reconciled
   downhill evidence says otherwise.
3. Cardinal seam samples agree from both sides after reconciliation.
4. Diagonal flow belongs to one deterministic cardinal seam handoff when it crosses a
   corner; use north, east, south, west tie order after the existing D8 direction order.
5. Local array labels never escape as public identities.
6. Renderer objects never own or mutate drainage identity.
7. Reconciliation replaces only seam bands and summaries. It does not rebuild the retained
   world or unrelated PixiJS display objects.
8. TypeScript remains the reference fallback. Rust/Wasm receives rectangular numeric
   batches and returns typed arrays; it does not own streaming, IDs, saves, or events.

## Stable Identities

Use namespaced coordinate-derived IDs:

- provisional watershed component: `watershed:<chunkX>,<chunkY>:<localComponent>`;
- canonical watershed outlet: `watershed:outlet:<worldX>,<worldY>`;
- river source: `river:source:<worldX>,<worldY>`;
- confluence: `river:confluence:<worldX>,<worldY>`;
- water mouth: `river:mouth:<worldX>,<worldY>`.

When exploration reveals an earlier canonical outlet, the resolver emits an alias merge.
Consumers must resolve at read time or subscribe to change events. Split is reserved for a
content/generator-version reconciliation that proves one previous identity represented
multiple drainage graphs.

## Implemented Foundation

`packages/map/src/drainage-summary.ts` now emits a serializable
`ChunkDrainageSummary` for every generated chunk. It exposes only the local D8 flow that
crosses a cardinal frontier, including the local watershed component, accumulation, and
filled elevation. The state is always `provisional`; no consumer may treat its watershed
integer as a stable world identity.

This gives workers, fixtures, diagnostics, and a future resolver the exact same typed
handoff contract. It intentionally does **not** use a synthetic edge-water mask or
reconstruct fields after generation: summaries use the actual hydrology raster that
generated the chunk. `tests/drainage-summary.test.ts` locks deterministic behavior for
negative coordinates and repeat generation.

## Data Contracts

The map package should add serializable, worker-safe contracts equivalent to:

```ts
interface ChunkDrainageSummary {
  chunkX: number
  chunkY: number
  chunkSize: number
  halo: number
  watershedComponents: Uint16Array
  componentOutlets: DrainageOutlet[]
  edges: Record<CardinalDirection, DrainageEdgeSample[]>
  riverSegments: RiverGraphSegment[]
  state: 'provisional' | 'reconciled'
}

interface DrainageEdgeSample {
  localOffset: number
  watershedComponent: number
  direction: number
  accumulation: number
  filledElevation: number
  crossesFrontier: boolean
}

interface RiverGraphSegment {
  id: string
  upstreamNodeIds: string[]
  downstreamNodeId: string | null
  points: Float32Array
  discharge: number
  state: 'source' | 'channel' | 'confluence' | 'outlet' | 'mouth'
}
```

Use typed edge arrays in production if object fixtures prove too expensive. The semantic
contract stays the same.

## Generation Strategy

### 1. Provisional halo raster (next)

Generate a deterministic rectangular window around an isolated chunk:

```text
interior: 64 x 64
initial halo: 16 cells per side
numeric batch: 96 x 96
```

Base elevation and water inputs must be sampled from global coordinates with the same seed,
content resolution, and authored overlay precedence as the interior. Run the existing
hydrology core over the full window, then crop interior arrays and emit edge summaries.

The halo reduces immediate edge artifacts but is explicitly provisional. It is not by
itself proof of seam correctness because priority flood still sees the halo's outer edge.

### 2. Pairwise seam reconciliation

When cardinal neighbors are retained, request one deterministic union window containing:

- both complete chunk interiors;
- the same halo around the pair;
- authored elevation/water inputs for the full window.

Run hydrology once for that union window. Extract a seam band from each side, initially
`halo / 2` cells deep, plus new edge summaries. Apply the pair result atomically in fixed
north/east/south/west order. The same pair key and bounds are used regardless of which
chunk arrived first.

Only the two chunks and their direct seam-dependent summaries are invalidated. If a changed
outlet aliases into another retained watershed, enqueue the next affected seam once; never
perform an unbounded synchronous cascade.

### 3. Retained drainage resolver

A map-owned resolver consumes summaries and:

- joins matching watershed components when flow crosses a seam;
- preserves canonical aliases across eviction/reload using the #37 ledger/event pattern;
- records frontier inflow/outflow and accumulation deltas;
- publishes merge/split/frontier events;
- exposes canonical watershed lookup for cell inspection;
- exposes river-node and segment lookup for roads, bridges, settlements, flooding, habitats,
  and minimap summaries.

The resolver may report `provisional` at the retained horizon. It must never call that
frontier a mouth unless the target is a water cell or a known world outlet.

### 4. Accumulation correction

Pair reconciliation provides exact local accumulation for the pair window but may receive
additional upstream discharge later. Store one boundary inflow scalar per edge sample and
propagate only the delta downstream through the retained graph. Saturate public
`Uint32Array` values rather than wrapping. A repeated summary with the same revision is
idempotent.

### 5. Stable river graph

River source candidates remain global-coordinate and config-driven. Trace unsmoothed graph
cells against reconciled flow, then derive presentation curves afterward. Segment IDs come
from source/confluence/mouth coordinates, not chunk IDs. A segment crossing a seam is split
for storage but keeps one graph identity and explicit upstream/downstream links.

The renderer can smooth segment points, but collision, bridge placement, flooding, and
skills query the unsmoothed graph corridor.

## Worker Protocol

Add versioned request/result variants rather than widening the existing request invisibly:

- `generate-chunk-hydrology-window` for provisional halo output;
- `reconcile-hydrology-seam` for a canonical chunk pair;
- structured request IDs, timeouts, fallback reasons, timings, and transfer-byte counts;
- transferable interior patches, summaries, and river point buffers.

The existing `hydrology-raster` Wasm batch can process rectangular windows without gaining
streaming knowledge. Promotion gates must be repeated at `96 x 96`, `160 x 96`, and
`96 x 160`, including negative-coordinate and authored-overlay fixtures.

## Persistence

Extend the world save additively with a versioned drainage ledger after the runtime resolver
is stable. Reuse the #37 policies:

- rehydrate aliases before startup chunks;
- validate schema/resolver versions, cycles, media, count, and serialized bytes;
- migrate old schema-one saves to an empty drainage ledger;
- hard-fail corrupt or incompatible data through typed recovery;
- keep bounded summaries for discovered identities, not full chunk rasters.

## Performance Budgets

Initial gates on the reference desktop profile:

- provisional `96 x 96` hydrology median: at most `1.8x` current `64 x 64` median;
- pair reconciliation median: `<= 12 ms`, p95 `<= 24 ms`;
- reconciliation transfer growth: `<= 48 KiB` per seam result;
- main-thread seam apply: `<= 2 ms` p95;
- at most one seam worker request in flight and four pending per newly arrived chunk;
- resolver work: proportional to changed edge samples and downstream retained segments;
- no full retained-world regeneration or full minimap rebuild.

Record actual numbers in benchmark output before changing these gates.

## Test Matrix

### Unit

- identical summaries and graph IDs in opposite load orders;
- east/west and north/south flow direction agreement;
- diagonal corner travel with fixed handoff order;
- negative chunk coordinates;
- no non-water interior river endpoint at a reconciled seam;
- confluence and mouth IDs stable after alias merges;
- eviction/reload and ledger round trip;
- malformed, cyclic, oversized, and incompatible ledger recovery;
- accumulation delta idempotence and saturation.

### Worker and Wasm

- TypeScript/Rust byte parity for square and rectangular halo windows;
- authored elevation/water overlay parity in a seam halo;
- transfer lists detach every returned numeric buffer exactly once;
- timeout, worker error, `messageerror`, and Wasm fallback settle every request.

### Browser

- travel across a seam while a river remains continuous;
- reload after discovery and retain watershed/river IDs;
- minimap and inspection update after merge events;
- no visible chunk-wide repaint when one seam reconciles;
- diagnostics expose implementation, changed seam, elapsed time, and resolver revision.

## Delivery Stages

1. **Contracts and red fixtures.** Add summary, graph, event, and query types plus failing
   load-order/seam fixtures.
2. **Provisional halo generation.** Add global-coordinate halo input and interior cropping
   in TypeScript, then preserve Wasm parity.
3. **Pair reconciliation.** Add worker request, deterministic pair bounds, seam patch apply,
   and bounded invalidation.
4. **Watershed resolver.** Canonical aliases, events, cell queries, eviction/reload, and
   persistence.
5. **River graph.** Stable nodes/segments, confluences, mouths, accumulation deltas, and
   downstream consumer queries.
6. **Runtime/browser proof.** Streamed travel, minimap/inspection refresh, context cleanup,
   performance budgets, CI, Pages, and live verification.

Do not close issue `#38` after only the halo stage. Closure requires all acceptance criteria,
including load-order identity, cross-boundary accumulation, bounded runtime updates, worker
transfer coverage, browser restart, and performance evidence.
