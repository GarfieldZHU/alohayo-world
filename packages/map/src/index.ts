export const BIOME = {
  deepOcean: 0,
  ocean: 1,
  shallowSea: 2,
  coast: 3,
  lake: 4,
  lowland: 5,
  grassland: 6,
  forest: 7,
  desert: 8,
  wetland: 9,
  highland: 10,
  bareRock: 11,
  mountain: 12,
  snow: 13,
} as const

export interface GeneratedWorld {
  seed: string
  hash: string
  width: number
  height: number
  generationMs: number
  elevation: Uint8Array
  moisture: Uint8Array
  temperature: Uint8Array
  biomes: Uint8Array
  landmass: Uint16Array
  waterbody: Uint16Array
  mainlandId: number
}

export interface GenerateWorldRequest {
  type: 'generate'
  seed: string
  width: number
  height: number
}

export interface GenerateWorldResponse {
  type: 'generated'
  world: GeneratedWorld
}

const SEA_LEVEL = 0.43
const FOUR_NEIGHBORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const

export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function random2d(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 69069)
  value = (value ^ (value >>> 13)) >>> 0
  value = Math.imul(value, 1274126177) >>> 0
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const px = x / scale
  const py = y / scale
  const x0 = Math.floor(px)
  const y0 = Math.floor(py)
  const tx = smoothstep(px - x0)
  const ty = smoothstep(py - y0)
  const a = random2d(x0, y0, seed)
  const b = random2d(x0 + 1, y0, seed)
  const c = random2d(x0, y0 + 1, seed)
  const d = random2d(x0 + 1, y0 + 1, seed)
  const top = a + (b - a) * tx
  const bottom = c + (d - c) * tx
  return top + (bottom - top) * ty
}

function octaveNoise(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, 46, seed) * 0.52 +
    valueNoise(x, y, 22, seed + 101) * 0.28 +
    valueNoise(x, y, 10, seed + 211) * 0.14 +
    valueNoise(x, y, 5, seed + 307) * 0.06
  )
}

function visitRegion(
  start: number,
  width: number,
  height: number,
  canVisit: (index: number) => boolean,
  onVisit: (index: number) => void
): number {
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  let count = 0
  queue[tail++] = start
  onVisit(start)

  while (head < tail) {
    const index = queue[head++]!
    count += 1
    const x = index % width
    const y = Math.floor(index / width)
    for (const [dx, dy] of FOUR_NEIGHBORS) {
      const nextX = x + dx
      const nextY = y + dy
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
      const next = nextY * width + nextX
      if (!canVisit(next)) continue
      onVisit(next)
      queue[tail++] = next
    }
  }

  return count
}

