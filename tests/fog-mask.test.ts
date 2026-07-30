import { describe, expect, it } from 'vitest'
import {
  createPackedFogMask,
  updatePackedFogMask,
  visionDirtyBounds,
} from '../packages/engine/src/fog-mask'
import { sampleVisionAtPoint, VISION_ACTION_THRESHOLD } from '../packages/engine/src/visibility'

const alphaAt = (mask: ReturnType<typeof createPackedFogMask>, pointX: number, pointY: number) => {
  const x = Math.floor((pointX - mask.bounds.minCellX) * mask.samplesPerCell)
  const y = Math.floor((pointY - mask.bounds.minCellY) * mask.samplesPerCell)
  return mask.pixels[(y * mask.width + x) * 4 + 3]! / 255
}

describe('GPU discovery fog mask preparation', () => {
  it('uses the same continuous visibility threshold as the CPU action reference', () => {
    const mask = createPackedFogMask(
      { minCellX: -8, minCellY: -8, widthCells: 16, heightCells: 16 },
      4
    )
    const vision = { sourceX: 0.5, sourceY: 0.5, radius: 4 }
    updatePackedFogMask(mask, {
      fogColor: 0x182434,
      hiddenAlpha: 1,
      memoryAlpha: 1,
      isDiscovered: () => false,
      activeVision: vision,
    })

    for (let y = -6; y <= 6; y += 0.25) {
      for (let x = -6; x <= 6; x += 0.25) {
        const sampleX = x + 0.125
        const sampleY = y + 0.125
        const cpuVisible =
          sampleVisionAtPoint({
            pointX: sampleX,
            pointY: sampleY,
            sourceX: vision.sourceX,
            sourceY: vision.sourceY,
            radius: vision.radius,
            softness: 1.35,
            noiseStrength: 0.34,
          }) >= VISION_ACTION_THRESHOLD
        expect(alphaAt(mask, sampleX, sampleY) <= 0.5).toBe(cpuVisible)
      }
    }
  })

  it('makes dirty vision-union updates byte-identical to a full rebuild', () => {
    const bounds = { minCellX: -12, minCellY: -12, widthCells: 24, heightCells: 24 }
    const previous = { sourceX: -2.5, sourceY: 1.5, radius: 4 }
    const next = { sourceX: 2.5, sourceY: 1.5, radius: 4 }
    const incremental = createPackedFogMask(bounds, 4)
    const rebuilt = createPackedFogMask(bounds, 4)
    const options = {
      fogColor: 0x182434,
      hiddenAlpha: 0.68,
      memoryAlpha: 0.045,
      isDiscovered: (x: number, y: number) => (x + y) % 3 === 0,
    }

    updatePackedFogMask(incremental, { ...options, activeVision: previous })
    updatePackedFogMask(incremental, {
      ...options,
      activeVision: next,
      dirtyBounds: visionDirtyBounds(previous, next),
    })
    updatePackedFogMask(rebuilt, { ...options, activeVision: next })

    expect(incremental.pixels).toEqual(rebuilt.pixels)
  })
})
