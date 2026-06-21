import type { BiomeDefinition, WorldRiverSystemDefinition } from '@alohayo/config'
import type { GeneratedRiver } from '@alohayo/map'
import type { Graphics } from 'pixi.js'

export function isWaterBiome(biome: BiomeDefinition | undefined) {
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

export function isBeachBiome(biome: BiomeDefinition | undefined) {
  return Boolean(biome && (biome.id.includes('beach') || biome.id.includes('coast')))
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

function catmullRom(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    ((2 * b) +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
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
  let started = false
  for (const point of points) {
    const x = (point.x - originX) * cellSize + cellSize / 2
    const y = (point.y - originY) * cellSize + cellSize / 2
    if (!started) {
      graphics.moveTo(x, y)
      started = true
    } else {
      graphics.lineTo(x, y)
    }
  }
  if (!started) return
  const bankWidth = river.width + 0.42
  const highlightWidth = Math.max(0.24, river.width * 0.34)
  graphics.stroke({ color: 0x123f66, width: bankWidth, alpha: 0.92 })
  graphics.stroke({ color: 0x4da6d8, width: river.width, alpha: 0.95 })
  graphics.stroke({ color: 0xb9e9ff, width: highlightWidth, alpha: 0.3 + river.flow * 0.18 })
}
