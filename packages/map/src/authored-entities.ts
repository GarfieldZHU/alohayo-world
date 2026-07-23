import type { MapAuthoredEntityKind, MapAuthoredEntityRespawnPolicy } from '@alohayo/config'
import type { GeneratedAuthoredEntity } from './authored-overlays'

export const AUTHORED_ENTITY_CAPABILITY_KINDS = [
  'npc-spawn',
  'enemy-spawn',
  'merchant-spawn',
  'resource-node',
  'quest-marker',
] as const satisfies readonly MapAuthoredEntityKind[]

export interface RuntimeAuthoredEntity extends GeneratedAuthoredEntity {
  runtimeId: string
  respawnPolicy: MapAuthoredEntityRespawnPolicy
  state: 'active' | 'despawned'
}

export interface AuthoredEntityLifecycleSnapshot {
  schemaVersion: 1
  despawnedRuntimeIds: string[]
}

export class AuthoredEntityLifecycleError extends Error {}

function runtimeId(entity: GeneratedAuthoredEntity) {
  return `${entity.areaId}:${entity.id}:${entity.x}:${entity.y}`
}

function fingerprint(entity: GeneratedAuthoredEntity) {
  return JSON.stringify({
    id: entity.id,
    kind: entity.kind,
    x: entity.x,
    y: entity.y,
    areaId: entity.areaId,
    archetypeId: entity.archetypeId,
    factionId: entity.factionId,
    tags: [...(entity.tags ?? [])].sort(),
    respawnPolicy: entity.respawnPolicy ?? 'on-chunk-revisit',
  })
}

/**
 * Pure streamed-runtime ownership. It neither creates Pixi objects nor executes content.
 * A caller retains entities when a chunk arrives and releases them on eviction.
 */
export class AuthoredEntityLifecycleRegistry {
  private readonly definitions = new Map<string, string>()
  private readonly active = new Map<string, RuntimeAuthoredEntity>()
  private readonly chunkRuntimeIds = new Map<string, Set<string>>()
  private readonly despawned = new Set<string>()

  retainChunk(chunkKey: string, entities: readonly GeneratedAuthoredEntity[]) {
    const retained = this.chunkRuntimeIds.get(chunkKey) ?? new Set<string>()
    this.chunkRuntimeIds.set(chunkKey, retained)
    const created: RuntimeAuthoredEntity[] = []
    for (const entity of [...entities].sort((left, right) =>
      runtimeId(left).localeCompare(runtimeId(right))
    )) {
      if (!AUTHORED_ENTITY_CAPABILITY_KINDS.includes(entity.kind)) {
        throw new AuthoredEntityLifecycleError(`unsupported authored entity kind ${entity.kind}`)
      }
      const id = runtimeId(entity)
      const nextFingerprint = fingerprint(entity)
      const knownFingerprint = this.definitions.get(id)
      if (knownFingerprint && knownFingerprint !== nextFingerprint) {
        throw new AuthoredEntityLifecycleError(`conflicting authored entity runtime id ${id}`)
      }
      this.definitions.set(id, nextFingerprint)
      retained.add(id)
      if (this.active.has(id)) continue
      const policy = entity.respawnPolicy ?? 'on-chunk-revisit'
      if (policy === 'never' && this.despawned.has(id)) continue
      const runtime = {
        ...entity,
        runtimeId: id,
        respawnPolicy: policy,
        state: 'active',
      } as RuntimeAuthoredEntity
      this.active.set(id, runtime)
      created.push(runtime)
    }
    return created
  }

  releaseChunk(chunkKey: string) {
    const released: RuntimeAuthoredEntity[] = []
    for (const id of this.chunkRuntimeIds.get(chunkKey) ?? []) {
      const entity = this.active.get(id)
      if (!entity) continue
      this.active.delete(id)
      released.push(entity)
    }
    this.chunkRuntimeIds.delete(chunkKey)
    return released
  }

  markDespawned(id: string) {
    if (!this.definitions.has(id))
      throw new AuthoredEntityLifecycleError(`unknown authored entity ${id}`)
    this.active.delete(id)
    this.despawned.add(id)
  }

  activeEntities() {
    return [...this.active.values()].sort((left, right) =>
      left.runtimeId.localeCompare(right.runtimeId)
    )
  }

  snapshot(): AuthoredEntityLifecycleSnapshot {
    return { schemaVersion: 1, despawnedRuntimeIds: [...this.despawned].sort() }
  }

  restore(snapshot: AuthoredEntityLifecycleSnapshot) {
    if (snapshot.schemaVersion !== 1)
      throw new AuthoredEntityLifecycleError('unsupported entity lifecycle snapshot')
    this.despawned.clear()
    for (const id of snapshot.despawnedRuntimeIds) this.despawned.add(id)
  }
}
