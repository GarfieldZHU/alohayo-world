import type {
  MapAuthoredEntityKind,
  MapAuthoredEntityRespawnPolicy,
  WorldSaveAuthoredEntityLifecycle,
} from '@alohayo/config'
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

export type AuthoredEntityLifecycleSnapshot = WorldSaveAuthoredEntityLifecycle

export const AUTHORED_ENTITY_LIFECYCLE_SCHEMA_VERSION = 1
export const AUTHORED_ENTITY_LIFECYCLE_MAX_DESPAWNED = 4096
export const AUTHORED_ENTITY_LIFECYCLE_MAX_BYTES = 256 * 1024

export type AuthoredEntityLifecycleErrorCode =
  | 'corrupt'
  | 'incompatible-version'
  | 'budget-exceeded'

export class AuthoredEntityLifecycleError extends Error {
  constructor(
    readonly code: AuthoredEntityLifecycleErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AuthoredEntityLifecycleError'
  }
}

export interface AuthoredEntityLifecycleDiagnostics {
  definitions: number
  active: number
  retained: number
  despawned: number
  owners: number
  conflicts: number
}

export function emptyAuthoredEntityLifecycleSnapshot(): AuthoredEntityLifecycleSnapshot {
  return {
    schemaVersion: AUTHORED_ENTITY_LIFECYCLE_SCHEMA_VERSION,
    despawnedRuntimeIds: [],
  }
}

export function authoredEntityLifecycleSnapshotBytes(
  snapshot: AuthoredEntityLifecycleSnapshot
): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength
}

