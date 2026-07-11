import { describe, expect, it } from 'vitest'
import { generateChunk, generateChunkBaseLayers } from '../packages/map/src'

describe('chunk base layers', () => {
  it('rebuilds the TypeScript chunk climate fields byte-for-byte', () => {
    const args = ['alohayo', -3, 5, 16] as const
    const baseLayers = generateChunkBaseLayers(...args)
    const chunk = generateChunk(...args)

    expect(baseLayers.elevation).toEqual(chunk.elevation)
    expect(baseLayers.moisture).toEqual(chunk.moisture)
    expect(baseLayers.temperature).toEqual(chunk.temperature)
  })

  it('accepts an injected coarse layer batch without changing chunk output', () => {
    const args = ['alohayo', 2, -4, 16] as const
    const baseLayers = generateChunkBaseLayers(...args)
    const baseline = generateChunk(...args)
    const fromInjectedLayers = generateChunk(...args, undefined, undefined, undefined, baseLayers)

    expect(fromInjectedLayers.hash).toBe(baseline.hash)
    expect(fromInjectedLayers.biomes).toEqual(baseline.biomes)
    expect(fromInjectedLayers.region).toEqual(baseline.region)
  })
})
