import { describe, expect, it } from 'vitest'
import {
  assertCompatibleContentPackState,
  createWorldSaveStore,
  decodeDiscoveredChunk,
  encodeDiscoveredChunk,
  WorldSaveError,
} from '../packages/engine/src/save-store'
import type { WorldSaveSnapshot } from '../packages/config/src'

class FakeOpenRequest {
  result!: FakeDatabase
  error: Error | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onupgradeneeded: (() => void) | null = null
}

class FakeObjectStoreNames {
  constructor(private readonly stores: Set<string>) {}
  contains(name: string) {
    return this.stores.has(name)
  }
}

class FakeRequest<T> {
  result!: T
  error: Error | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
}

class FakeObjectStore {
  constructor(
    private readonly records: Map<string, unknown>,
    private readonly transaction: FakeTransaction
  ) {}

  get(key: string) {
    const request = new FakeRequest<unknown>()
    queueMicrotask(() => {
      request.result = this.records.get(key)
      request.onsuccess?.()
    })
    return request
  }

  getAll() {
    const request = new FakeRequest<unknown[]>()
    queueMicrotask(() => {
      request.result = Array.from(this.records.values())
      request.onsuccess?.()
    })
    return request
  }

  put(value: { slotId: string }) {
    queueMicrotask(() => {
      if (this.transaction.failWith) {
        this.transaction.error = this.transaction.failWith
        this.transaction.onerror?.()
        return
      }
      this.records.set(value.slotId, value)
      this.transaction.oncomplete?.()
    })
  }

  delete(key: string) {
    queueMicrotask(() => {
      this.records.delete(key)
      this.transaction.oncomplete?.()
    })
  }
}

class FakeTransaction {
  error: Error | null = null
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(
    private readonly records: Map<string, unknown>,
    readonly failWith: Error | null = null
  ) {}

  objectStore() {
    return new FakeObjectStore(this.records, this)
  }
}

class FakeDatabase {
  objectStoreNames: FakeObjectStoreNames

  constructor(
    private readonly stores: Set<string>,
    private readonly records: Map<string, unknown>,
    private readonly failWrites = false
  ) {
    this.objectStoreNames = new FakeObjectStoreNames(stores)
  }

  createObjectStore(name: string) {
    this.stores.add(name)
    return {}
  }

  transaction() {
    return new FakeTransaction(
      this.records,
      this.failWrites ? new DOMException('quota', 'QuotaExceededError') : null
    )
  }
}

class FakeIndexedDbFactory {
  private readonly stores = new Set<string>()
  readonly records = new Map<string, unknown>()

  constructor(private readonly failWrites = false) {}

