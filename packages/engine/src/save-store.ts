import {
  WORLD_SAVE_MIGRATION_REGISTRY_SHAPE,
  type WorldSaveErrorCode,
  type WorldSaveSnapshot,
  type WorldSaveSummary,
} from '@alohayo/config'

export const WORLD_SAVE_SCHEMA_VERSION = 1
export const WORLD_SAVE_ENGINE_VERSION = '0.1.0'
const WORLD_SAVE_DB_NAME = 'alohayo-world'
const WORLD_SAVE_DB_VERSION = 1
const WORLD_SAVE_STORE = 'world-saves'
const WORLD_SAVE_AUTOSAVE_SLOT = 'autosave'

interface PersistedWorldSaveRecord {
  slotId: string
  snapshot: WorldSaveSnapshot
}

export interface WorldSaveStore {
  load(slotId?: string): Promise<WorldSaveSnapshot | null>
  save(snapshot: WorldSaveSnapshot, slotId?: string): Promise<WorldSaveSummary>
  clear(slotId?: string): Promise<void>
  exportSnapshot(snapshot: WorldSaveSnapshot): string
  importSnapshot(serialized: string): Promise<WorldSaveSnapshot>
}

export class WorldSaveError extends Error {
  constructor(
    readonly code: WorldSaveErrorCode,
    message: string,
    readonly causeValue?: unknown
  ) {
    super(message)
    this.name = 'WorldSaveError'
  }
}

export function createWorldSaveStore(
  indexedDb: IDBFactory | undefined = globalThis.indexedDB
): WorldSaveStore {
  return {
    async load(slotId = WORLD_SAVE_AUTOSAVE_SLOT) {
      const db = await openSaveDatabase(indexedDb)
      const record = await runReadonlyRequest<PersistedWorldSaveRecord | undefined>(db, slotId)
      if (!record) return null
      return validateWorldSaveSnapshot(record.snapshot)
    },
    async save(snapshot, slotId = WORLD_SAVE_AUTOSAVE_SLOT) {
      const db = await openSaveDatabase(indexedDb)
      const normalized = validateWorldSaveSnapshot(snapshot)
      await runWriteRequest(db, {
        slotId,
        snapshot: normalized,
      })
      return summarizeSave(slotId, normalized)
    },
    async clear(slotId = WORLD_SAVE_AUTOSAVE_SLOT) {
      const db = await openSaveDatabase(indexedDb)
      await runDeleteRequest(db, slotId)
    },
    exportSnapshot(snapshot) {
      return JSON.stringify(validateWorldSaveSnapshot(snapshot), null, 2)
    },
    async importSnapshot(serialized) {
      let parsed: unknown
      try {
        parsed = JSON.parse(serialized)
      } catch (error) {
        throw new WorldSaveError('invalid-import', 'save import is not valid JSON', error)
      }
      return validateWorldSaveSnapshot(parsed)
    },
  }
}

export function encodeDiscoveredChunk(discovered: Uint8Array): string {
  let binary = ''
  for (const value of discovered) {
    binary += String.fromCharCode(value)
  }
  return btoa(binary)
}

export function decodeDiscoveredChunk(serialized: string): Uint8Array {
  let binary: string
  try {
    binary = atob(serialized)
  } catch (error) {
    throw new WorldSaveError('corrupt', 'save discovery chunk is not valid base64', error)
  }
  const buffer = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    buffer[index] = binary.charCodeAt(index)
  }
  return buffer
}

export function summarizeSave(slotId: string, snapshot: WorldSaveSnapshot): WorldSaveSummary {
  return {
    slotId,
    savedAt: snapshot.savedAt,
    seed: snapshot.world.seed,
    discoveredChunks: snapshot.discovery.discoveredChunkKeys.length,
    discoveredCells: snapshot.discovery.discoveredCells,
    resolutionHash: snapshot.contentPacks.resolutionHash,
  }
}

