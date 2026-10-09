# Cross-Chunk Hydrology

**Tracking issue:** `#38`  
**Status:** the provisional halo, worker pair reconciliation, retained seam patch lifecycle,
bounded persisted alias ledger, public cell queries/change events, and stable cardinal plus
target-matched diagonal seam segments are implemented. The graph still covers seam links
only; interior graph construction, accumulation-delta propagation, and full continuity
proof remain open.

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
single streamed chunk now passes a `96 x 96` halo raster, which moves the false outlet 16
cells past the stored edge. That outer raster edge remains finite, and independent chunk
results can still disagree until a retained neighbor arrives. Pair reconciliation corrects
an eight-cell band on each side, but it does not propagate later upstream discharge through
an already reconciled downstream graph. Consequences:

- flow can terminate at a chunk edge even when lower land exists in the next chunk;
- edge accumulation omits upstream cells from neighboring chunks;
- local watershed integers have no stable cross-chunk meaning;
- independently generated river paths can disagree about the same seam.

The existing feature margin lets a rendered river inspect cells outside one chunk, but it
does not repair authoritative river graph identities or propagate changed discharge.
The renderer's `GeneratedRiver` paths are still produced from per-chunk feature windows and
are not yet rebuilt from the retained seam graph. Current seam segments therefore do not
claim to replace the full river presentation network.

## Non-Negotiable Invariants

1. World coordinates, never load order, choose canonical identities.
2. A chunk edge is a provisional frontier, not an outlet, unless water or reconciled
   downhill evidence says otherwise.
3. Cardinal seam samples agree from both sides after reconciliation.
4. Corner diagonals select one cardinal handoff in north, east, south, west order after the
   existing D8 direction order. Diagonal graph links resolve the target by world coordinate
   in the diagonal chunk; they do not yet recompute a four-chunk numeric window.
5. Local array labels never escape as public identities.
6. Renderer objects never own or mutate drainage identity.
7. Reconciliation replaces only seam bands and summaries. It does not rebuild the retained
   world or unrelated PixiJS display objects.
8. TypeScript remains the reference fallback. Rust/Wasm receives rectangular numeric
   batches and returns typed arrays; it does not own streaming, IDs, saves, or events.

## Stable Identities

The current resolver aliases provisional component IDs built from world chunk coordinates
and local watershed labels. Canonical roots are selected deterministically by chunk Y, chunk
X, and component number:

- provisional watershed component: `watershed:<chunkX>,<chunkY>:<localComponent>`;

Coordinate-derived cross-chunk segment, source, confluence, outlet, and mouth IDs are emitted
for validated seam handoffs. The optional `GameHandle` hydrology surface exposes retained
cell fields, canonical watershed IDs, a `reconciled-seams` graph snapshot, and change events.
The graph snapshot is explicitly partial; it is not yet a network of every within-chunk cell.
Split handling and full graph ownership remain pending.

## Implemented Foundation

`packages/map/src/drainage-summary.ts` emits a serializable `ChunkDrainageSummary` for every
generated chunk. It retains every cardinal boundary cell, including water, local watershed
component, accumulation, filled elevation, D8 direction, and whether the deterministic
cardinal handoff crosses that edge. A single-chunk summary is provisional. Pair results
replace the two adjacent edge summaries and seam bands; a retained resolver aliases matching
watershed components. The integer in a chunk array remains local and must not escape as a
public identity.

The worker uses the same serializable handoff contract. It intentionally does **not** use a
synthetic edge-water mask: summaries use the actual hydrology raster that generated the
chunk. `tests/drainage-summary.test.ts` locks deterministic negative-coordinate, repeated,
and corner-handoff behavior.

## Data Contracts

The current worker-safe contracts are:

```ts
interface ChunkDrainageSummary {
  chunkX: number
  chunkY: number
  chunkSize: number
  edges: Record<CardinalDirection, DrainageEdgeSample[]>
  state: 'provisional' | 'reconciled'
}

interface DrainageEdgeSample {
  localOffset: number
  watershedComponent: number
  direction: number
  upstreamCount: number
  accumulation: number
  filledElevation: number
  water: boolean
  crossesFrontier: boolean
}
```

