import type { WorldRiverGraphSegment } from '@alohayo/config'
import { expect, it } from 'vitest'
import {
  DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
  CrossChunkHydrologyResolver,
  createDynamicGeomorphologyCorridor,
  createDynamicGeomorphologyState,
  generateChunk,
  generateWorld,
  stepDynamicGeomorphology,
} from '../../packages/map/src'
import {
  createPackedFogMask,
  updatePackedFogMask,
  visionDirtyBounds,
} from '../../packages/engine/src/fog-mask'
import { indexRiverGraphSegmentsByChunk } from '../../packages/engine/src/minimap-hydrology'
import { indexRiverGraphRenderLines } from '../../packages/engine/src/water-render'

it('meets representative desktop atlas and chunk latency budgets', () => {
  const world = generateWorld('desktop-budget', 256, 192)
  const chunk = generateChunk('desktop-budget', 2, -1, 64)

  expect(world.generationMs).toBeLessThan(1000)
  expect(chunk.generationMs).toBeLessThan(120)
})

it('meets representative mobile atlas and chunk latency budgets', () => {
  const world = generateWorld('mobile-budget', 128, 96)
  const chunk = generateChunk('mobile-budget', 0, 0, 64)

  expect(world.generationMs).toBeLessThan(600)
  expect(chunk.generationMs).toBeLessThan(120)
})

it('keeps generated chunk memory within the retained hot-path budget', () => {
  const chunk = generateChunk('memory-budget', 0, 0, 64)
  const bytes =
    chunk.elevation.byteLength +
    chunk.moisture.byteLength +
    chunk.temperature.byteLength +
    chunk.biomes.byteLength +
    chunk.authoredArea.byteLength +
    chunk.region.byteLength
  const memoryMb = bytes / (1024 * 1024)

  expect(memoryMb).toBeLessThan(0.04)
})

it('limits retained-horizon fog travel updates to the moving vision corridor', () => {
  const mask = createPackedFogMask(
    { minCellX: -160, minCellY: -160, widthCells: 320, heightCells: 320 },
    4
  )
  const previous = { sourceX: -2.5, sourceY: 0.5, radius: 6 }
  const next = { sourceX: 2.5, sourceY: 0.5, radius: 6 }
  const common = {
    fogColor: 0x182434,
    hiddenAlpha: 0.68,
    memoryAlpha: 0.045,
    isDiscovered: () => false,
  }
  const fullSamples = updatePackedFogMask(mask, { ...common, activeVision: previous })
  const dirtySamples = updatePackedFogMask(mask, {
    ...common,
    activeVision: next,
    dirtyBounds: visionDirtyBounds(previous, next),
  })

  expect(fullSamples).toBe(mask.width * mask.height)
  expect(dirtySamples).toBeLessThan(fullSamples * 0.01)
})

it('steps a representative active geomorphology corridor within its broad CI budget', () => {
  const width = 128
  const height = 128
  const size = width * height
  const activeIndices = Uint32Array.from({ length: 4096 }, (_, index) => index)
  const flowDirection = new Int8Array(size)
  flowDirection.fill(-1)
  for (let index = 0; index < activeIndices.length - 1; index += 1) {
    flowDirection[index] = index % width === width - 1 ? 2 : 0
  }
  const corridor = createDynamicGeomorphologyCorridor({
    width,
    height,
    activeIndices,
    flowDirection,
    erosionPotential: new Uint8Array(size).fill(128),
    depositionPotential: new Uint8Array(size).fill(96),
    floodplain: new Uint8Array(size).fill(255),
  })
  const started = performance.now()
  const result = stepDynamicGeomorphology({
    corridor,
    state: createDynamicGeomorphologyState(corridor),
    config: { ...DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG, enabled: true },
  })
  const elapsed = performance.now() - started

  expect(result.accounting.processedCells).toBe(activeIndices.length)
  expect(result.accounting.sedimentResidual).toBe(0)
  expect(result.accounting.waterResidual).toBe(0)
  expect(elapsed).toBeLessThan(100)
})

