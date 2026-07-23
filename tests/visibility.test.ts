import { describe, expect, it } from 'vitest'
import {
  VISION_ACTION_THRESHOLD,
  pointCrossesVisionShadow,
  sampleChunkVisionAtPoint,
  sampleVisionAtPoint,
} from '../packages/engine/src/visibility'

describe('continuous visibility field', () => {
  it('keeps the explorer side visible and the far side shadowed', () => {
    const source = { sourceX: 10, sourceY: 10, radius: 5 }

    expect(sampleVisionAtPoint({ ...source, pointX: 10, pointY: 10 })).toBeGreaterThan(0.95)
    expect(sampleVisionAtPoint({ ...source, pointX: 18, pointY: 10 })).toBeLessThan(0.08)
  })

  it('creates partial visibility near the shadow frontier', () => {
    const visibility = sampleVisionAtPoint({
      sourceX: 10,
      sourceY: 10,
      pointX: 14.9,
      pointY: 10,
      radius: 5,
      noiseStrength: 0,
    })

    expect(visibility).toBeGreaterThan(0)
    expect(visibility).toBeLessThan(1)
  })

  it('uses the shared action threshold for shadow-line checks', () => {
    const source = { sourceX: 10, sourceY: 10, radius: 5, noiseStrength: 0 }

    expect(VISION_ACTION_THRESHOLD).toBe(0.5)
    expect(pointCrossesVisionShadow({ ...source, pointX: 13, pointY: 10 })).toBe(false)
    expect(pointCrossesVisionShadow({ ...source, pointX: 16, pointY: 10 })).toBe(true)
  })

  it('keeps the visibility field continuous across chunk coordinate systems', () => {
    const fromWestChunk = sampleChunkVisionAtPoint({
      localPointX: 64,
      localPointY: 10.5,
      localSourceX: 67.5,
      localSourceY: 8.5,
      chunkOriginX: -64,
      chunkOriginY: 0,
      radius: 5,
    })
    const fromEastChunk = sampleChunkVisionAtPoint({
      localPointX: 0,
      localPointY: 10.5,
      localSourceX: 3.5,
      localSourceY: 8.5,
      chunkOriginX: 0,
      chunkOriginY: 0,
      radius: 5,
    })

    expect(fromWestChunk).toBe(fromEastChunk)
  })
})
