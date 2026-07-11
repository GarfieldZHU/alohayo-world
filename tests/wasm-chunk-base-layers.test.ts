import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { generateChunkBaseLayers, hashSeed } from '../packages/map/src'

const wasmModuleUrl = new URL('../dist/embed/wasm/world_core.js', import.meta.url)
const wasmBinaryUrl = new URL('../dist/embed/wasm/world_core_bg.wasm', import.meta.url)
const hasWasmArtifact =
  existsSync(fileURLToPath(wasmModuleUrl)) && existsSync(fileURLToPath(wasmBinaryUrl))

describe('Wasm chunk base-layer parity', () => {
  const parity = hasWasmArtifact ? it : it.skip

  parity('matches the TypeScript reference buffers byte-for-byte', async () => {
    const wasm = await import(wasmModuleUrl.href)
    await wasm.default(readFileSync(wasmBinaryUrl))

    for (const [seed, chunkX, chunkY, chunkSize] of [
      ['alohayo', -3, 5, 16],
      ['coastline', 12, -8, 64],
    ] as const) {
      const expected = generateChunkBaseLayers(seed, chunkX, chunkY, chunkSize)
      const actual = wasm.generate_chunk_base_layers(
        hashSeed(seed),
        chunkSize,
        chunkX * chunkSize,
        chunkY * chunkSize
      )

      expect(actual.elevation).toEqual(expected.elevation)
      expect(actual.moisture).toEqual(expected.moisture)
      expect(actual.temperature).toEqual(expected.temperature)
    }
  })
})
