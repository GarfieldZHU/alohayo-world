import type { BiomeDefinition, WorldRiverGraphSegment } from '@alohayo/config'
import { describe, expect, it } from 'vitest'
import {
  classifyWaterMaterial,
  indexRiverGraphRenderLines,
} from '../packages/engine/src/water-render'

const biome = (id: string) => ({ id }) as BiomeDefinition
const context = {
  slope: 30,
  deposition: 20,
  floodplain: 0,
  river: false,
}

const riverSegment = (
  id: string,
  source: { x: number; y: number },
  target: { x: number; y: number },
  targetKind: WorldRiverGraphSegment['targetKind'] = 'channel'
): WorldRiverGraphSegment => ({
  id,
  identityId: 'watershed:-1,0:1',
  sourceNodeId: `river:channel:${source.x},${source.y}`,
  targetNodeId: `river:channel:${target.x},${target.y}`,
  sourceKind: 'channel',
  targetKind,
  source,
  target,
  chunkX: Math.floor(source.x / 2),
  chunkY: Math.floor(source.y / 2),
  offset: 0,
  direction: 'east',
  accumulation: 8,
})

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

describe('retained river graph presentation', () => {
  it('smooths stable D8 chains across negative-coordinate chunk seams', () => {
    const segments = [
      riverSegment('c', { x: 0, y: 0 }, { x: 1, y: 0 }, 'frontier'),
      riverSegment('a', { x: -2, y: 0 }, { x: -1, y: 0 }),
      riverSegment('b', { x: -1, y: 0 }, { x: 0, y: 0 }),
    ]

    const indexed = indexRiverGraphRenderLines(segments, 2, 2)
    const reversed = indexRiverGraphRenderLines([...segments].reverse(), 2, 2)

    expect(Array.from(indexed.keys()).sort()).toEqual(['-1,0', '0,0'])
    expect(Array.from(indexed.values()).reduce((count, lines) => count + lines.length, 0)).toBe(6)
    expect(Array.from(indexed)).toEqual(Array.from(reversed))
    expect(indexed.get('0,0')?.every((line) => line.accumulation === 8)).toBe(true)
  })

  it('keeps tributary presentation split at a confluence', () => {
    const tributary = riverSegment('a', { x: 0, y: -1 }, { x: 0, y: 0 })
    const mainstem = riverSegment('b', { x: -1, y: 0 }, { x: 0, y: 0 })
    const downstream = riverSegment('c', { x: 0, y: 0 }, { x: 1, y: 0 }, 'frontier')

    const indexed = indexRiverGraphRenderLines([downstream, tributary, mainstem], 4, 2)

    expect(Array.from(indexed.values()).reduce((count, lines) => count + lines.length, 0)).toBe(5)
  })

  it('clips a river link into both adjacent chunk views at a negative-coordinate seam', () => {
    const indexed = indexRiverGraphRenderLines(
      [riverSegment('seam', { x: -1, y: 0 }, { x: 0, y: 0 })],
      2,
      2
    )

    expect(Array.from(indexed.keys()).sort()).toEqual(['-1,0', '0,0'])
    expect(indexed.get('-1,0')?.every((line) => line.fromX + 0.5 <= 0 && line.toX + 0.5 <= 0)).toBe(
      true
    )
    expect(indexed.get('0,0')?.every((line) => line.fromX + 0.5 >= 0 && line.toX + 0.5 >= 0)).toBe(
      true
    )
  })
})
