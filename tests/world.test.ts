import { describe, expect, it } from 'vitest'
import { BIOME, generateWorld, hashSeed } from '../packages/map/src'

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
})
