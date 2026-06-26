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

interface SmoothDiscoveryFogOptions {
  fill: Graphics
  cutout: Graphics
  discovered: Uint8Array
  chunkSize: number
  cellSize: number
  fogColor: number
  hiddenAlpha: number
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

export function redrawSmoothDiscoveryFog({
  fill,
  cutout,
  discovered,
  chunkSize,
  cellSize,
  fogColor,
  hiddenAlpha,
}: SmoothDiscoveryFogOptions) {
  fill.clear()
  cutout.clear()

  fill.rect(0, 0, chunkSize * cellSize + 0.2, chunkSize * cellSize + 0.2).fill({
    color: fogColor,
    alpha: hiddenAlpha,
  })

  const discoveredAt = (localX: number, localY: number) => {
    if (localX < 0 || localY < 0 || localX >= chunkSize || localY >= chunkSize) return false
    return discovered[localY * chunkSize + localX] === 1
  }

  const drawConnection = (localX: number, localY: number, radius: number, alpha: number) => {
    const centerX = (localX + 0.5) * cellSize
    const centerY = (localY + 0.5) * cellSize
    if (discoveredAt(localX + 1, localY)) {
      cutout
        .roundRect(centerX, centerY - radius, cellSize, radius * 2, radius)
        .fill({ color: 0xffffff, alpha })
    }
    if (discoveredAt(localX, localY + 1)) {
      cutout
        .roundRect(centerX - radius, centerY, radius * 2, cellSize, radius)
        .fill({ color: 0xffffff, alpha })
    }
  }

  const drawCellField = (radius: number, alpha: number) => {
    for (let localY = 0; localY < chunkSize; localY += 1) {
      for (let localX = 0; localX < chunkSize; localX += 1) {
        if (!discoveredAt(localX, localY)) continue
        const centerX = (localX + 0.5) * cellSize
        const centerY = (localY + 0.5) * cellSize
        cutout.circle(centerX, centerY, radius).fill({ color: 0xffffff, alpha })
        drawConnection(localX, localY, radius, alpha)
      }
    }
  }

  drawCellField(cellSize * 1.18, 0.34)
  drawCellField(cellSize * 0.88, 0.58)
  drawCellField(cellSize * 0.62, 1)
}
