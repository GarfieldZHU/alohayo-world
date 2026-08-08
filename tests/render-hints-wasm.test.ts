import { describe, expect, it } from 'vitest'
import type { WorldWorkerCapabilities } from '@alohayo/config'
import { DEFAULT_WORLD_WORKER_CAPABILITIES } from '@alohayo/map'
import {
  normalizeWasmRenderHints,
  renderHintsTransferBytes,
  wasmBatchEnabled,
} from '../packages/map/src/render-hints-wasm'
import { generateChunkRenderHints } from '../packages/map/src/render-hints'

function makeHints(size: number) {
  const biomes = new Uint8Array(size * size)
  const elevation = new Uint8Array(size * size)
  return generateChunkRenderHints({
    biomes,
    elevation,
    chunkSize: size,
    originX: -size,
    originY: size,
  })
}

describe('render-hints worker boundary', () => {
  it('accepts the wasm-bindgen snake_case ABI and preserves transfer accounting', () => {
    const expected = makeHints(4)
    const normalized = normalizeWasmRenderHints(
      {
        noise: expected.noise,
        east_boundary_mask: expected.eastBoundaryMask,
        south_boundary_mask: expected.southBoundaryMask,
        regional_detail_mask: expected.regionalDetailMask,
        close_detail_kind: expected.closeDetailKind,
        detail_offset_x: expected.detailOffsetX,
        detail_offset_y: expected.detailOffsetY,
        shore_distance: expected.shoreDistance,
      },
      16
    )
    expect(normalized).toEqual(expected)
    expect(renderHintsTransferBytes(normalized!)).toBe(16 * (4 + 7))
  })

  it('rejects malformed output so the worker can take the TypeScript fallback', () => {
    const expected = makeHints(2)
    expect(
      normalizeWasmRenderHints(
        {
          noise: expected.noise,
          eastBoundaryMask: new Uint8Array(3),
          southBoundaryMask: expected.southBoundaryMask,
          regionalDetailMask: expected.regionalDetailMask,
          closeDetailKind: expected.closeDetailKind,
          detailOffsetX: expected.detailOffsetX,
          detailOffsetY: expected.detailOffsetY,
          shoreDistance: expected.shoreDistance,
        },
        4
      )
    ).toBeNull()
  })

  it('keeps the promoted default and rejects incompatible capabilities', () => {
    expect(wasmBatchEnabled(DEFAULT_WORLD_WORKER_CAPABILITIES, 'render-hints')).toBe(true)
    expect(
      wasmBatchEnabled(
        {
          ...DEFAULT_WORLD_WORKER_CAPABILITIES,
          wasm: { ...DEFAULT_WORLD_WORKER_CAPABILITIES.wasm, enabled: false },
        },
        'render-hints'
      )
    ).toBe(false)
    expect(
      wasmBatchEnabled(
        {
          ...DEFAULT_WORLD_WORKER_CAPABILITIES,
          protocolVersion: 2,
        } as unknown as WorldWorkerCapabilities,
        'render-hints'
      )
    ).toBe(false)
  })
})
