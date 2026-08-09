import { describe, expect, it } from 'vitest'
import {
  generateChunkTerrainTextureHints,
  TERRAIN_TEXTURE_PATTERN,
} from '../packages/map/src/terrain-texture-hints'

function makeInput(chunkSize = 8) {
  const size = chunkSize * chunkSize
  const biomes = new Uint8Array(size)
  const elevation = new Uint8Array(size)
  const moisture = new Uint8Array(size)
  const temperature = new Uint8Array(size)
  for (let index = 0; index < size; index += 1) {
    biomes[index] = index % 26
    elevation[index] = (index * 17 + 23) % 256
    moisture[index] = (index * 31 + 7) % 256
    temperature[index] = (index * 13 + 91) % 256
  }
  return { biomes, elevation, moisture, temperature, chunkSize, originX: -19, originY: 23 }
}

describe('terrain texture hint reference', () => {
  it('is deterministic across negative world origins and keeps recipe families stable', () => {
    const input = makeInput()
    const first = generateChunkTerrainTextureHints(input)
    const second = generateChunkTerrainTextureHints(input)
    expect(first).toEqual(second)
    expect(first.pattern[0]! >>> 4).toBe(TERRAIN_TEXTURE_PATTERN.water)
    expect(first.pattern[3]! >>> 4).toBe(TERRAIN_TEXTURE_PATTERN.coast)
    expect(first.pattern[9]! >>> 4).toBe(TERRAIN_TEXTURE_PATTERN.forest)
    expect(first.pattern[24]! >>> 4).toBe(TERRAIN_TEXTURE_PATTERN.volcanic)
    expect([...first.pattern].every((value) => (value & 0x0f) <= 15)).toBe(true)
  })

  it('changes coordinate-derived variation when the chunk moves', () => {
    const input = makeInput(4)
    const first = generateChunkTerrainTextureHints(input)
    const moved = generateChunkTerrainTextureHints({ ...input, originX: input.originX + 64 })
    expect(moved.pattern).not.toEqual(first.pattern)
  })
})
