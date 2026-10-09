import type {
  ChunkDrainageSummary,
  DrainageEdgeSample,
  CardinalDirection,
} from './drainage-summary'
import { HYDROLOGY_DIRECTIONS } from './hydrology'

export const CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION = 1 as const
export const CROSS_CHUNK_HYDROLOGY_RESOLVER_VERSION = '1' as const
export const CROSS_CHUNK_HYDROLOGY_MAX_ALIASES = 20_000
export const CROSS_CHUNK_HYDROLOGY_MAX_SEAMS = 8_192
export const CROSS_CHUNK_HYDROLOGY_MAX_BYTES = 2 * 1024 * 1024
export const CROSS_CHUNK_HYDROLOGY_MAX_RIVER_SEGMENTS = 16_384

export interface RetainedHydrologyRaster {
  chunkX: number
  chunkY: number
  chunkSize: number
  flowDirection: Int8Array
  flowAccumulation: Uint32Array
  watershed: Uint32Array
  water: Uint8Array
}

interface RetainedHydrologyBaseline {
  flowDirection: Int8Array
  flowAccumulation: Uint32Array
}

interface RetainedHydrologyCell {
  key: string
  raster: RetainedHydrologyRaster
  index: number
  x: number
  y: number
}

interface AccumulationDeltaSeed {
  x: number
  y: number
  amount: number
}

export interface HydrologySeamPair {
  /** Source offset for the selected handoff; equals the left offset for left-to-right flow. */
  offset: number
  leftOffset: number
  rightOffset: number
  left: DrainageEdgeSample
  right: DrainageEdgeSample
  flow: 'left-to-right' | 'right-to-left' | null
  consistent: boolean
}

export interface HydrologySeamResult {
  leftChunk: { chunkX: number; chunkY: number }
  rightChunk: { chunkX: number; chunkY: number }
  chunkSize: number
  direction: CardinalDirection
  state: 'reconciled'
  pairs: HydrologySeamPair[]
}

export interface CrossChunkHydrologyAlias {
  aliasId: string
  canonicalId: string
}

export interface CrossChunkHydrologySnapshot {
  schemaVersion: typeof CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION
  resolverVersion: typeof CROSS_CHUNK_HYDROLOGY_RESOLVER_VERSION
  aliases: CrossChunkHydrologyAlias[]
}

export class CrossChunkHydrologyLedgerError extends Error {
  constructor(
    readonly code: 'corrupt' | 'incompatible-version' | 'budget-exceeded',
    message: string
  ) {
    super(message)
    this.name = 'CrossChunkHydrologyLedgerError'
  }
}

export interface CrossChunkRiverSegment {
  id: string
  identityId: string
  sourceNodeId: string
  targetNodeId: string
  sourceKind: 'source' | 'channel' | 'confluence' | 'frontier'
  targetKind: 'channel' | 'confluence' | 'outlet' | 'mouth' | 'frontier'
  source: { x: number; y: number }
  target: { x: number; y: number }
  chunkX: number
  chunkY: number
  offset: number
  direction: CardinalDirection | 'north-east' | 'south-east' | 'south-west' | 'north-west'
  accumulation: number
}

const OPPOSITE: Record<CardinalDirection, CardinalDirection> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
}

const ADJACENT: Record<CardinalDirection, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}

const FLOW_DIRECTION: Record<CardinalDirection, number> = {
  east: 0,
  west: 1,
  south: 2,
  north: 3,
}

const DIAGONAL_DIRECTIONS: Record<number, CrossChunkRiverSegment['direction']> = {
  4: 'south-east',
  5: 'north-east',
  6: 'south-west',
  7: 'north-west',
}

const GRAPH_DIRECTIONS: Record<number, CrossChunkRiverSegment['direction']> = {
  0: 'east',
  1: 'west',
  2: 'south',
  3: 'north',
  ...DIAGONAL_DIRECTIONS,
}

const EDGE_ORDER: readonly CardinalDirection[] = ['north', 'east', 'south', 'west']

function sampleKey(chunkX: number, chunkY: number, sample: DrainageEdgeSample) {
  return `${chunkX},${chunkY}:${sample.watershedComponent}`
}

function identityId(token: string) {
  return `watershed:${token}`
}

function isWatershedToken(value: string) {
  return /^-?\d+,-?\d+:\d+$/.test(value)
}

export function emptyCrossChunkHydrologySnapshot(): CrossChunkHydrologySnapshot {
  return {
    schemaVersion: CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION,
    resolverVersion: CROSS_CHUNK_HYDROLOGY_RESOLVER_VERSION,
    aliases: [],
  }
}

export function crossChunkHydrologySnapshotBytes(snapshot: CrossChunkHydrologySnapshot) {
  return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength
}

