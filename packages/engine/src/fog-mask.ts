import { sampleVisionAtPoint } from './visibility'

export interface FogMaskBounds {
  minCellX: number
  minCellY: number
  widthCells: number
  heightCells: number
}

export interface FogMaskVision {
  sourceX: number
  sourceY: number
  radius: number
}

export interface PackedFogMask {
  bounds: FogMaskBounds
  samplesPerCell: number
  width: number
  height: number
  pixels: Uint8Array
}

interface FogMaskUpdateOptions {
  fogColor: number
  hiddenAlpha: number
  memoryAlpha: number
  isDiscovered: (cellX: number, cellY: number) => boolean
  activeVision?: FogMaskVision
  dirtyBounds?: FogMaskBounds
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const sameBounds = (left: FogMaskBounds, right: FogMaskBounds) =>
  left.minCellX === right.minCellX &&
  left.minCellY === right.minCellY &&
  left.widthCells === right.widthCells &&
  left.heightCells === right.heightCells

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

const discoveredCoverage = (
  pointX: number,
  pointY: number,
  isDiscovered: (cellX: number, cellY: number) => boolean
) => {
  const sampleX = pointX - 0.5
  const sampleY = pointY - 0.5
  const cellX = Math.floor(sampleX)
  const cellY = Math.floor(sampleY)
  const fractionX = sampleX - cellX
  const fractionY = sampleY - cellY
  const north =
    Number(isDiscovered(cellX, cellY)) * (1 - fractionX) +
    Number(isDiscovered(cellX + 1, cellY)) * fractionX
  const south =
    Number(isDiscovered(cellX, cellY + 1)) * (1 - fractionX) +
    Number(isDiscovered(cellX + 1, cellY + 1)) * fractionX
  return smoothstep(north * (1 - fractionY) + south * fractionY)
}

export function createPackedFogMask(bounds: FogMaskBounds, samplesPerCell = 4): PackedFogMask {
  const normalizedSamples = Math.max(1, Math.floor(samplesPerCell))
  const width = Math.max(1, Math.floor(bounds.widthCells * normalizedSamples))
  const height = Math.max(1, Math.floor(bounds.heightCells * normalizedSamples))
  return {
    bounds: { ...bounds },
    samplesPerCell: normalizedSamples,
    width,
    height,
    pixels: new Uint8Array(width * height * 4),
  }
}

export function fogMaskMatchesBounds(mask: PackedFogMask, bounds: FogMaskBounds) {
  return sameBounds(mask.bounds, bounds)
}

export function visionDirtyBounds(
  previous: FogMaskVision | undefined,
  next: FogMaskVision | undefined,
  padding = 2
): FogMaskBounds | undefined {
  if (!previous && !next) return undefined
  const sources = [previous, next].filter((value): value is FogMaskVision => Boolean(value))
  const minCellX = Math.floor(
    Math.min(...sources.map((source) => source.sourceX - source.radius)) - padding
  )
  const minCellY = Math.floor(
    Math.min(...sources.map((source) => source.sourceY - source.radius)) - padding
  )
  const maxCellX = Math.ceil(
    Math.max(...sources.map((source) => source.sourceX + source.radius)) + padding
  )
  const maxCellY = Math.ceil(
    Math.max(...sources.map((source) => source.sourceY + source.radius)) + padding
  )
  return {
    minCellX,
    minCellY,
    widthCells: Math.max(1, maxCellX - minCellX),
    heightCells: Math.max(1, maxCellY - minCellY),
  }
}

export function updatePackedFogMask(mask: PackedFogMask, options: FogMaskUpdateOptions) {
  const { bounds, samplesPerCell, pixels } = mask
  const dirty = options.dirtyBounds ?? bounds
  const startSampleX = clamp(
    Math.floor((dirty.minCellX - bounds.minCellX) * samplesPerCell),
    0,
    mask.width
  )
  const startSampleY = clamp(
    Math.floor((dirty.minCellY - bounds.minCellY) * samplesPerCell),
    0,
    mask.height
  )
  const endSampleX = clamp(
    Math.ceil((dirty.minCellX + dirty.widthCells - bounds.minCellX) * samplesPerCell),
    0,
    mask.width
  )
  const endSampleY = clamp(
    Math.ceil((dirty.minCellY + dirty.heightCells - bounds.minCellY) * samplesPerCell),
    0,
    mask.height
  )
  const red = (options.fogColor >>> 16) & 0xff
  const green = (options.fogColor >>> 8) & 0xff
  const blue = options.fogColor & 0xff
  let updatedSamples = 0

  for (let sampleY = startSampleY; sampleY < endSampleY; sampleY += 1) {
    const pointY = bounds.minCellY + (sampleY + 0.5) / samplesPerCell
    for (let sampleX = startSampleX; sampleX < endSampleX; sampleX += 1) {
      const pointX = bounds.minCellX + (sampleX + 0.5) / samplesPerCell
      const discovery = discoveredCoverage(pointX, pointY, options.isDiscovered)
      const memoryAlpha =
        options.hiddenAlpha + (options.memoryAlpha - options.hiddenAlpha) * discovery
      const withinVisionEnvelope =
        options.activeVision &&
        Math.abs(pointX - options.activeVision.sourceX) <= options.activeVision.radius + 2 &&
        Math.abs(pointY - options.activeVision.sourceY) <= options.activeVision.radius + 2
      const visibility =
        options.activeVision && withinVisionEnvelope
          ? sampleVisionAtPoint({
              pointX,
              pointY,
              sourceX: options.activeVision.sourceX,
              sourceY: options.activeVision.sourceY,
              radius: options.activeVision.radius,
              softness: 1.35,
              noiseStrength: 0.34,
            })
          : 0
      const alpha = Math.round(clamp(memoryAlpha * (1 - visibility), 0, 1) * 255)
      const offset = (sampleY * mask.width + sampleX) * 4
      // BufferImageSource defaults to BGRA8 for Uint8Array resources.
      pixels[offset] = blue
      pixels[offset + 1] = green
      pixels[offset + 2] = red
      pixels[offset + 3] = alpha
      updatedSamples += 1
    }
  }
  return updatedSamples
}