export function validateAuthoredEntityLifecycleSnapshot(
  snapshot: unknown
): asserts snapshot is AuthoredEntityLifecycleSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new AuthoredEntityLifecycleError('corrupt', 'entity lifecycle snapshot must be an object')
  }
  const candidate = snapshot as Partial<AuthoredEntityLifecycleSnapshot>
  if (candidate.schemaVersion !== AUTHORED_ENTITY_LIFECYCLE_SCHEMA_VERSION) {
    throw new AuthoredEntityLifecycleError(
      'incompatible-version',
      `unsupported entity lifecycle snapshot version ${String(candidate.schemaVersion)}`
    )
  }
  if (!Array.isArray(candidate.despawnedRuntimeIds)) {
    throw new AuthoredEntityLifecycleError(
      'corrupt',
      'entity lifecycle despawned IDs must be an array'
    )
  }
  if (candidate.despawnedRuntimeIds.length > AUTHORED_ENTITY_LIFECYCLE_MAX_DESPAWNED) {
    throw new AuthoredEntityLifecycleError(
      'budget-exceeded',
      `entity lifecycle snapshot exceeds ${AUTHORED_ENTITY_LIFECYCLE_MAX_DESPAWNED} despawned IDs`
    )
  }
  let previous = ''
  for (const [index, id] of candidate.despawnedRuntimeIds.entries()) {
    if (typeof id !== 'string' || !id || id.length > 512) {
      throw new AuthoredEntityLifecycleError(
        'corrupt',
        `entity lifecycle snapshot contains an invalid runtime ID at index ${index}`
      )
    }
    if (index > 0 && id <= previous) {
      throw new AuthoredEntityLifecycleError(
        'corrupt',
        'entity lifecycle despawned IDs must be unique and sorted'
      )
    }
    previous = id
  }
  if (
    authoredEntityLifecycleSnapshotBytes(candidate as AuthoredEntityLifecycleSnapshot) >
    AUTHORED_ENTITY_LIFECYCLE_MAX_BYTES
  ) {
    throw new AuthoredEntityLifecycleError(
      'budget-exceeded',
      `entity lifecycle snapshot exceeds ${AUTHORED_ENTITY_LIFECYCLE_MAX_BYTES} bytes`
    )
  }
}

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
  private readonly policies = new Map<string, MapAuthoredEntityRespawnPolicy>()
  private readonly active = new Map<string, RuntimeAuthoredEntity>()
  private readonly chunkRuntimeIds = new Map<string, Set<string>>()
  private readonly runtimeOwners = new Map<string, Set<string>>()
  private readonly despawned = new Set<string>()
  private conflictCount = 0

  retainChunk(chunkKey: string, entities: readonly GeneratedAuthoredEntity[]) {
    const planned: Array<{
      entity: GeneratedAuthoredEntity
      id: string
      fingerprint: string
      policy: MapAuthoredEntityRespawnPolicy
    }> = []
    const stagedFingerprints = new Map<string, string>()
    for (const entity of [...entities].sort((left, right) =>
      runtimeId(left).localeCompare(runtimeId(right))
    )) {
      if (!AUTHORED_ENTITY_CAPABILITY_KINDS.includes(entity.kind)) {
        throw new AuthoredEntityLifecycleError(
          'corrupt',
          `unsupported authored entity kind ${entity.kind}`
        )
      }
      const id = runtimeId(entity)
      const nextFingerprint = fingerprint(entity)
      const knownFingerprint = stagedFingerprints.get(id) ?? this.definitions.get(id)
      if (knownFingerprint && knownFingerprint !== nextFingerprint) {
        this.conflictCount += 1
        throw new AuthoredEntityLifecycleError(
          'corrupt',
          `conflicting authored entity runtime id ${id}`
        )
      }
      stagedFingerprints.set(id, nextFingerprint)
      planned.push({
        entity,
        id,
        fingerprint: nextFingerprint,
        policy: entity.respawnPolicy ?? 'on-chunk-revisit',
      })
    }

    const retained = this.chunkRuntimeIds.get(chunkKey) ?? new Set<string>()
    this.chunkRuntimeIds.set(chunkKey, retained)
    const created: RuntimeAuthoredEntity[] = []
    for (const { entity, id, fingerprint: nextFingerprint, policy } of planned) {
      this.definitions.set(id, nextFingerprint)
      this.policies.set(id, policy)
      retained.add(id)
      const owners = this.runtimeOwners.get(id) ?? new Set<string>()
      owners.add(chunkKey)
      this.runtimeOwners.set(id, owners)
      if (this.active.has(id)) continue
      if (this.despawned.has(id)) continue
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
      const owners = this.runtimeOwners.get(id)
      owners?.delete(chunkKey)
      if (owners?.size) continue
      this.runtimeOwners.delete(id)
      const entity = this.active.get(id)
      if (entity) {
        this.active.delete(id)
        released.push(entity)
      }
      if (this.policies.get(id) === 'on-chunk-revisit') this.despawned.delete(id)
    }
    this.chunkRuntimeIds.delete(chunkKey)
    return released
  }

  markDespawned(id: string) {
    if (!this.definitions.has(id))
      throw new AuthoredEntityLifecycleError('corrupt', `unknown authored entity ${id}`)
    this.active.delete(id)
    this.despawned.add(id)
  }

  activeEntities() {
    return [...this.active.values()].sort((left, right) =>
      left.runtimeId.localeCompare(right.runtimeId)
    )
  }

  snapshot(): AuthoredEntityLifecycleSnapshot {
    const snapshot = {
      schemaVersion: AUTHORED_ENTITY_LIFECYCLE_SCHEMA_VERSION,
      despawnedRuntimeIds: [...this.despawned]
        .filter((id) => this.policies.get(id) === 'never' || !this.policies.has(id))
        .sort(),
    } as const
    validateAuthoredEntityLifecycleSnapshot(snapshot)
    return snapshot
  }

  restore(snapshot: AuthoredEntityLifecycleSnapshot) {
    validateAuthoredEntityLifecycleSnapshot(snapshot)
    this.despawned.clear()
    for (const id of snapshot.despawnedRuntimeIds) {
      this.despawned.add(id)
      if (this.policies.get(id) === 'never') this.active.delete(id)
    }
  }

  diagnostics(): AuthoredEntityLifecycleDiagnostics {
    return {
      definitions: this.definitions.size,
      active: this.active.size,
      retained: this.runtimeOwners.size,
      despawned: this.despawned.size,
      owners: [...this.runtimeOwners.values()].reduce((total, owners) => total + owners.size, 0),
      conflicts: this.conflictCount,
    }
  }
}
