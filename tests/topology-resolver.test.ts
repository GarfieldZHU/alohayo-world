import { describe, expect, it } from 'vitest'
import {
  ChunkTopologyResolver,
  TOPOLOGY_LEDGER_MAX_BYTES,
  TOPOLOGY_RESOLVER_VERSION,
  TopologyLedgerError,
  generateChunk,
  summarizeChunkTopology,
  validateTopologyLedger,
  type TopologyChangeEvent,
} from '../packages/map/src'

function allLand(chunkX: number, chunkY: number) {
  return summarizeChunkTopology({
    chunkX,
    chunkY,
    chunkSize: 4,
    isWater: () => false,
  })
}

describe('streamed topology resolver', () => {
  it('merges cardinal chunk seams in either load order', () => {
    const first = new ChunkTopologyResolver()
    first.add(allLand(0, 0))
    first.add(allLand(1, 0))

    const second = new ChunkTopologyResolver()
    second.add(allLand(1, 0))
    second.add(allLand(0, 0))

    expect(first.resolveCell(0, 0, 0)?.id).toBe(first.resolveCell(1, 0, 0)?.id)
    expect(second.resolveCell(0, 0, 0)?.id).toBe(second.resolveCell(1, 0, 0)?.id)
    expect(first.resolveCell(0, 0, 0)?.id).toBe(second.resolveCell(0, 0, 0)?.id)
  })

  it('preserves canonical aliases across negative coordinates and reloads', () => {
    const resolver = new ChunkTopologyResolver()
    resolver.add(allLand(-1, -2))
    resolver.add(allLand(0, -2))
    const identity = resolver.resolveCell(-1, -2, 0)?.id

    resolver.release(-1, -2)
    resolver.add(allLand(-1, -2))

    expect(resolver.resolveCell(-1, -2, 0)?.id).toBe(identity)
    expect(resolver.resolveCell(0, -2, 0)?.id).toBe(identity)
    expect(resolver.resolveCell(-1, -2, 0)?.state).toBe('provisional')
  })

  it('publishes deterministic merge and frontier events without renderer ownership', () => {
    const resolver = new ChunkTopologyResolver()
    const events: TopologyChangeEvent[] = []
    const unsubscribe = resolver.subscribe((event) => events.push(event))

    resolver.add(allLand(1, 0))
    resolver.add(allLand(0, 0))
    resolver.release(1, 0)
    unsubscribe()

    expect(events.map((event) => event.type)).toEqual(['frontier', 'merge', 'frontier', 'frontier'])
    expect(events[1]).toMatchObject({
      type: 'merge',
      canonicalId: 'topology:0,0:1',
      aliases: ['topology:1,0:1'],
      medium: 'land',
    })
    expect(events.map((event) => event.revision)).toEqual([1, 2, 3, 4])
  })

  it('round-trips aliases before chunks load across diagonal travel and restart', () => {
    const first = new ChunkTopologyResolver()
    first.add(allLand(0, 0))
    first.add(allLand(1, 0))
    first.add(allLand(1, 1))
    const expected = first.resolveCell(1, 1, 0)?.id
    first.release(0, 0)
    first.release(1, 0)
    first.release(1, 1)

    const ledger = first.exportLedger()
    expect(ledger).toMatchObject({
      schemaVersion: 1,
      resolverVersion: TOPOLOGY_RESOLVER_VERSION,
    })
    expect(ledger.aliases).toHaveLength(2)

    const restarted = new ChunkTopologyResolver()
    restarted.rehydrate(ledger)
    restarted.add(allLand(1, 1))
    expect(restarted.resolveCell(1, 1, 0)?.id).toBe(expected)
    restarted.add(allLand(0, 0))
    restarted.add(allLand(1, 0))
    expect(restarted.resolveCell(0, 0, 0)?.id).toBe(expected)
    expect(restarted.exportLedger()).toEqual(ledger)
  })

  it('rejects corrupt and incompatible topology ledgers with typed errors', () => {
    expect(() =>
      validateTopologyLedger({ schemaVersion: 1, resolverVersion: 'future', aliases: [] })
    ).toThrowError(TopologyLedgerError)
    expect(() =>
      validateTopologyLedger({
        schemaVersion: 1,
        resolverVersion: TOPOLOGY_RESOLVER_VERSION,
        aliases: [
          {
            aliasId: 'not-a-topology-id',
            canonicalId: 'topology:0,0:1',
            medium: 'land',
          },
        ],
      })
    ).toThrowError(TopologyLedgerError)
    expect(() =>
      validateTopologyLedger({
        schemaVersion: 1,
        resolverVersion: TOPOLOGY_RESOLVER_VERSION,
        aliases: [
          {
            aliasId: 'topology:0,0:1',
            canonicalId: 'topology:1,0:1',
            medium: 'land',
          },
          {
            aliasId: 'topology:1,0:1',
            canonicalId: 'topology:0,0:1',
            medium: 'land',
          },
        ],
      })
    ).toThrowError(TopologyLedgerError)
    try {
      validateTopologyLedger({
        schemaVersion: 1,
        resolverVersion: TOPOLOGY_RESOLVER_VERSION,
        aliases: [
          {
            aliasId: `topology:${'1'.repeat(TOPOLOGY_LEDGER_MAX_BYTES)}`,
            canonicalId: 'topology:0,0:1',
            medium: 'land',
          },
        ],
      })
      throw new Error('expected oversized topology ledger to fail')
    } catch (error) {
      expect(error).toMatchObject({ code: 'budget-exceeded' })
    }
  })

  it('includes deterministic transferable summaries on generated chunks', () => {
    const first = generateChunk('topology-summary', -2, 3, 16)
    const second = generateChunk('topology-summary', -2, 3, 16)

    expect(first.topology.componentIds).toEqual(second.topology.componentIds)
    expect(first.topology.edges.east).toEqual(second.topology.edges.east)
    expect(first.topology.componentIds.length).toBe(first.chunkSize * first.chunkSize)
  })
})
