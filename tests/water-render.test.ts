import type { BiomeDefinition } from '@alohayo/config'
import { describe, expect, it } from 'vitest'
import { classifyWaterMaterial } from '../packages/engine/src/water-render'

const biome = (id: string) => ({ id }) as BiomeDefinition
const context = {
  slope: 30,
  deposition: 20,
  floodplain: 0,
  river: false,
}

describe('water material classification', () => {
  it('distinguishes persistent water forms and shore conditions', () => {
    expect(classifyWaterMaterial(biome('core:deep-ocean'), -8, context)).toBe('deep-ocean')
    expect(classifyWaterMaterial(biome('core:shallow-sea'), -4, context)).toBe('ocean-shelf')
    expect(classifyWaterMaterial(biome('core:coast'), 0, context)).toBe('beach')
    expect(classifyWaterMaterial(biome('core:lake'), -1, context)).toBe('lake-bank')
    expect(classifyWaterMaterial(biome('core:reef'), -2, context)).toBe('reef')
    expect(classifyWaterMaterial(biome('core:marsh'), -2, context)).toBe('marsh')
  })

  it('promotes steep, river-mouth, and depositional shores deterministically', () => {
    const water = biome('core:ocean')
    expect(classifyWaterMaterial(water, -1, { ...context, slope: 180 })).toBe('cliff')
    expect(classifyWaterMaterial(water, -1, { ...context, river: true })).toBe('estuary')
    expect(
      classifyWaterMaterial(water, -1, {
        ...context,
        river: true,
        deposition: 180,
        floodplain: 255,
      })
    ).toBe('delta')
  })
})
