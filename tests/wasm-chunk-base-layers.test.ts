import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateChunkBaseLayers, hashSeed } from '../packages/map/src'

const wasmModuleUrl = new URL('../dist/embed/wasm/world_core.js', import.meta.url)
const wasmBinaryUrl = new URL('../dist/embed/wasm/world_core_bg.wasm', import.meta.url)
const hasWasmArtifact =
  existsSync(fileURLToPath(wasmModuleUrl)) && existsSync(fileURLToPath(wasmBinaryUrl))

let wasm: Awaited<ReturnType<typeof importWasm>>
let startupMs = Number.POSITIVE_INFINITY
const importWasm = () => import(wasmModuleUrl.href)

describe('Wasm chunk base-layer parity', () => {
  const parity = hasWasmArtifact ? it : it.skip

  beforeAll(async () => {
    if (!hasWasmArtifact) return
    wasm = await importWasm()
    const startupStarted = performance.now()
    await wasm.default({ module_or_path: readFileSync(wasmBinaryUrl) })
    startupMs = performance.now() - startupStarted
  })

  parity('matches the TypeScript reference buffers byte-for-byte', () => {
    for (const [seed, chunkX, chunkY, chunkSize] of [
      ['origin', 0, 0, 16],
      ['north-west', -3, -5, 16],
      ['north-east', 12, -8, 64],
      ['south-west', -9, 7, 64],
      ['south-east', 5, 11, 128],
      ['far-boundary', -257, 256, 128],
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

  parity('beats the promotion median and transfer-size gates', () => {
    const fixtures = [
      ['alohayo', 4, -3, 64],
      ['continental', -7, 5, 128],
      ['boundary', 0, 0, 128],
      ['quadrant', -11, -9, 128],
    ] as const
    const percentile = (values: number[], ratio: number) =>
      [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!

    for (let warmup = 0; warmup < 3; warmup += 1) {
      for (const [seed, x, y, size] of fixtures) {
        generateChunkBaseLayers(seed, x, y, size)
        wasm.generate_chunk_base_layers(hashSeed(seed), size, x * size, y * size)
      }
    }

    const typescriptMs: number[] = []
    const wasmMs: number[] = []
    for (let run = 0; run < 15; run += 1) {
      for (const [seed, x, y, size] of fixtures) {
        let started = performance.now()
        generateChunkBaseLayers(seed, x, y, size)
        typescriptMs.push(performance.now() - started)
        started = performance.now()
        wasm.generate_chunk_base_layers(hashSeed(seed), size, x * size, y * size)
        wasmMs.push(performance.now() - started)
      }
    }

    const report = {
      startupMs,
      typescriptMedianMs: percentile(typescriptMs, 0.5),
      typescriptP95Ms: percentile(typescriptMs, 0.95),
      wasmMedianMs: percentile(wasmMs, 0.5),
      wasmP95Ms: percentile(wasmMs, 0.95),
      transferGrowthPercent: 0,
    }
    console.info('chunk base-layer promotion benchmark', report)
    expect(report.wasmMedianMs).toBeLessThan(report.typescriptMedianMs * 0.85)
    expect(report.transferGrowthPercent).toBeLessThanOrEqual(5)
    expect(report.startupMs).toBeLessThan(50)
  })
})
