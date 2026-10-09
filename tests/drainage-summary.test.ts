import { buildChunkDrainageFrontierInflows, buildChunkDrainageSummary } from '@alohayo/map'
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

  it('records deterministic halo flows entering a retained chunk', () => {
    const hydrology = buildHydrologyRaster({
      width: 5,
      height: 5,
      sample: () => ({ elevationValue: 0.8, water: false }),
    })
    hydrology.flowDirection.fill(-1)
    hydrology.flowAccumulation.fill(1)
    hydrology.watershed.fill(9)
    hydrology.flowDirection[0] = 4
    hydrology.flowAccumulation[0] = 4
    hydrology.flowDirection[5] = 0
    hydrology.flowAccumulation[5] = 6
    hydrology.flowAccumulation[6] = 10
    hydrology.watershed[6] = 7

    const args = {
      chunkX: 0,
      chunkY: 0,
      chunkSize: 3,
      windowOriginX: -1,
      windowOriginY: -1,
      hydrology,
    }
    const first = buildChunkDrainageFrontierInflows(args)
    const second = buildChunkDrainageFrontierInflows(args)

    expect(first).toEqual(second)
    expect(first).toEqual([
      {
        source: { x: -1, y: -1 },
        target: { x: 0, y: 0 },
        direction: 4,
        sourceAccumulation: 4,
      },
      {
        source: { x: -1, y: 0 },
        target: { x: 0, y: 0 },
        direction: 0,
        sourceAccumulation: 6,
      },
    ])
  })
})
