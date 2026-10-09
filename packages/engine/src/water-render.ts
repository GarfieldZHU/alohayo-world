import type {
  BiomeDefinition,
  WorldRiverGraphSegment,
  WorldRiverSystemDefinition,
} from '@alohayo/config'
import { extractMaskContours, type GeneratedRiver } from '@alohayo/map'
import type { Graphics } from 'pixi.js'

export function isWaterBiome(biome: BiomeDefinition | null | undefined) {
  return Boolean(
    biome &&
    (biome.id.includes('ocean') ||
      biome.id.includes('sea') ||
      biome.id.includes('coast') ||
      biome.id.includes('beach') ||
      biome.id.includes('lake') ||
      biome.id.includes('reef') ||
      biome.id.includes('marsh') ||
      biome.id.includes('wetland'))
  )
}

export function isBeachBiome(biome: BiomeDefinition | null | undefined) {
  return Boolean(biome && (biome.id.includes('beach') || biome.id.includes('coast')))
}

export type WaterMaterialKind =
  | 'deep-ocean'
  | 'ocean-shelf'
  | 'beach'
  | 'cliff'
  | 'lake-bank'
  | 'estuary'
  | 'delta'
  | 'marsh'
  | 'reef'

export function classifyWaterMaterial(
  biome: BiomeDefinition,
  shoreDistance: number,
  context: {
    slope: number
    deposition: number
    floodplain: number
    river: boolean
  }
): WaterMaterialKind {
  const nearShore = shoreDistance >= -3
  if (biome.id.includes('reef')) return 'reef'
  if (biome.id.includes('marsh') || biome.id.includes('wetland')) return 'marsh'
  if (context.river && nearShore && context.deposition >= 144 && context.floodplain > 0) {
    return 'delta'
  }
  if (context.river && nearShore) return 'estuary'
  if (nearShore && context.slope >= 144) return 'cliff'
  if (biome.id.includes('lake') && nearShore) return 'lake-bank'
  if (isBeachBiome(biome)) return 'beach'
  if (biome.id.includes('shallow-sea') || nearShore) return 'ocean-shelf'
  return 'deep-ocean'
}

function drawContourPath(graphics: Graphics, contour: Float32Array, cellSize: number) {
  if (contour.length < 4) return false
  graphics.moveTo(contour[0]! * cellSize, contour[1]! * cellSize)
  for (let index = 2; index < contour.length; index += 2) {
    graphics.lineTo(contour[index]! * cellSize, contour[index + 1]! * cellSize)
  }
  return true
}

export function drawWaterContours(
  graphics: Graphics,
  chunkSize: number,
  cellSize: number,
  biomeAt: (localX: number, localY: number) => BiomeDefinition | null | undefined
) {
  const sampledBiomes = new Map<string, BiomeDefinition | null | undefined>()
  const sampleBiome = (x: number, y: number) => {
    const key = `${x},${y}`
    if (!sampledBiomes.has(key)) sampledBiomes.set(key, biomeAt(x, y))
    return sampledBiomes.get(key)
  }
  const contours = extractMaskContours({
    width: chunkSize,
    height: chunkSize,
    isKnown: (x, y) => sampleBiome(x, y) != null,
    isInside: (x, y) => isWaterBiome(sampleBiome(x, y)),
    smoothingPasses: 3,
  })
  const layers = [
    { color: 0xd9c18a, width: Math.max(1.8, cellSize * 0.34), alpha: 0.52 },
    { color: 0x58a9c7, width: Math.max(1.15, cellSize * 0.2), alpha: 0.38 },
    { color: 0xf5f2e6, width: Math.max(0.55, cellSize * 0.075), alpha: 0.54 },
  ]
  for (const layer of layers) {
    for (const contour of contours) {
      if (drawContourPath(graphics, contour, cellSize)) graphics.stroke(layer)
    }
  }
  return contours.length
}

