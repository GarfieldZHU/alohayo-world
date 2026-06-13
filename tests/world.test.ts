import { describe, expect, it } from 'vitest'
import { BIOME, applyMapAreas, generateChunk, generateWorld, hashSeed } from '../packages/map/src'
import type { MapAreaDefinition } from '../packages/config/src'
import wayfinderIsle from '../content/maps/core/areas/wayfinder-isle.json'

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

  it('assigns every cell to valid terrain and topology', () => {
    const world = generateWorld('atlas-topology', 96, 72)
    const validCodes = new Set<number>(Object.values(BIOME))
    expect(world.biomes.every((code) => validCodes.has(code))).toBe(true)
    expect(world.mainlandId).toBeGreaterThan(0)
    for (let index = 0; index < world.biomes.length; index += 1) {
      expect(Boolean(world.landmass[index]) !== Boolean(world.waterbody[index])).toBe(true)
    }
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
