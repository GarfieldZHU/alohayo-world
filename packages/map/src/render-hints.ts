const BIOME = {
  deepOcean: 0,
  ocean: 1,
  shallowSea: 2,
  lake: 4,
  forest: 9,
  wetland: 11,
  highland: 12,
  bareRock: 13,
  mountain: 14,
  rainforest: 18,
} as const

export interface ChunkRenderHints {
  noise: Uint32Array
  eastBoundaryMask: Uint8Array
  southBoundaryMask: Uint8Array
  regionalDetailMask: Uint8Array
  closeDetailKind: Uint8Array
  detailOffsetX: Uint8Array
  detailOffsetY: Uint8Array
}

export const CLOSE_DETAIL_KIND = {
  none: 0,
  water: 1,
  forest: 2,
  mountain: 3,
  wetland: 4,
  generic: 5,
} as const

export function renderHintNoise(x: number, y: number, salt = 0) {
  let value = Math.imul(x + salt, 374761393) ^ Math.imul(y - salt, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}

function closeDetailKindForBiome(biome: number): number {
  if (
    biome === BIOME.deepOcean ||
    biome === BIOME.ocean ||
    biome === BIOME.shallowSea ||
    biome === BIOME.lake
  ) {
    return CLOSE_DETAIL_KIND.water
  }
  if (biome === BIOME.forest || biome === BIOME.rainforest) return CLOSE_DETAIL_KIND.forest
  if (biome === BIOME.mountain || biome === BIOME.bareRock || biome === BIOME.highland) {
    return CLOSE_DETAIL_KIND.mountain
  }
  if (biome === BIOME.wetland) return CLOSE_DETAIL_KIND.wetland
  return CLOSE_DETAIL_KIND.generic
}

export function generateChunkRenderHints(args: {
  biomes: Uint8Array
  elevation: Uint8Array
  chunkSize: number
  originX: number
  originY: number
}): ChunkRenderHints {
  const { biomes, elevation, chunkSize, originX, originY } = args
  const size = chunkSize * chunkSize
  const noise = new Uint32Array(size)
  const eastBoundaryMask = new Uint8Array(size)
  const southBoundaryMask = new Uint8Array(size)
  const regionalDetailMask = new Uint8Array(size)
  const closeDetailKind = new Uint8Array(size)
  const detailOffsetX = new Uint8Array(size)
  const detailOffsetY = new Uint8Array(size)

  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const index = localY * chunkSize + localX
      const cellNoise = renderHintNoise(originX + localX, originY + localY, elevation[index]!)
      noise[index] = cellNoise
      const biome = biomes[index]!
      if (localX + 1 < chunkSize && biomes[index + 1] !== biome) eastBoundaryMask[index] = 1
      if (localY + 1 < chunkSize && biomes[index + chunkSize] !== biome) southBoundaryMask[index] = 1
      if (cellNoise % 11 === 0) regionalDetailMask[index] = 1
      if (cellNoise % 7 === 0) {
        closeDetailKind[index] = closeDetailKindForBiome(biome)
        detailOffsetX[index] = (cellNoise >>> 7) & 0xff
        detailOffsetY[index] = (cellNoise >>> 11) & 0xff
      }
    }
  }

  return {
    noise,
    eastBoundaryMask,
    southBoundaryMask,
    regionalDetailMask,
    closeDetailKind,
    detailOffsetX,
    detailOffsetY,
  }
}
