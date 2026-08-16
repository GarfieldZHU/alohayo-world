import { describe, expect, it } from 'vitest'
import {
  CrossChunkHydrologyResolver,
  reconcileDrainageSeam,
  type ChunkDrainageSummary,
} from '@alohayo/map'

function summary(chunkX: number, chunkY: number, component: number, elevation = 42) {
  const sample = {
    localOffset: 1,
    watershedComponent: component,
    direction: 1,
    accumulation: 12,
    filledElevation: elevation,
    crossesFrontier: true,
  }
  return {
    chunkX,
    chunkY,
    chunkSize: 3,
    state: 'provisional' as const,
    edges: {
      north: [],
      east: [sample],
      south: [],
      west: [sample],
    },
  } satisfies ChunkDrainageSummary
}

describe('cross-chunk hydrology resolver', () => {
  it('reconciles a cardinal seam and rejects a mismatched elevation', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    const result = reconcileDrainageSeam({ left, right, direction: 'east' })
    expect(result.pairs).toHaveLength(1)
    expect(result.pairs[0]?.consistent).toBe(true)
    expect(
      reconcileDrainageSeam({
        left,
        right: summary(-1, 4, 3, 90),
        direction: 'east',
      }).pairs[0]?.consistent
    ).toBe(false)
  })

  it('keeps canonical identities and river segments independent of load order', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    const first = new CrossChunkHydrologyResolver()
    first.reconcile(left, right, 'east')
    const second = new CrossChunkHydrologyResolver()
    second.reconcile(right, left, 'west')

    expect(first.exportSnapshot()).toEqual(second.exportSnapshot())
    expect(first.segments()).toEqual(second.segments())
    expect(first.segments()[0]?.id).toContain('river:-2,4:')
  })

  it('rehydrates aliases after the neighboring chunks are evicted', () => {
    const left = summary(-2, -3, 11)
    const right = summary(-1, -3, 5)
    const first = new CrossChunkHydrologyResolver()
    first.reconcile(left, right, 'east')
    const snapshot = first.exportSnapshot()
    const restored = new CrossChunkHydrologyResolver()
    restored.rehydrate(snapshot)
    expect(restored.resolve(left.chunkX, left.chunkY, left.edges.east[0]!)).toBe(
      snapshot.aliases[0]?.canonicalId
    )
  })
})
