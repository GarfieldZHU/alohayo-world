# Cross-Chunk Hydrology

**Tracking issue:** `#38`  
**Status:** the provisional halo, worker pair reconciliation, retained seam patch lifecycle,
bounded persisted alias ledger, public cell queries/change events, stable retained-chunk D8
river links, signed accumulation-delta propagation through loaded downstream paths, and a
discovery-aware minimap graph consumer are implemented. Chunk summaries also retain
deterministic halo-derived incoming D8 links. The graph emits a coordinate-stable provisional
`frontier` source while the upstream raster is unloaded, replaces it with the retained raster
link when that chunk loads, and restores it after eviction. The public graph contract is now
schema version 2. The main map draws smoothed presentation paths from retained D8 links,
clipped to chunk bounds and indexed lazily from a local 3x3 chunk neighborhood. Movement and
road/bridge overlap masks query the unsmoothed graph. Hydrology revisions refresh affected
chunks and their immediate neighbors, including downstream chunks changed by accumulation
propagation. Unknown upstream and downstream cells remain explicit provisional frontiers;
the snapshot is capped at 16,384 segments. Developer cell inspection shows flow
accumulation, canonical watershed identity, and reconciliation state; it refreshes against
the current pointer after hydrology revisions and releases its cached pointer context on
destroy. Weather-driven road conditions consume floodplain classification, which feeds
existing aggregate settlement traffic queries. Hydrology beyond the deterministic halo and
retained horizon remains provisional; richer settlement-agent behavior and long-term
seasonal terrain feedback remain open.

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

Chunk generation still retains `GeneratedRiver` feature-window paths as data, but the main-map
renderer and movement masks now consume the retained D8 graph instead. Graph identity and
discharge remain bounded by the loaded horizon and its provisional outer halo.

## Non-Negotiable Invariants

1. World coordinates, never load order, choose canonical identities.
2. A chunk edge is a provisional frontier, not an outlet, unless water or reconciled
   downhill evidence says otherwise.
3. Cardinal seam samples agree from both sides after reconciliation.
4. A diagonal D8 flow crossing one cardinal seam matches the receiving edge at its shifted
   offset. Corner diagonals select one cardinal handoff in north, east, south, west order
   after the existing D8 direction order. Diagonal graph links resolve the target by world
   coordinate in the diagonal chunk; they do not yet recompute a four-chunk numeric window.
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

Coordinate-derived segment and node IDs are emitted for retained D8 links, including source,
confluence, outlet, mouth, and unloaded-frontier identities. A halo inflow uses the same
coordinate-derived segment ID before and after its source raster loads. The optional `GameHandle`
hydrology surface exposes retained cell fields, canonical watershed IDs, a bounded
`retained-chunks` graph snapshot, and change events. The graph is complete for selected river
links in loaded chunks; hydrology beyond the retained frontier is unknown. Split handling
and consumer ownership remain pending.

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
  frontierInflows: DrainageFrontierInflow[]
  state: 'provisional' | 'reconciled'
}

