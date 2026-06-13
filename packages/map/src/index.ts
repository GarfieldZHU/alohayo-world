import type { MapAreaDefinition, MapLandmarkDefinition } from '@alohayo/config'

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

export const CHUNK_REGION = {
  sea: 0,
  lake: 1,
  mainland: 2,
  island: 3,
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
  authoredArea: Uint16Array
  mainlandId: number
  areaIds: string[]
  landmarks: GeneratedLandmark[]
}

export interface GeneratedChunk {
  seed: string
  hash: string
  chunkX: number
  chunkY: number
  chunkSize: number
  originX: number
  originY: number
  generationMs: number
  elevation: Uint8Array
  moisture: Uint8Array
  temperature: Uint8Array
  biomes: Uint8Array
  authoredArea: Uint16Array
  region: Uint8Array
  areaIds: string[]
  landmarks: GeneratedLandmark[]
}

export interface GeneratedLandmark extends MapLandmarkDefinition {
  areaId: string
}

export interface GenerateWorldRequest {
  type: 'generate'
  id: string
  seed: string
  width: number
  height: number
  mapAreas?: MapAreaDefinition[]
  terrainCodes?: Record<string, number>
}

export interface GenerateChunkRequest {
  type: 'generate-chunk'
  id: string
  seed: string
  chunkX: number
  chunkY: number
  chunkSize: number
  surveyWidth: number
  surveyHeight: number
  mapAreas?: MapAreaDefinition[]
  terrainCodes?: Record<string, number>
}

export interface GenerateWorldResponse {
  type: 'generated'
  id: string
  world: GeneratedWorld
}

export interface GenerateChunkResponse {
  type: 'generated-chunk'
  id: string
  chunk: GeneratedChunk
}

export type WorldWorkerRequest = GenerateWorldRequest | GenerateChunkRequest
export type WorldWorkerResponse = GenerateWorldResponse | GenerateChunkResponse

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

