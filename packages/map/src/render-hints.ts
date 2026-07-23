const BIOME = {
  deepOcean: 0,
  ocean: 1,
  shallowSea: 2,
  coast: 3,
  lake: 4,
  beach: 5,
  forest: 9,
  wetland: 11,
  highland: 12,
  bareRock: 13,
  mountain: 14,
  rainforest: 18,
  marsh: 19,
  reef: 22,
} as const

export interface ChunkRenderHints {
  noise: Uint32Array
  eastBoundaryMask: Uint8Array
  southBoundaryMask: Uint8Array
  regionalDetailMask: Uint8Array
  closeDetailKind: Uint8Array
  detailOffsetX: Uint8Array
  detailOffsetY: Uint8Array
  /**
   * Signed local distance to a water/land edge. Water is negative, land is
   * positive, zero touches the edge, and +/-127 means no local shore exists.
   * #41 will replace this provisional per-chunk field with a halo-aware one.
   */
  shoreDistance: Int8Array
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

function isWaterBiomeCode(biome: number): boolean {
  return (
    biome === BIOME.deepOcean ||
    biome === BIOME.ocean ||
    biome === BIOME.shallowSea ||
    biome === BIOME.coast ||
    biome === BIOME.lake ||
    biome === BIOME.beach ||
    biome === BIOME.reef ||
    biome === BIOME.marsh ||
    biome === BIOME.wetland
  )
}

function buildLocalShoreDistance(biomes: Uint8Array, chunkSize: number): Int8Array {
  const size = chunkSize * chunkSize
  const distance = new Int16Array(size)
  distance.fill(-1)
  const queue = new Int32Array(size)
  let head = 0
  let tail = 0
  const neighbors: readonly [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]

  for (let y = 0; y < chunkSize; y += 1) {
    for (let x = 0; x < chunkSize; x += 1) {
      const index = y * chunkSize + x
      const water = isWaterBiomeCode(biomes[index]!)
      for (const [dx, dy] of neighbors) {
        const neighborX = x + dx
        const neighborY = y + dy
        if (neighborX < 0 || neighborY < 0 || neighborX >= chunkSize || neighborY >= chunkSize)
          continue
        if (water !== isWaterBiomeCode(biomes[neighborY * chunkSize + neighborX]!)) {
          distance[index] = 0
          queue[tail++] = index
          break
        }
      }
    }
  }

  while (head < tail) {
    const index = queue[head++]!
    const nextDistance = distance[index]! + 1
    const x = index % chunkSize
    const y = Math.floor(index / chunkSize)
    for (const [dx, dy] of neighbors) {
      const neighborX = x + dx
      const neighborY = y + dy
      if (neighborX < 0 || neighborY < 0 || neighborX >= chunkSize || neighborY >= chunkSize)
        continue
      const neighbor = neighborY * chunkSize + neighborX
      if (distance[neighbor] !== -1) continue
      distance[neighbor] = nextDistance
      queue[tail++] = neighbor
    }
  }

  const signed = new Int8Array(size)
  for (let index = 0; index < size; index += 1) {
    const absolute = distance[index] === -1 ? 127 : Math.min(127, distance[index]!)
    signed[index] = isWaterBiomeCode(biomes[index]!) ? -absolute : absolute
  }
  return signed
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
  const shoreDistance = buildLocalShoreDistance(biomes, chunkSize)

  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const index = localY * chunkSize + localX
      const cellNoise = renderHintNoise(originX + localX, originY + localY, elevation[index]!)
      noise[index] = cellNoise
      const biome = biomes[index]!
      if (localX + 1 < chunkSize && biomes[index + 1] !== biome) eastBoundaryMask[index] = 1
      if (localY + 1 < chunkSize && biomes[index + chunkSize] !== biome)
        southBoundaryMask[index] = 1
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
    shoreDistance,
  }
}