export function validateCrossChunkHydrologySnapshot(
  snapshot: unknown
): asserts snapshot is CrossChunkHydrologySnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new CrossChunkHydrologyLedgerError('corrupt', 'drainage ledger must be an object')
  }
  const candidate = snapshot as Partial<CrossChunkHydrologySnapshot>
  if (candidate.schemaVersion !== CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION) {
    throw new CrossChunkHydrologyLedgerError(
      'incompatible-version',
      `drainage ledger schema ${String(candidate.schemaVersion)} is not supported`
    )
  }
  if (candidate.resolverVersion !== CROSS_CHUNK_HYDROLOGY_RESOLVER_VERSION) {
    throw new CrossChunkHydrologyLedgerError(
      'incompatible-version',
      `drainage resolver ${String(candidate.resolverVersion)} is not supported`
    )
  }
  if (!Array.isArray(candidate.aliases)) {
    throw new CrossChunkHydrologyLedgerError('corrupt', 'drainage ledger aliases must be an array')
  }
  if (candidate.aliases.length > CROSS_CHUNK_HYDROLOGY_MAX_ALIASES) {
    throw new CrossChunkHydrologyLedgerError('budget-exceeded', 'drainage alias budget exceeded')
  }
  if (
    crossChunkHydrologySnapshotBytes(candidate as CrossChunkHydrologySnapshot) >
    CROSS_CHUNK_HYDROLOGY_MAX_BYTES
  ) {
    throw new CrossChunkHydrologyLedgerError(
      'budget-exceeded',
      'drainage ledger byte budget exceeded'
    )
  }
  const aliases = new Map<string, string>()
  for (const record of candidate.aliases) {
    const alias = record?.aliasId?.replace(/^watershed:/, '') ?? ''
    const canonical = record?.canonicalId?.replace(/^watershed:/, '') ?? ''
    if (
      !record ||
      typeof record.aliasId !== 'string' ||
      typeof record.canonicalId !== 'string' ||
      !record.aliasId.startsWith('watershed:') ||
      !record.canonicalId.startsWith('watershed:') ||
      !isWatershedToken(alias) ||
      !isWatershedToken(canonical) ||
      alias === canonical
    ) {
      throw new CrossChunkHydrologyLedgerError(
        'corrupt',
        'drainage ledger contains an invalid alias'
      )
    }
    if (aliases.has(alias)) {
      throw new CrossChunkHydrologyLedgerError(
        'corrupt',
        'drainage ledger contains a duplicate alias'
      )
    }
    aliases.set(alias, canonical)
  }
  for (const alias of aliases.keys()) {
    const visited = new Set<string>()
    let current: string | undefined = alias
    while (current && aliases.has(current)) {
      if (visited.has(current)) {
        throw new CrossChunkHydrologyLedgerError(
          'corrupt',
          'drainage ledger contains an alias cycle'
        )
      }
      visited.add(current)
      current = aliases.get(current)
    }
  }
}

function compareTokens(left: string, right: string) {
  const parse = (value: string) => {
    const [coordinates = '', component = '0'] = value.split(':')
    const [x = '0', y = '0'] = coordinates.split(',')
    return { x: Number(x), y: Number(y), component: Number(component) }
  }
  const a = parse(left)
  const b = parse(right)
  return a.y - b.y || a.x - b.x || a.component - b.component
}

function samplesByOffset(samples: readonly DrainageEdgeSample[]) {
  return new Map(samples.map((sample) => [sample.localOffset, sample]))
}

function edgeCellWorld(
  chunk: { chunkX: number; chunkY: number },
  direction: CardinalDirection,
  offset: number,
  chunkSize: number
) {
  const originX = chunk.chunkX * chunkSize
  const originY = chunk.chunkY * chunkSize
  if (direction === 'north') return { x: originX + offset, y: originY }
  if (direction === 'east') return { x: originX + chunkSize - 1, y: originY + offset }
  if (direction === 'south') return { x: originX + offset, y: originY + chunkSize - 1 }
  return { x: originX, y: originY + offset }
}

function sampleAtBoundaryCell(
  summary: ChunkDrainageSummary,
  localX: number,
  localY: number
): DrainageEdgeSample | null {
  const last = summary.chunkSize - 1
  if (localY === 0) return summary.edges.north[localX] ?? null
  if (localX === last) return summary.edges.east[localY] ?? null
  if (localY === last) return summary.edges.south[localX] ?? null
  if (localX === 0) return summary.edges.west[localY] ?? null
  return null
}

function riverNodeId(kind: string, point: { x: number; y: number }) {
  return `river:${kind}:${point.x},${point.y}`
}

function sourceKind(
  sample: Pick<DrainageEdgeSample, 'upstreamCount' | 'accumulation'>
): CrossChunkRiverSegment['sourceKind'] {
  if (sample.upstreamCount === 0 && sample.accumulation <= 1) return 'source'
  return sample.upstreamCount >= 2 ? 'confluence' : 'channel'
}

function targetKind(
  sample: Pick<DrainageEdgeSample, 'water' | 'direction' | 'upstreamCount'>,
  loaded = true
): CrossChunkRiverSegment['targetKind'] {
  if (sample.water) return 'mouth'
  if (!loaded) return 'frontier'
  if (sample.direction < 0) return 'outlet'
  return sample.upstreamCount >= 2 ? 'confluence' : 'channel'
}

function flowCrossesEdge(direction: number, edge: CardinalDirection) {
  const [flowX, flowY] = HYDROLOGY_DIRECTIONS[direction] ?? [0, 0]
  const [edgeX, edgeY] = ADJACENT[edge]
  return edgeX === 0 ? flowY === edgeY : flowX === edgeX
}

function targetOffsetForEdge(sourceOffset: number, direction: number, edge: CardinalDirection) {
  const [flowX, flowY] = HYDROLOGY_DIRECTIONS[direction] ?? [0, 0]
  return sourceOffset + (edge === 'east' || edge === 'west' ? flowY : flowX)
}

/**
 * Reconciles one cardinal seam without looking beyond the two edge summaries. Diagonal
 * handoffs adjust the receiving edge offset so single-seam D8 flows remain connected.
 */
