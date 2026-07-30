# Authored Entity Lifecycle

**Tracking issue:** `#42`  
**Status:** deterministic streamed runtime, persistence, diagnostics, and regression slice implemented.

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
4. Ownership is reference-counted across chunks. Releasing one chunk cannot remove a
   logical entity still retained by another streamed owner.
5. Chunk eviction calls `releaseChunk`; PixiJS state is independently destroyed by the
   engine. Revisit respawns only entities whose policy permits it.
6. An interaction module may call `markDespawned`. Save snapshots persist only sorted,
   unique `never`-respawn runtime IDs in a versioned, size-bounded map-owned delta.
7. The lifecycle delta rehydrates before restored chunks are retained. Legacy schema-one
   saves migrate to an empty lifecycle snapshot.

## Diagnostics and Tests

The renderer publishes stable `data-authored-entity-*` counts for active entities,
retained logical IDs, owner links, despawns, and conflicts. Dev mode shows the same
read-only summary on the World tab. Unit and browser tests cover negative coordinates,
overlapping ownership, eviction/revisit, never-respawn snapshot restore, legacy save
migration, invalid snapshots, unsupported kinds, conflicts, and streamed diagnostics.
