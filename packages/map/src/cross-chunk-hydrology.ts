import type {
  ChunkDrainageSummary,
  DrainageEdgeSample,
  CardinalDirection,
} from './drainage-summary'

export const CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION = 1 as const
export const CROSS_CHUNK_HYDROLOGY_MAX_ALIASES = 20_000
export const CROSS_CHUNK_HYDROLOGY_MAX_SEAMS = 8_192

export interface HydrologySeamPair {
  offset: number
  left: DrainageEdgeSample
  right: DrainageEdgeSample
  consistent: boolean
}

export interface HydrologySeamResult {
  leftChunk: { chunkX: number; chunkY: number }
  rightChunk: { chunkX: number; chunkY: number }
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
  aliases: CrossChunkHydrologyAlias[]
}

export interface CrossChunkRiverSegment {
  id: string
  identityId: string
  chunkX: number
  chunkY: number
  offset: number
  direction: CardinalDirection
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

function sampleKey(chunkX: number, chunkY: number, sample: DrainageEdgeSample) {
  return `${chunkX},${chunkY}:${sample.watershedComponent}`
}

function identityId(token: string) {
  return `topology:${token}`
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

/**
 * Reconciles one cardinal seam without looking beyond the two edge summaries. A sample
 * must be a provisional frontier on both sides and have compatible filled elevation;
 * otherwise it remains retryable instead of being promoted to a false river identity.
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
  const tolerance = Math.max(0, args.elevationTolerance ?? 1)
  const opposite = OPPOSITE[direction]
  const rightByOffset = samplesByOffset(right.edges[opposite])
  const pairs: HydrologySeamPair[] = []
  for (const leftSample of left.edges[direction]) {
    const rightSample = rightByOffset.get(leftSample.localOffset)
    if (!rightSample || !leftSample.crossesFrontier || !rightSample.crossesFrontier) continue
    pairs.push({
      offset: leftSample.localOffset,
      left: leftSample,
      right: rightSample,
      consistent:
        Math.abs(leftSample.filledElevation - rightSample.filledElevation) <= tolerance &&
        leftSample.accumulation > 0 &&
        rightSample.accumulation > 0,
    })
  }
  pairs.sort((a, b) => a.offset - b.offset)
  return {
    leftChunk: { chunkX: left.chunkX, chunkY: left.chunkY },
    rightChunk: { chunkX: right.chunkX, chunkY: right.chunkY },
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
  private readonly seams = new Map<string, HydrologySeamResult>()

  add(summary: ChunkDrainageSummary) {
    const key = `${summary.chunkX},${summary.chunkY}`
    this.summaries.set(key, summary)
    for (const samples of Object.values(summary.edges)) {
      for (const sample of samples) this.ensure(sampleKey(summary.chunkX, summary.chunkY, sample))
    }
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
      this.union(
        sampleKey(left.chunkX, left.chunkY, pair.left),
        sampleKey(right.chunkX, right.chunkY, pair.right)
      )
    }
    return result
  }

  resolve(chunkX: number, chunkY: number, sample: DrainageEdgeSample) {
    const token = sampleKey(chunkX, chunkY, sample)
    if (!this.parents.has(token)) return null
    return identityId(this.find(token))
  }

  segments(): CrossChunkRiverSegment[] {
    const segments: CrossChunkRiverSegment[] = []
    for (const seam of this.seams.values()) {
      for (const pair of seam.pairs) {
        if (!pair.consistent) continue
        const leftFirst =
          seam.leftChunk.chunkY < seam.rightChunk.chunkY ||
          (seam.leftChunk.chunkY === seam.rightChunk.chunkY &&
            seam.leftChunk.chunkX <= seam.rightChunk.chunkX)
        const segmentChunk = leftFirst ? seam.leftChunk : seam.rightChunk
        const segmentSample = leftFirst ? pair.left : pair.right
        const segmentDirection = leftFirst ? seam.direction : OPPOSITE[seam.direction]
        const identity = this.resolve(segmentChunk.chunkX, segmentChunk.chunkY, segmentSample)
        if (!identity) continue
        segments.push({
          id: `river:${identity.slice('topology:'.length)}:${segmentChunk.chunkX},${segmentChunk.chunkY}:${segmentDirection}:${pair.offset}`,
          identityId: identity,
          chunkX: segmentChunk.chunkX,
          chunkY: segmentChunk.chunkY,
          offset: pair.offset,
          direction: segmentDirection,
          accumulation: Math.max(pair.left.accumulation, pair.right.accumulation),
        })
      }
    }
    return segments.sort((a, b) => a.id.localeCompare(b.id))
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
    return { schemaVersion: CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION, aliases }
  }

  rehydrate(snapshot: CrossChunkHydrologySnapshot) {
    if (snapshot.schemaVersion !== CROSS_CHUNK_HYDROLOGY_SCHEMA_VERSION) {
      throw new RangeError('cross-chunk hydrology snapshot version is not supported')
    }
    this.parents.clear()
    for (const alias of snapshot.aliases) {
      const left = alias.aliasId.replace(/^topology:/, '')
      const right = alias.canonicalId.replace(/^topology:/, '')
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
