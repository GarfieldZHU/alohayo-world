import type { MapAreaDefinition } from '@alohayo/config'
import { describe, expect, it } from 'vitest'
import {
  applyHydrologySeamPatch,
  BIOME,
  generateChunk,
  generateChunkWithAreas,
  reconcileChunkHydrologyPair,
  reconcileDrainageSeam,
} from '@alohayo/map'
import type { HydrologyCoreBuilder } from '../packages/map/src/hydrology'

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

  it('builds the same bounded pair patches regardless of request orientation', () => {
    const seed = 'hydrology-pair-order'
    const west = generateChunk(seed, -1, 2, 64)
    const east = generateChunk(seed, 0, 2, 64)
    const eastward = reconcileChunkHydrologyPair({
      seedText: seed,
      firstChunkX: -1,
      firstChunkY: 2,
      secondChunkX: 0,
      secondChunkY: 2,
      direction: 'east',
      chunkSize: 64,
      surveyWidth: 128,
      surveyHeight: 128,
      firstWatershed: west.watershed,
      secondWatershed: east.watershed,
    })
    const westward = reconcileChunkHydrologyPair({
      seedText: seed,
      firstChunkX: 0,
      firstChunkY: 2,
      secondChunkX: -1,
      secondChunkY: 2,
      direction: 'west',
      chunkSize: 64,
      surveyWidth: 128,
      surveyHeight: 128,
      firstWatershed: east.watershed,
      secondWatershed: west.watershed,
    })

    expect(eastward.windowWidth).toBe(160)
    expect(eastward.windowHeight).toBe(96)
    expect(eastward.seamDepth).toBe(8)
    expect(
      eastward.patches.map(({ chunkX, chunkY, direction, x, y, width, height }) => ({
        chunkX,
        chunkY,
        direction,
        x,
        y,
        width,
        height,
      }))
    ).toEqual([
      { chunkX: -1, chunkY: 2, direction: 'east', x: 56, y: 0, width: 8, height: 64 },
      { chunkX: 0, chunkY: 2, direction: 'west', x: 0, y: 0, width: 8, height: 64 },
    ])
    const normalizedWestwardPatches = [...westward.patches]
      .sort((left, right) => left.chunkX - right.chunkX)
      .map((patch) => ({
        chunkX: patch.chunkX,
        chunkY: patch.chunkY,
        direction: patch.direction,
        fields: patch.fields,
        edgeSamples: patch.edgeSamples,
      }))
    expect(normalizedWestwardPatches).toEqual(
      eastward.patches.map(({ chunkX, chunkY, direction, fields, edgeSamples }) => ({
        chunkX,
        chunkY,
        direction,
        fields,
        edgeSamples,
      }))
    )

    const patchedWest = applyHydrologySeamPatch(west, eastward.patches[0]!)
    expect(patchedWest.slope.slice(56, 64)).toEqual(eastward.patches[0]!.fields.slope.slice(0, 8))
    expect(patchedWest.drainageSummary.edges.east).toEqual(eastward.patches[0]!.edgeSamples)
  })

  it('keeps actual pair seam direction and accumulation consistent on both sides', () => {
    const seed = 'hydrology-pair-seam-flow'
    const west = generateChunk(seed, -1, 0, 64)
    const east = generateChunk(seed, 0, 0, 64)
    const landOverlay: MapAreaDefinition = {
      schemaVersion: 1,
      id: 'test:hydrology-pair-land',
      name: 'Hydrology pair land',
      description: 'A land-only fixture for cross-seam accumulation checks.',
      enabled: true,
      placement: { mode: 'absolute', x: -80, y: -16 },
      width: 160,
      height: 96,
      terrainPatches: [
        {
          x: 0,
          y: 0,
          width: 160,
          height: 96,
          shape: 'rectangle',
          terrainId: 'core:grassland',
          elevation: 0.75,
        },
      ],
    }
    const eastFlowCore: HydrologyCoreBuilder = ({ width, height, rawElevation }) => {
      const size = width * height
      const filledElevation = new Float32Array(size)
      const slope = new Uint8Array(size)
      const flowDirection = new Int8Array(size)
      const flowAccumulation = new Uint32Array(size)
      const watershed = new Uint32Array(size)
      const depression = new Uint8Array(size)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = y * width + x
          filledElevation[index] = 1 - x / width
          flowDirection[index] = x === width - 1 ? -1 : 0
          flowAccumulation[index] = x + 1
          watershed[index] = 1
          slope[index] = 1
        }
      }
      return {
        width,
        height,
        rawElevation,
        filledElevation,
        water: new Uint8Array(size),
        slope,
        flowDirection,
        flowAccumulation,
        watershed,
        depression,
      }
    }
    const result = reconcileChunkHydrologyPair({
      seedText: seed,
      firstChunkX: -1,
      firstChunkY: 0,
      secondChunkX: 0,
      secondChunkY: 0,
      direction: 'east',
      chunkSize: 64,
      surveyWidth: 128,
      surveyHeight: 128,
      firstWatershed: west.watershed,
      secondWatershed: east.watershed,
      areas: [landOverlay],
      terrainCodes: { 'core:grassland': BIOME.grassland },
      coreBuilder: eastFlowCore,
    })
    const patchedWest = applyHydrologySeamPatch(west, result.patches[0])
    const patchedEast = applyHydrologySeamPatch(east, result.patches[1])
    const seam = reconcileDrainageSeam({
      left: patchedWest.drainageSummary,
      right: patchedEast.drainageSummary,
      direction: 'east',
    })
    expect(seam.pairs).toHaveLength(64)
    expect(seam.pairs.every((pair) => pair.flow === 'left-to-right')).toBe(true)
    expect(seam.pairs.every((pair) => pair.consistent)).toBe(true)
    expect(seam.pairs.every((pair) => pair.right.accumulation >= pair.left.accumulation)).toBe(true)
  })

  it('uses a 96x160 window for vertical pairs and rejects non-neighbors', () => {
    const seed = 'hydrology-pair-vertical'
    const north = generateChunk(seed, -3, -2, 64)
    const south = generateChunk(seed, -3, -1, 64)
    const result = reconcileChunkHydrologyPair({
      seedText: seed,
      firstChunkX: -3,
      firstChunkY: -2,
      secondChunkX: -3,
      secondChunkY: -1,
      direction: 'south',
      chunkSize: 64,
      surveyWidth: 128,
      surveyHeight: 128,
      firstWatershed: north.watershed,
      secondWatershed: south.watershed,
    })

    expect(result.windowWidth).toBe(96)
    expect(result.windowHeight).toBe(160)
    expect(result.patches[0]?.direction).toBe('south')
    expect(result.patches[1]?.direction).toBe('north')
    expect(() =>
      reconcileChunkHydrologyPair({
        seedText: seed,
        firstChunkX: -3,
        firstChunkY: -2,
        secondChunkX: -1,
        secondChunkY: -1,
        direction: 'south',
        chunkSize: 64,
        surveyWidth: 128,
        surveyHeight: 128,
        firstWatershed: north.watershed,
        secondWatershed: south.watershed,
      })
    ).toThrow('hydrology pair chunks are not cardinal neighbors')
  })
})
