import { describe, expect, it } from 'vitest'
import { generateWorld, hashSeed } from '../packages/map/src'

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
})
