import { describe, expect, it } from 'vitest'
import { BIOME } from '../packages/map/src'
import {
  CLOSE_DETAIL_KIND,
  generateChunkRenderHints,
  renderHintNoise,
} from '../packages/map/src/render-hints'

describe('chunk render hints', () => {
  it('is deterministic for the same chunk input', () => {
    const biomes = Uint8Array.from([
      BIOME.deepOcean,
      BIOME.deepOcean,
      BIOME.forest,
      BIOME.forest,
      BIOME.mountain,
      BIOME.mountain,
      BIOME.wetland,
      BIOME.lowland,
      BIOME.lake,
    ])
    const elevation = Uint8Array.from([42, 43, 80, 81, 190, 191, 110, 96, 20])
    const first = generateChunkRenderHints({
      biomes,
      elevation,
      chunkSize: 3,
      originX: -2,
      originY: 5,
    })
    const second = generateChunkRenderHints({
      biomes,
      elevation,
      chunkSize: 3,
      originX: -2,
      originY: 5,
    })

    expect(first.noise).toEqual(second.noise)
    expect(first.eastBoundaryMask).toEqual(second.eastBoundaryMask)
    expect(first.southBoundaryMask).toEqual(second.southBoundaryMask)
    expect(first.regionalDetailMask).toEqual(second.regionalDetailMask)
    expect(first.closeDetailKind).toEqual(second.closeDetailKind)
    expect(first.detailOffsetX).toEqual(second.detailOffsetX)
    expect(first.detailOffsetY).toEqual(second.detailOffsetY)
    expect(first.shoreDistance).toEqual(second.shoreDistance)
  })

  it('creates a signed local shoreline field without altering biome authority', () => {
    const hints = generateChunkRenderHints({
      biomes: Uint8Array.from([
        BIOME.ocean,
        BIOME.ocean,
        BIOME.lowland,
        BIOME.ocean,
        BIOME.ocean,
        BIOME.lowland,
        BIOME.ocean,
        BIOME.ocean,
        BIOME.lowland,
      ]),
      elevation: new Uint8Array(9),
      chunkSize: 3,
      originX: 0,
      originY: 0,
    })

    expect(Array.from(hints.shoreDistance)).toEqual([-1, 0, 0, -1, 0, 0, -1, 0, 0])
  })

  it('marks local boundaries and close-detail classes predictably', () => {
    const biomes = Uint8Array.from([
      BIOME.deepOcean,
      BIOME.deepOcean,
      BIOME.forest,
      BIOME.forest,
      BIOME.mountain,
      BIOME.mountain,
      BIOME.wetland,
      BIOME.lowland,
      BIOME.lake,
    ])
    const elevation = Uint8Array.from([42, 43, 80, 81, 190, 191, 110, 96, 20])
    const hints = generateChunkRenderHints({
      biomes,
      elevation,
      chunkSize: 3,
      originX: -2,
      originY: 5,
    })

    expect(Array.from(hints.eastBoundaryMask)).toEqual([0, 1, 0, 1, 0, 0, 1, 1, 0])
    expect(Array.from(hints.southBoundaryMask)).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 0])

    const mountainIndex = 4
    expect(hints.closeDetailKind[mountainIndex]).toBe(
      hints.noise[mountainIndex]! % 7 === 0 ? CLOSE_DETAIL_KIND.mountain : CLOSE_DETAIL_KIND.none
    )
    const forestIndex = 2
    expect(hints.closeDetailKind[forestIndex]).toBe(
      hints.noise[forestIndex]! % 7 === 0 ? CLOSE_DETAIL_KIND.forest : CLOSE_DETAIL_KIND.none
    )
  })

  it('keeps the noise contract stable for render-plan parity', () => {
    expect(renderHintNoise(-2, 5, 42)).toBe(64487195)
    expect(renderHintNoise(17, -9, 190)).toBe(3704234693)
  })
})
