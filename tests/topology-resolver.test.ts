import { describe, expect, it } from 'vitest'
import { ChunkTopologyResolver, generateChunk, summarizeChunkTopology } from '../packages/map/src'

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

  it('includes deterministic transferable summaries on generated chunks', () => {
    const first = generateChunk('topology-summary', -2, 3, 16)
    const second = generateChunk('topology-summary', -2, 3, 16)

    expect(first.topology.componentIds).toEqual(second.topology.componentIds)
    expect(first.topology.edges.east).toEqual(second.topology.edges.east)
    expect(first.topology.componentIds.length).toBe(first.chunkSize * first.chunkSize)
  })
})
