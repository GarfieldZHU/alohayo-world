import { describe, expect, it } from 'vitest'
import {
  CrossChunkHydrologyResolver,
  reconcileDrainageSeam,
  type ChunkDrainageSummary,
} from '@alohayo/map'

function summary(chunkX: number, chunkY: number, component: number, elevation = 42) {
  const outflow = {
    localOffset: 1,
    watershedComponent: component,
    direction: 0,
    upstreamCount: 1,
    accumulation: 12,
    filledElevation: elevation,
    water: false,
    crossesFrontier: true,
  }
  const receiving = {
    localOffset: 1,
    watershedComponent: component,
    direction: 2,
    upstreamCount: 1,
    accumulation: 24,
    filledElevation: elevation,
    water: false,
    crossesFrontier: false,
  }
  return {
    chunkX,
    chunkY,
    chunkSize: 3,
    state: 'provisional' as const,
    edges: {
      north: [],
      east: [outflow],
      south: [],
      west: [receiving],
    },
  } satisfies ChunkDrainageSummary
}

function cornerSummary(
  chunkX: number,
  chunkY: number,
  component: number,
  selected: {
    edge: 'north' | 'east' | 'south' | 'west'
    offset: number
    sample: {
      direction: number
      upstreamCount: number
      accumulation: number
      water?: boolean
      crossesFrontier?: boolean
    }
  }
): ChunkDrainageSummary {
  const edges = Object.fromEntries(
    (['north', 'east', 'south', 'west'] as const).map((edge) => [
      edge,
      Array.from({ length: 3 }, (_, localOffset) => ({
        localOffset,
        watershedComponent: component,
        direction: -1,
        upstreamCount: 0,
        accumulation: 1,
        filledElevation: 10,
        water: false,
        crossesFrontier: false,
      })),
    ])
  ) as ChunkDrainageSummary['edges']
  edges[selected.edge][selected.offset] = {
    ...edges[selected.edge][selected.offset]!,
    ...selected.sample,
  }
  return { chunkX, chunkY, chunkSize: 3, state: 'provisional', edges }
}

