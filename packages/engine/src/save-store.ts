import {
  WORLD_SAVE_MIGRATION_REGISTRY_SHAPE,
  type WorldSaveBackupSummary,
  type WorldSaveCompatibility,
  type WorldSaveErrorCode,
  type WorldSaveSnapshot,
  type WorldSaveSummary,
  type WorldSaveWorldState,
  type WorldSaveWeatherState,
} from '@alohayo/config'
import {
  AuthoredEntityLifecycleError,
  TopologyLedgerError,
  emptyAuthoredEntityLifecycleSnapshot,
  emptyTopologyLedger,
  validateAuthoredEntityLifecycleSnapshot,
  validateTopologyLedger,
} from '@alohayo/map'

export const WORLD_SAVE_SCHEMA_VERSION = 1
export const WORLD_SAVE_ENGINE_VERSION = '0.1.0'
const WORLD_SAVE_DB_NAME = 'alohayo-world'
const WORLD_SAVE_DB_VERSION = 1
const WORLD_SAVE_STORE = 'world-saves'
const WORLD_SAVE_AUTOSAVE_SLOT = 'autosave'
export const WORLD_SAVE_MAX_BACKUPS = 3

interface PersistedWorldSaveBackup {
  backupId: string
  label: string
  kind: 'autosave' | 'manual' | 'imported'
  snapshot: WorldSaveSnapshot
}

interface PersistedWorldSaveRecord {
  slotId: string
  label: string
  kind: 'autosave' | 'manual' | 'imported'
  snapshot: WorldSaveSnapshot
  backups?: PersistedWorldSaveBackup[]
}

export interface WorldSaveMetadata {
  label?: string
  kind?: 'autosave' | 'manual' | 'imported'
}

export interface WorldSaveStore {
  list(): Promise<WorldSaveSummary[]>
  listBackups(slotId: string): Promise<WorldSaveBackupSummary[]>
  loadBackup(slotId: string, backupId: string): Promise<WorldSaveSnapshot | null>
  load(slotId?: string): Promise<WorldSaveSnapshot | null>
  save(
    snapshot: WorldSaveSnapshot,
    slotId?: string,
    metadata?: WorldSaveMetadata
  ): Promise<WorldSaveSummary>
  rename(slotId: string, nextSlotId: string, label?: string): Promise<WorldSaveSummary>
  duplicate(slotId: string, nextSlotId: string, label?: string): Promise<WorldSaveSummary>
  restoreBackup(slotId: string, backupId: string): Promise<WorldSaveSummary>
  clear(slotId?: string): Promise<void>
  exportSnapshot(snapshot: WorldSaveSnapshot): string
  importSnapshot(serialized: string): Promise<WorldSaveSnapshot>
}

/**
 * Compare a validated save with the mounted world without touching runtime state.
 * A matching content resolution can be safely remounted; a different resolution
 * may change generation/content contracts and must be rejected before mutation.
 */