  open() {
    const request = new FakeOpenRequest()
    queueMicrotask(() => {
      request.result = new FakeDatabase(this.stores, this.records, this.failWrites)
      request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request as unknown as IDBOpenDBRequest
  }
}

const sampleSnapshot: WorldSaveSnapshot = {
  schemaVersion: 1,
  engineVersion: '0.1.0',
  savedAt: '2026-07-05T00:00:00.000Z',
  world: {
    seed: 'alohayo',
    chunkSize: 64,
    surveyWidth: 160,
    surveyHeight: 120,
    activeChunkRadius: 2,
    retainChunkRadius: 4,
    minimapChunkRadius: 6,
  },
  explorer: {
    archetypeId: 'core:explorer',
    x: 12.5,
    y: 8.5,
    facing: 'east',
    state: 'idle',
    activeWeaponSlot: 'core:main-hand',
  },
  discovery: {
    chunks: [
      {
        key: '0:0',
        chunkX: 0,
        chunkY: 0,
        discovered: encodeDiscoveredChunk(new Uint8Array([1, 0, 1, 1])),
      },
    ],
    discoveredCells: 3,
    discoveredChunkKeys: ['0:0'],
  },
  topology: {
    schemaVersion: 1,
    resolverVersion: '1',
    aliases: [
      {
        aliasId: 'topology:1,0:1',
        canonicalId: 'topology:0,0:1',
        medium: 'land',
      },
    ],
  },
  preferences: {
    locale: 'en',
    devMode: false,
    devShowGrid: false,
    devShowMinimap: false,
    devDayNight: true,
    devLightLevel: 0.65,
    devPanelCollapsed: false,
    devPanelActiveTab: 'movement',
    minimapCollapsed: false,
    minimapMode: 'fit',
    minimapManualRadius: 32,
  },
  contentPacks: {
    orderedPackIds: ['core', 'archipelago'],
    resolutionHash: 'fnv32:10cb56c6',
    packs: [
      {
        id: 'core',
        version: '0.1.0',
        schemaVersion: 1,
        manifestPath: '/content/core/manifest.json',
        dependencyDepth: 0,
        mapAreaIds: ['core:wayfinder-isle'],
      },
    ],
    resolvedMapAreaIds: ['core:wayfinder-isle'],
  },
}

describe('world save store', () => {
  it('round-trips snapshots through the fake IndexedDB store', async () => {
    const store = createWorldSaveStore(new FakeIndexedDbFactory() as unknown as IDBFactory)

    const saved = await store.save(sampleSnapshot)
    expect(saved.discoveredCells).toBe(3)

    const loaded = await store.load()
    expect(loaded).toEqual(sampleSnapshot)
  })

  it('exports and imports snapshots as JSON', async () => {
    const store = createWorldSaveStore(undefined)
    const serialized = store.exportSnapshot(sampleSnapshot)
    const imported = await store.importSnapshot(serialized)

    expect(imported).toEqual(sampleSnapshot)
  })

  it('migrates legacy schema-one saves without a topology ledger', async () => {
    const store = createWorldSaveStore(undefined)
    const legacy = { ...sampleSnapshot } as Partial<WorldSaveSnapshot>
    delete legacy.topology

    await expect(store.importSnapshot(JSON.stringify(legacy))).resolves.toMatchObject({
      topology: { schemaVersion: 1, resolverVersion: '1', aliases: [] },
    })
  })

  it('maps corrupt and incompatible topology ledgers to typed recovery errors', async () => {
    const store = createWorldSaveStore(undefined)
    await expect(
      store.importSnapshot(
        JSON.stringify({
          ...sampleSnapshot,
          topology: { ...sampleSnapshot.topology, aliases: [{ broken: true }] },
        })
      )
    ).rejects.toMatchObject({ code: 'corrupt' })
    await expect(
      store.importSnapshot(
        JSON.stringify({
          ...sampleSnapshot,
          topology: { ...sampleSnapshot.topology, resolverVersion: 'future' },
        })
      )
    ).rejects.toMatchObject({ code: 'unsupported-version' })
  })

  it('lists, renames, duplicates, and deletes named save slots', async () => {
    const store = createWorldSaveStore(new FakeIndexedDbFactory() as unknown as IDBFactory)
    await store.save(sampleSnapshot, 'manual-one', { label: 'Before the bridge' })
    await store.save({ ...sampleSnapshot, savedAt: '2026-07-06T00:00:00.000Z' }, 'import-one', {
      label: 'Imported journey',
      kind: 'imported',
    })

    expect(await store.list()).toEqual([
      expect.objectContaining({ slotId: 'import-one', kind: 'imported' }),
      expect.objectContaining({ slotId: 'manual-one', label: 'Before the bridge' }),
    ])

    await expect(store.rename('manual-one', 'renamed-slot', 'New name')).resolves.toMatchObject({
      slotId: 'renamed-slot',
      label: 'New name',
    })
    await expect(store.load('manual-one')).resolves.toBeNull()

    await expect(store.duplicate('renamed-slot', 'copy-slot')).resolves.toMatchObject({
      slotId: 'copy-slot',
      kind: 'manual',
    })
    await store.clear('copy-slot')
    await expect(store.load('copy-slot')).resolves.toBeNull()
  })

  it('decodes discovery chunks from base64 payloads', () => {
    expect(
      Array.from(decodeDiscoveredChunk(sampleSnapshot.discovery.chunks[0]!.discovered))
    ).toEqual([1, 0, 1, 1])
  })

  it('rejects incompatible content resolution hashes', () => {
    expect(() => assertCompatibleContentPackState(sampleSnapshot, 'fnv32:other')).toThrow(
      WorldSaveError
    )
  })

  it('rejects invalid imports', async () => {
    const store = createWorldSaveStore(undefined)
    await expect(store.importSnapshot('{oops')).rejects.toMatchObject({
      code: 'invalid-import',
    })
  })

  it('rejects unsupported save schema versions', async () => {
    const store = createWorldSaveStore(undefined)
    await expect(
      store.importSnapshot(
        JSON.stringify({
          ...sampleSnapshot,
          schemaVersion: 2,
        })
      )
    ).rejects.toMatchObject({
      code: 'unsupported-version',
    })
  })

  it('maps quota failures to typed save errors', async () => {
    const store = createWorldSaveStore(new FakeIndexedDbFactory(true) as unknown as IDBFactory)
    await expect(store.save(sampleSnapshot)).rejects.toMatchObject({
      code: 'quota-exceeded',
    })
  })
})