export function drawBoundaryBlend(
  graphics: Graphics,
  direction: 'east' | 'south',
  originX: number,
  originY: number,
  cellSize: number,
  noise: number,
  fromBiome: BiomeDefinition,
  toBiome: BiomeDefinition
) {
  const waterBoundary = isWaterBiome(fromBiome) !== isWaterBiome(toBiome)
  const band = Math.max(1.2, cellSize * 0.26)
  const accentBand = Math.max(0.8, cellSize * 0.14)
  if (!waterBoundary) {
    if (direction === 'east') {
      graphics
        .roundRect(originX + cellSize - band, originY, band * 1.15, cellSize, band * 0.55)
        .fill({ color: toBiome.color, alpha: 0.22 })
        .roundRect(
          originX + cellSize - accentBand,
          originY + (noise % Math.max(1, cellSize - 1)),
          accentBand * 1.1,
          Math.max(1, cellSize * 0.35),
          accentBand * 0.5
        )
        .fill({ color: toBiome.accent, alpha: 0.26 })
    } else {
      graphics
        .roundRect(originX, originY + cellSize - band, cellSize, band * 1.15, band * 0.55)
        .fill({ color: toBiome.color, alpha: 0.22 })
        .roundRect(
          originX + ((noise >>> 4) % Math.max(1, cellSize - 1)),
          originY + cellSize - accentBand,
          Math.max(1, cellSize * 0.35),
          accentBand * 1.1,
          accentBand * 0.5
        )
        .fill({ color: toBiome.accent, alpha: 0.26 })
    }
    return
  }

  const landBiome = isWaterBiome(fromBiome) ? toBiome : fromBiome
  const waterBiome = isWaterBiome(fromBiome) ? fromBiome : toBiome
  const shoreColor = isBeachBiome(fromBiome)
    ? fromBiome.color
    : isBeachBiome(toBiome)
      ? toBiome.color
      : 0xd9c18a
  const foamColor = 0xf5f2e6
  const waterAccent = waterBiome.accent
  const foamBand = Math.max(0.9, cellSize * 0.1)

  if (direction === 'east') {
    graphics
      .roundRect(originX + cellSize - band, originY - 0.1, band * 1.35, cellSize + 0.2, band * 0.66)
      .fill({ color: shoreColor, alpha: 0.42 })
    for (let step = 0; step < 3; step += 1) {
      const y = originY + ((noise >>> (step * 3 + 1)) % Math.max(1, cellSize - 1)) + 0.5
      const radius = Math.max(0.8, cellSize * (0.1 + step * 0.03))
      graphics
        .circle(originX + cellSize - band * 0.35 + step * band * 0.16, y, radius)
        .fill({ color: foamColor, alpha: 0.14 + step * 0.03 })
    }
    graphics
      .roundRect(originX + cellSize - foamBand * 1.2, originY, foamBand * 1.8, cellSize, foamBand)
      .fill({ color: waterAccent, alpha: 0.18 })
  } else {
    graphics
      .roundRect(originX - 0.1, originY + cellSize - band, cellSize + 0.2, band * 1.35, band * 0.66)
      .fill({ color: shoreColor, alpha: 0.42 })
    for (let step = 0; step < 3; step += 1) {
      const x = originX + ((noise >>> (step * 3 + 1)) % Math.max(1, cellSize - 1)) + 0.5
      const radius = Math.max(0.8, cellSize * (0.1 + step * 0.03))
      graphics
        .circle(x, originY + cellSize - band * 0.35 + step * band * 0.16, radius)
        .fill({ color: foamColor, alpha: 0.14 + step * 0.03 })
    }
    graphics
      .roundRect(originX, originY + cellSize - foamBand * 1.2, cellSize, foamBand * 1.8, foamBand)
      .fill({ color: waterAccent, alpha: 0.18 })
  }

  if (!isBeachBiome(landBiome)) {
    const duneBand = Math.max(0.6, cellSize * 0.08)
    if (direction === 'east') {
      graphics
        .roundRect(
          originX + cellSize - band * 1.3,
          originY + cellSize * 0.14,
          duneBand,
          cellSize * 0.72,
          duneBand
        )
        .fill({ color: landBiome.accent, alpha: 0.14 })
    } else {
      graphics
        .roundRect(
          originX + cellSize * 0.14,
          originY + cellSize - band * 1.3,
          cellSize * 0.72,
          duneBand,
          duneBand
        )
        .fill({ color: landBiome.accent, alpha: 0.14 })
    }
  }
}