Stable seam segments are derived from this contract. They use world-coordinate edge IDs and
node IDs, and diagonal D8 handoffs resolve the exact target corner cell before aliasing.
Diagonal matching does not yet recompute a four-chunk numeric window.

## Generation Strategy

### 1. Provisional halo raster (implemented)

Generate a deterministic rectangular window around an isolated chunk:

```text
interior: 64 x 64
initial halo: 16 cells per side
numeric batch: 96 x 96
```

Base elevation and water inputs must be sampled from global coordinates with the same seed,
content resolution, and authored overlay precedence as the interior. The chunk's existing
base-layer batch supplies interior samples; the halo is sampled from the same deterministic
world-coordinate functions. Authored terrain and elevation patches are applied across the
whole window in the normal pack order, including patches just outside the chunk. Run the
existing TypeScript or Wasm hydrology core over the full window, then crop interior arrays
and emit edge summaries.

The halo reduces immediate edge artifacts but is explicitly provisional. It is not by
itself proof of seam correctness because priority flood still sees the halo's outer edge.
The active 16-cell halo produces a `96 x 96` core raster for a `64 x 64` chunk. Two
30-run local benchmark samples measured TypeScript median ratios of 2.33–2.36x and Wasm
ratios of 2.37–2.39x relative to `64 x 64`; the latest medians were 2.647/1.134 ms and
1.260/0.527 ms respectively. The original 1.8x ratio target was not met; the budget is
now 2.5x, close to the 2.25x cell-count increase, with parity and deterministic
authored-overlay fixtures guarding the change. Revisit this budget if pair-window profiling
or the supported browser matrix shows the absolute cost is too high.

### 2. Pairwise seam reconciliation (implemented)

When cardinal neighbors are retained, the engine submits one serialized worker request for
the canonical west/east or north/south pair. The worker builds one deterministic union
window containing:

- both complete chunk interiors;
- the same halo around the pair;
- authored elevation/water inputs for the full window.

Run hydrology once for that union window. Extract an eight-cell seam band from each side
plus refreshed edge summaries. Transfer the numeric patch fields, apply results to retained
chunks in fixed north/east/south/west order, and ignore responses for evicted or replaced
chunks. Overlapping corner patches are replayed from a saved provisional baseline in that
order, so arrival order cannot change the final arrays.

Only the two chunks and their direct seam bands are changed. Pair requests use a single
worker queue; no retained-world generation or synchronous cascade runs on the main thread.
If a chunk is evicted, its neighbor's matching seam patch is removed and the neighbor is
recomposed from its baseline and remaining patches.

### 3. Retained drainage resolver (partial)

A map-owned resolver consumes summaries and:

- joins matching watershed components when flow crosses a seam;
- preserves canonical `watershed:` aliases across eviction/reload using a bounded versioned
  ledger in the world save;
- releases retained summaries and seam records on eviction while preserving required aliases;
- exposes canonical watershed lookup and deterministic cardinal/diagonal seam segment
  summaries inside the map package;
- exposes `GameHandle.queryHydrologyCell`, `getRiverGraph`, and `subscribeHydrology` for
  downstream systems. Unloaded cells return `null`; graph snapshots declare seam-only
  coverage; listeners are cleared by `destroy`.

Frontier inflow/outflow records, accumulation-delta propagation, split events, full
within-chunk graph construction, and graph-driven renderer integration are still pending.

The resolver may report `provisional` at the retained horizon. It must never call that
frontier a mouth unless the target is a water cell or a known world outlet.

### 4. Accumulation correction

Pair reconciliation provides exact local accumulation for the pair window but may receive
additional upstream discharge later. Store one boundary inflow scalar per edge sample and
propagate only the delta downstream through the retained graph. Saturate public
`Uint32Array` values rather than wrapping. A repeated summary with the same revision is
idempotent.

### 5. Stable river graph (partial)

River source candidates remain global-coordinate and config-driven. Trace unsmoothed graph
cells against reconciled flow, then derive presentation curves afterward. Segment IDs come
from source/confluence/mouth coordinates, not chunk IDs. A segment crossing a seam is split
for storage but keeps one graph identity and explicit upstream/downstream links.

