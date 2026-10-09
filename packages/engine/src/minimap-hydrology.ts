import type { WorldRiverGraphSegment } from '@alohayo/config'

export interface MinimapRiverViewport {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type MinimapRiverSegmentIndex = ReadonlyMap<string, readonly WorldRiverGraphSegment[]>

export function indexRiverGraphSegmentsByChunk(
  segments: readonly WorldRiverGraphSegment[]
): MinimapRiverSegmentIndex {
  const mutable = new Map<string, WorldRiverGraphSegment[]>()
  for (const segment of segments) {
    const key = `${segment.chunkX},${segment.chunkY}`
    const chunkSegments = mutable.get(key) ?? []
    chunkSegments.push(segment)
    mutable.set(key, chunkSegments)
  }
  return new Map(
    Array.from(mutable, ([key, chunkSegments]) => [key, Object.freeze(chunkSegments)] as const)
  )
}

export function selectVisibleRiverGraphSegments(args: {
  index: MinimapRiverSegmentIndex
  chunkSize: number
  viewport: MinimapRiverViewport
  isDiscovered: (x: number, y: number) => boolean
}): WorldRiverGraphSegment[] {
  const { index, chunkSize, viewport, isDiscovered } = args
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError('minimap river chunk size must be a positive integer')
  }
  const minChunkX = Math.floor(viewport.minX / chunkSize)
  const maxChunkX = Math.floor(viewport.maxX / chunkSize)
  const minChunkY = Math.floor(viewport.minY / chunkSize)
  const maxChunkY = Math.floor(viewport.maxY / chunkSize)
  const visible: WorldRiverGraphSegment[] = []
  for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      for (const segment of index.get(`${chunkX},${chunkY}`) ?? []) {
        if (segment.targetKind === 'frontier') continue
        if (
          segment.source.x < viewport.minX ||
          segment.source.x > viewport.maxX ||
          segment.source.y < viewport.minY ||
          segment.source.y > viewport.maxY ||
          segment.target.x < viewport.minX ||
          segment.target.x > viewport.maxX ||
          segment.target.y < viewport.minY ||
          segment.target.y > viewport.maxY
        ) {
          continue
        }
        if (
          !isDiscovered(segment.source.x, segment.source.y) ||
          !isDiscovered(segment.target.x, segment.target.y)
        ) {
          continue
        }
        visible.push(segment)
      }
    }
  }
  return visible
}
