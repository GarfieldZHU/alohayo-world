import { describe, expect, it } from 'vitest'
import { BIOME, applyMapAreas, generateChunk, generateWorld, hashSeed } from '../packages/map/src'
import type { MapAreaDefinition } from '../packages/config/src'
import wayfinderIsle from '../content/maps/core/areas/wayfinder-isle.json'

const isWaterBiome = (biome: number) =>
  biome === BIOME.deepOcean ||
  biome === BIOME.ocean ||
  biome === BIOME.shallowSea ||
  biome === BIOME.lake ||
  biome === BIOME.reef

describe('world generation', () => {
  it('is deterministic for a seed', () => {
    const first = generateWorld('alohayo', 32, 24)
    const second = generateWorld('alohayo', 32, 24)
    expect(first.hash).toBe(second.hash)
    expect(first.biomes).toEqual(second.biomes)
  })

  it('changes when the seed changes', () => {
    expect(generateWorld('alohayo', 32, 24).hash).not.toBe(generateWorld('cloudbreak', 32, 24).hash)
  })

  it('generates streamed chunks deterministically', () => {
    const first = generateChunk('alohayo', -2, 3, 32)
    const second = generateChunk('alohayo', -2, 3, 32)
    expect(first.hash).toBe(second.hash)
    expect(first.biomes).toEqual(second.biomes)
    expect(first.region).toEqual(second.region)
  })

  it('uses the same FNV seed contract as Rust', () => {
    expect(hashSeed('alohayo')).toBe(2244857266)
  })

  it('generates deterministic settlements and roads for the same seed', () => {
    const first = generateChunk('trade-routes', 1, -1, 64)
    const second = generateChunk('trade-routes', 1, -1, 64)
    expect(first.settlements).toEqual(second.settlements)
    expect(first.roads).toEqual(second.roads)
    const world = generateWorld('trade-routes-network', 160, 120)
    expect(
      world.roads.some((road) => road.points.some((point) => !Number.isInteger(point.x)))
    ).toBe(true)
  })

  it('exposes extended terrain families in generated worlds', () => {
    const world = generateWorld('terrain-spectrum', 160, 120)
    const codes = new Set(world.biomes)
    expect(codes.has(BIOME.tundra) || codes.has(BIOME.snow) || codes.has(BIOME.glacier)).toBe(true)
    expect(codes.has(BIOME.savanna) || codes.has(BIOME.desert) || codes.has(BIOME.oasis)).toBe(true)
    expect(world.settlements.length).toBeGreaterThan(0)
  })

  it('assigns every cell to valid terrain and topology', () => {
    const world = generateWorld('atlas-topology', 96, 72)
    const validCodes = new Set<number>(Object.values(BIOME))
    expect(world.biomes.every((code) => validCodes.has(code))).toBe(true)
    expect(world.mainlandId).toBeGreaterThan(0)
    for (let index = 0; index < world.biomes.length; index += 1) {
      expect(Boolean(world.landmass[index]) !== Boolean(world.waterbody[index])).toBe(true)
    }
  })

  it('keeps seeded ocean coverage within the configured wide range', () => {
    const ratios = Array.from({ length: 18 }, (_, index) => {
      const world = generateWorld(`coverage-${index}`, 96, 72)
      const waterCells = world.biomes.reduce(
        (total, biome) => total + Number(isWaterBiome(biome)),
        0
      )
      return waterCells / world.biomes.length
    })

    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(0.1)
      expect(ratio).toBeLessThanOrEqual(0.8)
    }

    const average = ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length
    expect(average).toBeGreaterThanOrEqual(0.3)
    expect(average).toBeLessThanOrEqual(0.6)
  })

  it('applies authored map areas and landmarks deterministically', () => {
    const terrainCodes = {
      'core:shallow-sea': BIOME.shallowSea,
      'core:coast': BIOME.coast,
      'core:grassland': BIOME.grassland,
      'core:highland': BIOME.highland,
      'core:bare-rock': BIOME.bareRock,
    }
    const first = applyMapAreas(
      generateWorld('authored', 128, 96),
      [wayfinderIsle as MapAreaDefinition],
      terrainCodes
    )
    const second = applyMapAreas(
      generateWorld('authored', 128, 96),
      [wayfinderIsle as MapAreaDefinition],
      terrainCodes
    )
    expect(first.hash).toBe(second.hash)
    expect(first.areaIds).toContain('core:wayfinder-isle')
    expect(first.landmarks[0]?.id).toBe('core:wayfinder-beacon')
    expect(first.authoredArea.some((area) => area > 0)).toBe(true)
  })
})
