export type TopologyMedium = 'land' | 'water'
export type CardinalDirection = 'north' | 'east' | 'south' | 'west'

export interface ChunkTopologySummary {
  chunkX: number
  chunkY: number
  chunkSize: number
  /** One deterministic local component label for every chunk cell. */
  componentIds: Uint16Array
  /** Medium for every component label; index zero is intentionally unused. */
  componentMedium: TopologyMedium[]
  edges: Record<CardinalDirection, Uint16Array>
}

export interface ResolvedTopologyIdentity {
  id: string
  medium: TopologyMedium
  /** An infinite world can only resolve the currently retained horizon. */
  state: 'provisional'
}

const DIRECTIONS: ReadonlyArray<{
  direction: CardinalDirection
  opposite: CardinalDirection
  dx: number
  dy: number
}> = [
  { direction: 'north', opposite: 'south', dx: 0, dy: -1 },
  { direction: 'east', opposite: 'west', dx: 1, dy: 0 },
  { direction: 'south', opposite: 'north', dx: 0, dy: 1 },
  { direction: 'west', opposite: 'east', dx: -1, dy: 0 },
]

function chunkKey(chunkX: number, chunkY: number) {
  return `${chunkX},${chunkY}`
}

function token(chunkX: number, chunkY: number, componentId: number) {
  return `${chunkX},${chunkY}:${componentId}`
}

function parseToken(value: string) {
  const [coordinate, component] = value.split(':')
  const [chunkX, chunkY] = coordinate!.split(',').map(Number)
  return { chunkX: chunkX!, chunkY: chunkY!, componentId: Number(component) }
}

function compareTokens(left: string, right: string) {
  const a = parseToken(left)
  const b = parseToken(right)
  return a.chunkY - b.chunkY || a.chunkX - b.chunkX || a.componentId - b.componentId
}

/**
 * Retains chunk summaries and joins matching cardinal-edge components. It deliberately
 * keeps parent aliases after eviction so a reloaded discovered chunk receives the same
 * canonical identity without requiring renderer state or a full-world scan.
 */
export class ChunkTopologyResolver {
  private readonly summaries = new Map<string, ChunkTopologySummary>()
  private readonly parents = new Map<string, string>()
  private readonly media = new Map<string, TopologyMedium>()

  add(summary: ChunkTopologySummary) {
    this.summaries.set(chunkKey(summary.chunkX, summary.chunkY), summary)
    for (let componentId = 1; componentId < summary.componentMedium.length; componentId += 1) {
      const key = token(summary.chunkX, summary.chunkY, componentId)
      this.parents.set(key, this.parents.get(key) ?? key)
      this.media.set(key, summary.componentMedium[componentId]!)
    }

    for (const neighbor of DIRECTIONS) {
      const adjacent = this.summaries.get(
        chunkKey(summary.chunkX + neighbor.dx, summary.chunkY + neighbor.dy)
      )
      if (!adjacent || adjacent.chunkSize !== summary.chunkSize) continue
      const edge = summary.edges[neighbor.direction]
      const opposite = adjacent.edges[neighbor.opposite]
      for (let index = 0; index < edge.length; index += 1) {
        const ownComponent = edge[index]!
        const adjacentComponent = opposite[index]!
        if (!ownComponent || !adjacentComponent) continue
        const own = token(summary.chunkX, summary.chunkY, ownComponent)
        const other = token(adjacent.chunkX, adjacent.chunkY, adjacentComponent)
        if (this.media.get(own) === this.media.get(other)) this.union(own, other)
      }
    }
  }

  release(chunkX: number, chunkY: number) {
    this.summaries.delete(chunkKey(chunkX, chunkY))
  }

  resolve(chunkX: number, chunkY: number, componentId: number): ResolvedTopologyIdentity | null {
    const key = token(chunkX, chunkY, componentId)
    const medium = this.media.get(key)
    if (!medium) return null
    return { id: `topology:${this.find(key)}`, medium, state: 'provisional' }
  }

  resolveCell(chunkX: number, chunkY: number, localIndex: number) {
    const summary = this.summaries.get(chunkKey(chunkX, chunkY))
    if (!summary) return null
    return this.resolve(chunkX, chunkY, summary.componentIds[localIndex]!)
  }

  private find(value: string): string {
    const parent = this.parents.get(value) ?? value
    if (parent === value) return value
    const root = this.find(parent)
    this.parents.set(value, root)
    return root
  }

  private union(left: string, right: string) {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot === rightRoot) return
    if (compareTokens(leftRoot, rightRoot) <= 0) this.parents.set(rightRoot, leftRoot)
    else this.parents.set(leftRoot, rightRoot)
  }
}

export function summarizeChunkTopology(args: {
  chunkX: number
  chunkY: number
  chunkSize: number
  isWater: (index: number) => boolean
}): ChunkTopologySummary {
  const { chunkX, chunkY, chunkSize, isWater } = args
  const size = chunkSize * chunkSize
  const componentIds = new Uint16Array(size)
  const componentMedium: TopologyMedium[] = ['land']
  let nextComponent = 1

  for (let start = 0; start < size; start += 1) {
    if (componentIds[start]) continue
    const medium: TopologyMedium = isWater(start) ? 'water' : 'land'
    const queue = [start]
    componentIds[start] = nextComponent
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!
      const x = current % chunkSize
      const y = Math.floor(current / chunkSize)
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const nx = x + dx!
        const ny = y + dy!
        if (nx < 0 || ny < 0 || nx >= chunkSize || ny >= chunkSize) continue
        const next = ny * chunkSize + nx
        if (componentIds[next] || (isWater(next) ? 'water' : 'land') !== medium) continue
        componentIds[next] = nextComponent
        queue.push(next)
      }
    }
    componentMedium[nextComponent] = medium
    nextComponent += 1
  }

  const north = new Uint16Array(chunkSize)
  const east = new Uint16Array(chunkSize)
  const south = new Uint16Array(chunkSize)
  const west = new Uint16Array(chunkSize)
  for (let index = 0; index < chunkSize; index += 1) {
    north[index] = componentIds[index]!
    south[index] = componentIds[(chunkSize - 1) * chunkSize + index]!
    west[index] = componentIds[index * chunkSize]!
    east[index] = componentIds[index * chunkSize + chunkSize - 1]!
  }

  return {
    chunkX,
    chunkY,
    chunkSize,
    componentIds,
    componentMedium,
    edges: { north, east, south, west },
  }
}
