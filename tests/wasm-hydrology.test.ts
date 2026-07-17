import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildHydrologyCoreRaster,
  type HydrologyCoreBuilder,
  type HydrologyCoreRaster,
} from '../packages/map/src/hydrology'
import { generateChunk } from '../packages/map/src'

const wasmModuleUrl = new URL('../dist/embed/wasm/world_core.js', import.meta.url)
const wasmBinaryUrl = new URL('../dist/embed/wasm/world_core_bg.wasm', import.meta.url)
const hasWasmArtifact =
  existsSync(fileURLToPath(wasmModuleUrl)) && existsSync(fileURLToPath(wasmBinaryUrl))

let wasm: Awaited<ReturnType<typeof importWasm>>
let startupMs = Number.POSITIVE_INFINITY
const importWasm = () => import(wasmModuleUrl.href)

const normalize = (
  result: ReturnType<Awaited<ReturnType<typeof importWasm>>['build_hydrology_raster']>,
  input: Parameters<HydrologyCoreBuilder>[0]
): HydrologyCoreRaster => ({
  width: input.width,
  height: input.height,
  rawElevation: result.raw_elevation,
  filledElevation: result.filled_elevation,
  water: result.water,
  slope: result.slope,
  flowDirection: result.flow_direction,
  flowAccumulation: result.flow_accumulation,
  watershed: result.watershed,
  depression: result.depression,
})

const fixture = (width: number, height: number, salt: number) => {
  const size = width * height
  const rawElevation = new Float32Array(size)
  const water = new Uint8Array(size)
  for (let index = 0; index < size; index += 1) {
    const x = index % width
    const y = Math.floor(index / width)
    rawElevation[index] = ((x * 13 + y * 17 + salt * 29 + ((x ^ y) % 11)) % 251) / 255
    water[index] = (x + salt) % 31 === 0 && (y * 3 + salt) % 17 < 2 ? 1 : 0
  }
  return { width, height, rawElevation, water }
}

describe('Wasm hydrology raster parity', () => {
  const parity = hasWasmArtifact ? it : it.skip

  beforeAll(async () => {
    if (!hasWasmArtifact) return
    wasm = await importWasm()
    const started = performance.now()
    await wasm.default({ module_or_path: readFileSync(wasmBinaryUrl) })
    startupMs = performance.now() - started
  })

  parity('matches every TypeScript core buffer for 16/64/128 fixtures', () => {
    for (const input of [fixture(16, 16, -3), fixture(64, 64, 7), fixture(128, 128, 19)]) {
      const expected = buildHydrologyCoreRaster(input)
      const actual = normalize(
        wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height),
        input
      )
      expect(actual.rawElevation).toEqual(expected.rawElevation)
      expect(actual.filledElevation).toEqual(expected.filledElevation)
      expect(actual.water).toEqual(expected.water)
      expect(actual.slope).toEqual(expected.slope)
      expect(actual.flowDirection).toEqual(expected.flowDirection)
      expect(actual.flowAccumulation).toEqual(expected.flowAccumulation)
      expect(actual.watershed).toEqual(expected.watershed)
      expect(actual.depression).toEqual(expected.depression)
    }
  })

  parity('preserves generated chunk hashes through the provider boundary', () => {
    const wasmBuilder: HydrologyCoreBuilder = (input) =>
      normalize(
        wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height),
        input
      )
    const reference = generateChunk('hydrology-wasm-hash', 2, -3, 64)
    const migrated = generateChunk(
      'hydrology-wasm-hash',
      2,
      -3,
      64,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      wasmBuilder
    )
    expect(migrated.hash).toBe(reference.hash)
    expect(migrated.flowDirection).toEqual(reference.flowDirection)
    expect(migrated.flowAccumulation).toEqual(reference.flowAccumulation)
    expect(migrated.watershed).toEqual(reference.watershed)
  })

  parity('beats the hydrology promotion benchmark gates', () => {
    const inputs = [fixture(64, 64, 7), fixture(128, 128, 19)]
    const percentile = (values: number[], ratio: number) =>
      [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!
    for (const input of inputs) {
      buildHydrologyCoreRaster(input)
      wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height)
    }
    const typescriptMs: number[] = []
    const wasmMs: number[] = []
    for (let run = 0; run < 10; run += 1) {
      for (const input of inputs) {
        let started = performance.now()
        buildHydrologyCoreRaster(input)
        typescriptMs.push(performance.now() - started)
        started = performance.now()
        wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height)
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
    console.info('hydrology raster promotion benchmark', report)
    expect(report.wasmMedianMs).toBeLessThan(report.typescriptMedianMs * 0.85)
    expect(report.transferGrowthPercent).toBeLessThanOrEqual(5)
    expect(report.startupMs).toBeLessThan(50)
  })
})