function classifyTopology(
  elevation: Uint8Array,
  width: number,
  height: number
): { ocean: Uint8Array; landmass: Uint16Array; waterbody: Uint16Array; mainlandId: number } {
  const size = width * height
  const water = new Uint8Array(size)
  const ocean = new Uint8Array(size)
  const landmass = new Uint16Array(size)
  const waterbody = new Uint16Array(size)

  for (let index = 0; index < size; index += 1) {
    water[index] = elevation[index]! / 255 < SEA_LEVEL ? 1 : 0
  }

  const markOcean = (index: number) => {
    ocean[index] = 1
    waterbody[index] = 1
  }
  const tryOcean = (index: number) => {
    if (water[index] && !ocean[index]) {
      visitRegion(index, width, height, (next) => Boolean(water[next] && !ocean[next]), markOcean)
    }
  }

  for (let x = 0; x < width; x += 1) {
    tryOcean(x)
    tryOcean((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    tryOcean(y * width)
    tryOcean(y * width + width - 1)
  }

  let waterbodyId = 2
  for (let index = 0; index < size; index += 1) {
    if (!water[index] || waterbody[index]) continue
    const id = waterbodyId++
    visitRegion(
      index,
      width,
      height,
      (next) => Boolean(water[next] && !waterbody[next]),
      (next) => {
        waterbody[next] = id
      }
    )
  }

  let landmassId = 1
  let mainlandId = 0
  let mainlandSize = 0
  for (let index = 0; index < size; index += 1) {
    if (water[index] || landmass[index]) continue
    const id = landmassId++
    const regionSize = visitRegion(
      index,
      width,
      height,
      (next) => Boolean(!water[next] && !landmass[next]),
      (next) => {
        landmass[next] = id
      }
    )
    if (regionSize > mainlandSize) {
      mainlandId = id
      mainlandSize = regionSize
    }
  }

  return { ocean, landmass, waterbody, mainlandId }
}

function touchesWater(
  index: number,
  width: number,
  height: number,
  waterbody: Uint16Array
): boolean {
  const x = index % width
  const y = Math.floor(index / width)
  return FOUR_NEIGHBORS.some(([dx, dy]) => {
    const nextX = x + dx
    const nextY = y + dy
    return (
      nextX >= 0 &&
      nextY >= 0 &&
      nextX < width &&
      nextY < height &&
      Boolean(waterbody[nextY * width + nextX])
    )
  })
}

export function generateWorld(seedText: string, width: number, height: number): GeneratedWorld {
  const started = globalThis.performance?.now?.() ?? Date.now()
  const seed = hashSeed(seedText)
  const size = width * height
  const elevation = new Uint8Array(size)
  const moisture = new Uint8Array(size)
  const temperature = new Uint8Array(size)
  const biomes = new Uint8Array(size)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const nx = (x / Math.max(1, width - 1)) * 2 - 1
      const ny = (y / Math.max(1, height - 1)) * 2 - 1
      const edge = Math.max(Math.abs(nx), Math.abs(ny))
      const continent = octaveNoise(x, y, seed) - Math.max(0, edge - 0.72) * 0.72
      const elevationValue = Math.max(0, Math.min(1, continent))
      const moistureValue = Math.max(
        0,
        Math.min(1, octaveNoise(x + 710, y - 390, seed + 503) + (1 - elevationValue) * 0.08)
      )
      const latitude = 1 - Math.abs(ny)
      const temperatureValue = Math.max(
        0,
        Math.min(
          1,
          latitude * 0.78 +
            valueNoise(x, y, 34, seed + 907) * 0.3 -
            Math.max(0, elevationValue - 0.72) * 0.75
        )
      )

      elevation[index] = Math.round(elevationValue * 255)
      moisture[index] = Math.round(moistureValue * 255)
      temperature[index] = Math.round(temperatureValue * 255)
    }
  }

  const topology = classifyTopology(elevation, width, height)
  let worldHash = 2166136261

  for (let index = 0; index < size; index += 1) {
    const elevationValue = elevation[index]! / 255
    const moistureValue = moisture[index]! / 255
    const temperatureValue = temperature[index]! / 255
    let biome: number

    if (topology.waterbody[index]) {
      if (!topology.ocean[index]) biome = BIOME.lake
      else if (elevationValue < 0.2) biome = BIOME.deepOcean
      else if (elevationValue < 0.34) biome = BIOME.ocean
      else biome = BIOME.shallowSea
    } else if (touchesWater(index, width, height, topology.waterbody) || elevationValue < 0.47) {
      biome = BIOME.coast
    } else if (elevationValue > 0.83 && temperatureValue < 0.46) {
      biome = BIOME.snow
    } else if (elevationValue > 0.82) {
      biome = BIOME.mountain
    } else if (elevationValue > 0.74 && moistureValue < 0.55) {
      biome = BIOME.bareRock
    } else if (elevationValue > 0.66) {
      biome = BIOME.highland
    } else if (moistureValue > 0.72 && elevationValue < 0.56) {
      biome = BIOME.wetland
    } else if (temperatureValue > 0.68 && moistureValue < 0.42) {
      biome = BIOME.desert
    } else if (moistureValue > 0.58) {
      biome = BIOME.forest
    } else if (elevationValue < 0.54) {
      biome = BIOME.lowland
    } else {
      biome = BIOME.grassland
    }

    biomes[index] = biome
    worldHash ^= biome + elevation[index]! + topology.landmass[index]! + topology.waterbody[index]!
    worldHash = Math.imul(worldHash, 16777619)
  }

  return {
    seed: seedText,
    hash: (worldHash >>> 0).toString(16).padStart(8, '0'),
    width,
    height,
    generationMs: (globalThis.performance?.now?.() ?? Date.now()) - started,
    elevation,
    moisture,
    temperature,
    biomes,
    landmass: topology.landmass,
    waterbody: topology.waterbody,
    mainlandId: topology.mainlandId,
  }
}