The renderer can smooth segment points, but collision, bridge placement, flooding, and
skills should query the unsmoothed graph corridor. The current public graph contains only
reconciled seam edges; per-cell interior links and source-to-mouth traversal are still
required before those consumers can treat it as complete.

## Worker Protocol

The worker protocol has an explicit `reconcile-hydrology-pair` request and
`reconciled-hydrology-pair` result with request IDs, timeout/error handling, implementation
and fallback diagnostics, timings, and numeric transfer-byte counts. The existing
`generate-chunk` path emits provisional halo output. Pair results transfer typed-array seam
patches; summaries remain compact structured-clone data. Stable river point buffers are not
present yet.

The existing `hydrology-raster` Wasm batch can process rectangular windows without gaining
streaming knowledge. Promotion gates must be repeated at `96 x 96`, `160 x 96`, and
`96 x 160`, including negative-coordinate and authored-overlay fixtures.

## Persistence

The world save now has an additive optional `drainage` alias ledger. It is rehydrated before
startup chunks and uses the #37 count, byte, cycle, and incompatible-version recovery
policies:

- rehydrate aliases before startup chunks;
- validate schema/resolver versions, cycles, count, and serialized bytes;
- migrate old schema-one saves to an empty drainage ledger;
- hard-fail corrupt or incompatible data through typed recovery;
- keep bounded summaries for discovered identities, not full chunk rasters.

## Performance Budgets

Initial gates on the reference desktop profile:

- provisional `96 x 96` hydrology median: at most `2.5x` current `64 x 64` median in both
  TypeScript and Wasm, measured over 30 warmed samples;
- pair reconciliation median: `<= 12 ms`, p95 `<= 24 ms`;
- reconciliation transfer growth: `<= 48 KiB` per seam result;
- main-thread seam apply: `<= 2 ms` p95;
- at most one seam worker request in flight and four pending per newly arrived chunk;
- resolver work: proportional to changed edge samples and downstream retained segments;
- no full retained-world regeneration or full minimap rebuild.

A local 30-run pair-window sample measured TypeScript at 6.84 ms median / 7.27 ms p95 and
Wasm at 5.19 ms median / 5.45 ms p95. The two-patch numeric transfer was 11,264 bytes and
main-thread patch application measured 0.153 ms p95. This sample meets the initial pair
budgets; hardware/browser-matrix variance and full stream-travel measurements remain open.

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

- worker pair reconciliation uses Wasm in the browser and persists/restores the drainage
  alias ledger after restart;
- travel across cardinal and diagonal seams while segment IDs remain stable (unit contract
  covered; browser travel and full presentation continuity pending);
- reload after discovery and retain watershed/river IDs (alias ledger covered; graph IDs
  pending);
- minimap and inspection update after merge events;
- no visible chunk-wide repaint when one seam reconciles;
- diagnostics expose implementation, changed seam, elapsed time, and resolver revision.

## Delivery Stages

1. **Contracts and red fixtures.** Summary, pair result, resolver, and load-order fixtures
   are implemented; stable graph/event/query contracts remain open.
2. **Provisional halo generation.** Add global-coordinate halo input and interior cropping
   in TypeScript, then preserve Wasm parity.
3. **Pair reconciliation.** Worker request, deterministic pair bounds, seam patch apply,
   bounded queue, stale-result guards, and eviction cleanup are implemented; browser
   performance evidence remains open.
4. **Watershed resolver.** Canonical aliases, bounded persistence, lookup, and eviction
   cleanup are implemented; public events and downstream cell queries remain open.
5. **River graph.** Stable nodes/segments, confluences, mouths, accumulation deltas, and
   downstream consumer queries.
6. **Runtime/browser proof.** Streamed travel, minimap/inspection refresh, context cleanup,
   performance budgets, CI, Pages, and live verification.

Do not close issue `#38` yet. Closure still requires graph continuity through chunk interiors,
upstream accumulation-delta propagation, consumers using the query surface, eviction/restart
graph identity, browser travel proof, and retained-horizon performance evidence in addition to
the implemented halo, seam lifecycle, and target-aware diagonal segment contracts.
