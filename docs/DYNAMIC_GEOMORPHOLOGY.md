# Dynamic Geomorphology

This document defines issue `#44`: deterministic, persistent erosion, flooding, sediment
transport, channel change, and delta growth layered over the immutable hydrology and
geomorphology fields from `#29`.

## Authority boundary

- `packages/map` owns simulation state, fixed steps, accounting, outlet handoffs, and
  terrain-transition proposals.
- The engine, renderer, weather, roads, settlements, and ecology are consumers. They do not
  mutate simulation buffers.
- Base elevation, hydrology, terrain IDs, and the static `erosionPotential`,
  `sedimentLoad`, `deposition`, and `floodplain` arrays remain immutable fallback inputs.
- The module is disabled by default. A disabled step processes zero cells and returns the
  existing state unchanged.

## Phase 0: local deterministic kernel

`packages/map/src/dynamic-geomorphology.ts` provides the first reversible slice:

1. `createDynamicGeomorphologyCorridor` compacts selected raster cells into sorted,
   parallel typed arrays and resolves downstream positions only within that active set.
2. `createDynamicGeomorphologyState` creates explicit version-one sediment, deposited
   material, water, and tick state.
3. `stepDynamicGeomorphology` applies one integer fixed step and emits the next state,
   sparse changed-cell indices, provisional local outlet exports, and complete mass
   accounting.

Every unit that leaves the active set is reported as a local outlet export. Phase 0 does
not persist or reconcile that export because chunk drainage identities remain provisional
until `#38` provides canonical aliases. Calling these records cross-chunk conservation
would be incorrect.

## Integer accounting

The kernel uses integer material/water units. For each step:

```text
starting sediment + erosion input
  = retained suspended/deposited sediment + exported sediment + saturation loss

starting water + seasonal input
  = retained water + exported water + saturation loss
```

`sedimentResidual` and `waterResidual` are therefore exactly zero for ordinary integer
fixtures. Saturation is never hidden: values beyond `Uint32` capacity are included in the
corresponding loss field.

The seasonal forcing interface accepts normalized integer scales from `0` to `255`.
Phase 0 intentionally does not read the live clock or weather system.

## Budgets

- Maximum active cells per corridor: `262,144`.
- Work per step: `O(active cells)`, independent of inactive retained cells.
- Persistent Phase 0 state: three `Uint32Array` values per active cell plus one tick.
- Representative benchmark: a 4,096-cell corridor step stays below the broad 100 ms CI
  guard; normal streamed corridors should be materially smaller.
- Static fallback: zero processed cells and no allocation of next-step buffers.

These are safety ceilings, not targets. The canonical handoff ledger applies tighter
serialized-byte and per-tick propagation limits before any data crosses a chunk boundary.

## Phase 1: canonical cross-chunk ledger

`packages/map/src/dynamic-geomorphology-ledger.ts` is the closeable Phase 1 contract.
It is deliberately a pure state container; the streamed engine decides when to batch a
tick and the topology resolver remains the authority for identity resolution.

1. `DynamicGeomorphologyLedger.ingestStep` maps every local outlet cell through a
   `ChunkTopologyResolver` callback. A missing or provisional mapping rejects the whole
   batch, so material is retryable rather than silently discarded.
2. `ingest` groups canonical identities and commits the aggregate atomically. The sorted
   snapshot is identical for either chunk arrival order and carries the source tick.
3. `applyTopologyEvent` folds alias mass into a resolver merge's canonical identity.
   `evict` and `rehydrate` make chunk eviction/restart explicit and preserve the ledger's
   serialized form.
4. Every batch is bounded to 16,384 handoffs; the ledger is bounded to 16,384 identities
   and 512 KiB serialized bytes. Uint32 mass overflow and schema/resolver mismatches are
   typed errors. These limits are checked before state is committed.

The ledger does not yet invent seasonal forcing, mutate terrain, or promote a delta to a
renderer-owned feature. Those behaviors are intentionally moved to the follow-up issue
for Phase 2–4 so the static fallback and topology authority remain reversible.

## Planned promotion

1. **Phase 1:** replace provisional local outlet indices with `#38` canonical drainage
   identities and add bounded eviction/rehydration. **Implemented in the ledger module.**
2. **Phase 2:** deterministic seasonal inundation, residence, and recession (follow-up).
3. **Phase 3:** persistent delta/fan accumulation, channel pressure, migration, and
   terrain-transition proposals with hysteresis.
4. **Phase 4:** save migration, consumers, dev-only visualization, desktop/mobile
   performance, and live promotion.

No later phase may make PixiJS authoritative or remove the static fallback.