it('propagates seam accumulation deltas within a retained downstream corridor budget', () => {
  const chunkSize = 64
  const chunkRadius = 24
  const seamDelta = 1024
  const resolver = new CrossChunkHydrologyResolver()
  let sourceRaster: {
    flowDirection: Int8Array
    flowAccumulation: Uint32Array
  } | null = null
  let targetRaster: {
    flowDirection: Int8Array
    flowAccumulation: Uint32Array
  } | null = null
  let farAccumulation: Uint32Array | null = null
  const maxWorldX = chunkRadius * chunkSize + chunkSize - 1
  for (let chunkX = -chunkRadius; chunkX <= chunkRadius; chunkX += 1) {
    const flowDirection = new Int8Array(chunkSize * chunkSize).fill(-1)
    const flowAccumulation = new Uint32Array(chunkSize * chunkSize).fill(1)
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const worldX = chunkX * chunkSize + localX
      const index = 32 * chunkSize + localX
      flowAccumulation[index] = worldX + chunkRadius * chunkSize + 1
      if (worldX < maxWorldX) flowDirection[index] = 0
    }
    if (chunkX === 0) {
      sourceRaster = { flowDirection, flowAccumulation }
    }
    if (chunkX === 1) targetRaster = { flowDirection, flowAccumulation }
    if (chunkX === chunkRadius) farAccumulation = flowAccumulation
    resolver.addRaster({
      chunkX,
      chunkY: 0,
      chunkSize,
      flowDirection,
      flowAccumulation,
      watershed: new Uint32Array(chunkSize * chunkSize),
      water: new Uint8Array(chunkSize * chunkSize),
    })
  }
  if (!sourceRaster || !targetRaster)
    throw new Error('accumulation benchmark seam rasters were not created')
  const sourceCorrectedMask = new Uint8Array(chunkSize * chunkSize)
  const targetCorrectedMask = new Uint8Array(chunkSize * chunkSize)
  for (let row = 0; row < chunkSize; row += 1) {
    sourceCorrectedMask.fill(1, row * chunkSize + chunkSize - 8, (row + 1) * chunkSize)
    targetCorrectedMask.fill(1, row * chunkSize, row * chunkSize + 8)
  }
  for (let localX = chunkSize - 8; localX < chunkSize; localX += 1) {
    const index = 32 * chunkSize + localX
    sourceRaster.flowAccumulation[index] = sourceRaster.flowAccumulation[index]! + seamDelta
  }
  for (let localX = 0; localX < 8; localX += 1) {
    const index = 32 * chunkSize + localX
    targetRaster.flowAccumulation[index] = targetRaster.flowAccumulation[index]! + seamDelta
  }
  resolver.setCorrectedMask(0, 0, sourceCorrectedMask)
  resolver.setCorrectedMask(1, 0, targetCorrectedMask)

  const samples: number[] = []
  let diagnostics = { correctedCells: 0, visitedCells: 0, changedCells: 0 }
  for (let sample = 0; sample < 12; sample += 1) {
    const started = performance.now()
    diagnostics = resolver.recomputeRetainedAccumulationDeltas()
    const elapsed = performance.now() - started
    if (sample >= 2) samples.push(elapsed)
  }
  samples.sort((a, b) => a - b)
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!
  console.info('retained accumulation delta benchmark', {
    retainedChunks: chunkRadius * 2 + 1,
    correctedCells: diagnostics.correctedCells,
    downstreamCells: chunkRadius * chunkSize,
    visitedCells: diagnostics.visitedCells,
    p95Ms: p95,
  })

  expect(diagnostics.correctedCells).toBe(chunkSize * 16)
  expect(p95).toBeLessThan(100)
  expect(farAccumulation?.[32 * chunkSize + (chunkSize - 1)]).toBe(
    maxWorldX + chunkRadius * chunkSize + 1 + seamDelta
  )
})

it('indexes the capped retained river graph within the renderer budget', () => {
  const segmentCount = 16_384
  const chunkSize = 64
  const segments: WorldRiverGraphSegment[] = Array.from({ length: segmentCount }, (_, index) => {
    const row = Math.floor(index / 448)
    const column = index % 448
    const x = row % 2 === 0 ? column : 447 - column
    const y = row
    const target = column === 447 ? { x, y: y + 1 } : { x: x + (row % 2 === 0 ? 1 : -1), y }
    return {
      id: `river:segment:${x},${y}>${target.x},${target.y}`,
      identityId: 'watershed:0,0:1',
      sourceNodeId: `river:channel:${x},${y}`,
      targetNodeId: `river:channel:${target.x},${target.y}`,
      sourceKind: 'channel',
      targetKind: 'channel',
      source: { x, y },
      target,
      chunkX: Math.floor(x / chunkSize),
      chunkY: Math.floor(y / chunkSize),
      offset: index,
      direction: column === 447 ? 'south' : row % 2 === 0 ? 'east' : 'west',
      accumulation: 8,
    }
  })
  const samples: number[] = []
  let indexedLineCount = 0
  for (let sample = 0; sample < 5; sample += 1) {
    const started = performance.now()
    const segmentsByChunk = indexRiverGraphSegmentsByChunk(segments)
    const localSegments: WorldRiverGraphSegment[] = []
    for (let chunkY = -1; chunkY <= 1; chunkY += 1) {
      for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
        localSegments.push(...(segmentsByChunk.get(`${chunkX},${chunkY}`) ?? []))
      }
    }
    const result = indexRiverGraphRenderLines(localSegments, chunkSize, 4, {
      chunkX: 0,
      chunkY: 0,
    })
    const elapsed = performance.now() - started
    indexedLineCount = Array.from(result.values()).reduce((count, lines) => count + lines.length, 0)
    if (sample > 0) samples.push(elapsed)
  }
  samples.sort((left, right) => left - right)
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!
  console.info('retained river graph render-index benchmark', {
    segments: segmentCount,
    indexedLines: indexedLineCount,
    p95Ms: p95,
  })

  expect(indexedLineCount).toBeGreaterThan(0)
  expect(indexedLineCount).toBeLessThan(segmentCount * 4)
  expect(p95).toBeLessThan(50)
})
