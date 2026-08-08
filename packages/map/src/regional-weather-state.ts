import type {
  WorldSaveWeatherCellState,
  WorldSaveWeatherHistoryEntry,
  WorldSaveWeatherState,
  WorldWeatherDefinition,
} from '@alohayo/config'

export const REGIONAL_WEATHER_STATE_SCHEMA_VERSION = 1 as const
export const DEFAULT_REGIONAL_WEATHER_TICK_SECONDS = 12
export const DEFAULT_REGIONAL_WEATHER_MAX_CELLS = 256
export const DEFAULT_REGIONAL_WEATHER_HISTORY_LIMIT = 8

export type RegionalWeatherCellState = WorldSaveWeatherCellState
export type RegionalWeatherHistoryEntry = WorldSaveWeatherHistoryEntry
export type RegionalWeatherStateSnapshot = WorldSaveWeatherState

export interface RegionalWeatherStateOptions {
  seed: string
  weather?: WorldWeatherDefinition
  tickSeconds?: number
  cellScale?: number
  maxCells?: number
  historyLimit?: number
}

export interface RegionalWeatherQuery {
  x: number
  y: number
}

export interface RegionalWeatherDrainageInput {
  precipitation: number
  accumulation: number
  runoff: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
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

function regionCoordinates(state: RegionalWeatherStateSnapshot, x: number, y: number) {
  return {
    x: Math.floor(x / Math.max(1, state.cellScale)),
    y: Math.floor(y / Math.max(1, state.cellScale)),
  }
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`
}

function forcing(seed: number, x: number, y: number, tick: number, salt: number) {
  return hash(
    seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(tick, 1442695041) ^ salt
  )
}

function frontId(x: number, y: number, tick: number, value: number) {
  return `front:${x}:${y}:${Math.floor(value * 7)}:${tick % 32}`
}

function deriveCell(
  state: RegionalWeatherStateSnapshot,
  x: number,
  y: number,
  tick = state.tick
): RegionalWeatherCellState {
  const seed = seedHash(state.seed)
  const pressureNoise = forcing(seed, x, y, tick, 17)
  const humidityNoise = forcing(seed, x, y, tick, 31)
  const temperatureNoise = forcing(seed, x, y, tick, 47)
  const windNoise = forcing(seed, x, y, tick, 61)
  const precipitation = clamp(humidityNoise * 0.62 + pressureNoise * 0.18, 0, 1)
  const windSpeed = clamp(0.12 + windNoise * 0.72, 0, 1)
  const windAngle = forcing(seed, x, y, tick, 79) * Math.PI * 2
  return {
    key: cellKey(x, y),
    x,
    y,
    tick,
    pressure: clamp(0.28 + pressureNoise * 0.64, 0, 1),
    humidity: clamp(0.14 + humidityNoise * 0.82, 0, 1),
    precipitation,
    temperatureAnomaly: (temperatureNoise - 0.5) * 0.72,
    windX: Math.cos(windAngle) * windSpeed,
    windY: Math.sin(windAngle) * windSpeed,
    frontId: frontId(x, y, tick, pressureNoise),
    lastTouchedTick: tick,
  }
}

function evolveCell(
  state: RegionalWeatherStateSnapshot,
  cell: RegionalWeatherCellState,
  weather: WorldWeatherDefinition | undefined
): RegionalWeatherCellState {
  const seed = seedHash(state.seed)
  const pressureForcing = forcing(seed, cell.x, cell.y, state.tick, 101)
  const humidityForcing = forcing(seed, cell.x, cell.y, state.tick, 113)
  const temperatureForcing = forcing(seed, cell.x, cell.y, state.tick, 127)
  const windForcing = forcing(seed, cell.x, cell.y, state.tick, 139)
  const pressure = clamp(cell.pressure * 0.84 + pressureForcing * 0.16, 0, 1)
  const humidity = clamp(cell.humidity * 0.8 + humidityForcing * 0.2, 0, 1)
  const precipitation = clamp(
    humidity * 0.62 + (1 - pressure) * 0.24 + (weather?.rainThreshold ?? 0.58) * 0.08,
    0,
    1
  )
  const temperatureAnomaly = clamp(
    cell.temperatureAnomaly * 0.86 + (temperatureForcing - 0.5) * 0.2,
    -1,
    1
  )
  const windAngle = windForcing * Math.PI * 2 + state.tick * 0.021
  const windSpeed = clamp(0.1 + (1 - pressure) * 0.52 + humidity * 0.22, 0, 1)
  return {
    ...cell,
    tick: state.tick,
    pressure,
    humidity,
    precipitation,
    temperatureAnomaly,
    windX: Math.cos(windAngle) * windSpeed,
    windY: Math.sin(windAngle) * windSpeed,
    frontId: frontId(cell.x, cell.y, state.tick, pressure),
    lastTouchedTick: state.tick,
  }
}

function normalizeCell(cell: RegionalWeatherCellState): RegionalWeatherCellState {
  return {
    key: cellKey(Math.trunc(cell.x), Math.trunc(cell.y)),
    x: Math.trunc(cell.x),
    y: Math.trunc(cell.y),
    tick: Math.max(0, Math.trunc(cell.tick)),
    pressure: clamp(cell.pressure, 0, 1),
    humidity: clamp(cell.humidity, 0, 1),
    precipitation: clamp(cell.precipitation, 0, 1),
    temperatureAnomaly: clamp(cell.temperatureAnomaly, -1, 1),
    windX: clamp(cell.windX, -1, 1),
    windY: clamp(cell.windY, -1, 1),
    frontId: typeof cell.frontId === 'string' ? cell.frontId : 'front:unknown',
    lastTouchedTick: Math.max(0, Math.trunc(cell.lastTouchedTick ?? cell.tick)),
  }
}

function normalizeHistory(
  history: RegionalWeatherHistoryEntry[] | undefined,
  limit: number
): RegionalWeatherHistoryEntry[] {
  return (history ?? [])
    .map((entry) => ({
      tick: Math.max(0, Math.trunc(entry.tick)),
      changedKeys: [...new Set(entry.changedKeys)].sort(),
    }))
    .sort((left, right) => left.tick - right.tick)
    .slice(-limit)
}

export function createRegionalWeatherState(
  options: RegionalWeatherStateOptions
): RegionalWeatherStateSnapshot {
  const weather = options.weather
  return {
    schemaVersion: REGIONAL_WEATHER_STATE_SCHEMA_VERSION,
    seed: options.seed,
    tick: 0,
    accumulatorSeconds: 0,
    tickSeconds: Math.max(
      1,
      options.tickSeconds ??
        Math.min(DEFAULT_REGIONAL_WEATHER_TICK_SECONDS, weather?.transitionSeconds ?? 12)
    ),
    cellScale: Math.max(8, Math.trunc(options.cellScale ?? weather?.cellScale ?? 48)),
    maxCells: Math.max(1, Math.trunc(options.maxCells ?? DEFAULT_REGIONAL_WEATHER_MAX_CELLS)),
    historyLimit: Math.max(
      1,
      Math.trunc(options.historyLimit ?? DEFAULT_REGIONAL_WEATHER_HISTORY_LIMIT)
    ),
    cells: [],
    history: [],
  }
}

export function restoreRegionalWeatherState(
  snapshot: RegionalWeatherStateSnapshot,
  options: Pick<RegionalWeatherStateOptions, 'seed' | 'weather'>
): RegionalWeatherStateSnapshot {
  if (snapshot.schemaVersion !== REGIONAL_WEATHER_STATE_SCHEMA_VERSION) {
    throw new Error(`unsupported regional weather schema ${String(snapshot.schemaVersion)}`)
  }
  if (snapshot.seed !== options.seed) {
    throw new Error('regional weather seed does not match the active world')
  }
  const normalized = createRegionalWeatherState({
    ...options,
    tickSeconds: snapshot.tickSeconds,
    cellScale: snapshot.cellScale,
    maxCells: snapshot.maxCells,
    historyLimit: snapshot.historyLimit,
  })
  normalized.tick = Math.max(0, Math.trunc(snapshot.tick))
  normalized.accumulatorSeconds = clamp(snapshot.accumulatorSeconds, 0, normalized.tickSeconds)
  normalized.cells = snapshot.cells
    .map(normalizeCell)
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(-normalized.maxCells)
  normalized.history = normalizeHistory(snapshot.history, normalized.historyLimit)
  return normalized
}

export function primeRegionalWeatherCell(
  state: RegionalWeatherStateSnapshot,
  query: RegionalWeatherQuery
): RegionalWeatherCellState {
  const coordinates = regionCoordinates(state, query.x, query.y)
  const key = cellKey(coordinates.x, coordinates.y)
  const existing = state.cells.find((cell) => cell.key === key)
  if (existing) {
    existing.lastTouchedTick = state.tick
    return existing
  }
  const next = deriveCell(state, coordinates.x, coordinates.y)
  state.cells.push(next)
  state.cells.sort((left, right) => left.key.localeCompare(right.key))
  while (state.cells.length > state.maxCells) {
    state.cells.sort(
      (left, right) =>
        left.lastTouchedTick - right.lastTouchedTick || left.key.localeCompare(right.key)
    )
    state.cells.shift()
  }
  return next
}

/** Pure query: unknown cells are derived without mutating the retained state. */
export function weatherAt(
  state: RegionalWeatherStateSnapshot,
  query: RegionalWeatherQuery
): RegionalWeatherCellState {
  const coordinates = regionCoordinates(state, query.x, query.y)
  const key = cellKey(coordinates.x, coordinates.y)
  const existing = state.cells.find((cell) => cell.key === key)
  return existing ? { ...existing } : deriveCell(state, coordinates.x, coordinates.y)
}

export function visibilityModifierAt(
  state: RegionalWeatherStateSnapshot,
  query: RegionalWeatherQuery
): number {
  const cell = weatherAt(state, query)
  const windSpeed = Math.hypot(cell.windX, cell.windY)
  return clamp(1 - cell.precipitation * 0.38 - windSpeed * 0.1, 0.35, 1)
}

export function drainageInputAt(
  state: RegionalWeatherStateSnapshot,
  query: RegionalWeatherQuery
): RegionalWeatherDrainageInput {
  const cell = weatherAt(state, query)
  const accumulation = clamp(cell.precipitation * (0.4 + cell.humidity * 0.35), 0, 1)
  return {
    precipitation: cell.precipitation,
    accumulation,
    runoff: clamp(accumulation * (0.35 + cell.pressure * 0.45), 0, 1),
  }
}

export function advanceRegionalWeatherState(
  state: RegionalWeatherStateSnapshot,
  weather: WorldWeatherDefinition | undefined,
  deltaSeconds: number
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0
  state.accumulatorSeconds += Math.min(deltaSeconds, 60)
  let advanced = 0
  while (state.accumulatorSeconds >= state.tickSeconds) {
    state.accumulatorSeconds -= state.tickSeconds
    state.tick += 1
    const changedKeys: string[] = []
    for (let index = 0; index < state.cells.length; index += 1) {
      state.cells[index] = evolveCell(state, state.cells[index]!, weather)
      changedKeys.push(state.cells[index]!.key)
    }
    state.history.push({ tick: state.tick, changedKeys })
    state.history = normalizeHistory(state.history, state.historyLimit)
    advanced += 1
  }
  return advanced
}

export function regionalWeatherElapsedSeconds(state: RegionalWeatherStateSnapshot): number {
  return state.tick * state.tickSeconds + state.accumulatorSeconds
}

export function cloneRegionalWeatherState(
  state: RegionalWeatherStateSnapshot
): RegionalWeatherStateSnapshot {
  return {
    ...state,
    cells: state.cells.map((cell) => ({ ...cell })),
    history: state.history.map((entry) => ({ ...entry, changedKeys: [...entry.changedKeys] })),
  }
}