interface DrainageFrontierInflow {
  source: { x: number; y: number }
  target: { x: number; y: number }
  direction: number
  sourceAccumulation: number
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
`frontierInflows` records halo cells whose D8 edge enters the chunk interior. These records
are sorted and bounded by the chunk perimeter; seam patches replace only records targeting
their affected patch area. Diagonal matching does not yet recompute a four-chunk numeric
window.

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
- exposes canonical watershed lookup and deterministic D8 river links for retained chunk
  cells, including cardinal and diagonal seams;
- adds provisional incoming links from the deterministic halo when the upstream source raster
  is not retained, and suppresses those virtual links while that source raster is retained;
- exposes `GameHandle.queryHydrologyCell`, `getRiverGraph`, and `subscribeHydrology` for
  downstream systems. Unloaded cells return `null`; graph snapshots declare retained-chunk
  coverage, use schema version 2, and cap output at 16,384 segments; listeners are cleared by
  `destroy`.

Incoming halo links and unloaded downstream frontier nodes make both ends explicit around the
retained horizon. They remain provisional: the halo edge and hydrology beyond the retained
chunks are not globally authoritative, and split events are still pending. The main-map
renderer derives smoothed presentation chains from graph links, and unsmoothed D8 corridors
drive river blocking and road/bridge overlap masks.

The resolver may report `provisional` at the retained horizon. It must never call that
frontier a mouth unless the target is a water cell or a known world outlet.

### 4. Accumulation correction (retained-horizon slice implemented)

The resolver snapshots each chunk's provisional direction and accumulation arrays and stores
the union mask for the currently applied worker seam patches. When patches change, it reverts
the prior propagated deltas, compares old and corrected outflow across the patched-area
boundary, and routes signed deltas along the corresponding old and current D8 paths. Only
reachable loaded cells are visited; a path stops at the retained frontier. Updates saturate
to the `Uint32` range instead of wrapping, and recomputing after an unchanged patch is
idempotent. Revision invalidation reports the union of chunks touched by the previous and
new propagated deltas, so removing a correction also refreshes downstream consumers. Eviction
returns the chunks touched by its rollback before dropping the source raster; batched eviction
includes those coordinates in the resulting hydrology event.

This does not make the unbounded world globally authoritative. Pair-window accumulation is
still provisional at its outer halo. The main-map renderer and movement/bridge masks now use
corrected retained values. Road-weather flooding consumes the retained floodplain layer and
remains reversible; richer settlement-agent behavior and long-term terrain feedback remain
open.

### 5. Stable river graph (partial)

River source candidates remain global-coordinate and config-driven. Trace unsmoothed graph
cells against reconciled flow, then derive presentation curves afterward. Segment IDs come
from source/confluence/mouth coordinates, not chunk IDs. A segment crossing a seam is split
for storage but keeps one graph identity and explicit upstream/downstream links.

The main-map renderer chains and smooths D8 segment points by chunk for presentation. River
blocking and road/bridge overlap masks use the unsmoothed cell corridor, and refresh from
hydrology revisions over changed chunks plus their immediate neighbors, including chunks
whose prior accumulation delta was removed by a new reconciliation. Render lines are
clipped to chunk bounds for PixiJS culling, and each rendered chunk indexes only its local 3x3
graph neighborhood. The public graph
contains per-cell D8 links only for retained chunks and marks unloaded downstream cells as
frontiers. Corrected discharge propagates along loaded downstream paths; weather-driven road
flooding consumes floodplain classification. Global source-to-mouth continuity, richer
settlement-agent behavior, long-term flood evolution, and skills remain open.

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
- retained accumulation delta propagation: `<= 100 ms` p95 for a synthetic 49-chunk
  horizon, 1,024 corrected seam cells, and a 1,536-cell downstream corridor (broad CI CPU
  bound, not hardware evidence);
- retained river render indexing: `<= 50 ms` p95 to select and smooth one visible chunk's 3x3
  neighborhood from a 16,384-segment retained graph (broad CI CPU bound, not hardware evidence);
- resolver work: proportional to changed edge samples and downstream retained segments;
- no full retained-world regeneration or full minimap rebuild.

A local 30-run pair-window sample measured TypeScript at 6.84 ms median / 7.27 ms p95 and
Wasm at 5.19 ms median / 5.45 ms p95. The two-patch numeric transfer was 11,264 bytes and
main-thread patch application measured 0.153 ms p95. The retained-delta benchmark checks a
1,024-cell seam correction through the full 1,536-cell corridor; an isolated local run
measured 2.73 ms p95. Parallel verification runs were slower under CPU contention. These
samples meet the initial budgets; hardware/browser-matrix variance and stream-travel timing
remain open.
The render-index benchmark for the 16,384-segment cap measured 7.01 ms p95 in the current
local run. This covers one chunk's 3x3 neighborhood and does not replace browser frame-pacing
evidence.

## Test Matrix

### Unit

- identical summaries and graph IDs in opposite load orders;
- east/west and north/south flow direction agreement;
- diagonal corner travel with fixed handoff order;
- negative chunk coordinates;
- no non-water interior river endpoint at a reconciled seam;
- confluence and mouth IDs stable after alias merges;
- transitive watershed aliases agree across three-chunk arrival orders;
- every loaded cross-chunk graph link agrees with the source's D8 target and target accumulation;
- eviction/reload and ledger round trip;
- malformed, cyclic, oversized, and incompatible ledger recovery;
- accumulation delta idempotence, saturation, and exactly-once merging at a downstream
  confluence.

### Worker and Wasm

- TypeScript/Rust byte parity for square and rectangular halo windows;
- authored elevation/water overlay parity in a seam halo;
- transfer lists detach every returned numeric buffer exactly once;
- timeout, worker error, `messageerror`, and Wasm fallback settle every request.

### Browser

- worker pair reconciliation uses Wasm in the browser and persists/restores the drainage
  alias ledger after restart;
- travel across cardinal and diagonal seams while segment IDs remain stable (unit contract
  covered; streamed browser checks validate every loaded cross-chunk segment in the active
  retained graph);
- reload after discovery and retain watershed/river graph IDs through streamed eviction/reload;
- the minimap reindexes and redraws discovered loaded river segments after hydrology revisions;
  the developer inspection readout refreshes its flow, watershed, and reconciliation values
  on each revision and drops its pointer context on destroy;
- the main-map graph renderer and movement/bridge masks use the same retained D8 revision and
  refresh only changed chunks with their immediate neighbors;
- no visible chunk-wide repaint when one seam reconciles;
- diagnostics expose implementation, changed seam, elapsed time, and resolver revision.

## Delivery Stages

1. **Contracts and red fixtures.** Summary, pair result, resolver, and load-order fixtures
   plus the seam graph, event, and cell-query contracts are implemented. Interior graph
   continuity and downstream consumers remain open.
2. **Provisional halo generation.** Add global-coordinate halo input and interior cropping
   in TypeScript, then preserve Wasm parity.
3. **Pair reconciliation.** Worker request, deterministic pair bounds, seam patch apply,
   stale-result guards, and eviction cleanup are implemented. Browser coverage verifies the
   Wasm pair path and public API; retained-horizon travel and performance evidence remain
   open.
4. **Watershed resolver.** Canonical aliases, bounded persistence, lookup, and eviction
   cleanup are implemented, with revisioned events and downstream cell queries. Alias
   splits and consumer integration remain open.
5. **River graph.** Stable retained-cell nodes/segments, confluences, mouths, incoming halo
   and outgoing unloaded-frontier identities, accumulation deltas, downstream consumer
   queries, a discovered-cell minimap overlay, graph-driven main-map presentation, and
   unsmoothed movement/bridge masks are implemented. Hydrology beyond the bounded halo and
   retained horizon remains provisional; richer settlement-agent simulation remains tracked
   separately.
6. **Runtime/browser proof.** Streamed travel, identity through eviction/reload, the
   discovery-aware minimap graph refresh, revision-driven hydrology inspection, and inspection
   cleanup are tested. Hosted CI, Pages, and live verification remain. The first player-facing
   graph consumer has a desktop capture at
   `docs/evidence/issue-38-river-minimap-desktop.png`; weather-road flooding feeds existing
   aggregate traffic queries. Hosted CI, Pages, and live verification remain required.

Do not close issue `#38` yet. Local contract, unit, worker, browser, and performance checks
must be reviewed together with hosted CI, Pages, and live verification before closure. The
implemented halo and retained-horizon graph expose provisional links at both ends; this does
not claim globally authoritative hydrology beyond the sampled halo and loaded chunks.
