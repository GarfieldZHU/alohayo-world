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

/** A provisional D8 link entering a chunk from its deterministic hydrology halo. */
export interface DrainageFrontierInflow {
  source: { x: number; y: number }
  target: { x: number; y: number }
  direction: number
  sourceAccumulation: number
}

export interface ChunkDrainageSummary {
  chunkX: number
  chunkY: number
  chunkSize: number
  state: 'provisional' | 'reconciled'
  edges: Record<CardinalDirection, DrainageEdgeSample[]>
  frontierInflows?: DrainageFrontierInflow[]
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
 * Records halo cells whose D8 edge enters the chunk interior. These links keep river
 * identity continuous while an upstream chunk is outside the retained horizon.
 */
export function buildChunkDrainageFrontierInflows(args: {
  chunkX: number
  chunkY: number
  chunkSize: number
  windowOriginX: number
  windowOriginY: number
  hydrology: HydrologyRaster
}): DrainageFrontierInflow[] {
  const { chunkX, chunkY, chunkSize, windowOriginX, windowOriginY, hydrology } = args
  if (
    !Number.isInteger(hydrology.width) ||
    !Number.isInteger(hydrology.height) ||
    hydrology.width < 1 ||
    hydrology.height < 1
  ) {
    throw new RangeError('drainage frontier inflow dimensions must be positive integers')
  }
  const windowCellCount = hydrology.width * hydrology.height
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize < 1 ||
    hydrology.flowDirection.length !== windowCellCount ||
    hydrology.flowAccumulation.length !== windowCellCount ||
    hydrology.watershed.length !== windowCellCount ||
    hydrology.water.length !== windowCellCount
  ) {
    throw new RangeError('drainage frontier inflow buffers must match their dimensions')
  }
  const chunkOriginX = chunkX * chunkSize
  const chunkOriginY = chunkY * chunkSize
  if (
    windowOriginX > chunkOriginX ||
    windowOriginY > chunkOriginY ||
    windowOriginX + hydrology.width < chunkOriginX + chunkSize ||
    windowOriginY + hydrology.height < chunkOriginY + chunkSize
  ) {
    throw new RangeError('drainage frontier inflow window must contain the chunk interior')
  }
  const inflows: DrainageFrontierInflow[] = []
  for (let index = 0; index < windowCellCount; index += 1) {
    if (hydrology.water[index]) continue
    const sourceX = windowOriginX + (index % hydrology.width)
    const sourceY = windowOriginY + Math.floor(index / hydrology.width)
    if (
      sourceX >= chunkOriginX &&
      sourceX < chunkOriginX + chunkSize &&
      sourceY >= chunkOriginY &&
      sourceY < chunkOriginY + chunkSize
    ) {
      continue
    }
    const direction = hydrology.flowDirection[index]!
    const vector = HYDROLOGY_DIRECTIONS[direction]
    if (!vector) continue
    const target = { x: sourceX + vector[0], y: sourceY + vector[1] }
    const targetLocalX = target.x - chunkOriginX
    const targetLocalY = target.y - chunkOriginY
    if (
      targetLocalX < 0 ||
      targetLocalY < 0 ||
      targetLocalX >= chunkSize ||
      targetLocalY >= chunkSize
    ) {
      continue
    }
    inflows.push({
      source: { x: sourceX, y: sourceY },
      target,
      direction,
      sourceAccumulation: hydrology.flowAccumulation[index]!,
    })
  }
  inflows.sort(
    (left, right) =>
      left.source.y - right.source.y ||
      left.source.x - right.source.x ||
      left.target.y - right.target.y ||
      left.target.x - right.target.x
  )
  if (inflows.length > chunkSize * 4 + 4) {
    throw new RangeError('drainage frontier inflow boundary budget exceeded')
  }
  return inflows
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
  frontierInflows?: DrainageFrontierInflow[]
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

  return {
    chunkX,
    chunkY,
    chunkSize,
    state: 'provisional',
    edges,
    frontierInflows: (args.frontierInflows ?? []).map((inflow) => ({
      ...inflow,
      source: { ...inflow.source },
      target: { ...inflow.target },
    })),
  }
}

const CARDINAL_HANDOFF_ORDER: readonly CardinalDirection[] = ['north', 'east', 'south', 'west']
