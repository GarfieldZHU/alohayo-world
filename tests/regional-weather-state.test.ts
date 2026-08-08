import { describe, expect, it } from 'vitest'
import {
  advanceRegionalWeatherState,
  cloneRegionalWeatherState,
  createRegionalWeatherState,
  drainageInputAt,
  primeRegionalWeatherCell,
  regionalWeatherElapsedSeconds,
  restoreRegionalWeatherState,
  visibilityModifierAt,
  weatherAt,
} from '@alohayo/map'

const weather = {
  enabled: true,
  cycleSeconds: 180,
  cellScale: 24,
  transitionSeconds: 12,
  rainThreshold: 0.58,
  snowTemperatureMax: 0.42,
  surfaceDecay: 0.72,
  states: [
    { id: 'clear' as const, duration: 0.55, wetness: 0, snowCover: 0, mud: 0 },
    { id: 'rain' as const, duration: 0.45, wetness: 1, snowCover: 0, mud: 0.5 },
  ],
}

describe('regional weather state', () => {
  it('keeps fixed-step evolution and queries deterministic across save/restore', () => {
    const state = createRegionalWeatherState({
      seed: 'weather-state-fixture',
      weather,
      maxCells: 4,
      historyLimit: 3,
    })
    for (const query of [
      { x: -73, y: 18 },
      { x: 14, y: 27 },
      { x: 52, y: -41 },
    ]) {
      primeRegionalWeatherCell(state, query)
    }
    expect(advanceRegionalWeatherState(state, weather, 36)).toBe(3)
    expect(regionalWeatherElapsedSeconds(state)).toBe(36)
    expect(state.history).toHaveLength(3)

    const snapshot = cloneRegionalWeatherState(state)
    const restored = restoreRegionalWeatherState(snapshot, {
      seed: 'weather-state-fixture',
      weather,
    })
    expect(restored).toEqual(state)
    expect(weatherAt(restored, { x: -73, y: 18 })).toEqual(weatherAt(state, { x: -73, y: 18 }))
    expect(drainageInputAt(restored, { x: 14, y: 27 })).toEqual(
      drainageInputAt(state, { x: 14, y: 27 })
    )
  })

  it('keeps pure queries side-effect free and bounds retained cells', () => {
    const state = createRegionalWeatherState({ seed: 'bounded', weather, maxCells: 2 })
    primeRegionalWeatherCell(state, { x: 0, y: 0 })
    primeRegionalWeatherCell(state, { x: 25, y: 0 })
    const before = cloneRegionalWeatherState(state)
    const unknown = weatherAt(state, { x: 999, y: -999 })
    expect(unknown.key).toBe('41:-42')
    expect(visibilityModifierAt(state, { x: 999, y: -999 })).toBeGreaterThanOrEqual(0.35)
    expect(state).toEqual(before)

    primeRegionalWeatherCell(state, { x: 50, y: 0 })
    expect(state.cells).toHaveLength(2)
    expect(state.cells.map((cell) => cell.key)).toEqual(['1:0', '2:0'])
  })

  it('rejects snapshots from another world seed', () => {
    const state = createRegionalWeatherState({ seed: 'one', weather })
    expect(() => restoreRegionalWeatherState(state, { seed: 'two', weather })).toThrow(
      'seed does not match'
    )
  })
})
