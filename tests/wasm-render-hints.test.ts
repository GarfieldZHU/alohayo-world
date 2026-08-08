import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateChunkRenderHints } from '../packages/map/src/render-hints'
import { hashSeed } from '@alohayo/map'

const wasmModuleUrl = new URL('../dist/embed/wasm/world_core.js', import.meta.url)
const wasmBinaryUrl = new URL('../dist/embed/wasm/world_core_bg.wasm', import.meta.url)
const hasWasmArtifact =
  existsSync(fileURLToPath(wasmModuleUrl)) && existsSync(fileURLToPath(wasmBinaryUrl))

let wasm: Awaited<ReturnType<typeof importWasm>>
let startupMs = Number.POSITIVE_INFINITY
const importWasm = () => import(wasmModuleUrl.href)

function expectedHints(seed: string, chunkX: number, chunkY: number, chunkSize: number) {
  const originX = chunkX * chunkSize
  const originY = chunkY * chunkSize
  const seedBias = hashSeed(seed) & 0xff
  const biomes = new Uint8Array(chunkSize * chunkSize)
  const elevation = new Uint8Array(chunkSize * chunkSize)
  for (let index = 0; index < biomes.length; index += 1) {
    const x = index % chunkSize
    const y = Math.floor(index / chunkSize)
    biomes[index] = (x * 13 + y * 7 + seedBias + chunkX * 3 + chunkY * 5) % 26
    elevation[index] = (x * 17 + y * 11 + seedBias * 3) % 256
  }
  return {
    biomes,
    elevation,
    hints: generateChunkRenderHints({ biomes, elevation, chunkSize, originX, originY }),
  }
}

describe('Wasm render-hint parity', () => {
  const parity = hasWasmArtifact ? it : it.skip

  beforeAll(async () => {
    if (!hasWasmArtifact) return
    wasm = await importWasm()
    const started = performance.now()
    await wasm.default({ module_or_path: readFileSync(wasmBinaryUrl) })
    startupMs = performance.now() - started
  })

  parity('matches the TypeScript reference across sizes, quadrants, and seams', () => {
    const fixtures = [
      ['origin', 0, 0, 16],
      ['north-west', -3, -5, 16],
      ['north-east', 12, -8, 64],
      ['south-west', -9, 7, 64],
      ['south-east', 5, 11, 128],
      ['seam-west', -1, 0, 128],
      ['seam-east', 1, 0, 128],
      ['seam-north', 0, -1, 128],
      ['seam-south', 0, 1, 128],
    ] as const

    for (const [seed, chunkX, chunkY, chunkSize] of fixtures) {
      const expected = expectedHints(seed, chunkX, chunkY, chunkSize)
      const actual = wasm.prepare_chunk_render_hints(
        expected.biomes,
        expected.elevation,
        chunkSize,
        chunkX * chunkSize,
        chunkY * chunkSize
      )
      expect(actual.noise).toEqual(expected.hints.noise)
      expect(actual.east_boundary_mask).toEqual(expected.hints.eastBoundaryMask)
      expect(actual.south_boundary_mask).toEqual(expected.hints.southBoundaryMask)
      expect(actual.regional_detail_mask).toEqual(expected.hints.regionalDetailMask)
      expect(actual.close_detail_kind).toEqual(expected.hints.closeDetailKind)
      expect(actual.detail_offset_x).toEqual(expected.hints.detailOffsetX)
      expect(actual.detail_offset_y).toEqual(expected.hints.detailOffsetY)
      expect(actual.shore_distance).toEqual(expected.hints.shoreDistance)
    }
  })

  parity('beats the promotion median and transfer-size gates', () => {
    const fixtures = [
      ['alohayo', -3, -5, 16],
      ['continental', 12, -8, 64],
      ['boundary', -9, 7, 128],
      ['quadrant', 5, 11, 128],
    ] as const
    const percentile = (values: number[], ratio: number) =>
      [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!

    for (let warmup = 0; warmup < 3; warmup += 1) {
      for (const [seed, x, y, size] of fixtures) {
        const input = expectedHints(seed, x, y, size)
        generateChunkRenderHints({
          biomes: input.biomes,
          elevation: input.elevation,
          chunkSize: size,
          originX: x * size,
          originY: y * size,
        })
        wasm.prepare_chunk_render_hints(input.biomes, input.elevation, size, x * size, y * size)
      }
    }

    const typescriptMs: number[] = []
    const wasmMs: number[] = []
    for (let run = 0; run < 12; run += 1) {
      for (const [seed, x, y, size] of fixtures) {
        const input = expectedHints(seed, x, y, size)
        let started = performance.now()
        generateChunkRenderHints({
          biomes: input.biomes,
          elevation: input.elevation,
          chunkSize: size,
          originX: x * size,
          originY: y * size,
        })
        typescriptMs.push(performance.now() - started)
        started = performance.now()
        wasm.prepare_chunk_render_hints(input.biomes, input.elevation, size, x * size, y * size)
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
    console.info('render-hints promotion benchmark', report)
    expect(report.wasmMedianMs).toBeLessThan(report.typescriptMedianMs * 0.85)
    expect(report.transferGrowthPercent).toBeLessThanOrEqual(5)
    expect(report.startupMs).toBeLessThan(50)
  })
})
