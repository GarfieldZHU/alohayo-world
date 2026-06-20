import type {
  BiomeDefinition,
  MapAreaDefinition,
  MapLandmarkDefinition,
  WorldRiverSystemDefinition,
  WorldRoadSystemDefinition,
} from '@alohayo/config'

export const BIOME = {
  deepOcean: 0,
  ocean: 1,
  shallowSea: 2,
  coast: 3,
  lake: 4,
  beach: 5,
  basin: 6,
  lowland: 7,
  grassland: 8,
  forest: 9,
  desert: 10,
  wetland: 11,
  highland: 12,
  bareRock: 13,
  mountain: 14,
  snow: 15,
  tundra: 16,
  savanna: 17,
  rainforest: 18,
  marsh: 19,
  plateau: 20,
  canyon: 21,
  reef: 22,
  oasis: 23,
  volcano: 24,
  glacier: 25,
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
  settlements: GeneratedSettlement[]
  rivers: GeneratedRiver[]
  roads: GeneratedRoad[]
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
  settlements: GeneratedSettlement[]
  rivers: GeneratedRiver[]
  roads: GeneratedRoad[]
}

export interface GeneratedLandmark extends MapLandmarkDefinition {
  areaId: string
}

export type SettlementKind =
  | 'camp'
  | 'hamlet'
  | 'village'
  | 'town'
  | 'city'
  | 'port'
  | 'oasis'
  | 'fort'
  | 'watchpost'
  | 'mine'

export interface GeneratedSettlement {
  id: string
  name: string
  kind: SettlementKind
  x: number
  y: number
  biome: number
  population: number
  traffic: number
  creatureTags: string[]
  roadAccess: number
}

export type RoadKind = 'trail' | 'road' | 'trade-route' | 'pass'

export interface GeneratedRoad {
  id: string
  kind: RoadKind
  traffic: number
  fromSettlementId: string
  toSettlementId: string
  points: Array<{ x: number; y: number }>
}

export interface GeneratedRiver {
  id: string
  width: number
  flow: number
  source: { x: number; y: number }
  mouth: { x: number; y: number }
  points: Array<{ x: number; y: number }>
}