export function drawWaterCloseDetail(
  graphics: Graphics,
  originX: number,
  originY: number,
  cellSize: number,
  noise: number,
  accentColor: number
) {
  const centerX = originX + cellSize / 2
  const centerY = originY + cellSize / 2
  const angle = ((noise % 9) - 4) * 0.12
  const halfLength = Math.max(0.8, cellSize * 0.26)
  const dx = Math.cos(angle) * halfLength
  const dy = Math.sin(angle) * halfLength * 0.35
  graphics
    .moveTo(centerX - dx, centerY - dy)
    .lineTo(centerX + dx, centerY + dy)
    .stroke({ color: accentColor, width: 0.45, alpha: 0.68 })
}

/** A subtle material band driven by the map's signed shoreline hint. */
export function drawWaterMaterialBand(
  graphics: Graphics,
  originX: number,
  originY: number,
  cellSize: number,
  shoreDistance: number,
  accentColor: number,
  material: WaterMaterialKind,
  noise: number
) {
  if (shoreDistance > 0) return
  const depth = Math.abs(shoreDistance)
  const materialStyle: Record<WaterMaterialKind, { color: number; alpha: number }> = {
    'deep-ocean': { color: accentColor, alpha: 0.018 },
    'ocean-shelf': { color: accentColor, alpha: depth === 0 ? 0.065 : 0.036 },
    beach: { color: 0xf5e5b8, alpha: 0.064 },
    cliff: { color: 0x16384d, alpha: 0.11 },
    'lake-bank': { color: 0x8ed4d8, alpha: 0.052 },
    estuary: { color: 0x83c7bf, alpha: 0.064 },
    delta: { color: 0xc7ad78, alpha: 0.082 },
    marsh: { color: 0x789d78, alpha: 0.07 },
    reef: { color: 0x71e0cf, alpha: 0.075 },
  }
  const style = materialStyle[material]
  graphics
    .rect(originX, originY, cellSize, cellSize)
    .fill({ color: style.color, alpha: style.alpha })

  if (material === 'reef' || material === 'marsh' || material === 'delta') {
    const radius = Math.max(0.3, cellSize * (material === 'reef' ? 0.08 : 0.055))
    const x = originX + cellSize * (0.25 + ((noise >>> 5) % 50) / 100)
    const y = originY + cellSize * (0.25 + ((noise >>> 11) % 50) / 100)
    graphics.circle(x, y, radius).fill({
      color: material === 'delta' ? 0xe4cf9d : material === 'reef' ? 0xb9fff1 : 0xb6cf9a,
      alpha: 0.22,
    })
  } else if (material === 'cliff' && depth <= 1) {
    graphics
      .rect(originX, originY, cellSize, Math.max(0.35, cellSize * 0.08))
      .fill({ color: 0x0e2637, alpha: 0.2 })
  }
}

function catmullRom(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  )
}

function smoothPolyline(points: Array<{ x: number; y: number }>, samples: number) {
  if (points.length < 3 || samples <= 1) return points
  const smoothed: Array<{ x: number; y: number }> = [points[0]!]
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]!
    const start = points[index]!
    const end = points[index + 1]!
    const next = points[index + 2] ?? points[index + 1]!
    for (let sample = 1; sample <= samples; sample += 1) {
      const t = sample / samples
      smoothed.push({
        x: catmullRom(previous.x, start.x, end.x, next.x, t),
        y: catmullRom(previous.y, start.y, end.y, next.y, t),
      })
    }
  }
  return smoothed
}

