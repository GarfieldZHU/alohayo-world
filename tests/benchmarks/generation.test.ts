import { expect, it } from 'vitest'
import { generateWorld } from '../../packages/map/src'

it('generates the demo atlas within a broad CI budget', () => {
  const world = generateWorld('benchmark', 256, 192)
  expect(world.generationMs).toBeLessThan(1000)
})

it('generates the largest bounded atlas within a broad CI budget', () => {
  const world = generateWorld('continental-benchmark', 384, 288)
  expect(world.generationMs).toBeLessThan(2000)
})
