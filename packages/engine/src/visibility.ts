import type { Graphics } from 'pixi.js'

export const VISION_ACTION_THRESHOLD = 0.5

interface VisionSampleOptions {
  pointX: number
  pointY: number
  sourceX: number
  sourceY: number
  radius: number
  softness?: number
  noiseStrength?: number
}

interface ChunkVisionSampleOptions {
  localPointX: number
  localPointY: number
  localSourceX: number
  localSourceY: number
  chunkOriginX: number
  chunkOriginY: number
  radius: number
  softness?: number
  noiseStrength?: number
}

interface SmoothDiscoveryFogOptions {
  fill: Graphics
  cutout: Graphics
  discovered: Uint8Array
  chunkSize: number
  cellSize: number
  chunkOriginX: number
  chunkOriginY: number
  fogColor: number
  hiddenAlpha: number
  activeVision?: {
    sourceX: number
    sourceY: number
    radius: number
  }
  clear?: boolean
  offsetX?: number
  offsetY?: number
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(0.0001, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const fieldNoise = (x: number, y: number) => {
  const coarse = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  const fine = Math.sin(x * 31.4159 - y * 17.1717) * 24634.6345
  return ((coarse - Math.floor(coarse) + fine - Math.floor(fine)) / 2) * 2 - 1
}

export function sampleVisionAtPoint({
  pointX,
  pointY,
  sourceX,
  sourceY,
  radius,
  softness = 0.82,
  noiseStrength = 0.28,
}: VisionSampleOptions) {
  const distance = Math.hypot(pointX - sourceX, pointY - sourceY)
  const wobble = fieldNoise(pointX * 0.72 + sourceX * 0.13, pointY * 0.72 + sourceY * 0.13)
  const naturalDistance = distance + wobble * noiseStrength
  return 1 - smoothstep(radius - softness, radius + softness, naturalDistance)
}

export function pointCrossesVisionShadow(options: VisionSampleOptions) {
  return sampleVisionAtPoint(options) < VISION_ACTION_THRESHOLD
}

export function sampleChunkVisionAtPoint({
  localPointX,
  localPointY,
  localSourceX,
  localSourceY,
  chunkOriginX,
  chunkOriginY,
  radius,
  softness,
  noiseStrength,
}: ChunkVisionSampleOptions) {
  return sampleVisionAtPoint({
    pointX: chunkOriginX + localPointX,
    pointY: chunkOriginY + localPointY,
    sourceX: chunkOriginX + localSourceX,
    sourceY: chunkOriginY + localSourceY,
    radius,
    softness,
    noiseStrength,
  })
}

export function redrawSmoothDiscoveryFog({
  fill,
  cutout,
  discovered,
  chunkSize,
  cellSize,
  chunkOriginX,
  chunkOriginY,
  fogColor,
  hiddenAlpha,
  activeVision,
  clear = true,
  offsetX = 0,
  offsetY = 0,
}: SmoothDiscoveryFogOptions) {
  if (clear) {
    fill.clear()
    cutout.clear()
  }

  const discoveredAt = (localX: number, localY: number) => {
    if (localX < 0 || localY < 0 || localX >= chunkSize || localY >= chunkSize) return false
    return discovered[localY * chunkSize + localX] === 1
  }

  const activeVisibilityAt = (localX: number, localY: number) => {
    if (!activeVision) return 0
    return sampleChunkVisionAtPoint({
      localPointX: localX,
      localPointY: localY,
      localSourceX: activeVision.sourceX,
      localSourceY: activeVision.sourceY,
      chunkOriginX,
      chunkOriginY,
      radius: activeVision.radius,
      softness: 1.35,
      noiseStrength: 0.34,
    })
  }

  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const memoryAlpha = discoveredAt(localX, localY) ? 0.045 : hiddenAlpha
      const samples = [
        activeVisibilityAt(localX + 0.08, localY + 0.08),
        activeVisibilityAt(localX + 0.92, localY + 0.08),
        activeVisibilityAt(localX + 0.92, localY + 0.92),
        activeVisibilityAt(localX + 0.08, localY + 0.92),
      ]
      const minVisibility = Math.min(...samples)
      const maxVisibility = Math.max(...samples)
      const subdivisions = maxVisibility - minVisibility > 0.08 ? 4 : 1
      const subCellSize = cellSize / subdivisions
      for (let subY = 0; subY < subdivisions; subY += 1) {
        for (let subX = 0; subX < subdivisions; subX += 1) {
          const visibility = activeVisibilityAt(
            localX + (subX + 0.5) / subdivisions,
            localY + (subY + 0.5) / subdivisions
          )
          const alpha = memoryAlpha * (1 - visibility)
          if (alpha < 0.008) continue
          fill
            .rect(
              offsetX + localX * cellSize + subX * subCellSize,
              offsetY + localY * cellSize + subY * subCellSize,
              subCellSize,
              subCellSize
            )
            .fill({ color: fogColor, alpha })
        }
      }
    }
  }
}
