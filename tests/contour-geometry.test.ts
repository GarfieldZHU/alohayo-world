import { describe, expect, it } from 'vitest'
import { generateChunkContourGeometry, normalizeWasmContourGeometry } from '@alohayo/map'

describe('coarse contour geometry worker contract', () => {
  it('keeps the fallback typed and suppresses unknown chunk borders', () => {
    const geometry = generateChunkContourGeometry({
      inside: Uint8Array.from([1, 1, 1, 1]),
      width: 2,
      height: 2,
      originX: -4,
      originY: 9,
    })
    expect(geometry.abiVersion).toBe(1)
    expect(geometry.pathOffsets).toHaveLength(0)
    expect(geometry.points).toHaveLength(0)
  })

  it('rejects malformed or overlong Wasm output before transfer', () => {
    const valid = {
      abi_version: 1,
      width: 2,
      height: 2,
      path_offsets: new Uint32Array([0]),
      path_lengths: new Uint32Array([2]),
      points: new Float32Array([0, 0, 1, 0]),
      closed: new Uint8Array([0]),
    }
    expect(normalizeWasmContourGeometry(valid, 2, 2, 0, 0)?.pathLengths[0]).toBe(2)
    expect(
      normalizeWasmContourGeometry({ ...valid, path_lengths: new Uint32Array([4]) }, 2, 2, 0, 0)
    ).toBeNull()
  })
})
