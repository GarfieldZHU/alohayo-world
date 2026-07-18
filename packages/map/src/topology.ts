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

export const TOPOLOGY_LEDGER_SCHEMA_VERSION = 1 as const
export const TOPOLOGY_RESOLVER_VERSION = '1'
export const TOPOLOGY_LEDGER_MAX_ALIASES = 20_000
export const TOPOLOGY_LEDGER_MAX_BYTES = 2 * 1024 * 1024

export interface TopologyAliasRecord {
  aliasId: string
  canonicalId: string
  medium: TopologyMedium
}

export interface TopologyIdentityLedger {
  schemaVersion: typeof TOPOLOGY_LEDGER_SCHEMA_VERSION
  resolverVersion: string
  aliases: TopologyAliasRecord[]
}

export type TopologyChangeEvent =
  | {
      type: 'merge'
      revision: number
      canonicalId: string
      aliases: string[]
      medium: TopologyMedium
    }
  | {
      type: 'split'
      revision: number
      previousId: string
      canonicalIds: string[]
      medium: TopologyMedium
    }
  | {
      type: 'frontier'
      revision: number
      action: 'added' | 'released'
      chunkX: number
      chunkY: number
      identityIds: string[]
    }

export type TopologyChangeListener = (event: TopologyChangeEvent) => void
type TopologyChangeEventInput =
  | Omit<Extract<TopologyChangeEvent, { type: 'merge' }>, 'revision'>
  | Omit<Extract<TopologyChangeEvent, { type: 'split' }>, 'revision'>
  | Omit<Extract<TopologyChangeEvent, { type: 'frontier' }>, 'revision'>
export type TopologyLedgerErrorCode = 'corrupt' | 'incompatible-version' | 'budget-exceeded'

