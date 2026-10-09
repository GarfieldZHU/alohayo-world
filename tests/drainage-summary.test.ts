import { buildChunkDrainageSummary } from '@alohayo/map'
import { buildHydrologyRaster } from '../packages/map/src/hydrology'
import { describe, expect, it } from 'vitest'

describe('chunk drainage summaries', () => {
  it('retains every boundary cell and marks only actual frontier handoffs', () => {
    const hydrology = buildHydrologyRaster({
      width: 3,
      height: 3,
      sample: (x, y) => ({ elevationValue: 100 - x * 10 - y, water: false }),
    })
    hydrology.flowDirection.fill(-1)
    hydrology.flowDirection[5] = 0
    const first = buildChunkDrainageSummary({ chunkX: -2, chunkY: 3, hydrology })
    const second = buildChunkDrainageSummary({ chunkX: -2, chunkY: 3, hydrology })

    expect(first).toEqual(second)
    expect(first.state).toBe('provisional')
    expect(first.edges.east).toHaveLength(3)
    expect(first.edges.east.map((sample) => sample.crossesFrontier)).toEqual([false, true, false])
    expect(first.edges.west).toHaveLength(3)
    expect(first.edges.west.every((sample) => !sample.crossesFrontier)).toBe(true)
  })

  it('assigns a corner diagonal to one cardinal handoff in north/east/south/west order', () => {
    const hydrology = buildHydrologyRaster({
      width: 3,
      height: 3,
      sample: (x, y) => ({ elevationValue: 100 - x * 10 - y, water: false }),
    })
    hydrology.flowDirection.fill(-1)
    hydrology.flowDirection[2] = 5

    const summary = buildChunkDrainageSummary({ chunkX: 0, chunkY: 0, hydrology })

    expect(summary.edges.north[2]?.crossesFrontier).toBe(true)
    expect(summary.edges.east[0]?.crossesFrontier).toBe(false)
  })
})
