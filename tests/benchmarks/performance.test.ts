import { expect, it } from 'vitest'
import { generateChunk, generateWorld } from '../../packages/map/src'
import {
  createPackedFogMask,
  updatePackedFogMask,
  visionDirtyBounds,
} from '../../packages/engine/src/fog-mask'

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
