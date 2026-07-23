import { HYDROLOGY_DIRECTIONS, hydrologyNeighborIndex, type HydrologyRaster } from './hydrology'

export type CardinalDirection = 'north' | 'east' | 'south' | 'west'

export interface DrainageEdgeSample {
  localOffset: number
  watershedComponent: number
  direction: number
  accumulation: number
  filledElevation: number
  crossesFrontier: boolean
}

export interface ChunkDrainageSummary {
  chunkX: number
  chunkY: number
  chunkSize: number
  state: 'provisional' | 'reconciled'
  edges: Record<CardinalDirection, DrainageEdgeSample[]>
}

const EDGE_DIRECTIONS: Record<CardinalDirection, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}

function edgeIndex(direction: CardinalDirection, offset: number, chunkSize: number) {
  if (direction === 'north') return offset
  if (direction === 'east') return offset * chunkSize + chunkSize - 1
  if (direction === 'south') return (chunkSize - 1) * chunkSize + offset
  return offset * chunkSize
}

/**
 * Serializable stage-one seam data. The local watershed label is deliberately marked
 * provisional until #38's pairwise reconciliation aliases it to a world identity.
 */
export function buildChunkDrainageSummary(args: {
  chunkX: number
  chunkY: number
  hydrology: HydrologyRaster
}): ChunkDrainageSummary {
  const { chunkX, chunkY, hydrology } = args
  const { width: chunkSize, height } = hydrology
  if (chunkSize !== height) throw new RangeError('chunk drainage summaries require square chunks')
  const edges = {} as ChunkDrainageSummary['edges']

  for (const direction of Object.keys(EDGE_DIRECTIONS) as CardinalDirection[]) {
    const [edgeX, edgeY] = EDGE_DIRECTIONS[direction]
    const samples: DrainageEdgeSample[] = []
    for (let offset = 0; offset < chunkSize; offset += 1) {
      const index = edgeIndex(direction, offset, chunkSize)
      const flowDirection = hydrology.flowDirection[index]!
      const neighbor = hydrologyNeighborIndex(index, flowDirection, chunkSize, chunkSize)
      const [flowX, flowY] = HYDROLOGY_DIRECTIONS[flowDirection] ?? [0, 0]
      const crossesThisEdge =
        neighbor === -1 && ((edgeX !== 0 && flowX === edgeX) || (edgeY !== 0 && flowY === edgeY))
      if (!crossesThisEdge) continue
      samples.push({
        localOffset: offset,
        watershedComponent: hydrology.watershed[index]!,
        direction: flowDirection,
        accumulation: hydrology.flowAccumulation[index]!,
        filledElevation: hydrology.filledElevation[index]!,
        crossesFrontier: true,
      })
    }
    edges[direction] = samples
  }

  return { chunkX, chunkY, chunkSize, state: 'provisional', edges }
}
