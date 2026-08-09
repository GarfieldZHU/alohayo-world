/**
 * Compact, renderer-independent texture recipes for the map face.
 *
 * These hints describe how a terrain may be ornamented; they never replace the
 * biome, terrain, topology, hydrology, or movement fields. Keeping the recipe
 * coarse lets the worker use Wasm without transferring pixels or creating one
 * display object per cell.
 */

import { renderHintNoise } from './render-hints'

export const TERRAIN_TEXTURE_PATTERN = {
  none: 0,
  water: 1,
  coast: 2,
  grass: 3,
  forest: 4,
  wetland: 5,
  arid: 6,
  upland: 7,
  mountain: 8,
  snow: 9,
  volcanic: 10,
} as const

export type TerrainTexturePattern =
  (typeof TERRAIN_TEXTURE_PATTERN)[keyof typeof TERRAIN_TEXTURE_PATTERN]

export interface ChunkTerrainTextureHints {
  /** High nibble is the material recipe; low nibble is deterministic density. */
  pattern: Uint8Array
}

function texturePatternForBiome(biome: number): TerrainTexturePattern {
  if (biome <= 2) return TERRAIN_TEXTURE_PATTERN.water
  if (biome === 3 || biome === 5 || biome === 22) return TERRAIN_TEXTURE_PATTERN.coast
  if (biome === 4 || biome === 11 || biome === 19 || biome === 23) {
    return TERRAIN_TEXTURE_PATTERN.wetland
  }
  if (biome === 9 || biome === 18) return TERRAIN_TEXTURE_PATTERN.forest
  if (biome === 10) return TERRAIN_TEXTURE_PATTERN.arid
  if (biome === 12 || biome === 13 || biome === 20 || biome === 21) {
    return TERRAIN_TEXTURE_PATTERN.upland
  }
  if (biome === 14) return TERRAIN_TEXTURE_PATTERN.mountain
  if (biome === 15 || biome === 16 || biome === 25) return TERRAIN_TEXTURE_PATTERN.snow
  if (biome === 24) return TERRAIN_TEXTURE_PATTERN.volcanic
  if (biome === 6 || biome === 7 || biome === 8 || biome === 17) {
    return TERRAIN_TEXTURE_PATTERN.grass
  }
  return TERRAIN_TEXTURE_PATTERN.none
}

function texturePatternBaseStrength(pattern: TerrainTexturePattern): number {
  switch (pattern) {
    case TERRAIN_TEXTURE_PATTERN.water:
      return 44
    case TERRAIN_TEXTURE_PATTERN.coast:
      return 58
    case TERRAIN_TEXTURE_PATTERN.grass:
      return 34
    case TERRAIN_TEXTURE_PATTERN.forest:
      return 54
    case TERRAIN_TEXTURE_PATTERN.wetland:
      return 60
    case TERRAIN_TEXTURE_PATTERN.arid:
      return 46
    case TERRAIN_TEXTURE_PATTERN.upland:
      return 48
    case TERRAIN_TEXTURE_PATTERN.mountain:
      return 62
    case TERRAIN_TEXTURE_PATTERN.snow:
      return 52
    case TERRAIN_TEXTURE_PATTERN.volcanic:
      return 64
    default:
      return 36
  }
}

function textureNoise(
  x: number,
  y: number,
  elevation: number,
  moisture: number,
  temperature: number
) {
  let value = renderHintNoise(x, y, elevation)
  value = Math.imul(value ^ moisture, 2246822519)
  value = Math.imul(value ^ temperature, 3266489917)
  return (value ^ (value >>> 16)) >>> 0
}

export function generateChunkTerrainTextureHints(args: {
  biomes: Uint8Array
  elevation: Uint8Array
  moisture: Uint8Array
  temperature: Uint8Array
  chunkSize: number
  originX: number
  originY: number
}): ChunkTerrainTextureHints {
  const { biomes, elevation, moisture, temperature, chunkSize, originX, originY } = args
  const size = chunkSize * chunkSize
  const pattern = new Uint8Array(size)

  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const index = localY * chunkSize + localX
      const cellElevation = elevation[index]!
      const cellMoisture = moisture[index]!
      const cellTemperature = temperature[index]!
      const cellPattern = texturePatternForBiome(biomes[index]!)
      const noise = textureNoise(
        originX + localX,
        originY + localY,
        cellElevation,
        cellMoisture,
        cellTemperature
      )
      const density = Math.min(
        15,
        Math.floor(
          (texturePatternBaseStrength(cellPattern) +
            ((noise >>> 24) & 0x2f) +
            Math.floor((cellMoisture + cellTemperature + cellElevation) / 24)) /
            12
        )
      )
      pattern[index] = (cellPattern << 4) | density
    }
  }

  return { pattern }
}