export class TopologyLedgerError extends Error {
  constructor(
    readonly code: TopologyLedgerErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TopologyLedgerError'
  }
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

function topologyId(value: string) {
  return `topology:${value}`
}

function topologyToken(value: string) {
  return value.startsWith('topology:') ? value.slice('topology:'.length) : value
}

function isTopologyToken(value: string) {
  return /^-?\d+,-?\d+:\d+$/.test(value)
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
  private readonly listeners = new Set<TopologyChangeListener>()
  private revision = 0
  private aliasCount = 0

  subscribe(listener: TopologyChangeListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  rehydrate(ledger: TopologyIdentityLedger) {
    validateTopologyLedger(ledger)
    const retainedSummaries = Array.from(this.summaries.values()).sort(
      (left, right) => left.chunkY - right.chunkY || left.chunkX - right.chunkX
    )
    this.summaries.clear()
    this.parents.clear()
    this.media.clear()
    this.aliasCount = 0
    for (const record of ledger.aliases) {
      const alias = topologyToken(record.aliasId)
      const canonical = topologyToken(record.canonicalId)
      this.parents.set(alias, canonical)
      this.parents.set(canonical, canonical)
      this.media.set(alias, record.medium)
      this.media.set(canonical, record.medium)
    }
    this.aliasCount = ledger.aliases.length
    for (const summary of retainedSummaries) this.add(summary)
  }

  exportLedger(): TopologyIdentityLedger {
    const aliases = Array.from(this.parents.keys())
      .sort(compareTokens)
      .flatMap((alias): TopologyAliasRecord[] => {
        const canonical = this.find(alias)
        if (canonical === alias) return []
        return [
          {
            aliasId: topologyId(alias),
            canonicalId: topologyId(canonical),
            medium: this.media.get(alias) ?? this.media.get(canonical)!,
          },
        ]
      })
    const ledger: TopologyIdentityLedger = {
      schemaVersion: TOPOLOGY_LEDGER_SCHEMA_VERSION,
      resolverVersion: TOPOLOGY_RESOLVER_VERSION,
      aliases,
    }
    validateTopologyLedger(ledger)
    return ledger
  }

  stats() {
    const ledger = this.exportLedger()
    return {
      revision: this.revision,
      retainedChunks: this.summaries.size,
      aliases: ledger.aliases.length,
      serializedBytes: topologyLedgerBytes(ledger),
    }
  }

  getAliasCount() {
    return this.aliasCount
  }

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

    this.emit({
      type: 'frontier',
      action: 'added',
      chunkX: summary.chunkX,
      chunkY: summary.chunkY,
      identityIds: this.summaryIdentityIds(summary),
    })
  }

  release(chunkX: number, chunkY: number) {
    const summary = this.summaries.get(chunkKey(chunkX, chunkY))
    if (!summary) return
    const identityIds = this.summaryIdentityIds(summary)
    this.summaries.delete(chunkKey(chunkX, chunkY))
    this.compactReleasedRoots(summary)
    this.emit({ type: 'frontier', action: 'released', chunkX, chunkY, identityIds })
  }

  resolve(chunkX: number, chunkY: number, componentId: number): ResolvedTopologyIdentity | null {
    const key = token(chunkX, chunkY, componentId)
    const medium = this.media.get(key)
    if (!medium) return null
    return { id: topologyId(this.find(key)), medium, state: 'provisional' }
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
    const canonical = compareTokens(leftRoot, rightRoot) <= 0 ? leftRoot : rightRoot
    const alias = canonical === leftRoot ? rightRoot : leftRoot
    if (this.aliasCount >= TOPOLOGY_LEDGER_MAX_ALIASES) {
      throw new TopologyLedgerError(
        'budget-exceeded',
        `topology alias budget exceeds ${TOPOLOGY_LEDGER_MAX_ALIASES}`
      )
    }
    this.parents.set(alias, canonical)
    this.aliasCount += 1
    this.emit({
      type: 'merge',
      canonicalId: topologyId(canonical),
      aliases: [topologyId(alias)],
      medium: this.media.get(canonical) ?? this.media.get(alias)!,
    })
  }

  private summaryIdentityIds(summary: ChunkTopologySummary) {
    const ids = new Set<string>()
    for (let componentId = 1; componentId < summary.componentMedium.length; componentId += 1) {
      ids.add(topologyId(this.find(token(summary.chunkX, summary.chunkY, componentId))))
    }
    return Array.from(ids).sort()
  }

  private compactReleasedRoots(summary: ChunkTopologySummary) {
    const referencedRoots = new Set<string>()
    for (const [alias, parent] of this.parents) {
      if (alias !== parent) referencedRoots.add(this.find(parent))
    }
    for (let componentId = 1; componentId < summary.componentMedium.length; componentId += 1) {
      const key = token(summary.chunkX, summary.chunkY, componentId)
      if (this.parents.get(key) === key && !referencedRoots.has(key)) {
        this.parents.delete(key)
        this.media.delete(key)
      }
    }
  }

  private emit(event: TopologyChangeEventInput) {
    this.revision += 1
    const versioned = { ...event, revision: this.revision } as TopologyChangeEvent
    for (const listener of this.listeners) listener(versioned)
  }
}

export function emptyTopologyLedger(): TopologyIdentityLedger {
  return {
    schemaVersion: TOPOLOGY_LEDGER_SCHEMA_VERSION,
    resolverVersion: TOPOLOGY_RESOLVER_VERSION,
    aliases: [],
  }
}

export function topologyLedgerBytes(ledger: TopologyIdentityLedger) {
  return new TextEncoder().encode(JSON.stringify(ledger)).byteLength
}

export function validateTopologyLedger(ledger: unknown): asserts ledger is TopologyIdentityLedger {
  if (!ledger || typeof ledger !== 'object') {
    throw new TopologyLedgerError('corrupt', 'topology ledger must be an object')
  }
  const candidate = ledger as Partial<TopologyIdentityLedger>
  if (candidate.schemaVersion !== TOPOLOGY_LEDGER_SCHEMA_VERSION) {
    throw new TopologyLedgerError(
      'incompatible-version',
      `topology ledger schema ${String(candidate.schemaVersion)} is not supported`
    )
  }
  if (candidate.resolverVersion !== TOPOLOGY_RESOLVER_VERSION) {
    throw new TopologyLedgerError(
      'incompatible-version',
      `topology resolver ${String(candidate.resolverVersion)} is not supported`
    )
  }
  if (!Array.isArray(candidate.aliases)) {
    throw new TopologyLedgerError('corrupt', 'topology ledger aliases must be an array')
  }
  if (candidate.aliases.length > TOPOLOGY_LEDGER_MAX_ALIASES) {
    throw new TopologyLedgerError('budget-exceeded', 'topology ledger alias budget exceeded')
  }
  if (topologyLedgerBytes(candidate as TopologyIdentityLedger) > TOPOLOGY_LEDGER_MAX_BYTES) {
    throw new TopologyLedgerError('budget-exceeded', 'topology ledger serialized budget exceeded')
  }
  for (const record of candidate.aliases) {
    const alias = topologyToken(record?.aliasId ?? '')
    const canonical = topologyToken(record?.canonicalId ?? '')
    if (
      !record ||
      !isTopologyToken(alias) ||
      !isTopologyToken(canonical) ||
      alias === canonical ||
      (record.medium !== 'land' && record.medium !== 'water')
    ) {
      throw new TopologyLedgerError('corrupt', 'topology ledger contains an invalid alias')
    }
  }
  const aliases = new Map<string, string>()
  const identityMedia = new Map<string, TopologyMedium>()
  for (const record of candidate.aliases) {
    const alias = topologyToken(record.aliasId)
    const canonical = topologyToken(record.canonicalId)
    if (aliases.has(alias)) {
      throw new TopologyLedgerError('corrupt', 'topology ledger contains a duplicate alias')
    }
    for (const identity of [alias, canonical]) {
      const currentMedium = identityMedia.get(identity)
      if (currentMedium && currentMedium !== record.medium) {
        throw new TopologyLedgerError('corrupt', 'topology ledger mixes identity media')
      }
      identityMedia.set(identity, record.medium)
    }
    aliases.set(alias, canonical)
  }
  for (const alias of aliases.keys()) {
    const visited = new Set<string>()
    let current: string | undefined = alias
    while (current && aliases.has(current)) {
      if (visited.has(current)) {
        throw new TopologyLedgerError('corrupt', 'topology ledger contains an alias cycle')
      }
      visited.add(current)
      current = aliases.get(current)
    }
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