export function reconcileDrainageSeam(args: {
  left: ChunkDrainageSummary
  right: ChunkDrainageSummary
  direction: CardinalDirection
  elevationTolerance?: number
}): HydrologySeamResult {
  const { left, right, direction } = args
  const [dx, dy] = ADJACENT[direction]
  if (right.chunkX !== left.chunkX + dx || right.chunkY !== left.chunkY + dy) {
    throw new RangeError('hydrology seam chunks are not adjacent')
  }
  if (left.chunkSize !== right.chunkSize) {
    throw new RangeError('hydrology seam chunk sizes do not match')
  }
  const tolerance = Math.max(0, args.elevationTolerance ?? 1 / 255)
  const opposite = OPPOSITE[direction]
  const leftByOffset = samplesByOffset(left.edges[direction])
  const rightByOffset = samplesByOffset(right.edges[opposite])
  const pairsByOffset = new Map<string, HydrologySeamPair>()
  const addPair = (
    leftOffset: number,
    rightOffset: number,
    leftSample: DrainageEdgeSample,
    rightSample: DrainageEdgeSample,
    flow: HydrologySeamPair['flow']
  ) => {
    const key = `${leftOffset}:${rightOffset}`
    if (pairsByOffset.has(key)) return
    const leftFlows = flow === 'left-to-right'
    const source = leftFlows ? leftSample : rightSample
    const target = leftFlows ? rightSample : leftSample
    const targetReturnsAcross = flowCrossesEdge(target.direction, leftFlows ? opposite : direction)
    pairsByOffset.set(key, {
      offset: leftFlows ? leftOffset : rightOffset,
      leftOffset,
      rightOffset,
      left: leftSample,
      right: rightSample,
      flow,
      consistent: Boolean(
        flow &&
        !source.water &&
        source.accumulation > 0 &&
        !targetReturnsAcross &&
        (target.water || source.accumulation <= target.accumulation) &&
        source.filledElevation + tolerance >= target.filledElevation
      ),
    })
  }
  for (const [offset, leftSample] of leftByOffset) {
    const rightSample = rightByOffset.get(offset)
    if (!rightSample) continue
    const leftFlowsAcross =
      leftSample.crossesFrontier && leftSample.direction === FLOW_DIRECTION[direction]
    const rightFlowsAcross =
      rightSample.crossesFrontier && rightSample.direction === FLOW_DIRECTION[opposite]
    const flow =
      leftFlowsAcross === rightFlowsAcross
        ? null
        : leftFlowsAcross
          ? 'left-to-right'
          : 'right-to-left'
    addPair(offset, offset, leftSample, rightSample, flow)
  }
  for (const [sourceOffset, source] of leftByOffset) {
    if (
      !source.crossesFrontier ||
      !DIAGONAL_DIRECTIONS[source.direction] ||
      !flowCrossesEdge(source.direction, direction)
    ) {
      continue
    }
    const targetOffset = targetOffsetForEdge(sourceOffset, source.direction, direction)
    const target = rightByOffset.get(targetOffset)
    if (targetOffset < 0 || targetOffset >= left.chunkSize || !target) continue
    addPair(sourceOffset, targetOffset, source, target, 'left-to-right')
  }
  for (const [sourceOffset, source] of rightByOffset) {
    if (
      !source.crossesFrontier ||
      !DIAGONAL_DIRECTIONS[source.direction] ||
      !flowCrossesEdge(source.direction, opposite)
    ) {
      continue
    }
    const targetOffset = targetOffsetForEdge(sourceOffset, source.direction, opposite)
    const target = leftByOffset.get(targetOffset)
    if (targetOffset < 0 || targetOffset >= left.chunkSize || !target) continue
    addPair(targetOffset, sourceOffset, target, source, 'right-to-left')
  }
  const pairs = Array.from(pairsByOffset.values())
  pairs.sort(
    (a, b) =>
      a.offset - b.offset ||
      a.leftOffset - b.leftOffset ||
      a.rightOffset - b.rightOffset ||
      (a.flow ?? '').localeCompare(b.flow ?? '')
  )
  return {
    leftChunk: { chunkX: left.chunkX, chunkY: left.chunkY },
    rightChunk: { chunkX: right.chunkX, chunkY: right.chunkY },
    chunkSize: left.chunkSize,
    direction,
    state: 'reconciled',
    pairs,
  }
}

/**
 * Retains only canonical cross-chunk river/watershed aliases. It is intentionally
 * separate from the renderer and can be fed in any neighbor arrival order.
 */
export class CrossChunkHydrologyResolver {
  private readonly parents = new Map<string, string>()
  private readonly summaries = new Map<string, ChunkDrainageSummary>()
  private readonly rasters = new Map<string, RetainedHydrologyRaster>()
  private readonly rasterBaselines = new Map<string, RetainedHydrologyBaseline>()
  private readonly correctedMasks = new Map<string, Uint8Array>()
  private readonly correctedCellIndices = new Map<string, Uint32Array>()
  private readonly propagatedAccumulationDeltas = new Map<string, number>()
  private retainedRasterChunkSize: number | null = null
  private readonly seams = new Map<string, HydrologySeamResult>()
  private readonly diagonalSegments = new Map<
    string,
    {
      chunks: [{ chunkX: number; chunkY: number }, { chunkX: number; chunkY: number }]
      segments: CrossChunkRiverSegment[]
    }
  >()

  add(summary: ChunkDrainageSummary) {
    const key = `${summary.chunkX},${summary.chunkY}`
    this.summaries.set(key, summary)
    for (const samples of Object.values(summary.edges)) {
      for (const sample of samples) this.ensure(sampleKey(summary.chunkX, summary.chunkY, sample))
    }
  }

