import { describe, expect, it } from 'vitest'
import { computeGameCameraScale } from '../packages/engine/src/utils'
import {
  buildTransportStructures,
  evaluateTransportTraversal,
  sampleRegionalWeather,
  simulateSettlementTraffic,
  type GeneratedRoad,
  type GeneratedSettlement,
} from '@alohayo/map'

const fixtureRoads: GeneratedRoad[] = [
  {
    id: 'road:a::b',
    kind: 'road',
    traffic: 4,
    fromSettlementId: 'a',
    toSettlementId: 'b',
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
  },
]

describe('regional weather consumers', () => {
  it('keeps regional identity and forecast deterministic', () => {
    const weather = {
      enabled: true,
      cycleSeconds: 120,
      cellScale: 48,
      transitionSeconds: 18,
      rainThreshold: 0.58,
      snowTemperatureMax: 0.42,
      surfaceDecay: 0.72,
      states: [
        { id: 'clear' as const, duration: 0.5, wetness: 0, snowCover: 0, mud: 0 },
        { id: 'rain' as const, duration: 0.5, wetness: 1, snowCover: 0, mud: 0.5 },
      ],
    }
    const first = sampleRegionalWeather({
      seed: 'weather-fixture',
      x: -73.5,
      y: 18.25,
      elapsedSeconds: 42,
      weather,
    })
    const second = sampleRegionalWeather({
      seed: 'weather-fixture',
      x: -73.5,
      y: 18.25,
      elapsedSeconds: 42,
      weather,
    })
    expect(first).toEqual(second)
    expect(first.regionId).toMatch(/^front:/)
    expect(first.forecast).toHaveLength(3)
    expect(first.visibility).toBeGreaterThanOrEqual(0.35)
  })
})

describe('shared transport traversal', () => {
  it('creates a deterministic bridge marker and enforces its capability', () => {
    const structures = buildTransportStructures(fixtureRoads, () => ({
      nearWater: true,
      moisture: 0.3,
      ruggedness: 0.2,
    }))
    expect(structures).toHaveLength(1)
    expect(structures[0]?.kind).toBe('ferry')
    expect(evaluateTransportTraversal({ structure: structures[0] }).allowed).toBe(false)
    expect(
      evaluateTransportTraversal({
        structure: structures[0],
        capabilityTags: ['traversal:ferry'],
      }).allowed
    ).toBe(true)
  })
})

describe('settlement traffic aggregate', () => {
  it('stays bounded and deterministic under weather pressure', () => {
    const settlements: GeneratedSettlement[] = [
      {
        id: 'a',
        name: 'A',
        kind: 'town',
        x: 0,
        y: 0,
        biome: 7,
        population: 100,
        traffic: 4,
        creatureTags: [],
        roadAccess: 0.8,
      },
    ]
    const first = simulateSettlementTraffic(settlements, fixtureRoads, [], 4, {
      regionId: 'front:0:0:0',
      front: 0.7,
      wind: { x: 0.4, y: 0.2, speed: 0.45 },
      precipitation: 0.8,
      accumulation: 0.4,
      visibility: 0.6,
      comfort: 0.5,
      stateId: 'rain',
      forecast: [],
    })
    const second = simulateSettlementTraffic(settlements, fixtureRoads, [], 4, undefined)
    expect(first).toEqual(
      simulateSettlementTraffic(settlements, fixtureRoads, [], 4, {
        regionId: 'front:0:0:0',
        front: 0.7,
        wind: { x: 0.4, y: 0.2, speed: 0.45 },
        precipitation: 0.8,
        accumulation: 0.4,
        visibility: 0.6,
        comfort: 0.5,
        stateId: 'rain',
        forecast: [],
      })
    )
    expect(first[0]?.congestion).toBeGreaterThan(second[0]?.congestion ?? 0)
    expect(first[0]?.supplyAccess).toBeGreaterThanOrEqual(0)
    expect(first[0]?.supplyAccess).toBeLessThanOrEqual(1)
  })
})

describe('game camera', () => {
  it('keeps the follow view close while respecting a floor', () => {
    expect(computeGameCameraScale(1440, 900, 4)).toBe(10.5)
    expect(computeGameCameraScale(360, 640, 4)).toBeGreaterThanOrEqual(2.8)
  })
})
