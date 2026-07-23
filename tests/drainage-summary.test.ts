import { buildChunkDrainageSummary } from '@alohayo/map'
import { buildHydrologyRaster } from '../packages/map/src/hydrology'
import { describe, expect, it } from 'vitest'

describe('chunk drainage summaries', () => {
  it('serializes deterministic provisional frontier handoffs', () => {
    const hydrology = buildHydrologyRaster({
      width: 3,
      height: 3,
      sample: (x, y) => ({ elevationValue: 100 - x * 10 - y, water: false }),
    })
    const first = buildChunkDrainageSummary({ chunkX: -2, chunkY: 3, hydrology })
    const second = buildChunkDrainageSummary({ chunkX: -2, chunkY: 3, hydrology })

    expect(first).toEqual(second)
    expect(first.state).toBe('provisional')
    expect(first.edges.east.every((sample) => sample.crossesFrontier)).toBe(true)
    expect(first.edges.west).toEqual([])
  })
})