export function drawRiver(
  graphics: Graphics,
  river: GeneratedRiver,
  originX: number,
  originY: number,
  cellSize: number,
  riverSystem?: WorldRiverSystemDefinition
) {
  const smoothingSamples = riverSystem?.generation.smoothingSamples ?? 2
  const points = smoothPolyline(river.points, Math.max(2, smoothingSamples))
  if (points.length < 2) return
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!
    const point = points[index]!
    const progress = index / Math.max(1, points.length - 1)
    const profileWidth = river.width * (0.72 + progress * (0.38 + river.flow * 0.16))
    const startX = (previous.x - originX) * cellSize + cellSize / 2
    const startY = (previous.y - originY) * cellSize + cellSize / 2
    const endX = (point.x - originX) * cellSize + cellSize / 2
    const endY = (point.y - originY) * cellSize + cellSize / 2
    const bankWidth = profileWidth + 0.42
    const highlightWidth = Math.max(0.22, profileWidth * 0.28)
    graphics
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: 0x123f66, width: bankWidth, alpha: 0.92 })
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: 0x4da6d8, width: profileWidth, alpha: 0.95 })
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({
        color: 0xb9e9ff,
        width: highlightWidth,
        alpha: 0.24 + river.flow * 0.2 + progress * 0.08,
      })
  }
}

export interface RiverGraphRenderLine {
  fromX: number
  fromY: number
  toX: number
  toY: number
  accumulation: number
}

export type RiverGraphRenderIndex = ReadonlyMap<string, readonly RiverGraphRenderLine[]>

const riverGraphPointKey = (point: { x: number; y: number }) => `${point.x},${point.y}`

function riverGraphMajorThreshold(riverSystem: WorldRiverSystemDefinition) {
  const minimumAccumulation = Math.max(4, Math.floor(riverSystem.generation.minLength * 0.75))
  return Math.max(minimumAccumulation + 2, Math.floor(riverSystem.generation.minLength * 1.8))
}

/**
 * Turns retained D8 links into smoothed presentation lines, clipped to their
 * rendered chunk. The authoritative graph remains unsmoothed.
 */