export interface GenerateWorldRequest {
  type: 'generate'
  id: string
  seed: string
  width: number
  height: number
  mapAreas?: MapAreaDefinition[]
  terrainCodes?: Record<string, number>
  biomeDefinitions?: BiomeDefinition[]
  riverSystem?: WorldRiverSystemDefinition
  roadSystem?: WorldRoadSystemDefinition
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
  biomeDefinitions?: BiomeDefinition[]
  riverSystem?: WorldRiverSystemDefinition
  roadSystem?: WorldRoadSystemDefinition
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

const DEFAULT_SEA_LEVEL = 0.43
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

function seaLevelForSeed(seed: number): number {
  const distribution = random2d(seed & 1023, (seed >>> 10) & 1023, seed ^ 0x51f15e3d)
  const variance = random2d((seed >>> 20) & 1023, seed & 2047, seed ^ 0x7f4a7c15)
  if (distribution < 0.12) {
    return 0.24 + variance * 0.32
  }
  return 0.36 + variance * 0.13
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
  height: number,
  seaLevel: number
): { ocean: Uint8Array; landmass: Uint16Array; waterbody: Uint16Array; mainlandId: number } {
  const size = width * height
  const water = new Uint8Array(size)
  const ocean = new Uint8Array(size)
  const landmass = new Uint16Array(size)
  const waterbody = new Uint16Array(size)

  for (let index = 0; index < size; index += 1) {
    water[index] = elevation[index]! / 255 < seaLevel ? 1 : 0
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
  const topology = classifyTopology(elevation, width, height, DEFAULT_SEA_LEVEL)
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

function isWaterBiome(biome: number): boolean {
  return (
    biome === BIOME.deepOcean ||
    biome === BIOME.ocean ||
    biome === BIOME.shallowSea ||
    biome === BIOME.lake ||
    biome === BIOME.reef
  )
}

function biomeRoadCost(definitions: Map<number, BiomeDefinition>, biome: number): number {
  return definitions.get(biome)?.roadCost ?? (isWaterBiome(biome) ? 999 : 4)
}

function biomeSettlementSuitability(
  definitions: Map<number, BiomeDefinition>,
  biome: number
): number {
  return definitions.get(biome)?.settlement.suitability ?? 0.1
}

function biomeCreatureTags(definitions: Map<number, BiomeDefinition>, biome: number): string[] {
  return definitions.get(biome)?.creatures.habitatTags ?? []
}

function defaultRoadSystem(): WorldRoadSystemDefinition {
  return {
    profiles: [
      {
        id: 'trail',
        name: 'Foot Trail',
        movementMultiplier: 0.86,
        width: 0.72,
        color: '#8f7f69',
        edgeColor: '#4d3f31',
        terrainTextureStrength: 0.34,
        weatherTextureStrength: 0.2,
      },
      {
        id: 'road',
        name: 'Packed Road',
        movementMultiplier: 0.68,
        width: 0.98,
        color: '#c8b6a1',
        edgeColor: '#78624d',
        terrainTextureStrength: 0.42,
        weatherTextureStrength: 0.28,
      },
      {
        id: 'trade-route',
        name: 'Royal Trade Road',
        movementMultiplier: 0.52,
        width: 1.22,
        color: '#f0d79b',
        edgeColor: '#9c7b46',
        terrainTextureStrength: 0.5,
        weatherTextureStrength: 0.34,
      },
      {
        id: 'pass',
        name: 'Mountain Pass',
        movementMultiplier: 0.9,
        width: 0.82,
        color: '#d7c8bf',
        edgeColor: '#655c57',
        terrainTextureStrength: 0.38,
        weatherTextureStrength: 0.22,
      },
    ],
    generation: {
      candidateDistance: 120,
      trafficRoadMin: 3,
      trafficTradeRouteMin: 4,
      ruggedPassThreshold: 0.68,
      smoothingIterations: 2,
      textureStep: 5,
    },
  }
}

function resolveRoadSystem(roadSystem?: WorldRoadSystemDefinition): WorldRoadSystemDefinition {
  return roadSystem ?? defaultRoadSystem()
}

function defaultRiverSystem(): WorldRiverSystemDefinition {
  return {
    enabled: true,
    blockingMovement: true,
    bridgeRadius: 1,
    renderWidth: {
      minor: 0.72,
      major: 1.18,
    },
    generation: {
      sourceStride: 14,
      sourceChance: 0.46,
      sourceElevationMin: 0.48,
      sourceMoistureMin: 0.24,
      channelDepthMin: 0.03,
      traceMargin: 72,
      minLength: 6,
      maxLength: 108,
    },
  }
}

function resolveRiverSystem(riverSystem?: WorldRiverSystemDefinition): WorldRiverSystemDefinition {
  return riverSystem ?? defaultRiverSystem()
}

function streamHotspotValue(globalX: number, globalY: number, seed: number): number {
  return clamp01(
    valueNoise(globalX - 410, globalY + 270, 210, seed + 7001) * 0.7 +
      valueNoise(globalX + 93, globalY - 185, 72, seed + 7019) * 0.3
  )
}

function streamRuggednessValue(globalX: number, globalY: number, seed: number): number {
  const ridge = Math.abs(valueNoise(globalX, globalY, 86, seed + 2503) * 2 - 1)
  const breaks = Math.abs(valueNoise(globalX + 190, globalY - 240, 28, seed + 2609) * 2 - 1)
  return clamp01(ridge * 0.72 + breaks * 0.28)
}

function streamBasinValue(
  globalX: number,
  globalY: number,
  seed: number,
  elevationValue: number
): number {
  const offsets = [
    [12, 0],
    [-12, 0],
    [0, 12],
    [0, -12],
    [9, 9],
    [-9, 9],
    [9, -9],
    [-9, -9],
  ] as const
  let rimElevation = 0
  for (const [offsetX, offsetY] of offsets) {
    rimElevation += streamElevationValue(globalX + offsetX, globalY + offsetY, seed)
  }
  rimElevation /= offsets.length
  return clamp01((rimElevation - elevationValue - 0.06) * 4.5)
}

function classifyTerrain(args: {
  elevationValue: number
  seaLevel: number
  moistureValue: number
  temperatureValue: number
  ruggednessValue: number
  hotspotValue: number
  basinValue: number
  water: boolean
  oceanConnected: boolean
  touchingWater: boolean
  reefChance: number
  oasisChance: number
}): number {
  const {
    elevationValue,
    seaLevel,
    moistureValue,
    temperatureValue,
    ruggednessValue,
    hotspotValue,
    basinValue,
    water,
    oceanConnected,
    touchingWater,
    reefChance,
    oasisChance,
  } = args

  if (water) {
    const waterDepth = seaLevel - elevationValue
    if (!oceanConnected) return BIOME.lake
    if (temperatureValue > 0.68 && waterDepth < 0.08 && reefChance > 0.76) return BIOME.reef
    if (waterDepth > 0.18) return BIOME.deepOcean
    if (waterDepth > 0.08) return BIOME.ocean
    return BIOME.shallowSea
  }

  if (touchingWater || elevationValue < seaLevel + 0.05) {
    if (temperatureValue > 0.4 && moistureValue < 0.6 && ruggednessValue < 0.34) return BIOME.beach
    return BIOME.coast
  }
  if (hotspotValue > 0.82 && elevationValue > 0.79 && ruggednessValue > 0.48) return BIOME.volcano
  if (elevationValue > 0.87 && temperatureValue < 0.3 && moistureValue > 0.58) return BIOME.glacier
  if (elevationValue > 0.83 && temperatureValue < 0.44) return BIOME.snow
  if (temperatureValue < 0.26 && elevationValue < 0.76) return BIOME.tundra
  if (ruggednessValue > 0.78 && elevationValue > 0.56 && moistureValue < 0.48) return BIOME.canyon
  if (elevationValue > 0.7 && ruggednessValue < 0.34) return BIOME.plateau
  if (elevationValue > 0.81) return BIOME.mountain
  if (elevationValue > 0.74 && moistureValue < 0.56) return BIOME.bareRock
  if (elevationValue > 0.64) return BIOME.highland
  if (basinValue > 0.66 && elevationValue < 0.58 && ruggednessValue < 0.5) return BIOME.basin
  if (moistureValue > 0.82 && temperatureValue > 0.5 && elevationValue < 0.58) return BIOME.marsh
  if (moistureValue > 0.74 && elevationValue < 0.58) return BIOME.wetland
  if (temperatureValue > 0.72 && moistureValue < 0.26) {
    if (oasisChance > 0.86 && elevationValue < 0.68) return BIOME.oasis
    return BIOME.desert
  }
  if (temperatureValue > 0.66 && moistureValue > 0.76) return BIOME.rainforest
  if (temperatureValue > 0.6 && moistureValue >= 0.3 && moistureValue < 0.56) return BIOME.savanna
  if (moistureValue > 0.58) return BIOME.forest
  if (elevationValue < 0.54) return BIOME.lowland
  return BIOME.grassland
}

function classifyStreamBiome(
  globalX: number,
  globalY: number,
  seed: number,
  seaLevel: number,
  elevationValue: number,
  moistureValue: number,
  temperatureValue: number
): number {
  const water = elevationValue < seaLevel
  const west = streamElevationValue(globalX - 1, globalY, seed) < seaLevel
  const east = streamElevationValue(globalX + 1, globalY, seed) < seaLevel
  const north = streamElevationValue(globalX, globalY - 1, seed) < seaLevel
  const south = streamElevationValue(globalX, globalY + 1, seed) < seaLevel
  const enclosed = !west && !east && !north && !south && elevationValue > 0.28
  return classifyTerrain({
    elevationValue,
    seaLevel,
    moistureValue,
    temperatureValue,
    ruggednessValue: streamRuggednessValue(globalX, globalY, seed),
    hotspotValue: streamHotspotValue(globalX, globalY, seed),
    basinValue: streamBasinValue(globalX, globalY, seed, elevationValue),
    water,
    oceanConnected: !enclosed,
    touchingWater: west || east || north || south,
    reefChance: valueNoise(globalX + 220, globalY - 160, 18, seed + 8011),
    oasisChance: valueNoise(globalX - 150, globalY + 180, 24, seed + 8039),
  })
}

function classifyChunkRegions(biomes: Uint8Array, chunkSize: number): Uint8Array {
  const size = chunkSize * chunkSize
  const region = new Uint8Array(size)
  const visited = new Uint8Array(size)

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

interface EvaluatedCell {
  biome: number
  elevationValue: number
  moistureValue: number
  temperatureValue: number
  ruggednessValue: number
  nearWater: boolean
}

function evaluateStreamCell(globalX: number, globalY: number, seed: number): EvaluatedCell {
  const seaLevel = seaLevelForSeed(seed)
  const elevationValue = streamElevationValue(globalX, globalY, seed)
  const moistureValue = streamMoistureValue(globalX, globalY, seed, elevationValue)
  const temperatureValue = streamTemperatureValue(globalX, globalY, seed, elevationValue)
  const biome = classifyStreamBiome(
    globalX,
    globalY,
    seed,
    seaLevel,
    elevationValue,
    moistureValue,
    temperatureValue
  )
  const nearWater = [
    streamElevationValue(globalX - 1, globalY, seed) < seaLevel,
    streamElevationValue(globalX + 1, globalY, seed) < seaLevel,
    streamElevationValue(globalX, globalY - 1, seed) < seaLevel,
    streamElevationValue(globalX, globalY + 1, seed) < seaLevel,
  ].some(Boolean)
  return {
    biome,
    elevationValue,
    moistureValue,
    temperatureValue,
    ruggednessValue: streamRuggednessValue(globalX, globalY, seed),
    nearWater,
  }
}

function localRuggednessFromElevation(
  elevation: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const center = elevation[y * width + x]! / 255
  let total = 0
  let count = 0
  for (const [dx, dy] of FOUR_NEIGHBORS) {
    const nextX = x + dx
    const nextY = y + dy
    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
    total += Math.abs(center - elevation[nextY * width + nextX]! / 255)
    count += 1
  }
  return clamp01((total / Math.max(1, count)) * 7 + Math.abs(center - 0.62) * 0.12)
}

function buildBiomeDefinitionMap(
  biomeDefinitions?: BiomeDefinition[]
): Map<number, BiomeDefinition> {
  return new Map((biomeDefinitions ?? []).map((biome) => [biome.code, biome]))
}

function populateChunkFeatures(
  chunk: GeneratedChunk,
  seedText: string,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
): GeneratedChunk {
  const biomeMap = buildBiomeDefinitionMap(biomeDefinitions)
  const roadsConfig = resolveRoadSystem(roadSystem)
  const riversConfig = resolveRiverSystem(riverSystem)
  const seed = hashSeed(seedText)
  const featureMargin = Math.max(48, riversConfig.generation.traceMargin)
  const minX = chunk.originX - featureMargin
  const maxX = chunk.originX + chunk.chunkSize - 1 + featureMargin
  const minY = chunk.originY - featureMargin
  const maxY = chunk.originY + chunk.chunkSize - 1 + featureMargin
  const evaluate = (x: number, y: number): EvaluatedCell => {
    if (
      x >= chunk.originX &&
      y >= chunk.originY &&
      x < chunk.originX + chunk.chunkSize &&
      y < chunk.originY + chunk.chunkSize
    ) {
      const localX = x - chunk.originX
      const localY = y - chunk.originY
      const index = localY * chunk.chunkSize + localX
      const biome = chunk.biomes[index]!
      const nearWater = FOUR_NEIGHBORS.some(([dx, dy]) => {
        const nx = localX + dx
        const ny = localY + dy
        return (
          nx >= 0 &&
          ny >= 0 &&
          nx < chunk.chunkSize &&
          ny < chunk.chunkSize &&
          isWaterBiome(chunk.biomes[ny * chunk.chunkSize + nx]!)
        )
      })
      return {
        biome,
        elevationValue: chunk.elevation[index]! / 255,
        moistureValue: chunk.moisture[index]! / 255,
        temperatureValue: chunk.temperature[index]! / 255,
        ruggednessValue:
          localRuggednessFromElevation(
            chunk.elevation,
            chunk.chunkSize,
            chunk.chunkSize,
            localX,
            localY
          ) +
          streamHotspotValue(x, y, seed) * 0.08,
        nearWater,
      }
    }
    return evaluateStreamCell(x, y, seed)
  }

  const settlements = generateSettlementsForBounds(
    seedText,
    minX,
    minY,
    maxX,
    maxY,
    evaluate,
    biomeMap
  )
  const rivers = buildRiverNetwork(seedText, minX, minY, maxX, maxY, evaluate, riversConfig).filter(
    (river) => riverTouchesChunk(river, chunk.originX, chunk.originY, chunk.chunkSize)
  )
  const roads = buildRoadNetwork(settlements, evaluate, biomeMap, roadsConfig).filter((road) =>
    roadTouchesChunk(road, chunk.originX, chunk.originY, chunk.chunkSize)
  )
  chunk.settlements = settlements.filter(
    (settlement) =>
      settlement.x >= chunk.originX &&
      settlement.y >= chunk.originY &&
      settlement.x < chunk.originX + chunk.chunkSize &&
      settlement.y < chunk.originY + chunk.chunkSize
  )
  chunk.rivers = rivers
  chunk.roads = roads
  chunk.landmarks = [...chunk.landmarks, ...chunk.settlements.map(settlementToLandmark)]
  return chunk
}

function populateWorldFeatures(
  world: GeneratedWorld,
  seedText: string,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
): GeneratedWorld {
  const biomeMap = buildBiomeDefinitionMap(biomeDefinitions)
  const roadsConfig = resolveRoadSystem(roadSystem)
  const riversConfig = resolveRiverSystem(riverSystem)
  const seed = hashSeed(seedText)
  const evaluate = (x: number, y: number): EvaluatedCell => {
    const clampedX = Math.max(0, Math.min(world.width - 1, x))
    const clampedY = Math.max(0, Math.min(world.height - 1, y))
    const index = clampedY * world.width + clampedX
    return {
      biome: world.biomes[index]!,
      elevationValue: world.elevation[index]! / 255,
      moistureValue: world.moisture[index]! / 255,
      temperatureValue: world.temperature[index]! / 255,
      ruggednessValue:
        localRuggednessFromElevation(
          world.elevation,
          world.width,
          world.height,
          clampedX,
          clampedY
        ) +
        streamHotspotValue(clampedX * 4, clampedY * 4, seed) * 0.08,
      nearWater: touchesWater(index, world.width, world.height, world.waterbody),
    }
  }
  const settlements = generateSettlementsForBounds(
    seedText,
    0,
    0,
    world.width - 1,
    world.height - 1,
    evaluate,
    biomeMap
  )
  world.settlements = settlements
  world.rivers = buildRiverNetwork(
    seedText,
    0,
    0,
    world.width - 1,
    world.height - 1,
    evaluate,
    riversConfig
  )
  world.roads = buildRoadNetwork(settlements, evaluate, biomeMap, roadsConfig)
  world.landmarks = [...world.landmarks, ...settlements.map(settlementToLandmark)]
  return world
}

function scoreSettlementSite(
  biomeDefinitions: Map<number, BiomeDefinition>,
  cell: EvaluatedCell
): number {
  if (isWaterBiome(cell.biome) || biomeRoadCost(biomeDefinitions, cell.biome) >= 999) {
    return Number.NEGATIVE_INFINITY
  }
  const temperatureComfort = 1 - Math.abs(cell.temperatureValue - 0.58)
  const moistureComfort = 1 - Math.abs(cell.moistureValue - 0.54)
  let score = biomeSettlementSuitability(biomeDefinitions, cell.biome) * 100
  score += temperatureComfort * 14
  score += moistureComfort * 12
  score -= cell.ruggednessValue * 46
  if (cell.nearWater) score += 16
  if (cell.biome === BIOME.lowland || cell.biome === BIOME.grassland) score += 10
  if (cell.biome === BIOME.coast || cell.biome === BIOME.oasis) score += 14
  if (cell.biome === BIOME.desert || cell.biome === BIOME.canyon) score -= 12
  if (cell.biome === BIOME.marsh || cell.biome === BIOME.wetland) score -= 18
  if (
    cell.biome === BIOME.mountain ||
    cell.biome === BIOME.volcano ||
    cell.biome === BIOME.glacier
  ) {
    score -= 28
  }
  return score
}

function chooseSettlementKind(
  score: number,
  nearWater: boolean,
  biome: number,
  ruggednessValue: number,
  noise: number
): SettlementKind {
  if (biome === BIOME.oasis) return 'oasis'
  if (biome === BIOME.desert || biome === BIOME.tundra) return score > 54 ? 'camp' : 'camp'
  if (ruggednessValue > 0.72 && score > 42) return noise > 0.55 ? 'fort' : 'watchpost'
  if (biome === BIOME.bareRock || biome === BIOME.volcano) return 'mine'
  if (nearWater && score > 84) return 'port'
  if (score > 92 && noise > 0.7) return 'city'
  if (score > 76) return 'town'
  if (score > 58) return 'village'
  return 'hamlet'
}

function settlementPopulation(kind: SettlementKind, noise: number): number {
  switch (kind) {
    case 'city':
      return 9000 + Math.floor(noise * 16000)
    case 'town':
    case 'port':
      return 1800 + Math.floor(noise * 5200)
    case 'village':
      return 280 + Math.floor(noise * 900)
    case 'fort':
    case 'mine':
      return 120 + Math.floor(noise * 420)
    case 'oasis':
      return 180 + Math.floor(noise * 500)
    case 'watchpost':
      return 60 + Math.floor(noise * 180)
    default:
      return 40 + Math.floor(noise * 160)
  }
}

function settlementTraffic(kind: SettlementKind, population: number): number {
  const base =
    kind === 'city'
      ? 4
      : kind === 'town' || kind === 'port'
        ? 3
        : kind === 'village' || kind === 'oasis'
          ? 2
          : 1
  return Math.max(base, population > 8000 ? 4 : population > 1800 ? 3 : base)
}

function settlementName(seed: number, gridX: number, gridY: number, kind: SettlementKind): string {
  const starts = ['Alo', 'Rin', 'Ka', 'Bel', 'Nor', 'Eld', 'Sa', 'Tor', 'Mi', 'Va', 'Lu', 'Zen']
  const mids = ['ha', 'ra', 'lo', 'mi', 'ta', 'ver', 'sha', 'dun', 'ri', 'ke', 'na', 'sol']
  const suffixes: Record<SettlementKind, string[]> = {
    camp: ['Camp', 'Rest', 'Post'],
    hamlet: ['Cross', 'Field', 'End'],
    village: ['Vale', 'Ford', 'Hollow'],
    town: ['Market', 'Bridge', 'Heights'],
    city: ['Crown', 'Harbor', 'Gate'],
    port: ['Port', 'Haven', 'Quay'],
    oasis: ['Spring', 'Palm', 'Well'],
    fort: ['Hold', 'Keep', 'Watch'],
    watchpost: ['Lookout', 'Watch', 'Tor'],
    mine: ['Mine', 'Cut', 'Delve'],
  }
  const a = starts[Math.floor(random2d(gridX, gridY, seed + 9001) * starts.length)]!
  const b = mids[Math.floor(random2d(gridX, gridY, seed + 9019) * mids.length)]!
  const c = suffixes[kind][Math.floor(random2d(gridX, gridY, seed + 9049) * suffixes[kind].length)]!
  return `${a}${b} ${c}`
}

function generateSettlementsForBounds(
  seedText: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  evaluateCell: (x: number, y: number) => EvaluatedCell,
  biomeDefinitions: Map<number, BiomeDefinition>
): GeneratedSettlement[] {
  const seed = hashSeed(seedText)
  const settlements: GeneratedSettlement[] = []
  const gridSize = 24
  const searchRadius = 5
  const minGridX = Math.floor(minX / gridSize) - 1
  const maxGridX = Math.floor(maxX / gridSize) + 1
  const minGridY = Math.floor(minY / gridSize) - 1
  const maxGridY = Math.floor(maxY / gridSize) + 1

  for (let gridY = minGridY; gridY <= maxGridY; gridY += 1) {
    for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
      const centerX = gridX * gridSize + Math.floor(random2d(gridX, gridY, seed + 9203) * gridSize)
      const centerY = gridY * gridSize + Math.floor(random2d(gridX, gridY, seed + 9241) * gridSize)
      let best: (EvaluatedCell & { x: number; y: number; score: number }) | null = null
      for (let y = centerY - searchRadius; y <= centerY + searchRadius; y += 1) {
        if (y < minY || y > maxY) continue
        for (let x = centerX - searchRadius; x <= centerX + searchRadius; x += 1) {
          if (x < minX || x > maxX) continue
          const cell = evaluateCell(x, y)
          const score = scoreSettlementSite(biomeDefinitions, cell)
          if (!Number.isFinite(score)) continue
          if (!best || score > best.score) best = { ...cell, x, y, score }
        }
      }
      if (!best || best.score < 46) continue
      if (
        settlements.some(
          (existing) =>
            Math.hypot(existing.x - best.x, existing.y - best.y) < 14 &&
            existing.population >= best.score * 20
        )
      ) {
        continue
      }
      const kindNoise = random2d(gridX, gridY, seed + 9277)
      const kind = chooseSettlementKind(
        best.score,
        best.nearWater,
        best.biome,
        best.ruggednessValue,
        kindNoise
      )
      const population = settlementPopulation(kind, random2d(gridX, gridY, seed + 9311))
      settlements.push({
        id: `settlement:${gridX}:${gridY}`,
        name: settlementName(seed, gridX, gridY, kind),
        kind,
        x: best.x,
        y: best.y,
        biome: best.biome,
        population,
        traffic: settlementTraffic(kind, population),
        creatureTags: biomeCreatureTags(biomeDefinitions, best.biome),
        roadAccess: biomeDefinitions.get(best.biome)?.settlement.roadAccess ?? 0.2,
      })
    }
  }

  return settlements.sort(
    (left, right) => right.population - left.population || left.id.localeCompare(right.id)
  )
}

function roadTraversalCost(
  biomeDefinitions: Map<number, BiomeDefinition>,
  cell: EvaluatedCell
): number {
  const base = biomeRoadCost(biomeDefinitions, cell.biome)
  if (base >= 999) return Number.POSITIVE_INFINITY
  return base + cell.ruggednessValue * 4 + (cell.nearWater ? 0.2 : 0)
}

const EIGHT_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

function smoothRoadPoints(
  points: Array<{ x: number; y: number }>,
  iterations: number
): Array<{ x: number; y: number }> {
  if (points.length <= 2 || iterations <= 0) return points
  let current = points
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = [current[0]!]
    for (let index = 0; index < current.length - 1; index += 1) {
      const from = current[index]!
      const to = current[index + 1]!
      next.push(
        { x: from.x * 0.75 + to.x * 0.25, y: from.y * 0.75 + to.y * 0.25 },
        { x: from.x * 0.25 + to.x * 0.75, y: from.y * 0.25 + to.y * 0.75 }
      )
    }
    next.push(current[current.length - 1]!)
    current = next
  }
  return current
}

function buildRoadPath(
  from: GeneratedSettlement,
  to: GeneratedSettlement,
  evaluateCell: (x: number, y: number) => EvaluatedCell,
  biomeDefinitions: Map<number, BiomeDefinition>,
  roadSystem: WorldRoadSystemDefinition
): Array<{ x: number; y: number }> {
  const minX = Math.min(from.x, to.x) - 10
  const maxX = Math.max(from.x, to.x) + 10
  const minY = Math.min(from.y, to.y) - 10
  const maxY = Math.max(from.y, to.y) + 10
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const size = width * height
  if (size > 20000) return []

  const start = (from.y - minY) * width + (from.x - minX)
  const goal = (to.y - minY) * width + (to.x - minX)
  const gScore = new Float64Array(size)
  const fScore = new Float64Array(size)
  const cameFrom = new Int32Array(size)
  const open = new Uint8Array(size)
  const closed = new Uint8Array(size)
  const cache = new Map<number, EvaluatedCell>()
  for (let index = 0; index < size; index += 1) {
    gScore[index] = Number.POSITIVE_INFINITY
    fScore[index] = Number.POSITIVE_INFINITY
    cameFrom[index] = -1
  }

  const heuristic = (index: number) => {
    const x = index % width
    const y = Math.floor(index / width)
    return Math.hypot((goal % width) - x, Math.floor(goal / width) - y)
  }

  const getCell = (index: number) => {
    const cached = cache.get(index)
    if (cached) return cached
    const x = minX + (index % width)
    const y = minY + Math.floor(index / width)
    const cell = evaluateCell(x, y)
    cache.set(index, cell)
    return cell
  }

  gScore[start] = 0
  fScore[start] = heuristic(start)
  open[start] = 1

  while (true) {
    let current = -1
    let currentScore = Number.POSITIVE_INFINITY
    for (let index = 0; index < size; index += 1) {
      if (!open[index] || fScore[index]! >= currentScore) continue
      current = index
      currentScore = fScore[index]!
    }
    if (current < 0) return []
    if (current == goal) break
    open[current] = 0
    closed[current] = 1
    const currentX = current % width
    const currentY = Math.floor(current / width)

    for (const [dx, dy] of EIGHT_NEIGHBORS) {
      const nextX = currentX + dx
      const nextY = currentY + dy
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
      const next = nextY * width + nextX
      if (closed[next]) continue
      const cell = getCell(next)
      const traversal = roadTraversalCost(biomeDefinitions, cell)
      if (!Number.isFinite(traversal)) continue
      const step = Math.hypot(dx, dy) * traversal
      const tentative = gScore[current]! + step
      if (tentative >= gScore[next]!) continue
      cameFrom[next] = current
      gScore[next] = tentative
      fScore[next] = tentative + heuristic(next)
      open[next] = 1
    }
  }

  const raw: Array<{ x: number; y: number }> = []
  let current = goal
  while (current >= 0) {
    raw.push({ x: minX + (current % width), y: minY + Math.floor(current / width) })
    current = cameFrom[current]!
  }
  raw.reverse()
  if (raw.length <= 2) return raw

  const simplified = [raw[0]!]
  let previousDirection = ''
  for (let index = 1; index < raw.length - 1; index += 1) {
    const prev = raw[index - 1]!
    const currentPoint = raw[index]!
    const next = raw[index + 1]!
    const direction = `${Math.sign(currentPoint.x - prev.x)},${Math.sign(currentPoint.y - prev.y)}:${Math.sign(next.x - currentPoint.x)},${Math.sign(next.y - currentPoint.y)}`
    if (direction !== previousDirection || index % 3 === 0) {
      simplified.push(currentPoint)
      previousDirection = direction
    }
  }
  simplified.push(raw[raw.length - 1]!)
  return smoothRoadPoints(simplified, roadSystem.generation.smoothingIterations)
}

function roadKindForConnection(
  from: GeneratedSettlement,
  to: GeneratedSettlement,
  sampleRuggedness: number,
  roadSystem: WorldRoadSystemDefinition
): RoadKind {
  const traffic = Math.max(from.traffic, to.traffic)
  if (sampleRuggedness > roadSystem.generation.ruggedPassThreshold) return 'pass'
  if (
    traffic >= roadSystem.generation.trafficTradeRouteMin ||
    from.kind === 'port' ||
    to.kind === 'port' ||
    from.kind === 'oasis' ||
    to.kind === 'oasis'
  ) {
    return 'trade-route'
  }
  if (traffic >= roadSystem.generation.trafficRoadMin) return 'road'
  return 'trail'
}

function buildRoadNetwork(
  settlements: GeneratedSettlement[],
  evaluateCell: (x: number, y: number) => EvaluatedCell,
  biomeDefinitions: Map<number, BiomeDefinition>,
  roadSystem: WorldRoadSystemDefinition
): GeneratedRoad[] {
  const roads: GeneratedRoad[] = []
  const seenPairs = new Set<string>()
  for (const settlement of settlements) {
    const desiredLinks = settlement.traffic >= 4 ? 3 : settlement.traffic >= 3 ? 2 : 1
    const neighbors = settlements
      .filter((candidate) => candidate.id !== settlement.id)
      .map((candidate) => ({
        candidate,
        distance: Math.hypot(candidate.x - settlement.x, candidate.y - settlement.y),
      }))
      .filter(
        ({ candidate, distance }) =>
          distance <= roadSystem.generation.candidateDistance &&
          candidate.population >= settlement.population * 0.55
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, desiredLinks + 2)

    let links = 0
    for (const { candidate } of neighbors) {
      if (links >= desiredLinks) break
      const pairKey = [settlement.id, candidate.id].sort().join('::')
      if (seenPairs.has(pairKey)) continue
      const path = buildRoadPath(settlement, candidate, evaluateCell, biomeDefinitions, roadSystem)
      if (path.length < 2) continue
      const midpoint = path[Math.floor(path.length / 2)]!
      const ruggedness = evaluateCell(midpoint.x, midpoint.y).ruggednessValue
      roads.push({
        id: `road:${pairKey}`,
        kind: roadKindForConnection(settlement, candidate, ruggedness, roadSystem),
        traffic: Math.max(settlement.traffic, candidate.traffic),
        fromSettlementId: settlement.id,
        toSettlementId: candidate.id,
        points: path,
      })
      seenPairs.add(pairKey)
      links += 1
    }
  }
  return roads
}

function traceRiverPath(
  sourceX: number,
  sourceY: number,
  evaluateCell: (x: number, y: number) => EvaluatedCell,
  riverSystem: WorldRiverSystemDefinition
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [{ x: sourceX, y: sourceY }]
  const visited = new Set<string>([`${sourceX},${sourceY}`])
  const source = evaluateCell(sourceX, sourceY)
  let currentX = sourceX
  let currentY = sourceY

  for (let step = 0; step < riverSystem.generation.maxLength; step += 1) {
    const current = evaluateCell(currentX, currentY)
    if (isWaterBiome(current.biome)) break

    let best: { x: number; y: number; score: number; water: boolean } | null = null
    for (const [dx, dy] of EIGHT_NEIGHBORS) {
      const nextX = currentX + dx
      const nextY = currentY + dy
      const key = `${nextX},${nextY}`
      if (visited.has(key)) continue
      const candidate = evaluateCell(nextX, nextY)
      const water = isWaterBiome(candidate.biome)
      const depthDrop =
        current.elevationValue -
        candidate.elevationValue +
        (candidate.moistureValue - current.moistureValue) * 0.12
      const score =
        (water ? 10 : 0) +
        depthDrop * 8 -
        candidate.ruggednessValue * 0.15 -
        Math.abs(dx) * 0.03 -
        Math.abs(dy) * 0.03
      if (!best || score > best.score) {
        best = { x: nextX, y: nextY, score, water }
      }
    }

    if (!best) break
    if (!best.water && best.score < riverSystem.generation.channelDepthMin * 8) break
    currentX = best.x
    currentY = best.y
    points.push({ x: currentX, y: currentY })
    visited.add(`${currentX},${currentY}`)
    if (best.water) break
  }

  const last = points[points.length - 1]
  if (!last) return []
  const mouth = evaluateCell(last.x, last.y)
  if (isWaterBiome(mouth.biome)) return points
  if (mouth.elevationValue <= source.elevationValue - riverSystem.generation.channelDepthMin * 4) {
    return points
  }
  return []
}

function riverTouchesChunk(
  river: GeneratedRiver,
  originX: number,
  originY: number,
  chunkSize: number
): boolean {
  const maxX = originX + chunkSize - 1
  const maxY = originY + chunkSize - 1
  return river.points.some(
    (point) => point.x >= originX && point.x <= maxX && point.y >= originY && point.y <= maxY
  )
}

function buildRiverNetwork(
  seedText: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  evaluateCell: (x: number, y: number) => EvaluatedCell,
  riverSystem: WorldRiverSystemDefinition
): GeneratedRiver[] {
  if (!riverSystem.enabled) return []
  const seed = hashSeed(seedText)
  const rivers: GeneratedRiver[] = []
  const seenMouths = new Set<string>()
  const stride = riverSystem.generation.sourceStride
  const startX = Math.floor(minX / stride) * stride
  const startY = Math.floor(minY / stride) * stride

  for (let y = startY; y <= maxY; y += stride) {
    for (let x = startX; x <= maxX; x += stride) {
      const chance = random2d(x, y, seed + 12031)
      if (chance > riverSystem.generation.sourceChance) continue
      const source = evaluateCell(x, y)
      if (isWaterBiome(source.biome)) continue
      if (source.elevationValue < riverSystem.generation.sourceElevationMin) continue
      if (source.moistureValue < riverSystem.generation.sourceMoistureMin) continue
      const path = traceRiverPath(x, y, evaluateCell, riverSystem)
      if (path.length < riverSystem.generation.minLength) continue
      const mouth = path[path.length - 1]!
      const mouthKey = `${mouth.x},${mouth.y}`
      if (seenMouths.has(mouthKey)) continue
      seenMouths.add(mouthKey)
      rivers.push({
        id: `river:${x}:${y}`,
        width:
          path.length > riverSystem.generation.minLength * 2
            ? riverSystem.renderWidth.major
            : riverSystem.renderWidth.minor,
        flow: clamp01(path.length / riverSystem.generation.maxLength),
        source: { x, y },
        mouth: { x: mouth.x, y: mouth.y },
        points: path,
      })
    }
  }

  if (!rivers.length) {
    let fallbackSource: { x: number; y: number; score: number } | null = null
    for (let y = minY; y <= maxY; y += Math.max(6, Math.floor(stride / 2))) {
      for (let x = minX; x <= maxX; x += Math.max(6, Math.floor(stride / 2))) {
        const cell = evaluateCell(x, y)
        if (isWaterBiome(cell.biome)) continue
        const score =
          cell.elevationValue * 0.7 + cell.moistureValue * 0.3 - cell.ruggednessValue * 0.15
        if (!fallbackSource || score > fallbackSource.score) fallbackSource = { x, y, score }
      }
    }

    if (fallbackSource) {
      const points: Array<{ x: number; y: number }> = [{ x: fallbackSource.x, y: fallbackSource.y }]
      const visited = new Set<string>([`${fallbackSource.x},${fallbackSource.y}`])
      let currentX = fallbackSource.x
      let currentY = fallbackSource.y
      for (let step = 0; step < riverSystem.generation.maxLength; step += 1) {
        const current = evaluateCell(currentX, currentY)
        let best: { x: number; y: number; value: number } | null = null
        for (const [dx, dy] of EIGHT_NEIGHBORS) {
          const nextX = currentX + dx
          const nextY = currentY + dy
          const key = `${nextX},${nextY}`
          if (visited.has(key)) continue
          const next = evaluateCell(nextX, nextY)
          const value =
            next.elevationValue +
            (Math.abs(nextX - minX) / Math.max(1, maxX - minX)) * 0.01 +
            (Math.abs(nextY - minY) / Math.max(1, maxY - minY)) * 0.01
          if (!best || value < best.value) best = { x: nextX, y: nextY, value }
          if (isWaterBiome(next.biome)) {
            best = { x: nextX, y: nextY, value: -1 }
            break
          }
        }
        if (!best) break
        currentX = best.x
        currentY = best.y
        points.push({ x: currentX, y: currentY })
        visited.add(`${currentX},${currentY}`)
        if (isWaterBiome(evaluateCell(currentX, currentY).biome)) break
        if (
          best.value >= current.elevationValue &&
          points.length >= riverSystem.generation.minLength
        )
          break
      }

      if (points.length >= riverSystem.generation.minLength) {
        const mouth = points[points.length - 1]!
        rivers.push({
          id: `river:fallback:${fallbackSource.x}:${fallbackSource.y}`,
          width: riverSystem.renderWidth.minor,
          flow: clamp01(points.length / riverSystem.generation.maxLength),
          source: { x: fallbackSource.x, y: fallbackSource.y },
          mouth: { x: mouth.x, y: mouth.y },
          points,
        })
      }
    }
  }

  return rivers
}

function roadTouchesChunk(
  road: GeneratedRoad,
  originX: number,
  originY: number,
  chunkSize: number
): boolean {
  const maxX = originX + chunkSize - 1
  const maxY = originY + chunkSize - 1
  return road.points.some(
    (point) => point.x >= originX && point.x <= maxX && point.y >= originY && point.y <= maxY
  )
}

function settlementToLandmark(settlement: GeneratedSettlement): GeneratedLandmark {
  const creatures = settlement.creatureTags.slice(0, 2).join(', ')
  return {
    id: settlement.id,
    name: settlement.name,
    x: settlement.x,
    y: settlement.y,
    kind: `settlement:${settlement.kind}`,
    description: `${settlement.kind} population ${settlement.population}. Nearby creatures favor ${creatures || 'local mixed habitats'}.`,
    areaId: '',
  }
}

export function applyMapAreas(
  world: GeneratedWorld,
  areas: MapAreaDefinition[],
  terrainCodes: Record<string, number>,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
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
  world.settlements = []
  world.rivers = []
  world.roads = []
  populateWorldFeatures(world, world.seed, biomeDefinitions, riverSystem, roadSystem)

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
  surveyHeight: number,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
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
  chunk.settlements = []
  chunk.rivers = []
  chunk.roads = []
  populateChunkFeatures(chunk, chunk.seed, biomeDefinitions, riverSystem, roadSystem)

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

export function generateWorld(
  seedText: string,
  width: number,
  height: number,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
): GeneratedWorld {
  const started = globalThis.performance?.now?.() ?? Date.now()
  const seed = hashSeed(seedText)
  const seaLevel = seaLevelForSeed(seed)
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

  const topology = classifyTopology(elevation, width, height, seaLevel)
  let worldHash = 2166136261

  for (let index = 0; index < size; index += 1) {
    const x = index % width
    const y = Math.floor(index / width)
    const elevationValue = elevation[index]! / 255
    const moistureValue = moisture[index]! / 255
    const temperatureValue = temperature[index]! / 255
    const biome = classifyTerrain({
      elevationValue,
      seaLevel,
      moistureValue,
      temperatureValue,
      ruggednessValue:
        localRuggednessFromElevation(elevation, width, height, x, y) +
        streamHotspotValue(x * 4, y * 4, seed) * 0.08,
      hotspotValue: streamHotspotValue(x * 4, y * 4, seed),
      basinValue: streamBasinValue(x * 4, y * 4, seed, elevationValue),
      water: Boolean(topology.waterbody[index]),
      oceanConnected: Boolean(topology.ocean[index]),
      touchingWater: touchesWater(index, width, height, topology.waterbody),
      reefChance: valueNoise(x + 220, y - 160, 18, seed + 8011),
      oasisChance: valueNoise(x - 150, y + 180, 24, seed + 8039),
    })

    biomes[index] = biome
    worldHash ^= biome + elevation[index]! + topology.landmass[index]! + topology.waterbody[index]!
    worldHash = Math.imul(worldHash, 16777619)
  }

  const world: GeneratedWorld = {
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
    settlements: [],
    rivers: [],
    roads: [],
  }
  return populateWorldFeatures(world, seedText, biomeDefinitions, riverSystem, roadSystem)
}

export function generateChunk(
  seedText: string,
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
): GeneratedChunk {
  const started = globalThis.performance?.now?.() ?? Date.now()
  const seed = hashSeed(seedText)
  const seaLevel = seaLevelForSeed(seed)
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
        seaLevel,
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

  const chunk: GeneratedChunk = {
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
    settlements: [],
    rivers: [],
    roads: [],
  }
  return populateChunkFeatures(chunk, seedText, biomeDefinitions, riverSystem, roadSystem)
}

export function generateChunkWithAreas(
  seedText: string,
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  surveyWidth: number,
  surveyHeight: number,
  areas: MapAreaDefinition[],
  terrainCodes: Record<string, number>,
  biomeDefinitions?: BiomeDefinition[],
  riverSystem?: WorldRiverSystemDefinition,
  roadSystem?: WorldRoadSystemDefinition
): GeneratedChunk {
  const chunk = generateChunk(
    seedText,
    chunkX,
    chunkY,
    chunkSize,
    biomeDefinitions,
    riverSystem,
    roadSystem
  )
  return applyAreasToChunk(
    chunk,
    areas,
    terrainCodes,
    surveyWidth,
    surveyHeight,
    biomeDefinitions,
    riverSystem,
    roadSystem
  )
}
