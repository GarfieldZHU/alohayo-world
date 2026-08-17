import { describe, expect, it } from 'vitest'
import { TerrainAtlasResidency, chooseTerrainAtlasLod } from '../packages/engine/src/terrain-atlas'

describe('terrain atlas residency', () => {
  it('selects a low-memory LOD without changing terrain authority', () => {
    expect(chooseTerrainAtlasLod({ qualityTier: 'high', deviceMemoryGB: 1 })).toBe(1)
    expect(chooseTerrainAtlasLod({ qualityTier: 'balanced', deviceMemoryGB: 8 })).toBe(1)
    expect(chooseTerrainAtlasLod({ qualityTier: 'high', deviceMemoryGB: 8 })).toBe(0)
    expect(chooseTerrainAtlasLod({ qualityTier: 'high', reducedMotion: true })).toBe(1)
  })

  it('evicts released chunk residency on reload while keeping referenced chunks', () => {
    const residency = new TerrainAtlasResidency({ maxChunks: 2, bytesPerChunk: 100 })
    residency.acquire('0:0', 0)
    residency.release('0:0')
    residency.acquire('1:0', 0)
    residency.release('1:0')
    residency.acquire('2:0', 1)
    expect(residency.stats()).toMatchObject({
      residentChunks: 2,
      referencedChunks: 1,
      lod1Chunks: 1,
    })
    residency.release('2:0')
    residency.acquire('0:0', 1)
    expect(residency.stats().residentChunks).toBe(2)
  })
})