function streamLatitude(globalY: number): number {
  const wrapped = Math.abs(((((globalY / 640) % 2) + 2) % 2) - 1)
  return 1 - wrapped
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function streamElevationValue(globalX: number, globalY: number, seed: number): number {
  const macro = valueNoise(globalX, globalY, 360, seed + 1301)
  const continents = valueNoise(globalX, globalY, 180, seed + 1709)
  const fine = octaveNoise(globalX, globalY, seed)
  const ridges = Math.abs(valueNoise(globalX, globalY, 88, seed + 2503) * 2 - 1)
  return clamp01(macro * 0.46 + continents * 0.26 + fine * 0.38 - ridges * 0.14 - 0.12)
}

function streamMoistureValue(
  globalX: number,
  globalY: number,
  seed: number,
  elevationValue: number
): number {
  const rain = valueNoise(globalX + 710, globalY - 390, 92, seed + 503)
  const saturation = valueNoise(globalX - 180, globalY + 820, 34, seed + 1187)
  return clamp01(rain * 0.64 + saturation * 0.22 + (1 - elevationValue) * 0.18)
}

function streamTemperatureValue(
  globalX: number,
  globalY: number,
  seed: number,
  elevationValue: number
): number {
  const latitude = streamLatitude(globalY)
  const climate = valueNoise(globalX, globalY, 54, seed + 907)
  return clamp01(latitude * 0.72 + climate * 0.24 - Math.max(0, elevationValue - 0.68) * 0.78)
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

function classifyTopologyFromBiomes(
  biomes: Uint8Array,
  width: number,
  height: number
): { landmass: Uint16Array; waterbody: Uint16Array; mainlandId: number } {
  const elevation = new Uint8Array(biomes.length)
  for (let index = 0; index < biomes.length; index += 1) {
    const biome = biomes[index]!
    elevation[index] =
      biome === BIOME.deepOcean ||
      biome === BIOME.ocean ||
      biome === BIOME.shallowSea ||
      biome === BIOME.lake
        ? 0
        : 255
  }
  const topology = classifyTopology(elevation, width, height)
  return {
    landmass: topology.landmass,
    waterbody: topology.waterbody,
    mainlandId: topology.mainlandId,
  }
}

function patchContains(
  shape: 'rectangle' | 'ellipse',
  localX: number,
  localY: number,
  width: number,
  height: number
): boolean {
  if (shape === 'rectangle') return true
  const normalizedX = (localX + 0.5) / width - 0.5
  const normalizedY = (localY + 0.5) / height - 0.5
  return normalizedX * normalizedX * 4 + normalizedY * normalizedY * 4 <= 1
}

function resolveAreaOrigin(
  area: MapAreaDefinition,
  surveyWidth: number,
  surveyHeight: number,
  centered = false
): { x: number; y: number } {
  if (area.placement.mode === 'absolute') {
    return { x: Math.round(area.placement.x), y: Math.round(area.placement.y) }
  }
  if (!centered) {
    return {
      x: Math.round((surveyWidth - area.width) * area.placement.x),
      y: Math.round((surveyHeight - area.height) * area.placement.y),
    }
  }
  return {
    x: Math.round((surveyWidth - area.width) * area.placement.x - surveyWidth / 2),
    y: Math.round((surveyHeight - area.height) * area.placement.y - surveyHeight / 2),
  }
}

function classifyStreamBiome(
  globalX: number,
  globalY: number,
  seed: number,
  elevationValue: number,
  moistureValue: number,
  temperatureValue: number
): number {
  const water = elevationValue < SEA_LEVEL
  const west = streamElevationValue(globalX - 1, globalY, seed) < SEA_LEVEL
  const east = streamElevationValue(globalX + 1, globalY, seed) < SEA_LEVEL
  const north = streamElevationValue(globalX, globalY - 1, seed) < SEA_LEVEL
  const south = streamElevationValue(globalX, globalY + 1, seed) < SEA_LEVEL
  const touchingWater = west || east || north || south

  if (water) {
    const enclosed = !west && !east && !north && !south && elevationValue > 0.28
    if (enclosed) return BIOME.lake
    if (elevationValue < 0.18) return BIOME.deepOcean
    if (elevationValue < 0.31) return BIOME.ocean
    return BIOME.shallowSea
  }

  if (touchingWater || elevationValue < 0.48) return BIOME.coast
  if (elevationValue > 0.84 && temperatureValue < 0.48) return BIOME.snow
  if (elevationValue > 0.82) return BIOME.mountain
  if (elevationValue > 0.74 && moistureValue < 0.56) return BIOME.bareRock
  if (elevationValue > 0.66) return BIOME.highland
  if (moistureValue > 0.74 && elevationValue < 0.57) return BIOME.wetland
  if (temperatureValue > 0.68 && moistureValue < 0.42) return BIOME.desert
  if (moistureValue > 0.58) return BIOME.forest
  if (elevationValue < 0.54) return BIOME.lowland
  return BIOME.grassland
}

function classifyChunkRegions(biomes: Uint8Array, chunkSize: number): Uint8Array {
  const size = chunkSize * chunkSize
  const region = new Uint8Array(size)
  const visited = new Uint8Array(size)

  const isWaterBiome = (biome: number) =>
    biome === BIOME.deepOcean ||
    biome === BIOME.ocean ||
    biome === BIOME.shallowSea ||
    biome === BIOME.lake

  for (let index = 0; index < size; index += 1) {
    if (visited[index]) continue
    const biome = biomes[index]!
    const water = isWaterBiome(biome)
    const queue = new Int32Array(size)
    const cells: number[] = []
    let head = 0
    let tail = 0
    let touchesEdge = false
    queue[tail++] = index
    visited[index] = 1

    while (head < tail) {
      const current = queue[head++]!
      cells.push(current)
      const x = current % chunkSize
      const y = Math.floor(current / chunkSize)
      if (x === 0 || y === 0 || x === chunkSize - 1 || y === chunkSize - 1) touchesEdge = true
      for (const [dx, dy] of FOUR_NEIGHBORS) {
        const nextX = x + dx
        const nextY = y + dy
        if (nextX < 0 || nextY < 0 || nextX >= chunkSize || nextY >= chunkSize) continue
        const next = nextY * chunkSize + nextX
        if (visited[next]) continue
        if (isWaterBiome(biomes[next]!) !== water) continue
        visited[next] = 1
        queue[tail++] = next
      }
    }

    const regionCode = water
      ? touchesEdge
        ? CHUNK_REGION.sea
        : CHUNK_REGION.lake
      : touchesEdge
        ? CHUNK_REGION.mainland
        : CHUNK_REGION.island

    for (const cell of cells) region[cell] = regionCode
  }

  return region
}

export function applyMapAreas(
  world: GeneratedWorld,
  areas: MapAreaDefinition[],
  terrainCodes: Record<string, number>
): GeneratedWorld {
  const authoredArea = new Uint16Array(world.biomes.length)
  const areaIds = ['']
  const landmarks: GeneratedLandmark[] = []

  const applyCell = (
    worldX: number,
    worldY: number,
    areaIndex: number,
    terrainId: string,
    elevation?: number,
    moisture?: number,
    temperature?: number
  ) => {
    if (worldX < 0 || worldY < 0 || worldX >= world.width || worldY >= world.height) return
    const terrainCode = terrainCodes[terrainId]
    if (terrainCode === undefined) throw new Error(`unknown terrain id ${terrainId}`)
    const index = worldY * world.width + worldX
    world.biomes[index] = terrainCode
    authoredArea[index] = areaIndex
    if (elevation !== undefined) world.elevation[index] = elevation
    if (moisture !== undefined) world.moisture[index] = moisture
    if (temperature !== undefined) world.temperature[index] = temperature
  }

  for (const area of areas) {
    if (!area.enabled) continue
    const areaIndex = areaIds.length
    areaIds.push(area.id)
    const origin = resolveAreaOrigin(area, world.width, world.height)

    for (const patch of area.terrainPatches) {
      for (let y = 0; y < patch.height; y += 1) {
        for (let x = 0; x < patch.width; x += 1) {
          if (!patchContains(patch.shape, x, y, patch.width, patch.height)) continue
          applyCell(
            origin.x + patch.x + x,
            origin.y + patch.y + y,
            areaIndex,
            patch.terrainId,
            patch.elevation,
            patch.moisture,
            patch.temperature
          )
        }
      }
    }

    for (const cell of area.cells ?? []) {
      applyCell(
        origin.x + cell.x,
        origin.y + cell.y,
        areaIndex,
        cell.terrainId,
        cell.elevation,
        cell.moisture,
        cell.temperature
      )
    }

    for (const landmark of area.landmarks ?? []) {
      landmarks.push({
        ...landmark,
        x: origin.x + landmark.x,
        y: origin.y + landmark.y,
        areaId: area.id,
      })
    }
  }

  const topology = classifyTopologyFromBiomes(world.biomes, world.width, world.height)
  world.landmass = topology.landmass
  world.waterbody = topology.waterbody
  world.mainlandId = topology.mainlandId
  world.authoredArea = authoredArea
  world.areaIds = areaIds
  world.landmarks = landmarks

  let worldHash = 2166136261
  for (let index = 0; index < world.biomes.length; index += 1) {
    worldHash ^=
      world.biomes[index]! +
      world.elevation[index]! +
      world.landmass[index]! +
      world.waterbody[index]! +
      world.authoredArea[index]!
    worldHash = Math.imul(worldHash, 16777619)
  }
  world.hash = (worldHash >>> 0).toString(16).padStart(8, '0')
  return world
}

function applyAreasToChunk(
  chunk: GeneratedChunk,
  areas: MapAreaDefinition[],
  terrainCodes: Record<string, number>,
  surveyWidth: number,
  surveyHeight: number
): GeneratedChunk {
  const areaIds = ['']
  const landmarks: GeneratedLandmark[] = []
  const chunkMaxX = chunk.originX + chunk.chunkSize - 1
  const chunkMaxY = chunk.originY + chunk.chunkSize - 1

  const applyCell = (
    worldX: number,
    worldY: number,
    areaIndex: number,
    terrainId: string,
    elevation?: number,
    moisture?: number,
    temperature?: number
  ) => {
    if (
      worldX < chunk.originX ||
      worldY < chunk.originY ||
      worldX > chunkMaxX ||
      worldY > chunkMaxY
    ) {
      return
    }
    const terrainCode = terrainCodes[terrainId]
    if (terrainCode === undefined) throw new Error(`unknown terrain id ${terrainId}`)
    const localX = worldX - chunk.originX
    const localY = worldY - chunk.originY
    const index = localY * chunk.chunkSize + localX
    chunk.biomes[index] = terrainCode
    chunk.authoredArea[index] = areaIndex
    if (elevation !== undefined) chunk.elevation[index] = elevation
    if (moisture !== undefined) chunk.moisture[index] = moisture
    if (temperature !== undefined) chunk.temperature[index] = temperature
  }

  for (const area of areas) {
    if (!area.enabled) continue
    const origin = resolveAreaOrigin(area, surveyWidth, surveyHeight, true)
    const areaMinX = origin.x
    const areaMinY = origin.y
    const areaMaxX = origin.x + area.width - 1
    const areaMaxY = origin.y + area.height - 1
    const intersects = !(
      areaMaxX < chunk.originX ||
      areaMaxY < chunk.originY ||
      areaMinX > chunkMaxX ||
      areaMinY > chunkMaxY
    )
    if (!intersects) continue

    const areaIndex = areaIds.length
    areaIds.push(area.id)

    for (const patch of area.terrainPatches) {
      for (let y = 0; y < patch.height; y += 1) {
        for (let x = 0; x < patch.width; x += 1) {
          if (!patchContains(patch.shape, x, y, patch.width, patch.height)) continue
          applyCell(
            origin.x + patch.x + x,
            origin.y + patch.y + y,
            areaIndex,
            patch.terrainId,
            patch.elevation,
            patch.moisture,
            patch.temperature
          )
        }
      }
    }

    for (const cell of area.cells ?? []) {
      applyCell(
        origin.x + cell.x,
        origin.y + cell.y,
        areaIndex,
        cell.terrainId,
        cell.elevation,
        cell.moisture,
        cell.temperature
      )
    }

    for (const landmark of area.landmarks ?? []) {
      const worldX = origin.x + landmark.x
      const worldY = origin.y + landmark.y
      if (
        worldX < chunk.originX ||
        worldY < chunk.originY ||
        worldX > chunkMaxX ||
        worldY > chunkMaxY
      ) {
        continue
      }
      landmarks.push({
        ...landmark,
        x: worldX,
        y: worldY,
        areaId: area.id,
      })
    }
  }

  chunk.areaIds = areaIds
  chunk.landmarks = landmarks
  chunk.region = classifyChunkRegions(chunk.biomes, chunk.chunkSize)

  let chunkHash = 2166136261
  for (let index = 0; index < chunk.biomes.length; index += 1) {
    chunkHash ^=
      chunk.biomes[index]! +
      chunk.elevation[index]! +
      chunk.moisture[index]! +
      chunk.temperature[index]! +
      chunk.authoredArea[index]! +
      chunk.region[index]!
    chunkHash = Math.imul(chunkHash, 16777619)
  }
  chunk.hash = (chunkHash >>> 0).toString(16).padStart(8, '0')
  return chunk
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
      const elevationValue = clamp01(continent)
      const moistureValue = clamp01(
        octaveNoise(x + 710, y - 390, seed + 503) + (1 - elevationValue) * 0.08
      )
      const latitude = 1 - Math.abs(ny)
      const temperatureValue = clamp01(
        latitude * 0.78 +
          valueNoise(x, y, 34, seed + 907) * 0.3 -
          Math.max(0, elevationValue - 0.72) * 0.75
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
    authoredArea: new Uint16Array(size),
    mainlandId: topology.mainlandId,
    areaIds: [''],
    landmarks: [],
  }
}

export function generateChunk(
  seedText: string,
  chunkX: number,
  chunkY: number,
  chunkSize: number
): GeneratedChunk {
  const started = globalThis.performance?.now?.() ?? Date.now()
  const seed = hashSeed(seedText)
  const size = chunkSize * chunkSize
  const originX = chunkX * chunkSize
  const originY = chunkY * chunkSize
  const elevation = new Uint8Array(size)
  const moisture = new Uint8Array(size)
  const temperature = new Uint8Array(size)
  const biomes = new Uint8Array(size)

  let chunkHash = 2166136261
  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const globalX = originX + localX
      const globalY = originY + localY
      const index = localY * chunkSize + localX
      const elevationValue = streamElevationValue(globalX, globalY, seed)
      const moistureValue = streamMoistureValue(globalX, globalY, seed, elevationValue)
      const temperatureValue = streamTemperatureValue(globalX, globalY, seed, elevationValue)
      const biome = classifyStreamBiome(
        globalX,
        globalY,
        seed,
        elevationValue,
        moistureValue,
        temperatureValue
      )

      elevation[index] = Math.round(elevationValue * 255)
      moisture[index] = Math.round(moistureValue * 255)
      temperature[index] = Math.round(temperatureValue * 255)
      biomes[index] = biome

      chunkHash ^= biome + elevation[index]! + moisture[index]! + temperature[index]!
      chunkHash = Math.imul(chunkHash, 16777619)
    }
  }

  return {
    seed: seedText,
    hash: (chunkHash >>> 0).toString(16).padStart(8, '0'),
    chunkX,
    chunkY,
    chunkSize,
    originX,
    originY,
    generationMs: (globalThis.performance?.now?.() ?? Date.now()) - started,
    elevation,
    moisture,
    temperature,
    biomes,
    authoredArea: new Uint16Array(size),
    region: classifyChunkRegions(biomes, chunkSize),
    areaIds: [''],
    landmarks: [],
  }
}

export function generateChunkWithAreas(
  seedText: string,
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  surveyWidth: number,
  surveyHeight: number,
  areas: MapAreaDefinition[],
  terrainCodes: Record<string, number>
): GeneratedChunk {
  const chunk = generateChunk(seedText, chunkX, chunkY, chunkSize)
  return applyAreasToChunk(chunk, areas, terrainCodes, surveyWidth, surveyHeight)
}