export function inspectWorldSaveCompatibility(
  snapshot: WorldSaveSnapshot,
  currentWorld: WorldSaveWorldState,
  currentResolutionHash: string
): WorldSaveCompatibility {
  const savedWorld = snapshot.world
  const reasons: string[] = []
  if (snapshot.contentPacks.resolutionHash !== currentResolutionHash) {
    reasons.push('content-resolution')
  }
  const worldFields: Array<keyof WorldSaveWorldState> = [
    'seed',
    'chunkSize',
    'surveyWidth',
    'surveyHeight',
    'activeChunkRadius',
    'retainChunkRadius',
    'minimapChunkRadius',
  ]
  for (const field of worldFields) {
    if (savedWorld[field] !== currentWorld[field]) reasons.push(field)
  }
  const hardIncompatibility =
    reasons.includes('content-resolution') || savedWorld.chunkSize !== currentWorld.chunkSize
  return {
    kind: hardIncompatibility ? 'incompatible' : reasons.length > 0 ? 'remountable' : 'current',
    reasons,
    savedWorld: { ...savedWorld },
    currentWorld: { ...currentWorld },
    savedResolutionHash: snapshot.contentPacks.resolutionHash,
    currentResolutionHash,
  }
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
    async list() {
      const db = await openSaveDatabase(indexedDb)
      const records = await runListRequest(db)
      return records
        .map((record) => {
          try {
            return summarizeRecord(normalizeRecord(record))
          } catch (error) {
            return summarizeCorruptRecord(record, error)
          }
        })
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    },
    async listBackups(slotId) {
      const record = await requireRawRecord(await readRawRecord(indexedDb, slotId), slotId)
      return recordBackups(record)
        .map((backup) => {
          try {
            const snapshot = validateWorldSaveSnapshot(backup.snapshot)
            return {
              ...summarizeSave(slotId, snapshot, backup, recordBackups(record).length),
              backupId: backup.backupId,
            }
          } catch (error) {
            return {
              ...summarizeCorruptRecord(
                {
                  ...record,
                  label: backup.label,
                  kind: backup.kind,
                  snapshot: backup.snapshot,
                  backups: [],
                },
                error
              ),
              backupId: backup.backupId,
            }
          }
        })
        .sort(
          (left, right) =>
            right.savedAt.localeCompare(left.savedAt) || left.backupId.localeCompare(right.backupId)
        )
    },
    async loadBackup(slotId, backupId) {
      const record = await requireRawRecord(await readRawRecord(indexedDb, slotId), slotId)
      const backup = recordBackups(record).find((candidate) => candidate.backupId === backupId)
      if (!backup) {
        throw new WorldSaveError('unavailable', `save backup ${backupId} does not exist`)
      }
      return validateWorldSaveSnapshot(backup.snapshot)
    },
    async load(slotId = WORLD_SAVE_AUTOSAVE_SLOT) {
      const db = await openSaveDatabase(indexedDb)
      const record = await runReadonlyRequest<PersistedWorldSaveRecord | undefined>(db, slotId)
      if (!record) return null
      return validateWorldSaveSnapshot(record.snapshot)
    },
    async save(snapshot, slotId = WORLD_SAVE_AUTOSAVE_SLOT, metadata = {}) {
      const db = await openSaveDatabase(indexedDb)
      const normalized = validateWorldSaveSnapshot(snapshot)
      const record: PersistedWorldSaveRecord = {
        slotId,
        label: metadata.label?.trim() || defaultSlotLabel(slotId),
        kind: metadata.kind ?? (slotId === WORLD_SAVE_AUTOSAVE_SLOT ? 'autosave' : 'manual'),
        snapshot: normalized,
        backups: [],
      }
      const existing = await runReadonlyRequest<PersistedWorldSaveRecord | undefined>(db, slotId)
      record.backups = buildRollingBackups(existing)
      await runWriteWithBackupPruning(db, record)
      return summarizeRecord(record)
    },
    async rename(slotId, nextSlotId, label) {
      const record = await requireRecord(await readRecord(indexedDb, slotId), slotId)
      const renamed = {
        ...record,
        slotId: normalizeSlotId(nextSlotId),
        label: label?.trim() || record.label,
      }
      const db = await openSaveDatabase(indexedDb)
      await runWriteWithBackupPruning(db, renamed)
      if (renamed.slotId !== slotId) await runDeleteRequest(db, slotId)
      return summarizeRecord(renamed)
    },
    async duplicate(slotId, nextSlotId, label) {
      const record = await requireRecord(await readRecord(indexedDb, slotId), slotId)
      const duplicate = {
        ...record,
        slotId: normalizeSlotId(nextSlotId),
        label: label?.trim() || `${record.label} copy`,
        kind: 'manual' as const,
      }
      const db = await openSaveDatabase(indexedDb)
      await runWriteWithBackupPruning(db, duplicate)
      return summarizeRecord(duplicate)
    },
    async restoreBackup(slotId, backupId) {
      const record = await requireRawRecord(await readRawRecord(indexedDb, slotId), slotId)
      const storedBackups = recordBackups(record)
      const backup = storedBackups.find((candidate) => candidate.backupId === backupId)
      if (!backup) {
        throw new WorldSaveError('unavailable', `save backup ${backupId} does not exist`)
      }
      const restoredSnapshot = validateWorldSaveSnapshot(backup.snapshot)
      const currentBackup = safeBackupFromRecord(record)
      const backups = [
        ...(currentBackup ? [currentBackup] : []),
        ...storedBackups.filter((candidate) => candidate.backupId !== backupId),
      ]
      const restored: PersistedWorldSaveRecord = {
        slotId,
        label: backup.label,
        kind: backup.kind,
        snapshot: restoredSnapshot,
        backups: dedupeBackups(backups).slice(0, WORLD_SAVE_MAX_BACKUPS),
      }
      const db = await openSaveDatabase(indexedDb)
      await runWriteWithBackupPruning(db, restored)
      return summarizeRecord(restored)
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

export function summarizeSave(
  slotId: string,
  snapshot: WorldSaveSnapshot,
  metadata: WorldSaveMetadata = {},
  backupCount = 0
): WorldSaveSummary {
  return {
    slotId,
    label: metadata.label?.trim() || defaultSlotLabel(slotId),
    kind: metadata.kind ?? (slotId === WORLD_SAVE_AUTOSAVE_SLOT ? 'autosave' : 'manual'),
    health: 'healthy',
    errorCode: null,
    savedAt: snapshot.savedAt,
    seed: snapshot.world.seed,
    engineVersion: snapshot.engineVersion,
    explorerX: snapshot.explorer.x,
    explorerY: snapshot.explorer.y,
    discoveredChunks: snapshot.discovery.discoveredChunkKeys.length,
    discoveredCells: snapshot.discovery.discoveredCells,
    resolutionHash: snapshot.contentPacks.resolutionHash,
    backupCount,
    sizeBytes: serializedBytes(snapshot),
  }
}

function summarizeRecord(record: PersistedWorldSaveRecord): WorldSaveSummary {
  return summarizeSave(record.slotId, record.snapshot, record, recordBackups(record).length)
}

function summarizeCorruptRecord(
  record: Partial<PersistedWorldSaveRecord>,
  error: unknown
): WorldSaveSummary {
  const snapshot = record.snapshot as Partial<WorldSaveSnapshot> | undefined
  const saveError =
    error instanceof WorldSaveError
      ? error
      : new WorldSaveError('corrupt', error instanceof Error ? error.message : String(error), error)
  return {
    slotId: typeof record.slotId === 'string' ? record.slotId : 'corrupt-record',
    label: typeof record.label === 'string' ? record.label : 'Damaged save',
    kind:
      record.kind === 'autosave' || record.kind === 'imported' || record.kind === 'manual'
        ? record.kind
        : 'manual',
    health: 'corrupt',
    errorCode: saveError.code,
    savedAt: typeof snapshot?.savedAt === 'string' ? snapshot.savedAt : '',
    seed: typeof snapshot?.world?.seed === 'string' ? snapshot.world.seed : 'unknown',
    engineVersion: typeof snapshot?.engineVersion === 'string' ? snapshot.engineVersion : 'unknown',
    explorerX: typeof snapshot?.explorer?.x === 'number' ? snapshot.explorer.x : 0,
    explorerY: typeof snapshot?.explorer?.y === 'number' ? snapshot.explorer.y : 0,
    discoveredChunks: Array.isArray(snapshot?.discovery?.discoveredChunkKeys)
      ? snapshot.discovery.discoveredChunkKeys.length
      : 0,
    discoveredCells:
      typeof snapshot?.discovery?.discoveredCells === 'number'
        ? snapshot.discovery.discoveredCells
        : 0,
    resolutionHash:
      typeof snapshot?.contentPacks?.resolutionHash === 'string'
        ? snapshot.contentPacks.resolutionHash
        : 'unknown',
    backupCount: recordBackups(record).length,
    sizeBytes: serializedBytes(record.snapshot),
  }
}

function serializedBytes(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
  } catch {
    return 0
  }
}

function recordBackups(record: Partial<PersistedWorldSaveRecord>) {
  return Array.isArray(record.backups) ? record.backups : []
}

function backupId(snapshot: WorldSaveSnapshot) {
  const value = JSON.stringify([
    snapshot.savedAt,
    snapshot.world.seed,
    snapshot.explorer.x,
    snapshot.explorer.y,
    snapshot.discovery.discoveredCells,
  ])
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `backup-${snapshot.savedAt}-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function safeBackupFromRecord(
  record: Partial<PersistedWorldSaveRecord>
): PersistedWorldSaveBackup | null {
  try {
    const snapshot = validateWorldSaveSnapshot(record.snapshot)
    return {
      backupId: backupId(snapshot),
      label: record.label?.trim() || 'Recovered save',
      kind: record.kind ?? 'manual',
      snapshot,
    }
  } catch {
    return null
  }
}

function dedupeBackups(backups: PersistedWorldSaveBackup[]) {
  const seen = new Set<string>()
  return backups.filter((backup) => {
    if (seen.has(backup.backupId)) return false
    seen.add(backup.backupId)
    return true
  })
}

function buildRollingBackups(
  existing: PersistedWorldSaveRecord | undefined
): PersistedWorldSaveBackup[] {
  if (!existing) return []
  const current = safeBackupFromRecord(existing)
  const healthyExisting = recordBackups(existing).filter((backup) => {
    try {
      validateWorldSaveSnapshot(backup.snapshot)
      return true
    } catch {
      return false
    }
  })
  return dedupeBackups([...(current ? [current] : []), ...healthyExisting]).slice(
    0,
    WORLD_SAVE_MAX_BACKUPS
  )
}

function defaultSlotLabel(slotId: string) {
  return slotId === WORLD_SAVE_AUTOSAVE_SLOT ? 'Autosave' : slotId
}

function normalizeSlotId(slotId: string) {
  const normalized = slotId
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) throw new WorldSaveError('invalid-import', 'save slot id is empty')
  return normalized.slice(0, 64)
}

function normalizeRecord(record: PersistedWorldSaveRecord): PersistedWorldSaveRecord {
  return {
    ...record,
    label: record.label?.trim() || defaultSlotLabel(record.slotId),
    kind: record.kind ?? (record.slotId === WORLD_SAVE_AUTOSAVE_SLOT ? 'autosave' : 'manual'),
    snapshot: validateWorldSaveSnapshot(record.snapshot),
    backups: recordBackups(record),
  }
}

function validateWeatherState(weather: unknown): asserts weather is WorldSaveWeatherState {
  if (!weather || typeof weather !== 'object') {
    throw new WorldSaveError('corrupt', 'save snapshot weather state is invalid')
  }
  const candidate = weather as Partial<WorldSaveWeatherState>
  const tick = candidate.tick
  const accumulatorSeconds = candidate.accumulatorSeconds
  const tickSeconds = candidate.tickSeconds
  const cellScale = candidate.cellScale
  const maxCells = candidate.maxCells
  const historyLimit = candidate.historyLimit
  const tickValue = tick ?? Number.NaN
  const accumulatorSecondsValue = accumulatorSeconds ?? Number.NaN
  const tickSecondsValue = tickSeconds ?? Number.NaN
  const cellScaleValue = cellScale ?? Number.NaN
  const maxCellsValue = maxCells ?? 0
  const historyLimitValue = historyLimit ?? 0
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.seed !== 'string' ||
    !Number.isFinite(tickValue) ||
    tickValue < 0 ||
    !Number.isFinite(accumulatorSecondsValue) ||
    accumulatorSecondsValue < 0 ||
    !Number.isFinite(tickSecondsValue) ||
    tickSecondsValue <= 0 ||
    !Number.isFinite(cellScaleValue) ||
    cellScaleValue < 1 ||
    !Number.isInteger(maxCellsValue) ||
    maxCellsValue < 1 ||
    maxCellsValue > 1024 ||
    !Number.isInteger(historyLimitValue) ||
    historyLimitValue < 1 ||
    historyLimitValue > 64 ||
    !Array.isArray(candidate.cells) ||
    candidate.cells.length > maxCellsValue ||
    !Array.isArray(candidate.history) ||
    candidate.history.length > historyLimitValue
  ) {
    throw new WorldSaveError(
      'corrupt',
      'save snapshot weather state does not match schema version 1'
    )
  }
  for (const cell of candidate.cells) {
    if (
      !cell ||
      typeof cell.key !== 'string' ||
      !Number.isInteger(cell.x) ||
      !Number.isInteger(cell.y) ||
      !Number.isInteger(cell.tick) ||
      !Number.isFinite(cell.pressure) ||
      !Number.isFinite(cell.humidity) ||
      !Number.isFinite(cell.precipitation) ||
      !Number.isFinite(cell.temperatureAnomaly) ||
      !Number.isFinite(cell.windX) ||
      !Number.isFinite(cell.windY) ||
      typeof cell.frontId !== 'string' ||
      !Number.isInteger(cell.lastTouchedTick)
    ) {
      throw new WorldSaveError('corrupt', 'save snapshot weather cell is invalid')
    }
  }
  for (const entry of candidate.history) {
    if (
      !entry ||
      !Number.isInteger(entry.tick) ||
      entry.tick < 0 ||
      !Array.isArray(entry.changedKeys) ||
      entry.changedKeys.some((key) => typeof key !== 'string')
    ) {
      throw new WorldSaveError('corrupt', 'save snapshot weather history is invalid')
    }
  }
}

async function requireRecord(
  record: PersistedWorldSaveRecord | null,
  slotId: string
): Promise<PersistedWorldSaveRecord> {
  if (!record) throw new WorldSaveError('unavailable', `save slot ${slotId} does not exist`)
  return normalizeRecord(record)
}

async function readRecord(indexedDb: IDBFactory | undefined, slotId: string) {
  const record = await readRawRecord(indexedDb, slotId)
  return record ? normalizeRecord(record) : null
}

async function readRawRecord(indexedDb: IDBFactory | undefined, slotId: string) {
  const db = await openSaveDatabase(indexedDb)
  const record = await runReadonlyRequest<PersistedWorldSaveRecord | undefined>(db, slotId)
  return record ?? null
}

async function requireRawRecord(
  record: PersistedWorldSaveRecord | null,
  slotId: string
): Promise<PersistedWorldSaveRecord> {
  if (!record) throw new WorldSaveError('unavailable', `save slot ${slotId} does not exist`)
  return record
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
    !migrated.topology ||
    !migrated.authoredEntities ||
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

  try {
    validateTopologyLedger(migrated.topology)
    validateAuthoredEntityLifecycleSnapshot(migrated.authoredEntities)
    if (migrated.weather !== undefined) validateWeatherState(migrated.weather)
  } catch (error) {
    if (error instanceof TopologyLedgerError) {
      throw new WorldSaveError(
        error.code === 'incompatible-version' ? 'unsupported-version' : 'corrupt',
        error.message,
        error
      )
    }
    if (error instanceof AuthoredEntityLifecycleError) {
      throw new WorldSaveError(
        error.code === 'incompatible-version'
          ? 'unsupported-version'
          : error.code === 'budget-exceeded'
            ? 'quota-exceeded'
            : 'corrupt',
        error.message,
        error
      )
    }
    throw error
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
  const current = snapshot as WorldSaveSnapshot & {
    topology?: WorldSaveSnapshot['topology']
    authoredEntities?: WorldSaveSnapshot['authoredEntities']
  }
  return {
    ...current,
    topology: current.topology ?? emptyTopologyLedger(),
    authoredEntities: current.authoredEntities ?? emptyAuthoredEntityLifecycleSnapshot(),
  }
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

function runListRequest(db: IDBDatabase): Promise<PersistedWorldSaveRecord[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WORLD_SAVE_STORE, 'readonly')
    const request = transaction.objectStore(WORLD_SAVE_STORE).getAll()
    request.onerror = () =>
      reject(new WorldSaveError('unavailable', 'failed to list save records', request.error))
    request.onsuccess = () => resolve(request.result as PersistedWorldSaveRecord[])
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

async function runWriteWithBackupPruning(
  db: IDBDatabase,
  record: PersistedWorldSaveRecord
): Promise<void> {
  let candidate = record
  while (true) {
    try {
      await runWriteRequest(db, candidate)
      record.backups = candidate.backups
      return
    } catch (error) {
      if (
        !(error instanceof WorldSaveError) ||
        error.code !== 'quota-exceeded' ||
        !candidate.backups?.length
      ) {
        throw error
      }
      candidate = {
        ...candidate,
        backups: candidate.backups.slice(0, -1),
      }
    }
  }
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
