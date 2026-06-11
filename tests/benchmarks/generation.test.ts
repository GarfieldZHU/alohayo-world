import { expect, it } from 'vitest'
import { generateWorld } from '../../packages/map/src'

it('generates the demo atlas within a broad CI budget', () => {
  const world = generateWorld('benchmark', 128, 96)
  expect(world.generationMs).toBeLessThan(1000)
})
