import type { BiomeDefinition, WorldRoadConditionId, WorldWeatherDefinition } from '@alohayo/config'
import type { ActiveWeatherState } from './types'

export interface WeatherSurfaceSample {
  wetness: number
  snowCover: number
  mud: number
  condition: WorldRoadConditionId
}

function noise(x: number, y: number, seed: number) {
  let value = Math.imul(x + seed, 374761393) ^ Math.imul(y - seed, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff
}

/**
 * Produces reversible, local surface state from seed, clock phase, biome, and cell.
 * Base terrain is never mutated: callers may discard and rebuild this sample at any time.
 */
export function sampleWeatherSurface(args: {
  state: ActiveWeatherState
  weather?: WorldWeatherDefinition
  biome: BiomeDefinition
  cellX: number
  cellY: number
  seed: number
}): WeatherSurfaceSample {
  const variation = 0.58 + noise(args.cellX, args.cellY, args.seed + 711) * 0.42
  const exposure = args.state.fade * variation
  const cold = args.biome.temperature.max <= (args.weather?.snowTemperatureMax ?? 0.42) + 0.12
  const wetness = args.state.wetness * exposure
  const snowCover = cold ? args.state.snowCover * exposure : 0
  const mudFriendly = ['plain', 'grassland', 'forest', 'wetland'].includes(args.biome.family)
  const mud = mudFriendly ? args.state.mud * exposure : 0
  const floodProne = args.biome.family === 'wetland' || args.biome.family === 'coast'

  let condition: WorldRoadConditionId = 'dry'
  if (floodProne && wetness > 0.56 && noise(args.cellX, args.cellY, args.seed + 911) > 0.7) {
    condition = 'flooded'
  } else if (snowCover > 0.34 && wetness > 0.16) {
    condition = 'slushy'
  } else if (snowCover > 0.18) {
    condition = 'snowy'
  } else if (mud > 0.2) {
    condition = 'muddy'
  } else if (wetness > 0.12) {
    condition = 'wet'
  }

  return { wetness, snowCover, mud, condition }
}
