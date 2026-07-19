import { describe, expect, it } from 'vitest'

import { clipRoadToBounds, roadWeatherOverlayAlpha } from '../packages/engine/src/road-render'

const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 }

describe('road rendering geometry', () => {
  it('clips a crossing road to the chunk boundary', () => {
    expect(
      clipRoadToBounds(
        [
          { x: -5, y: 5 },
          { x: 15, y: 5 },
        ],
        bounds
      )
    ).toEqual([
      [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ],
    ])
  })

  it('keeps separate chunk visits as disconnected paths', () => {
    expect(
      clipRoadToBounds(
        [
          { x: 2, y: 2 },
          { x: -2, y: 2 },
          { x: -2, y: 8 },
          { x: 2, y: 8 },
        ],
        bounds
      )
    ).toEqual([
      [
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      [
        { x: 0, y: 8 },
        { x: 2, y: 8 },
      ],
    ])
  })

  it('does not paint a solid grey overlay in clear weather', () => {
    expect(
      roadWeatherOverlayAlpha(0.8, 0.7, {
        wetness: 0,
        snowCover: 0,
        mud: 0,
        fade: 1,
      })
    ).toBe(0)
    expect(
      roadWeatherOverlayAlpha(0.8, 0.7, {
        wetness: 0.5,
        snowCover: 0,
        mud: 0,
        fade: 0.5,
      })
    ).toBeCloseTo(0.14)
  })
})
