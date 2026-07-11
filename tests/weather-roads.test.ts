import { describe, expect, it } from 'vitest'
import type { BiomeDefinition } from '../packages/config/src'
import { sampleWeatherSurface } from '../packages/engine/src/weather'

const grassland: BiomeDefinition = {
  id: 'core:grassland',
  code: 8,
  name: 'Grassland',
  family: 'grassland',
  color: '#778844',
  accent: '#aabb66',
  description: 'Fixture',
  movementCost: 1,
  roadCost: 1,
  occurrence: 1,
  latitude: { min: 0, max: 1 },
  elevation: { min: 0, max: 1 },
  temperature: { min: 0, max: 1 },
  moisture: { min: 0, max: 1 },
  creatures: { habitatTags: [], iconicSpecies: [], abundance: 0 },
  settlement: { suitability: 0, roleWeights: {}, roadAccess: 0 },
}

describe('weather road conditions', () => {
  it('derives deterministic reversible muddy road state from weather', () => {
    const state = { id: 'rain', wetness: 1, snowCover: 0, mud: 1, fade: 1 }
    const first = sampleWeatherSurface({ state, biome: grassland, cellX: 18, cellY: -9, seed: 4 })
    const second = sampleWeatherSurface({ state, biome: grassland, cellX: 18, cellY: -9, seed: 4 })
    const clear = sampleWeatherSurface({
      state: { id: 'clear', wetness: 0, snowCover: 0, mud: 0, fade: 0 },
      biome: grassland,
      cellX: 18,
      cellY: -9,
      seed: 4,
    })

    expect(first).toEqual(second)
    expect(first.condition).toBe('muddy')
    expect(clear.condition).toBe('dry')
  })

  it('uses snow and thaw to distinguish snowy and slushy roads', () => {
    const snow = sampleWeatherSurface({
      state: { id: 'snow', wetness: 0, snowCover: 1, mud: 0, fade: 1 },
      biome: { ...grassland, temperature: { min: 0, max: 0.2 } },
      cellX: 0,
      cellY: 0,
      seed: 7,
    })
    const thaw = sampleWeatherSurface({
      state: { id: 'thaw', wetness: 1, snowCover: 1, mud: 0, fade: 1 },
      biome: { ...grassland, temperature: { min: 0, max: 0.2 } },
      cellX: 0,
      cellY: 0,
      seed: 7,
    })

    expect(snow.condition).toBe('snowy')
    expect(thaw.condition).toBe('slushy')
  })
})
