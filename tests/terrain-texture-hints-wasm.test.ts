import { describe, expect, it } from 'vitest'
import { generateChunkTerrainTextureHints } from '../packages/map/src/terrain-texture-hints'
import {
  normalizeWasmTerrainTextureHints,
  terrainTextureHintsTransferBytes,
} from '../packages/map/src/terrain-texture-hints-wasm'

describe('terrain texture hint worker boundary', () => {
  it('accepts the packed one-byte ABI and accounts for its transfer size', () => {
    const expected = generateChunkTerrainTextureHints({
      biomes: new Uint8Array(16),
      elevation: new Uint8Array(16),
      moisture: new Uint8Array(16),
      temperature: new Uint8Array(16),
      chunkSize: 4,
      originX: -4,
      originY: 8,
    })
    const normalized = normalizeWasmTerrainTextureHints({ pattern: expected.pattern }, 16)
    expect(normalized).toEqual(expected)
    expect(terrainTextureHintsTransferBytes(normalized!)).toBe(16)
  })

  it('rejects malformed output so the worker can use its TypeScript fallback', () => {
    expect(normalizeWasmTerrainTextureHints({ pattern: new Uint8Array(15) }, 16)).toBeNull()
  })
})
