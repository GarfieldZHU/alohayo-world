import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateChunkTerrainTextureHints } from '../packages/map/src/terrain-texture-hints'

const wasmModuleUrl = new URL('../dist/embed/wasm/world_core.js', import.meta.url)
const wasmBinaryUrl = new URL('../dist/embed/wasm/world_core_bg.wasm', import.meta.url)
const hasWasmArtifact =
  existsSync(fileURLToPath(wasmModuleUrl)) && existsSync(fileURLToPath(wasmBinaryUrl))
const importWasm = () => import(wasmModuleUrl.href)
let wasm: Awaited<ReturnType<typeof importWasm>>

function fixture(chunkSize: number) {
  const size = chunkSize * chunkSize
  const biomes = new Uint8Array(size)
  const elevation = new Uint8Array(size)
  const moisture = new Uint8Array(size)
  const temperature = new Uint8Array(size)
  for (let index = 0; index < size; index += 1) {
    biomes[index] = (index * 7 + 3) % 26
    elevation[index] = (index * 19 + 41) % 256
    moisture[index] = (index * 23 + 5) % 256
    temperature[index] = (index * 29 + 71) % 256
  }
  return { biomes, elevation, moisture, temperature }
}

describe('Wasm terrain texture hint parity', () => {
  const parity = hasWasmArtifact ? it : it.skip

  beforeAll(async () => {
    if (!hasWasmArtifact) return
    wasm = await importWasm()
    await wasm.default({ module_or_path: readFileSync(wasmBinaryUrl) })
  })

  parity('matches TypeScript across sizes, negative origins, and seams', () => {
    for (const [size, originX, originY] of [
      [4, -4, 8],
      [16, -48, -16],
      [32, 32, 64],
    ] as const) {
      const input = fixture(size)
      const expected = generateChunkTerrainTextureHints({
        ...input,
        chunkSize: size,
        originX,
        originY,
      })
      const actual = wasm.prepare_chunk_texture_hints(
        input.biomes,
        input.elevation,
        input.moisture,
        input.temperature,
        size,
        originX,
        originY
      )
      expect(actual.pattern).toEqual(expected.pattern)
    }
  })
})
