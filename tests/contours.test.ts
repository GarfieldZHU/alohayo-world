import { describe, expect, it } from 'vitest'
import { extractMaskContours } from '@alohayo/map'

describe('mask contour extraction', () => {
  it('turns a cell frontier into a closed smoothed typed-array path', () => {
    const contour = extractMaskContours({
      width: 3,
      height: 3,
      isInside: (x, y) => x === 1 && y === 1,
      smoothingPasses: 2,
    })[0]!

    expect(contour).toBeInstanceOf(Float32Array)
    expect(contour.length).toBeGreaterThan(8)
    expect(contour[0]).toBe(contour.at(-2))
    expect(contour[1]).toBe(contour.at(-1))
    expect(Math.min(...contour)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...contour)).toBeLessThanOrEqual(2)
  })

  it('keeps separated regions as deterministic contours', () => {
    const build = () =>
      extractMaskContours({
        width: 4,
        height: 4,
        isInside: (x, y) => (x === 0 && y === 0) || (x === 3 && y === 3),
        smoothingPasses: 3,
      })

    const first = build()
    const second = build()
    expect(first).toHaveLength(2)
    expect(first.map((contour) => Array.from(contour))).toEqual(
      second.map((contour) => Array.from(contour))
    )
  })
})