export function validateWorldSaveSnapshot(snapshot: unknown): WorldSaveSnapshot {
  const migrated = migrateWorldSaveSnapshot(snapshot)
  if (
    !migrated ||
    migrated.schemaVersion !== 1 ||
    typeof migrated.engineVersion !== 'string' ||
    typeof migrated.savedAt !== 'string' ||
    !migrated.world ||
    typeof migrated.world.seed !== 'string' ||
    typeof migrated.world.chunkSize !== 'number' ||
    typeof migrated.world.surveyWidth !== 'number' ||
    typeof migrated.world.surveyHeight !== 'number' ||
    typeof migrated.world.activeChunkRadius !== 'number' ||
    typeof migrated.world.retainChunkRadius !== 'number' ||
    typeof migrated.world.minimapChunkRadius !== 'number' ||
    !migrated.explorer ||
    typeof migrated.explorer.archetypeId !== 'string' ||
    typeof migrated.explorer.x !== 'number' ||
    typeof migrated.explorer.y !== 'number' ||
    !['north', 'east', 'south', 'west'].includes(migrated.explorer.facing) ||
    !['idle', 'walk', 'run', 'action'].includes(migrated.explorer.state) ||
    !migrated.discovery ||
    !Array.isArray(migrated.discovery.chunks) ||
    typeof migrated.discovery.discoveredCells !== 'number' ||
    !Array.isArray(migrated.discovery.discoveredChunkKeys) ||
    !migrated.preferences ||
    typeof migrated.preferences.locale !== 'string' ||
    typeof migrated.preferences.devMode !== 'boolean' ||
    typeof migrated.preferences.devShowGrid !== 'boolean' ||
    typeof migrated.preferences.devShowMinimap !== 'boolean' ||
    typeof migrated.preferences.devDayNight !== 'boolean' ||
    typeof migrated.preferences.devLightLevel !== 'number' ||
    typeof migrated.preferences.devPanelCollapsed !== 'boolean' ||
    !['movement', 'world', 'gear'].includes(migrated.preferences.devPanelActiveTab) ||
    typeof migrated.preferences.minimapCollapsed !== 'boolean' ||
    !['fit', 'manual'].includes(migrated.preferences.minimapMode) ||
    typeof migrated.preferences.minimapManualRadius !== 'number' ||
    !migrated.contentPacks ||
    !Array.isArray(migrated.contentPacks.orderedPackIds) ||
    typeof migrated.contentPacks.resolutionHash !== 'string' ||
    !Array.isArray(migrated.contentPacks.packs) ||
    !Array.isArray(migrated.contentPacks.resolvedMapAreaIds)
  ) {
    throw new WorldSaveError('corrupt', 'save snapshot does not match schema version 1')
  }

  for (const chunk of migrated.discovery.chunks) {
    if (
      !chunk ||
      typeof chunk.key !== 'string' ||
      typeof chunk.chunkX !== 'number' ||
      typeof chunk.chunkY !== 'number' ||
      typeof chunk.discovered !== 'string'
    ) {
      throw new WorldSaveError('corrupt', 'save snapshot contains an invalid discovery chunk')
    }
  }

  return migrated
}

export function assertCompatibleContentPackState(
  snapshot: WorldSaveSnapshot,
  resolutionHash: string
): void {
  if (snapshot.contentPacks.resolutionHash !== resolutionHash) {
    throw new WorldSaveError(
      'incompatible-content',
      `save content resolution ${snapshot.contentPacks.resolutionHash} does not match current content ${resolutionHash}`
    )
  }
}

function migrateWorldSaveSnapshot(snapshot: unknown): WorldSaveSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new WorldSaveError('corrupt', 'save snapshot must be an object')
  }
  const candidate = snapshot as { schemaVersion?: unknown }
  if (candidate.schemaVersion !== WORLD_SAVE_SCHEMA_VERSION) {
    throw new WorldSaveError(
      'unsupported-version',
      `save schema version ${String(candidate.schemaVersion)} is not supported by the current migration registry`
    )
  }
  if (
    !WORLD_SAVE_MIGRATION_REGISTRY_SHAPE.supportedSchemaVersions.includes(WORLD_SAVE_SCHEMA_VERSION)
  ) {
    throw new WorldSaveError('unsupported-version', 'current save schema version is not registered')
  }
  return snapshot as WorldSaveSnapshot
}

function openSaveDatabase(indexedDb: IDBFactory | undefined): Promise<IDBDatabase> {
  if (!indexedDb) {
    throw new WorldSaveError('unavailable', 'IndexedDB is not available in this environment')
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(WORLD_SAVE_DB_NAME, WORLD_SAVE_DB_VERSION)
    request.onerror = () =>
      reject(new WorldSaveError('unavailable', 'failed to open save database', request.error))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(WORLD_SAVE_STORE)) {
        db.createObjectStore(WORLD_SAVE_STORE, { keyPath: 'slotId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runReadonlyRequest<T>(db: IDBDatabase, slotId: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WORLD_SAVE_STORE, 'readonly')
    const request = transaction.objectStore(WORLD_SAVE_STORE).get(slotId)
    request.onerror = () =>
      reject(new WorldSaveError('unavailable', 'failed to read save record', request.error))
    request.onsuccess = () => resolve(request.result as T | undefined)
  })
}

function runWriteRequest(db: IDBDatabase, record: PersistedWorldSaveRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WORLD_SAVE_STORE, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(mapIndexedDbWriteError(transaction.error ?? new Error('failed to write save record')))
    transaction.objectStore(WORLD_SAVE_STORE).put(record)
  })
}

function runDeleteRequest(db: IDBDatabase, slotId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WORLD_SAVE_STORE, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(mapIndexedDbWriteError(transaction.error ?? new Error('failed to delete save record')))
    transaction.objectStore(WORLD_SAVE_STORE).delete(slotId)
  })
}

function mapIndexedDbWriteError(error: unknown): WorldSaveError {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new WorldSaveError('quota-exceeded', 'save storage quota exceeded', error)
  }
  return new WorldSaveError('unavailable', 'failed to write save record', error)
}