  addRaster(raster: RetainedHydrologyRaster) {
    const size = raster.chunkSize * raster.chunkSize
    if (
      !Number.isInteger(raster.chunkSize) ||
      raster.chunkSize < 1 ||
      raster.flowDirection.length !== size ||
      raster.flowAccumulation.length !== size ||
      raster.watershed.length !== size ||
      raster.water.length !== size
    ) {
      throw new RangeError('retained hydrology raster buffers must match the chunk dimensions')
    }
    if (
      this.retainedRasterChunkSize !== null &&
      this.retainedRasterChunkSize !== raster.chunkSize
    ) {
      throw new RangeError('retained hydrology chunks must use matching dimensions')
    }
    this.retainedRasterChunkSize = raster.chunkSize
    const key = `${raster.chunkX},${raster.chunkY}`
    this.rasters.set(key, raster)
    if (!this.rasterBaselines.has(key)) {
      this.rasterBaselines.set(key, {
        flowDirection: raster.flowDirection.slice(),
        flowAccumulation: raster.flowAccumulation.slice(),
      })
    }
    if (!this.correctedMasks.has(key)) this.correctedMasks.set(key, new Uint8Array(size))
  }

  setCorrectedMask(chunkX: number, chunkY: number, mask: Uint8Array) {
    const key = `${chunkX},${chunkY}`
    const raster = this.rasters.get(key)
    if (!raster || mask.length !== raster.chunkSize * raster.chunkSize) {
      throw new RangeError('hydrology corrected mask must match a retained chunk')
    }
    this.correctedMasks.set(key, mask)
    const correctedIndices: number[] = []
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index]) correctedIndices.push(index)
    }
    this.correctedCellIndices.set(key, Uint32Array.from(correctedIndices))
  }

  revertRetainedAccumulationDeltas() {
    const changedChunkByKey = new Map<string, { chunkX: number; chunkY: number }>()
    for (const [token, amount] of this.propagatedAccumulationDeltas) {
      const separator = token.lastIndexOf(':')
      const key = token.slice(0, separator)
      const [chunkX, chunkY] = key.split(',').map(Number)
      if (Number.isFinite(chunkX) && Number.isFinite(chunkY)) {
        changedChunkByKey.set(key, { chunkX: chunkX!, chunkY: chunkY! })
      }
      const index = Number(token.slice(separator + 1))
      const raster = this.rasters.get(key)
      if (
        !raster ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= raster.flowAccumulation.length
      ) {
        continue
      }
      raster.flowAccumulation[index] = Math.max(
        0,
        Math.min(0xffff_ffff, raster.flowAccumulation[index]! - amount)
      )
    }
    this.propagatedAccumulationDeltas.clear()
    return Array.from(changedChunkByKey.values()).sort(
      (left, right) => left.chunkY - right.chunkY || left.chunkX - right.chunkX
    )
  }

  recomputeRetainedAccumulationDeltas() {
    const changedChunkByKey = new Map<string, { chunkX: number; chunkY: number }>()
    for (const chunk of this.revertRetainedAccumulationDeltas()) {
      changedChunkByKey.set(`${chunk.chunkX},${chunk.chunkY}`, chunk)
    }
    const currentSeeds: AccumulationDeltaSeed[] = []
    const baselineSeeds: AccumulationDeltaSeed[] = []
    let correctedCells = 0
    for (const [key, raster] of this.rasters) {
      const mask = this.correctedMasks.get(key)
      const correctedIndices = this.correctedCellIndices.get(key)
      const baseline = this.rasterBaselines.get(key)
      if (!mask || !correctedIndices || !baseline) continue
      correctedCells += correctedIndices.length
      const originX = raster.chunkX * raster.chunkSize
      const originY = raster.chunkY * raster.chunkSize
      for (const index of correctedIndices) {
        const x = originX + (index % raster.chunkSize)
        const y = originY + Math.floor(index / raster.chunkSize)
        const currentDirection = raster.flowDirection[index]!
        const baselineDirection = baseline.flowDirection[index]!
        if (currentDirection >= 0) {
          const [dx, dy] = HYDROLOGY_DIRECTIONS[currentDirection] ?? [0, 0]
          const target = this.retainedCellAt(x + dx, y + dy)
          if (
            target &&
            !this.correctedMasks.get(target.key)?.[target.index] &&
            raster.flowAccumulation[index]! > 0
          ) {
            currentSeeds.push({
              x: target.x,
              y: target.y,
              amount: raster.flowAccumulation[index]!,
            })
          }
        }
        if (baselineDirection >= 0) {
          const [dx, dy] = HYDROLOGY_DIRECTIONS[baselineDirection] ?? [0, 0]
          const target = this.retainedCellAt(x + dx, y + dy)
          if (
            target &&
            !this.correctedMasks.get(target.key)?.[target.index] &&
            baseline.flowAccumulation[index]! > 0
          ) {
            baselineSeeds.push({
              x: target.x,
              y: target.y,
              amount: -baseline.flowAccumulation[index]!,
            })
          }
        }
      }
    }
    const currentVisited = this.propagateAccumulationSeeds(
      currentSeeds,
      (cell) => cell.raster.flowDirection[cell.index]!
    )
    const baselineVisited = this.propagateAccumulationSeeds(baselineSeeds, (cell) => {
      return this.rasterBaselines.get(cell.key)?.flowDirection[cell.index] ?? -1
    })
    for (const [token, amount] of this.propagatedAccumulationDeltas) {
      if (amount === 0) this.propagatedAccumulationDeltas.delete(token)
    }
    for (const token of this.propagatedAccumulationDeltas.keys()) {
      const key = token.slice(0, token.lastIndexOf(':'))
      const [chunkX, chunkY] = key.split(',').map(Number)
      if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) continue
      changedChunkByKey.set(key, { chunkX: chunkX!, chunkY: chunkY! })
    }
    const changedChunks = Array.from(changedChunkByKey.values()).sort(
      (left, right) => left.chunkY - right.chunkY || left.chunkX - right.chunkX
    )
    return {
      correctedCells,
      seedCount: currentSeeds.length + baselineSeeds.length,
      visitedCells: currentVisited + baselineVisited,
      changedCells: this.propagatedAccumulationDeltas.size,
      changedChunks,
    }
  }

  private retainedCellAt(x: number, y: number): RetainedHydrologyCell | null {
    const chunkSize = this.retainedRasterChunkSize
    if (chunkSize === null) return null
    const chunkX = Math.floor(x / chunkSize)
    const chunkY = Math.floor(y / chunkSize)
    const key = `${chunkX},${chunkY}`
    const raster = this.rasters.get(key)
    if (!raster) return null
    const localX = x - chunkX * chunkSize
    const localY = y - chunkY * chunkSize
    return { key, raster, index: localY * chunkSize + localX, x, y }
  }

  private propagateAccumulationSeeds(
    seeds: AccumulationDeltaSeed[],
    directionAt: (cell: RetainedHydrologyCell) => number
  ) {
    if (seeds.length === 0) return 0
    seeds.sort((a, b) => a.y - b.y || a.x - b.x || a.amount - b.amount)
    const nodes = new Map<string, { cell: RetainedHydrologyCell; downstream: string | null }>()
    const pendingCells = seeds.flatMap((seed) => {
      const cell = this.retainedCellAt(seed.x, seed.y)
      return cell ? [cell] : []
    })
    for (let cursor = 0; cursor < pendingCells.length; cursor += 1) {
      const cell = pendingCells[cursor]!
      const token = `${cell.key}:${cell.index}`
      if (nodes.has(token)) continue
      const direction = directionAt(cell)
      const vector = HYDROLOGY_DIRECTIONS[direction]
      const downstreamCell = vector
        ? this.retainedCellAt(cell.x + vector[0], cell.y + vector[1])
        : null
      const downstream = downstreamCell ? `${downstreamCell.key}:${downstreamCell.index}` : null
      nodes.set(token, { cell, downstream })
      if (downstreamCell) pendingCells.push(downstreamCell)
    }

    const indegree = new Map(Array.from(nodes.keys(), (token) => [token, 0]))
    for (const node of nodes.values()) {
      if (node.downstream && nodes.has(node.downstream)) {
        indegree.set(node.downstream, (indegree.get(node.downstream) ?? 0) + 1)
      }
    }
    const pendingDeltas = new Map<string, number>()
    for (const seed of seeds) {
      const cell = this.retainedCellAt(seed.x, seed.y)
      if (!cell) continue
      const token = `${cell.key}:${cell.index}`
      pendingDeltas.set(token, (pendingDeltas.get(token) ?? 0) + seed.amount)
    }
    const ready = Array.from(nodes.keys()).filter((token) => indegree.get(token) === 0)
    let processedCells = 0
    for (let cursor = 0; cursor < ready.length; cursor += 1) {
      const token = ready[cursor]!
      const node = nodes.get(token)!
      processedCells += 1
      const requestedDelta = pendingDeltas.get(token) ?? 0
      const current = node.cell.raster.flowAccumulation[node.cell.index]!
      const next = Math.max(0, Math.min(0xffff_ffff, current + requestedDelta))
      const appliedDelta = next - current
      node.cell.raster.flowAccumulation[node.cell.index] = next
      if (appliedDelta !== 0) {
        this.propagatedAccumulationDeltas.set(
          token,
          (this.propagatedAccumulationDeltas.get(token) ?? 0) + appliedDelta
        )
      }
      if (!node.downstream || !nodes.has(node.downstream)) continue
      pendingDeltas.set(node.downstream, (pendingDeltas.get(node.downstream) ?? 0) + appliedDelta)
      const remainingIndegree = (indegree.get(node.downstream) ?? 1) - 1
      indegree.set(node.downstream, remainingIndegree)
      if (remainingIndegree === 0) ready.push(node.downstream)
    }
    return processedCells
  }

  reconcile(left: ChunkDrainageSummary, right: ChunkDrainageSummary, direction: CardinalDirection) {
    this.add(left)
    this.add(right)
    const result = reconcileDrainageSeam({ left, right, direction })
    const seamKey = `${left.chunkX},${left.chunkY}:${direction}`
    this.seams.set(seamKey, result)
    if (this.seams.size > CROSS_CHUNK_HYDROLOGY_MAX_SEAMS) {
      throw new RangeError('cross-chunk hydrology seam budget exceeded')
    }
    for (const pair of result.pairs) {
      if (!pair.consistent) continue
      const leftFlows = pair.flow === 'left-to-right'
      this.union(
        sampleKey(
          leftFlows ? left.chunkX : right.chunkX,
          leftFlows ? left.chunkY : right.chunkY,
          leftFlows ? pair.left : pair.right
        ),
        sampleKey(
          leftFlows ? right.chunkX : left.chunkX,
          leftFlows ? right.chunkY : left.chunkY,
          leftFlows ? pair.right : pair.left
        )
      )
    }
    return result
  }

  /** Links D8 corner flows only when the target sample belongs to the diagonal chunk. */
  reconcileDiagonal(first: ChunkDrainageSummary, second: ChunkDrainageSummary) {
    if (
      Math.abs(first.chunkX - second.chunkX) !== 1 ||
      Math.abs(first.chunkY - second.chunkY) !== 1
    ) {
      throw new RangeError('diagonal hydrology chunks must touch at one corner')
    }
    if (first.chunkSize !== second.chunkSize) {
      throw new RangeError('diagonal hydrology chunk sizes do not match')
    }
    this.add(first)
    this.add(second)

    const pairChunks = [first, second]
      .map(({ chunkX, chunkY }) => ({ chunkX, chunkY }))
      .sort((a, b) => a.chunkY - b.chunkY || a.chunkX - b.chunkX) as [
      { chunkX: number; chunkY: number },
      { chunkX: number; chunkY: number },
    ]
    const pairKey = `${pairChunks[0].chunkX},${pairChunks[0].chunkY}|${pairChunks[1].chunkX},${pairChunks[1].chunkY}`
    const segments: CrossChunkRiverSegment[] = []
    for (const [sourceChunk, targetChunk] of [
      [first, second],
      [second, first],
    ] as const) {
      const targetDeltaX = targetChunk.chunkX - sourceChunk.chunkX
      const targetDeltaY = targetChunk.chunkY - sourceChunk.chunkY
      const targetOriginX = targetChunk.chunkX * targetChunk.chunkSize
      const targetOriginY = targetChunk.chunkY * targetChunk.chunkSize
      for (const edge of EDGE_ORDER) {
        for (const sample of sourceChunk.edges[edge]) {
          if (!sample.crossesFrontier) continue
          const [dx, dy] = HYDROLOGY_DIRECTIONS[sample.direction] ?? [0, 0]
          if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) continue
          if (dx !== targetDeltaX || dy !== targetDeltaY || sample.water) continue
          const source = edgeCellWorld(sourceChunk, edge, sample.localOffset, sourceChunk.chunkSize)
          const target = { x: source.x + dx, y: source.y + dy }
          const localTargetX = target.x - targetOriginX
          const localTargetY = target.y - targetOriginY
          const targetSample = sampleAtBoundaryCell(targetChunk, localTargetX, localTargetY)
          if (
            !targetSample ||
            !(targetSample.water || sample.accumulation <= targetSample.accumulation)
          ) {
            continue
          }
          if (sample.filledElevation + 1 / 255 < targetSample.filledElevation) continue

          const sourceIdentity = sampleKey(sourceChunk.chunkX, sourceChunk.chunkY, sample)
          const targetIdentity = sampleKey(targetChunk.chunkX, targetChunk.chunkY, targetSample)
          this.union(sourceIdentity, targetIdentity)
          const identity = identityId(this.find(sourceIdentity))
          const fromKind = sourceKind(sample)
          const toKind = targetKind(targetSample)
          segments.push({
            id: `river:segment:${source.x},${source.y}>${target.x},${target.y}`,
            identityId: identity,
            sourceNodeId: riverNodeId(fromKind, source),
            targetNodeId: riverNodeId(toKind, target),
            sourceKind: fromKind,
            targetKind: toKind,
            source,
            target,
            chunkX: sourceChunk.chunkX,
            chunkY: sourceChunk.chunkY,
            offset: sample.localOffset,
            direction: DIAGONAL_DIRECTIONS[sample.direction]!,
            accumulation: targetSample.accumulation,
          })
        }
      }
    }
    this.diagonalSegments.set(pairKey, {
      chunks: pairChunks,
      segments: segments.sort((a, b) => a.id.localeCompare(b.id)),
    })
    if (this.diagonalSegments.size + this.seams.size > CROSS_CHUNK_HYDROLOGY_MAX_SEAMS) {
      this.diagonalSegments.delete(pairKey)
      throw new RangeError('cross-chunk hydrology seam budget exceeded')
    }
    return this.diagonalSegments.get(pairKey)!.segments
  }

  release(chunkX: number, chunkY: number) {
    const changedChunks = this.revertRetainedAccumulationDeltas()
    const key = `${chunkX},${chunkY}`
    this.summaries.delete(key)
    this.rasters.delete(key)
    this.rasterBaselines.delete(key)
    this.correctedMasks.delete(key)
    this.correctedCellIndices.delete(key)
    if (this.rasters.size === 0) this.retainedRasterChunkSize = null
    for (const [seamKey, seam] of this.seams) {
      if (
        (seam.leftChunk.chunkX === chunkX && seam.leftChunk.chunkY === chunkY) ||
        (seam.rightChunk.chunkX === chunkX && seam.rightChunk.chunkY === chunkY)
      ) {
        this.seams.delete(seamKey)
      }
    }
    for (const [pairKey, pair] of this.diagonalSegments) {
      if (pair.chunks.some((chunk) => chunk.chunkX === chunkX && chunk.chunkY === chunkY)) {
        this.diagonalSegments.delete(pairKey)
      }
    }
    const referencedRoots = new Set<string>()
    for (const [alias, parent] of this.parents) {
      if (alias !== parent) referencedRoots.add(this.find(parent))
    }
    for (const [token, parent] of this.parents) {
      if (parent !== token || token.split(':', 1)[0] !== key || referencedRoots.has(token)) continue
      this.parents.delete(token)
    }
    return changedChunks
  }

  resolve(chunkX: number, chunkY: number, sample: DrainageEdgeSample) {
    const token = sampleKey(chunkX, chunkY, sample)
    if (!this.parents.has(token)) return null
    return identityId(this.find(token))
  }

  resolveComponent(chunkX: number, chunkY: number, watershedComponent: number) {
    const token = `${chunkX},${chunkY}:${watershedComponent}`
    return identityId(this.parents.has(token) ? this.find(token) : token)
  }

  segments(): CrossChunkRiverSegment[] {
    const segments: CrossChunkRiverSegment[] = []
    for (const seam of this.seams.values()) {
      for (const pair of seam.pairs) {
        if (!pair.consistent) continue
        const leftFlows = pair.flow === 'left-to-right'
        const sourceChunk = leftFlows ? seam.leftChunk : seam.rightChunk
        const targetChunk = leftFlows ? seam.rightChunk : seam.leftChunk
        const sourceSample = leftFlows ? pair.left : pair.right
        const targetSample = leftFlows ? pair.right : pair.left
        const sourceOffset = leftFlows ? pair.leftOffset : pair.rightOffset
        const targetOffset = leftFlows ? pair.rightOffset : pair.leftOffset
        const sourceDirection = leftFlows ? seam.direction : OPPOSITE[seam.direction]
        const targetDirection = OPPOSITE[sourceDirection]
        const source = edgeCellWorld(sourceChunk, sourceDirection, sourceOffset, seam.chunkSize)
        const target = edgeCellWorld(targetChunk, targetDirection, targetOffset, seam.chunkSize)
        const identity = this.resolve(sourceChunk.chunkX, sourceChunk.chunkY, sourceSample)
        if (!identity) continue
        const fromKind = sourceKind(sourceSample)
        const toKind = targetKind(targetSample)
        const sourceNodeId = riverNodeId(fromKind, source)
        const targetNodeId = riverNodeId(toKind, target)
        segments.push({
          id: `river:segment:${source.x},${source.y}>${target.x},${target.y}`,
          identityId: identity,
          sourceNodeId,
          targetNodeId,
          sourceKind: fromKind,
          targetKind: toKind,
          source,
          target,
          chunkX: sourceChunk.chunkX,
          chunkY: sourceChunk.chunkY,
          offset: sourceOffset,
          direction: GRAPH_DIRECTIONS[sourceSample.direction] ?? sourceDirection,
          accumulation: targetSample.accumulation,
        })
      }
    }
    segments.push(...Array.from(this.diagonalSegments.values()).flatMap((pair) => pair.segments))
    return segments.sort((a, b) => a.id.localeCompare(b.id))
  }

  retainedRiverGraph(
    minimumAccumulation = 1,
    maxSegments = CROSS_CHUNK_HYDROLOGY_MAX_RIVER_SEGMENTS
  ) {
    if (!Number.isFinite(minimumAccumulation) || minimumAccumulation < 0) {
      throw new RangeError('minimum river accumulation must be a finite non-negative number')
    }
    const segmentLimit = Math.max(
      0,
      Math.min(
        CROSS_CHUNK_HYDROLOGY_MAX_RIVER_SEGMENTS,
        Number.isFinite(maxSegments)
          ? Math.floor(maxSegments)
          : CROSS_CHUNK_HYDROLOGY_MAX_RIVER_SEGMENTS
      )
    )
    const upstreamCounts = new Map<string, Uint8Array>()
    for (const [key, raster] of this.rasters) {
      upstreamCounts.set(key, new Uint8Array(raster.chunkSize * raster.chunkSize))
    }
    for (const raster of this.rasters.values()) {
      const originX = raster.chunkX * raster.chunkSize
      const originY = raster.chunkY * raster.chunkSize
      for (let index = 0; index < raster.flowDirection.length; index += 1) {
        const direction = raster.flowDirection[index]!
        const [dx, dy] = HYDROLOGY_DIRECTIONS[direction] ?? [0, 0]
        if (direction < 0 || (dx === 0 && dy === 0)) continue
        const targetX = originX + (index % raster.chunkSize) + dx
        const targetY = originY + Math.floor(index / raster.chunkSize) + dy
        const targetChunkX = Math.floor(targetX / raster.chunkSize)
        const targetChunkY = Math.floor(targetY / raster.chunkSize)
        const targetKey = `${targetChunkX},${targetChunkY}`
        const targetRaster = this.rasters.get(targetKey)
        const targetCounts = upstreamCounts.get(targetKey)
        if (!targetRaster || !targetCounts) continue
        const localX = targetX - targetChunkX * raster.chunkSize
        const localY = targetY - targetChunkY * raster.chunkSize
        const targetIndex = localY * raster.chunkSize + localX
        const targetCount = targetCounts[targetIndex] ?? 0
        if (targetCount < 255) targetCounts[targetIndex] = targetCount + 1
      }
    }

    for (const summary of this.summaries.values()) {
      const targetCounts = upstreamCounts.get(`${summary.chunkX},${summary.chunkY}`)
      if (!targetCounts) continue
      for (const inflow of summary.frontierInflows ?? []) {
        if (this.retainedCellAt(inflow.source.x, inflow.source.y)) continue
        const target = this.retainedCellAt(inflow.target.x, inflow.target.y)
        if (!target || target.key !== `${summary.chunkX},${summary.chunkY}`) continue
        const count = targetCounts[target.index] ?? 0
        if (count < 255) targetCounts[target.index] = count + 1
      }
    }

    const byId = new Map(this.segments().map((segment) => [segment.id, segment]))
    for (const [key, raster] of this.rasters) {
      const originX = raster.chunkX * raster.chunkSize
      const originY = raster.chunkY * raster.chunkSize
      const counts = upstreamCounts.get(key)!
      for (let index = 0; index < raster.flowDirection.length; index += 1) {
        const direction = raster.flowDirection[index]!
        const vector = HYDROLOGY_DIRECTIONS[direction]
        const accumulation = raster.flowAccumulation[index]!
        if (!vector || direction < 0 || raster.water[index] || accumulation < minimumAccumulation) {
          continue
        }
        const [dx, dy] = vector
        const source = {
          x: originX + (index % raster.chunkSize),
          y: originY + Math.floor(index / raster.chunkSize),
        }
        const target = { x: source.x + dx, y: source.y + dy }
        const targetChunkX = Math.floor(target.x / raster.chunkSize)
        const targetChunkY = Math.floor(target.y / raster.chunkSize)
        const targetKey = `${targetChunkX},${targetChunkY}`
        const targetRaster = this.rasters.get(targetKey)
        const targetIndex =
          (target.y - targetChunkY * raster.chunkSize) * raster.chunkSize +
          (target.x - targetChunkX * raster.chunkSize)
        const targetDirection = targetRaster?.flowDirection[targetIndex] ?? -1
        const targetUpstreamCount = upstreamCounts.get(targetKey)?.[targetIndex] ?? 0
        const loaded = Boolean(targetRaster)
        const fromKind = sourceKind({ upstreamCount: counts[index]!, accumulation })
        const toKind = targetKind(
          {
            water: Boolean(targetRaster?.water[targetIndex]),
            direction: targetDirection,
            upstreamCount: targetUpstreamCount,
          },
          loaded
        )
        const identityId = this.resolveComponent(
          raster.chunkX,
          raster.chunkY,
          raster.watershed[index]!
        )
        const sourceNodeId = riverNodeId(fromKind, source)
        const targetNodeId = riverNodeId(toKind, target)
        const id = `river:segment:${source.x},${source.y}>${target.x},${target.y}`
        byId.set(id, {
          id,
          identityId,
          sourceNodeId,
          targetNodeId,
          sourceKind: fromKind,
          targetKind: toKind,
          source,
          target,
          chunkX: raster.chunkX,
          chunkY: raster.chunkY,
          offset: index,
          direction: GRAPH_DIRECTIONS[direction]!,
          accumulation: targetRaster?.flowAccumulation[targetIndex] ?? accumulation,
        })
      }
    }

    for (const summary of this.summaries.values()) {
      const chunkKey = `${summary.chunkX},${summary.chunkY}`
      const targetCounts = upstreamCounts.get(chunkKey)
      if (!targetCounts) continue
      for (const inflow of summary.frontierInflows ?? []) {
        if (inflow.sourceAccumulation < minimumAccumulation) continue
        if (this.retainedCellAt(inflow.source.x, inflow.source.y)) continue
        const target = this.retainedCellAt(inflow.target.x, inflow.target.y)
        if (!target || target.key !== chunkKey) continue
        const { raster, index: targetIndex } = target
        const targetKindValue = targetKind(
          {
            water: Boolean(raster.water[targetIndex]),
            direction: raster.flowDirection[targetIndex]!,
            upstreamCount: targetCounts[targetIndex]!,
          },
          true
        )
        const id = `river:segment:${inflow.source.x},${inflow.source.y}>${inflow.target.x},${inflow.target.y}`
        byId.set(id, {
          id,
          identityId: this.resolveComponent(
            summary.chunkX,
            summary.chunkY,
            raster.watershed[targetIndex]!
          ),
          sourceNodeId: riverNodeId('frontier', inflow.source),
          targetNodeId: riverNodeId(targetKindValue, inflow.target),
          sourceKind: 'frontier',
          targetKind: targetKindValue,
          source: { ...inflow.source },
          target: { ...inflow.target },
          chunkX: summary.chunkX,
          chunkY: summary.chunkY,
          offset: targetIndex,
          direction: GRAPH_DIRECTIONS[inflow.direction]!,
          accumulation: raster.flowAccumulation[targetIndex] ?? inflow.sourceAccumulation,
        })
      }
    }
    const segments = Array.from(byId.values()).sort(
      (a, b) => a.source.y - b.source.y || a.source.x - b.source.x || a.id.localeCompare(b.id)
    )
    return {
      segments: segments.slice(0, segmentLimit),
      truncated: segments.length > segmentLimit,
    }
  }

  exportSnapshot(): CrossChunkHydrologySnapshot {
    const aliases = Array.from(this.parents.keys())
      .sort(compareTokens)
      .flatMap((token): CrossChunkHydrologyAlias[] => {
        const canonical = this.find(token)
        return canonical === token
          ? []
          : [{ aliasId: identityId(token), canonicalId: identityId(canonical) }]
      })
    const snapshot = {
      schemaVersion: CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION,
      resolverVersion: CROSS_CHUNK_HYDROLOGY_RESOLVER_VERSION,
      aliases,
    } satisfies CrossChunkHydrologySnapshot
    validateCrossChunkHydrologySnapshot(snapshot)
    return snapshot
  }

  rehydrate(snapshot: CrossChunkHydrologySnapshot) {
    validateCrossChunkHydrologySnapshot(snapshot)
    this.parents.clear()
    for (const alias of snapshot.aliases) {
      const left = alias.aliasId.replace(/^watershed:/, '')
      const right = alias.canonicalId.replace(/^watershed:/, '')
      this.ensure(left)
      this.ensure(right)
      this.parents.set(left, right)
    }
  }

  private ensure(token: string) {
    if (!this.parents.has(token)) this.parents.set(token, token)
  }

  private find(token: string): string {
    const parent = this.parents.get(token) ?? token
    if (parent === token) return token
    const root = this.find(parent)
    this.parents.set(token, root)
    return root
  }

  private union(left: string, right: string) {
    this.ensure(left)
    this.ensure(right)
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot === rightRoot) return
    const canonical = compareTokens(leftRoot, rightRoot) <= 0 ? leftRoot : rightRoot
    const alias = canonical === leftRoot ? rightRoot : leftRoot
    if (this.exportSnapshot().aliases.length >= CROSS_CHUNK_HYDROLOGY_MAX_ALIASES) {
      throw new RangeError('cross-chunk hydrology alias budget exceeded')
    }
    this.parents.set(alias, canonical)
  }
}
