import { HYDROLOGY_DIRECTIONS, type HydrologyRaster } from './hydrology'

export type CardinalDirection = 'north' | 'east' | 'south' | 'west'

export interface DrainageEdgeSample {
  localOffset: number
  watershedComponent: number
  direction: number
  upstreamCount: number
  accumulation: number
  filledElevation: number
  water: boolean
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

export function buildHydrologyUpstreamCounts(hydrology: HydrologyRaster): Uint8Array {
  const counts = new Uint8Array(hydrology.width * hydrology.height)
  for (let index = 0; index < counts.length; index += 1) {
    const direction = hydrology.flowDirection[index]!
    const [dx, dy] = HYDROLOGY_DIRECTIONS[direction] ?? [0, 0]
    if (direction < 0 || (dx === 0 && dy === 0)) continue
    const x = index % hydrology.width
    const y = Math.floor(index / hydrology.width)
    const targetX = x + dx
    const targetY = y + dy
    if (targetX < 0 || targetY < 0 || targetX >= hydrology.width || targetY >= hydrology.height) {
      continue
    }
    const target = targetY * hydrology.width + targetX
    const targetCount = counts[target] ?? 0
    if (targetCount < 255) counts[target] = targetCount + 1
  }
  return counts
}

/**
 * Serializable seam data. Every boundary cell is retained so a downstream cell can be
 * paired with an upstream frontier flow. The local watershed label is deliberately marked
 * provisional until #38's pairwise reconciliation aliases it to a world identity.
 */
export function buildChunkDrainageSummary(args: {
  chunkX: number
  chunkY: number
  hydrology: HydrologyRaster
  upstreamCounts?: Uint8Array
}): ChunkDrainageSummary {
  const { chunkX, chunkY, hydrology } = args
  const { width: chunkSize, height } = hydrology
  if (chunkSize !== height) throw new RangeError('chunk drainage summaries require square chunks')
  const upstreamCounts = args.upstreamCounts ?? buildHydrologyUpstreamCounts(hydrology)
  if (upstreamCounts.length !== chunkSize * chunkSize) {
    throw new RangeError('chunk drainage upstream counts must match its dimensions')
  }
  const edges = {} as ChunkDrainageSummary['edges']

  for (const direction of Object.keys(EDGE_DIRECTIONS) as CardinalDirection[]) {
    const samples: DrainageEdgeSample[] = []
    for (let offset = 0; offset < chunkSize; offset += 1) {
      const index = edgeIndex(direction, offset, chunkSize)
      const flowDirection = hydrology.flowDirection[index]!
      const [flowX, flowY] = HYDROLOGY_DIRECTIONS[flowDirection] ?? [0, 0]
      const x = index % chunkSize
      const y = Math.floor(index / chunkSize)
      const crossedEdges = CARDINAL_HANDOFF_ORDER.filter((candidate) => {
        const [dx, dy] = EDGE_DIRECTIONS[candidate]
        return (
          (dx < 0 && x === 0 && flowX < 0) ||
          (dx > 0 && x === chunkSize - 1 && flowX > 0) ||
          (dy < 0 && y === 0 && flowY < 0) ||
          (dy > 0 && y === chunkSize - 1 && flowY > 0)
        )
      })
      samples.push({
        localOffset: offset,
        watershedComponent: hydrology.watershed[index]!,
        direction: flowDirection,
        upstreamCount: upstreamCounts[index]!,
        accumulation: hydrology.flowAccumulation[index]!,
        filledElevation: hydrology.filledElevation[index]!,
        water: Boolean(hydrology.water[index]),
        crossesFrontier: crossedEdges[0] === direction,
      })
    }
    edges[direction] = samples
  }

  return { chunkX, chunkY, chunkSize, state: 'provisional', edges }
}

const CARDINAL_HANDOFF_ORDER: readonly CardinalDirection[] = ['north', 'east', 'south', 'west']
