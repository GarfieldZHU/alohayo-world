import type { WorldWeatherDefinition } from '@alohayo/config'
import {
  drainageInputAt,
  weatherAt,
  type RegionalWeatherStateSnapshot,
} from './regional-weather-state'

export interface RegionalWeatherSample {
  regionId: string
  front: number
  wind: { x: number; y: number; speed: number }
  precipitation: number
  accumulation: number
  visibility: number
  comfort: number
  stateId: string
  frontId: string
  pressure: number
  humidity: number
  temperatureAnomaly: number
  drainageInput: ReturnType<typeof drainageInputAt>
  forecast: Array<{ stateId: string; precipitation: number; windSpeed: number }>
}

function hash(value: number): number {
  let state = value | 0
  state = Math.imul(state ^ (state >>> 16), 0x45d9f3b)
  state = Math.imul(state ^ (state >>> 16), 0x45d9f3b)
  return ((state ^ (state >>> 16)) >>> 0) / 4294967296
}

function seedHash(seed: string): number {
  let value = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value | 0
}

function regionBucket(seed: number, x: number, y: number, scale: number): string {
  const gx = Math.floor(x / Math.max(1, scale))
  const gy = Math.floor(y / Math.max(1, scale))
  return `front:${gx}:${gy}:${Math.floor(hash(seed ^ (gx * 374761393) ^ (gy * 668265263)) * 7)}`
}

function stateAt(weather: WorldWeatherDefinition, cycle: number) {
  const total = weather.states.reduce((sum, state) => sum + state.duration, 0)
  let cursor = 0
  for (const state of weather.states) {
    cursor += state.duration / Math.max(0.001, total)
    if (cycle <= cursor || state === weather.states.at(-1)) return state
  }
  return weather.states[0]!
}

/** Deterministic region-scale weather query shared by gameplay and diagnostics. */
export function sampleRegionalWeather(args: {
  seed: string
  x: number
  y: number
  elapsedSeconds: number
  weather?: WorldWeatherDefinition
  state?: RegionalWeatherStateSnapshot
}): RegionalWeatherSample {
  const weather = args.weather
  if (!weather?.enabled || !weather.states.length) {
    return {
      regionId: 'front:clear',
      front: 0,
      wind: { x: 0, y: 0, speed: 0 },
      precipitation: 0,
      accumulation: 0,
      visibility: 1,
      comfort: 1,
      stateId: 'clear',
      frontId: 'front:clear',
      pressure: 1,
      humidity: 0,
      temperatureAnomaly: 0,
      drainageInput: { precipitation: 0, accumulation: 0, runoff: 0 },
      forecast: [],
    }
  }
  if (args.state) {
    const cell = weatherAt(args.state, { x: args.x, y: args.y })
    const drainageInput = drainageInputAt(args.state, { x: args.x, y: args.y })
    const windSpeed = Math.hypot(cell.windX, cell.windY)
    const state = weather.states.reduce((closest, candidate) =>
      Math.abs(candidate.wetness - cell.precipitation) <
      Math.abs(closest.wetness - cell.precipitation)
        ? candidate
        : closest
    )
    const precipitation = Math.min(1, Math.max(0, cell.precipitation))
    const visibility = Math.max(0.35, 1 - precipitation * 0.38 - windSpeed * 0.1)
    const comfort = Math.max(0, 1 - precipitation * 0.36 - (state.id === 'snow' ? 0.24 : 0))
    return {
      regionId: `front:${cell.x}:${cell.y}`,
      front: Math.min(1, Math.max(0, 1 - cell.pressure)),
      wind: { x: cell.windX, y: cell.windY, speed: windSpeed },
      precipitation,
      accumulation: drainageInput.accumulation,
      visibility,
      comfort,
      stateId: state.id,
      frontId: cell.frontId,
      pressure: cell.pressure,
      humidity: cell.humidity,
      temperatureAnomaly: cell.temperatureAnomaly,
      drainageInput,
      forecast: [1, 2, 3].map((step) => ({
        stateId: state.id,
        precipitation: Math.min(1, precipitation + step * 0.02),
        windSpeed: Math.min(1, windSpeed + step * 0.025),
      })),
    }
  }
  const seed = seedHash(args.seed)
  const scale = Math.max(8, weather.cellScale)
  const regionId = regionBucket(seed, args.x, args.y, scale)
  const regionNoise = hash(
    seed ^ (Math.floor(args.x / scale) * 374761393) ^ (Math.floor(args.y / scale) * 668265263)
  )
  const cycle =
    (((args.elapsedSeconds / Math.max(1, weather.cycleSeconds) + regionNoise * 0.37) % 1) + 1) % 1
  const state = stateAt(weather, cycle)
  const front =
    Math.sin(
      (args.elapsedSeconds / Math.max(1, weather.cycleSeconds)) * Math.PI * 2 + regionNoise * 9
    ) *
      0.5 +
    0.5
  const windAngle = regionNoise * Math.PI * 2 + args.elapsedSeconds * 0.002
  const windSpeed = Math.min(1, 0.18 + front * 0.52 + (state.id === 'rain' ? 0.18 : 0))
  const precipitation = Math.min(1, Math.max(0, state.wetness * (0.58 + front * 0.42)))
  const accumulation = Math.min(1, Math.max(0, precipitation * (0.4 + regionNoise * 0.35)))
  const visibility = Math.max(0.35, 1 - precipitation * 0.38 - windSpeed * 0.1)
  const comfort = Math.max(0, 1 - precipitation * 0.36 - (state.id === 'snow' ? 0.24 : 0))
  const forecast = [1, 2, 3].map((step) => {
    const next = stateAt(
      weather,
      ((args.elapsedSeconds + step * weather.transitionSeconds) /
        Math.max(1, weather.cycleSeconds) +
        regionNoise * 0.37) %
        1
    )
    return {
      stateId: next.id,
      precipitation: Math.min(1, next.wetness * (0.58 + front * 0.42)),
      windSpeed: Math.min(1, windSpeed + step * 0.025),
    }
  })
  return {
    regionId,
    front,
    wind: {
      x: Math.cos(windAngle) * windSpeed,
      y: Math.sin(windAngle) * windSpeed,
      speed: windSpeed,
    },
    precipitation,
    accumulation,
    visibility,
    comfort,
    stateId: state.id,
    frontId: regionId,
    pressure: 1 - front,
    humidity: precipitation,
    temperatureAnomaly: state.id === 'snow' ? -0.4 : state.id === 'rain' ? 0.08 : 0,
    drainageInput: {
      precipitation,
      accumulation,
      runoff: Math.min(1, accumulation * (0.35 + (1 - front) * 0.45)),
    },
    forecast,
  }
}
