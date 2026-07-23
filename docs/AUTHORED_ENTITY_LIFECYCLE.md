# Authored Entity Lifecycle

**Tracking issue:** `#42`  
**Status:** first deterministic streamed-runtime slice implemented.

## Boundary

Authored entities start as map-area JSON anchors. `packages/map/src/authored-entities.ts`
owns their pure runtime lifecycle; the engine retains them when a chunk arrives and
releases them on eviction. Neither layer executes content, creates behavior trees, or
mutates character/combat state.

## Declarative Contract

Allowed `kind` values are a closed registry: `npc-spawn`, `enemy-spawn`,
`merchant-spawn`, `resource-node`, and `quest-marker`.

Each entity can declare `respawnPolicy`: `on-chunk-revisit` (default) or `never`.
Validation rejects unknown kinds, invalid policies, and executable-shaped fields such as
`script`, `code`, `handler`, `module`, or `command`.

## Lifecycle

1. Map overlays resolve area-local coordinates to deterministic world coordinates.
2. A streamed chunk calls `retainChunk(chunkKey, authoredEntities)`.
3. The registry derives a stable runtime ID from provenance and world coordinates,
   rejects conflicting duplicate definitions, and returns newly active entities.
4. Chunk eviction calls `releaseChunk`; PixiJS state is independently destroyed by the
   engine. Revisit respawns only entities whose policy permits it.
5. A future interaction module may call `markDespawned`; snapshots preserve only those
   stable IDs. Save-store wiring waits until an interaction can change entity state.

## Diagnostics and Tests

The renderer publishes `data-authored-entity-runtime="map-lifecycle-v1"` and
`data-authored-entity-count` on its canvas. Unit tests cover negative coordinates,
duplicate retention, eviction/revisit, never-respawn snapshot restore, unsupported kinds,
and conflicts. Browser dev-panel inspection and save-store integration remain #42 steps.
