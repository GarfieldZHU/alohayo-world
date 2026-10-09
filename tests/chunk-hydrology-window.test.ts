import type { MapAreaDefinition } from '@alohayo/config'
import { describe, expect, it } from 'vitest'
import { BIOME, generateChunk, generateChunkWithAreas } from '@alohayo/map'

describe('streamed chunk hydrology halo', () => {
  it('is deterministic at positive and negative chunk coordinates', () => {
    for (const [chunkX, chunkY] of [
      [-2, 3],
      [2, -3],
    ] as const) {
      const first = generateChunk('hydrology-window-determinism', chunkX, chunkY, 64)
      const second = generateChunk('hydrology-window-determinism', chunkX, chunkY, 64)

      expect(first.flowDirection).toEqual(second.flowDirection)
      expect(first.flowAccumulation).toEqual(second.flowAccumulation)
      expect(first.watershed).toEqual(second.watershed)
      expect(first.drainageSummary).toEqual(second.drainageSummary)
    }
  })

  it('uses authored water overlays just beyond the chunk edge in drainage inputs', () => {
    const area: MapAreaDefinition = {
      schemaVersion: 1,
      id: 'test:hydrology-frontier-water',
      name: 'Hydrology frontier water',
      description: 'A water overlay used to verify halo sampling.',
      enabled: true,
      placement: { mode: 'absolute', x: 64, y: 0 },
      width: 16,
      height: 64,
      terrainPatches: [
        {
          x: 0,
          y: 0,
          width: 16,
          height: 64,
          shape: 'rectangle',
          terrainId: 'core:ocean',
          elevation: 0,
        },
      ],
    }
    const baseline = generateChunk('hydrology-window-overlay', 0, 0, 64)
    const withHaloOverlay = generateChunkWithAreas(
      'hydrology-window-overlay',
      0,
      0,
      64,
      128,
      128,
      [area],
      { 'core:ocean': BIOME.ocean }
    )

    expect(withHaloOverlay.biomes).toEqual(baseline.biomes)
    expect(withHaloOverlay.elevation).toEqual(baseline.elevation)
    expect(withHaloOverlay.flowDirection).not.toEqual(baseline.flowDirection)
  })
})
