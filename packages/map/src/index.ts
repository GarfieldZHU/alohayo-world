export const BIOME = {
  ocean: 0,
  coast: 1,
  grassland: 2,
  forest: 3,
  desert: 4,
  wetland: 5,
  mountain: 6,
  snow: 7,
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

export function generateWorld(seedText: string, width: number, height: number): GeneratedWorld {
  const started = globalThis.performance?.now?.() ?? Date.now()
  const seed = hashSeed(seedText)
  const size = width * height
  const elevation = new Uint8Array(size)
  const moisture = new Uint8Array(size)
  const temperature = new Uint8Array(size)
  const biomes = new Uint8Array(size)
  let worldHash = 2166136261

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const nx = (x / (width - 1)) * 2 - 1
      const ny = (y / (height - 1)) * 2 - 1
      const edge = Math.max(Math.abs(nx), Math.abs(ny))
      const continent = octaveNoise(x, y, seed) - Math.max(0, edge - 0.56) * 0.9
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

      let biome: number = BIOME.grassland
      if (elevationValue < 0.43) biome = BIOME.ocean
      else if (elevationValue < 0.47) biome = BIOME.coast
      else if (elevationValue > 0.82 && temperatureValue < 0.42) biome = BIOME.snow
      else if (elevationValue > 0.78) biome = BIOME.mountain
      else if (moistureValue > 0.7 && elevationValue < 0.58) biome = BIOME.wetland
      else if (temperatureValue > 0.68 && moistureValue < 0.42) biome = BIOME.desert
      else if (moistureValue > 0.57) biome = BIOME.forest
      biomes[index] = biome

      worldHash ^= biome + elevation[index]!
      worldHash = Math.imul(worldHash, 16777619)
    }
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
  }
}
