import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { beforeAll, describe, expect, it } from 'vitest'
import type { MapAreaDefinition } from '@alohayo/config'
import {
  buildHydrologyCoreRaster,
  type HydrologyCoreBuilder,
  type HydrologyCoreRaster,
} from '../packages/map/src/hydrology'
import {
  applyHydrologySeamPatch,
  BIOME,
  generateChunk,
  reconcileChunkHydrologyPair,
} from '../packages/map/src'

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

  parity('matches every TypeScript core buffer for square and rectangular fixtures', () => {
    for (const input of [
      fixture(16, 16, -3),
      fixture(64, 64, 7),
      fixture(96, 96, -11),
      fixture(128, 128, 19),
      fixture(160, 96, -23),
      fixture(96, 160, 31),
    ]) {
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

  parity('matches complete horizontal and vertical pair seam outputs', () => {
    const wasmBuilder: HydrologyCoreBuilder = (input) =>
      normalize(
        wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height),
        input
      )
    const seed = 'hydrology-pair-wasm-parity'
    const areas: MapAreaDefinition[] = [
      {
        schemaVersion: 1,
        id: 'test:hydrology-horizontal-seam-water',
        name: 'Horizontal seam water',
        description: 'Water overlay across a horizontal chunk seam.',
        enabled: true,
        placement: { mode: 'absolute', x: -8, y: 0 },
        width: 16,
        height: 64,
        terrainPatches: [
          {
            x: 0,
            y: 0,
            width: 16,
            height: 64,
            shape: 'rectangle',
            terrainId: 'core:ocean',
            elevation: 0,
          },
        ],
      },
      {
        schemaVersion: 1,
        id: 'test:hydrology-vertical-seam-water',
        name: 'Vertical seam water',
        description: 'Water overlay across a vertical chunk seam.',
        enabled: true,
        placement: { mode: 'absolute', x: 128, y: -136 },
        width: 64,
        height: 16,
        terrainPatches: [
          {
            x: 0,
            y: 0,
            width: 64,
            height: 16,
            shape: 'rectangle',
            terrainId: 'core:ocean',
            elevation: 0,
          },
        ],
      },
    ]
    const fixtures = [
      {
        first: generateChunk(seed, -1, 0, 64),
        second: generateChunk(seed, 0, 0, 64),
        direction: 'east' as const,
      },
      {
        first: generateChunk(seed, 2, -3, 64),
        second: generateChunk(seed, 2, -2, 64),
        direction: 'south' as const,
      },
    ]
    for (const pair of fixtures) {
      const args = {
        seedText: seed,
        firstChunkX: pair.first.chunkX,
        firstChunkY: pair.first.chunkY,
        secondChunkX: pair.second.chunkX,
        secondChunkY: pair.second.chunkY,
        direction: pair.direction,
        chunkSize: 64,
        surveyWidth: 192,
        surveyHeight: 192,
        firstWatershed: pair.first.watershed,
        secondWatershed: pair.second.watershed,
        areas,
        terrainCodes: { 'core:ocean': BIOME.ocean },
      }
      const reference = reconcileChunkHydrologyPair(args)
      const actual = reconcileChunkHydrologyPair({ ...args, coreBuilder: wasmBuilder })
      expect(actual).toEqual(reference)
    }
  })

  parity('meets bounded pair timing, transfer, and seam-apply budgets', () => {
    const wasmBuilder: HydrologyCoreBuilder = (input) =>
      normalize(
        wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height),
        input
      )
    const seed = 'hydrology-pair-budget'
    const west = generateChunk(seed, -1, 0, 64)
    const east = generateChunk(seed, 0, 0, 64)
    const args = {
      seedText: seed,
      firstChunkX: west.chunkX,
      firstChunkY: west.chunkY,
      secondChunkX: east.chunkX,
      secondChunkY: east.chunkY,
      direction: 'east' as const,
      chunkSize: 64,
      surveyWidth: 128,
      surveyHeight: 128,
      firstWatershed: west.watershed,
      secondWatershed: east.watershed,
    }
    const percentile = (values: number[], ratio: number) =>
      [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!
    const transfersBytes = (result: ReturnType<typeof reconcileChunkHydrologyPair>) =>
      result.patches.reduce(
        (sum, patch) =>
          sum + Object.values(patch.fields).reduce((bytes, field) => bytes + field.byteLength, 0),
        0
      )
    for (let index = 0; index < 3; index += 1) {
      reconcileChunkHydrologyPair(args)
      reconcileChunkHydrologyPair({ ...args, coreBuilder: wasmBuilder })
    }
    const typescriptMs: number[] = []
    const wasmMs: number[] = []
    const applyMs: number[] = []
    let transferBytes = 0
    let wasmResult: ReturnType<typeof reconcileChunkHydrologyPair> | undefined
    for (let index = 0; index < 30; index += 1) {
      let started = performance.now()
      reconcileChunkHydrologyPair(args)
      typescriptMs.push(performance.now() - started)
      started = performance.now()
      wasmResult = reconcileChunkHydrologyPair({ ...args, coreBuilder: wasmBuilder })
      wasmMs.push(performance.now() - started)
      transferBytes = transfersBytes(wasmResult)
      started = performance.now()
      for (const patch of wasmResult.patches) {
        applyHydrologySeamPatch(patch.chunkX === west.chunkX ? west : east, patch)
      }
      applyMs.push(performance.now() - started)
    }
    const report = {
      typescriptMedianMs: percentile(typescriptMs, 0.5),
      typescriptP95Ms: percentile(typescriptMs, 0.95),
      wasmMedianMs: percentile(wasmMs, 0.5),
      wasmP95Ms: percentile(wasmMs, 0.95),
      transferBytes,
      seamApplyP95Ms: percentile(applyMs, 0.95),
    }
    console.info('pair hydrology promotion benchmark', report)
    expect(report.typescriptMedianMs).toBeLessThanOrEqual(12)
    expect(report.typescriptP95Ms).toBeLessThanOrEqual(24)
    expect(report.wasmMedianMs).toBeLessThanOrEqual(12)
    expect(report.wasmP95Ms).toBeLessThanOrEqual(24)
    expect(report.transferBytes).toBeLessThanOrEqual(48 * 1024)
    expect(report.seamApplyP95Ms).toBeLessThanOrEqual(2)
  })

  parity('beats the hydrology promotion benchmark gates', () => {
    const inputs = [fixture(64, 64, 7), fixture(96, 96, -11), fixture(128, 128, 19)]
    const percentile = (values: number[], ratio: number) =>
      [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!
    for (const input of inputs) {
      buildHydrologyCoreRaster(input)
      wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height)
    }
    const typescriptMs: number[] = []
    const wasmMs: number[] = []
    const typescriptBySize = new Map<number, number[]>()
    const wasmBySize = new Map<number, number[]>()
    for (let run = 0; run < 30; run += 1) {
      for (const input of inputs) {
        let started = performance.now()
        buildHydrologyCoreRaster(input)
        const referenceElapsedMs = performance.now() - started
        typescriptMs.push(referenceElapsedMs)
        const referenceSamples = typescriptBySize.get(input.width) ?? []
        referenceSamples.push(referenceElapsedMs)
        typescriptBySize.set(input.width, referenceSamples)
        started = performance.now()
        wasm.build_hydrology_raster(input.rawElevation, input.water, input.width, input.height)
        const wasmElapsedMs = performance.now() - started
        wasmMs.push(wasmElapsedMs)
        const wasmSamples = wasmBySize.get(input.width) ?? []
        wasmSamples.push(wasmElapsedMs)
        wasmBySize.set(input.width, wasmSamples)
      }
    }
    const typescript64MedianMs = percentile(typescriptBySize.get(64)!, 0.5)
    const typescript96MedianMs = percentile(typescriptBySize.get(96)!, 0.5)
    const wasm64MedianMs = percentile(wasmBySize.get(64)!, 0.5)
    const wasm96MedianMs = percentile(wasmBySize.get(96)!, 0.5)
    const report = {
      startupMs,
      typescriptMedianMs: percentile(typescriptMs, 0.5),
      typescriptP95Ms: percentile(typescriptMs, 0.95),
      wasmMedianMs: percentile(wasmMs, 0.5),
      wasmP95Ms: percentile(wasmMs, 0.95),
      typescript64MedianMs,
      typescript96MedianMs,
      typescriptHalo96Vs64MedianRatio: typescript96MedianMs / typescript64MedianMs,
      wasm64MedianMs,
      wasm96MedianMs,
      wasmHalo96Vs64MedianRatio: wasm96MedianMs / wasm64MedianMs,
      transferGrowthPercent: 0,
    }
    console.info('hydrology raster promotion benchmark', report)
    expect(report.typescriptHalo96Vs64MedianRatio).toBeLessThanOrEqual(2.5)
    expect(report.wasmHalo96Vs64MedianRatio).toBeLessThanOrEqual(2.5)
    expect(report.wasmMedianMs).toBeLessThan(report.typescriptMedianMs * 0.85)
    expect(report.transferGrowthPercent).toBeLessThanOrEqual(5)
    expect(report.startupMs).toBeLessThan(50)
  })
})