describe('cross-chunk hydrology resolver', () => {
  it('reconciles a cardinal seam and rejects a mismatched elevation', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    const result = reconcileDrainageSeam({ left, right, direction: 'east' })
    expect(result.pairs).toHaveLength(1)
    expect(result.pairs[0]?.flow).toBe('left-to-right')
    expect(result.pairs[0]?.consistent).toBe(true)
    expect(
      reconcileDrainageSeam({
        left,
        right: summary(-1, 4, 3, 90),
        direction: 'east',
      }).pairs[0]?.consistent
    ).toBe(false)
  })

  it('does not reconcile opposing frontier flows as a river handoff', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    right.edges.west[0]!.direction = 1
    right.edges.west[0]!.crossesFrontier = true

    const result = reconcileDrainageSeam({ left, right, direction: 'east' })

    expect(result.pairs[0]?.flow).toBe(null)
    expect(result.pairs[0]?.consistent).toBe(false)
  })

  it('does not alias a diagonal corner handoff to the wrong cardinal receiver', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    left.edges.east[0]!.direction = 5

    const result = reconcileDrainageSeam({ left, right, direction: 'east' })

    expect(result.pairs[0]?.flow).toBe(null)
    expect(result.pairs[0]?.consistent).toBe(false)
  })

  it('keeps canonical identities and river segments independent of load order', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    const first = new CrossChunkHydrologyResolver()
    first.reconcile(left, right, 'east')
    const second = new CrossChunkHydrologyResolver()
    second.reconcile(right, left, 'west')

    expect(first.exportSnapshot()).toEqual(second.exportSnapshot())
    expect(first.exportSnapshot().aliases[0]?.canonicalId).toBe('watershed:-2,4:7')
    expect(first.segments()).toEqual(second.segments())
    expect(first.segments()[0]?.id).toBe('river:segment:-4,13>-3,13')
    expect(first.segments()[0]?.sourceNodeId).toBe('river:channel:-4,13')
    expect(first.segments()[0]?.targetNodeId).toBe('river:channel:-3,13')
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

  it('releases retained summaries and seam segments while keeping canonical aliases', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    const resolver = new CrossChunkHydrologyResolver()
    resolver.reconcile(left, right, 'east')
    const expectedIdentity = resolver.exportSnapshot().aliases[0]?.canonicalId

    resolver.release(left.chunkX, left.chunkY)

    expect(resolver.segments()).toEqual([])
    expect(resolver.resolve(right.chunkX, right.chunkY, right.edges.west[0]!)).toBe(
      expectedIdentity
    )
    expect(resolver.exportSnapshot().aliases).toHaveLength(1)
  })

  it('assigns stable source and mouth node identities to a water-bound seam', () => {
    const left = summary(-2, 4, 7)
    const right = summary(-1, 4, 3)
    left.edges.east[0]!.accumulation = 1
    left.edges.east[0]!.upstreamCount = 0
    right.edges.west[0]!.water = true
    right.edges.west[0]!.accumulation = 1

    const resolver = new CrossChunkHydrologyResolver()
    resolver.reconcile(left, right, 'east')
    const [segment] = resolver.segments()

    expect(segment?.sourceKind).toBe('source')
    expect(segment?.targetKind).toBe('mouth')
    expect(segment?.sourceNodeId).toBe('river:source:-4,13')
    expect(segment?.targetNodeId).toBe('river:mouth:-3,13')
  })

  it('assigns confluence and outlet IDs from stable edge-cell coordinates', () => {
    const left = summary(1, -2, 4)
    const right = summary(2, -2, 5)
    left.edges.east[0]!.upstreamCount = 2
    right.edges.west[0]!.direction = -1
    right.edges.west[0]!.upstreamCount = 0

    const resolver = new CrossChunkHydrologyResolver()
    resolver.reconcile(left, right, 'east')
    const [segment] = resolver.segments()

    expect(segment?.sourceNodeId).toBe('river:confluence:5,-5')
    expect(segment?.targetNodeId).toBe('river:outlet:6,-5')
    expect(segment?.targetKind).toBe('outlet')
  })

  it('matches a diagonal D8 handoff to its actual target cell at negative coordinates', () => {
    const source = cornerSummary(-2, 1, 9, {
      edge: 'north',
      offset: 2,
      sample: { direction: 5, upstreamCount: 0, accumulation: 1, crossesFrontier: true },
    })
    const target = cornerSummary(-1, 0, 4, {
      edge: 'south',
      offset: 0,
      sample: { direction: 2, upstreamCount: 1, accumulation: 8 },
    })
    const first = new CrossChunkHydrologyResolver()
    const firstSegments = first.reconcileDiagonal(source, target)
    const second = new CrossChunkHydrologyResolver()
    second.reconcileDiagonal(target, source)

    expect(firstSegments).toHaveLength(1)
    expect(firstSegments[0]).toMatchObject({
      id: 'river:segment:-4,3>-3,2',
      direction: 'north-east',
      sourceKind: 'source',
      sourceNodeId: 'river:source:-4,3',
      targetNodeId: 'river:channel:-3,2',
    })
    expect(first.segments()).toEqual(second.segments())
    expect(first.exportSnapshot()).toEqual(second.exportSnapshot())

    first.release(source.chunkX, source.chunkY)
    expect(first.segments()).toEqual([])
  })

  it('replaces diagonal links when an updated seam summary changes the target', () => {
    const source = cornerSummary(-2, 1, 9, {
      edge: 'north',
      offset: 2,
      sample: { direction: 5, upstreamCount: 0, accumulation: 1, crossesFrontier: true },
    })
    const target = cornerSummary(-1, 0, 4, {
      edge: 'south',
      offset: 0,
      sample: { direction: 2, upstreamCount: 1, accumulation: 8 },
    })
    const resolver = new CrossChunkHydrologyResolver()
    resolver.reconcileDiagonal(source, target)
    source.edges.north[2]!.direction = 0

    expect(resolver.reconcileDiagonal(source, target)).toEqual([])
    expect(resolver.segments()).toEqual([])
  })

  it('exposes canonical watershed IDs for interior components without leaking local labels', () => {
    const resolver = new CrossChunkHydrologyResolver()
    const before = resolver.exportSnapshot()

    expect(resolver.resolveComponent(-3, 2, 11)).toBe('watershed:-3,2:11')
    expect(resolver.exportSnapshot()).toEqual(before)
  })

  it('builds stable retained-cell D8 river links and leaves unknown outlets as frontiers', () => {
    const leftDirection = new Int8Array(9).fill(-1)
    const leftAccumulation = new Uint32Array(9)
    const leftWatershed = new Uint32Array(9).fill(7)
    const leftWater = new Uint8Array(9)
    leftDirection[5] = 0
    leftAccumulation[5] = 6
    const rightDirection = new Int8Array(9).fill(-1)
    const rightAccumulation = new Uint32Array(9)
    const rightWatershed = new Uint32Array(9).fill(3)
    const rightWater = new Uint8Array(9)
    rightDirection[3] = 0
    rightAccumulation[3] = 7
    rightAccumulation[4] = 7

    const leftRaster = {
      chunkX: -1,
      chunkY: 0,
      chunkSize: 3,
      flowDirection: leftDirection,
      flowAccumulation: leftAccumulation,
      watershed: leftWatershed,
      water: leftWater,
    }
    const rightRaster = {
      chunkX: 0,
      chunkY: 0,
      chunkSize: 3,
      flowDirection: rightDirection,
      flowAccumulation: rightAccumulation,
      watershed: rightWatershed,
      water: rightWater,
    }
    const first = new CrossChunkHydrologyResolver()
    first.addRaster(rightRaster)
    first.addRaster(leftRaster)
    const second = new CrossChunkHydrologyResolver()
    second.addRaster(leftRaster)
    second.addRaster(rightRaster)
    const graph = first.retainedRiverGraph(4)

    expect(graph.truncated).toBe(false)
    expect(graph.segments).toEqual(second.retainedRiverGraph(4).segments)
    expect(graph.segments).toContainEqual(
      expect.objectContaining({
        id: 'river:segment:-1,1>0,1',
        sourceNodeId: 'river:channel:-1,1',
        targetNodeId: 'river:channel:0,1',
        direction: 'east',
        targetKind: 'channel',
        accumulation: 7,
      })
    )
    expect(first.retainedRiverGraph(4, 1)).toMatchObject({ truncated: true })
    expect(first.retainedRiverGraph(4, -1)).toMatchObject({ segments: [], truncated: true })
    expect(() => first.retainedRiverGraph(Number.NaN)).toThrow(RangeError)

    const frontier = new CrossChunkHydrologyResolver()
    frontier.addRaster(leftRaster)
    expect(frontier.retainedRiverGraph(4).segments[0]).toMatchObject({
      id: 'river:segment:-1,1>0,1',
      targetKind: 'frontier',
      accumulation: 6,
    })
  })
})