export function indexRiverGraphRenderLines(
  segments: readonly WorldRiverGraphSegment[],
  chunkSize: number,
  smoothingSamples: number,
  targetChunk?: { chunkX: number; chunkY: number }
): RiverGraphRenderIndex {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError('river render chunk size must be a positive integer')
  }
  const orderedSegments = [...segments].sort((left, right) => left.id.localeCompare(right.id))
  const outgoing = new Map<string, WorldRiverGraphSegment>()
  const incomingCount = new Map<string, number>()
  for (const segment of orderedSegments) {
    const sourceKey = riverGraphPointKey(segment.source)
    if (!outgoing.has(sourceKey)) outgoing.set(sourceKey, segment)
    const targetKey = riverGraphPointKey(segment.target)
    incomingCount.set(targetKey, (incomingCount.get(targetKey) ?? 0) + 1)
  }

  const visited = new Set<string>()
  const mutableIndex = new Map<string, RiverGraphRenderLine[]>()
  const sampleCount = Math.max(2, Math.min(8, Math.floor(smoothingSamples) || 2))
  const targetChunkKey = targetChunk ? `${targetChunk.chunkX},${targetChunk.chunkY}` : null

  const appendPath = (pathSegments: WorldRiverGraphSegment[]) => {
    if (pathSegments.length === 0) return
    const points = [pathSegments[0]!.source, ...pathSegments.map((segment) => segment.target)]
    const smoothPoints = smoothPolyline(points, sampleCount)
    for (let index = 1; index < smoothPoints.length; index += 1) {
      const from = smoothPoints[index - 1]!
      const to = smoothPoints[index]!
      const edgeIndex = Math.min(pathSegments.length - 1, Math.floor((index - 1) / sampleCount))
      const startX = from.x + 0.5
      const startY = from.y + 0.5
      const deltaX = to.x - from.x
      const deltaY = to.y - from.y
      const splitParameters = [0, 1]
      const addBoundarySplits = (start: number, delta: number) => {
        if (delta === 0) return
        const end = start + delta
        const minimum = Math.min(start, end)
        const maximum = Math.max(start, end)
        for (
          let boundaryIndex = Math.floor(minimum / chunkSize) + 1;
          boundaryIndex * chunkSize < maximum;
          boundaryIndex += 1
        ) {
          const parameter = (boundaryIndex * chunkSize - start) / delta
          if (parameter > 0 && parameter < 1) splitParameters.push(parameter)
        }
      }
      addBoundarySplits(startX, deltaX)
      addBoundarySplits(startY, deltaY)
      splitParameters.sort((left, right) => left - right)
      for (let splitIndex = 1; splitIndex < splitParameters.length; splitIndex += 1) {
        const fromParameter = splitParameters[splitIndex - 1]!
        const toParameter = splitParameters[splitIndex]!
        if (toParameter - fromParameter <= Number.EPSILON) continue
        const middleParameter = (fromParameter + toParameter) / 2
        const midpointX = startX + deltaX * middleParameter
        const midpointY = startY + deltaY * middleParameter
        const key = `${Math.floor(midpointX / chunkSize)},${Math.floor(midpointY / chunkSize)}`
        if (targetChunkKey && key !== targetChunkKey) continue
        const lines = mutableIndex.get(key) ?? []
        lines.push({
          fromX: startX + deltaX * fromParameter - 0.5,
          fromY: startY + deltaY * fromParameter - 0.5,
          toX: startX + deltaX * toParameter - 0.5,
          toY: startY + deltaY * toParameter - 0.5,
          accumulation: pathSegments[edgeIndex]!.accumulation,
        })
        mutableIndex.set(key, lines)
      }
    }
  }

  const traceFrom = (first: WorldRiverGraphSegment) => {
    const path: WorldRiverGraphSegment[] = []
    let current: WorldRiverGraphSegment | undefined = first
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      path.push(current)
      if (current.targetKind === 'frontier') break
      const targetKey = riverGraphPointKey(current.target)
      if (incomingCount.get(targetKey) !== 1) break
      const next = outgoing.get(targetKey)
      if (!next || visited.has(next.id)) break
      current = next
    }
    appendPath(path)
  }

  for (const segment of orderedSegments) {
    if ((incomingCount.get(riverGraphPointKey(segment.source)) ?? 0) !== 1) traceFrom(segment)
  }
  for (const segment of orderedSegments) {
    if (!visited.has(segment.id)) traceFrom(segment)
  }

  return new Map(Array.from(mutableIndex, ([key, lines]) => [key, Object.freeze(lines)] as const))
}

/** Draws graph-derived river lines while keeping the graph itself as the authority. */
export function drawRiverGraphLines(
  graphics: Graphics,
  lines: readonly RiverGraphRenderLine[],
  originX: number,
  originY: number,
  cellSize: number,
  riverSystem?: WorldRiverSystemDefinition
) {
  if (lines.length === 0 || !riverSystem) return
  const majorThreshold = riverGraphMajorThreshold(riverSystem)
  const groups = [
    {
      lines: lines.filter((line) => line.accumulation < majorThreshold),
      width: riverSystem.renderWidth.minor,
      highlightAlpha: 0.3,
    },
    {
      lines: lines.filter((line) => line.accumulation >= majorThreshold),
      width: riverSystem.renderWidth.major,
      highlightAlpha: 0.42,
    },
  ]

  for (const group of groups) {
    if (group.lines.length === 0) continue
    const appendLines = () => {
      for (const line of group.lines) {
        graphics
          .moveTo((line.fromX - originX + 0.5) * cellSize, (line.fromY - originY + 0.5) * cellSize)
          .lineTo((line.toX - originX + 0.5) * cellSize, (line.toY - originY + 0.5) * cellSize)
      }
    }
    appendLines()
    graphics.stroke({ color: 0x123f66, width: group.width + 0.42, alpha: 0.92 })
    appendLines()
    graphics.stroke({ color: 0x4da6d8, width: group.width, alpha: 0.95 })
    appendLines()
    graphics.stroke({
      color: 0xb9e9ff,
      width: Math.max(0.22, group.width * 0.28),
      alpha: group.highlightAlpha,
    })
  }
}
