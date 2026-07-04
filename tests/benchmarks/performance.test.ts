import { expect, it } from 'vitest'
import { generateChunk, generateWorld } from '../../packages/map/src'

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
