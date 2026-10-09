import { describe, expect, it } from 'vitest'
import type { WorldRiverGraphSegment } from '@alohayo/config'
import {
  indexRiverGraphSegmentsByChunk,
  selectVisibleRiverGraphSegments,
} from '../packages/engine/src/minimap-hydrology'

function segment(
  id: string,
  chunkX: number,
  source: WorldRiverGraphSegment['source'],
  target: WorldRiverGraphSegment['target'],
  targetKind: WorldRiverGraphSegment['targetKind'] = 'channel'
): WorldRiverGraphSegment {
  return {
    id,
    identityId: 'watershed:0,0:1',
    sourceNodeId: `river:channel:${source.x},${source.y}`,
    targetNodeId: `river:channel:${target.x},${target.y}`,
    sourceKind: 'channel',
    targetKind,
    source,
    target,
    chunkX,
    chunkY: 0,
    offset: 0,
    direction: 'east',
    accumulation: 8,
  }
}

describe('minimap hydrology', () => {
  it('selects only discovered retained river segments inside negative-coordinate viewport chunks', () => {
    const visible = segment('visible', -1, { x: -1, y: -2 }, { x: 0, y: -2 })
    const frontier = segment('frontier', -1, { x: -1, y: -1 }, { x: 0, y: -1 }, 'frontier')
    const undiscovered = segment('undiscovered', 0, { x: 0, y: -3 }, { x: 1, y: -3 })
    const distant = segment('distant', 2, { x: 8, y: -2 }, { x: 9, y: -2 })
    const index = indexRiverGraphSegmentsByChunk([visible, frontier, undiscovered, distant])

    const result = selectVisibleRiverGraphSegments({
      index,
      chunkSize: 4,
      viewport: { minX: -2, maxX: 2, minY: -4, maxY: 0 },
      isDiscovered: (x, y) => !(x === 0 && y === -3),
    })

    expect(result.map((item) => item.id)).toEqual(['visible'])
  })

  it('updates the chunk index when a river path crosses a retained seam', () => {
    const seam = segment('seam', 0, { x: 3, y: 2 }, { x: 4, y: 2 })
    const index = indexRiverGraphSegmentsByChunk([seam])

    expect(
      selectVisibleRiverGraphSegments({
        index,
        chunkSize: 4,
        viewport: { minX: 3, maxX: 4, minY: 2, maxY: 2 },
        isDiscovered: () => true,
      })
    ).toEqual([seam])
  })
})
