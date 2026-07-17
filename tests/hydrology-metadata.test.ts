import { describe, expect, it } from 'vitest'
import { buildHydrologyRaster } from '../packages/map/src/hydrology'

describe('geomorphology metadata', () => {
  it('derives bounded erosion, sediment, deposition, and floodplain fields', () => {
    const width = 17
    const height = 17
    const raster = buildHydrologyRaster({
      width,
      height,
      sample: (x, y) => {
        const distanceToChannel = Math.abs(x - 8)
        return {
          elevationValue: (height - y) * 0.025 + distanceToChannel * 0.008,
          water: y === height - 1,
        }
      },
    })

    for (const field of [
      raster.erosionPotential,
      raster.sedimentLoad,
      raster.deposition,
      raster.floodplain,
    ]) {
      expect(field.length).toBe(width * height)
      expect(field.every((value) => value >= 0 && value <= 255)).toBe(true)
    }
    expect(raster.erosionPotential.some((value) => value > 0)).toBe(true)
    expect(raster.sedimentLoad.some((value) => value > 0)).toBe(true)
    expect(raster.deposition.some((value) => value > 0)).toBe(true)
    expect(raster.floodplain.some((value) => value === 255)).toBe(true)
  })

  it('returns byte-identical metadata for the same inputs', () => {
    const generate = () =>
      buildHydrologyRaster({
        width: 12,
        height: 10,
        sample: (x, y) => ({
          elevationValue: (10 - y) * 0.04 + Math.abs(x - 5) * 0.01,
          water: y === 9,
        }),
      })
    const first = generate()
    const second = generate()

    expect(first.erosionPotential).toEqual(second.erosionPotential)
    expect(first.sedimentLoad).toEqual(second.sedimentLoad)
    expect(first.deposition).toEqual(second.deposition)
    expect(first.floodplain).toEqual(second.floodplain)
  })
})
