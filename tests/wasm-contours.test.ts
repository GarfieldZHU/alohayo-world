import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { beforeAll, describe, expect, it } from 'vitest'
import { extractMaskContours } from '@alohayo/map'

const wasmModuleUrl = new URL('../dist/embed/wasm/world_core.js', import.meta.url)
const wasmBinaryUrl = new URL('../dist/embed/wasm/world_core_bg.wasm', import.meta.url)
const hasWasmArtifact =
  existsSync(fileURLToPath(wasmModuleUrl)) && existsSync(fileURLToPath(wasmBinaryUrl))

let wasm: Awaited<ReturnType<typeof importWasm>>
let startupMs = Number.POSITIVE_INFINITY
const importWasm = () => import(wasmModuleUrl.href)

function makeKnownHalo(width: number, height: number, isKnown: (x: number, y: number) => boolean) {
  const halo = new Uint8Array((width + 2) * (height + 2))
  for (let y = -1; y <= height; y += 1) {
    for (let x = -1; x <= width; x += 1) {
      halo[(y + 1) * (width + 2) + x + 1] = isKnown(x, y) ? 1 : 0
    }
  }
  return halo
}

function normalizeWasm(result: ReturnType<typeof wasm.prepare_contour_geometry>) {
  const offsets = Array.from(result.path_offsets as Uint32Array)
  const lengths = result.path_lengths as Uint32Array
  const points = result.points as Float32Array
  const paths = offsets.map((offset, index) => {
    const length = lengths[index]!
    return Array.from(points.slice(offset * 2, (offset + length) * 2))
  })
  return {
    paths,
    closed: Array.from(result.closed as Uint8Array),
    origin: [result.origin_x, result.origin_y],
  }
}

function normalizeTypeScript(contours: Float32Array[]) {
  return contours.map((contour) => Array.from(contour))
}

function makeFixture(width: number, height: number) {
  const inside = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      inside[y * width + x] = (x * 13 + y * 7 + x * y) % 17 < 7 ? 1 : 0
    }
  }
  return { inside, known: makeKnownHalo(width, height, () => true) }
}

function contourBytes(contours: readonly Float32Array[]) {
  return (
    contours.reduce((sum, contour) => sum + contour.byteLength, 0) +
    contours.length * (Uint32Array.BYTES_PER_ELEMENT * 2 + Uint8Array.BYTES_PER_ELEMENT)
  )
}

describe('Wasm contour geometry parity', () => {
  const parity = hasWasmArtifact ? it : it.skip

  beforeAll(async () => {
    if (!hasWasmArtifact) return
    wasm = await importWasm()
    const started = performance.now()
    await wasm.default({ module_or_path: readFileSync(wasmBinaryUrl) })
    startupMs = performance.now() - started
  })

  parity('matches the TypeScript contour topology', () => {
    for (const fixture of [
      { width: 4, height: 3, inside: [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0], origin: [-12, 7] },
      { width: 5, height: 2, inside: [1, 0, 1, 0, 1, 0, 0, 0, 0, 1], origin: [19, -23] },
    ] as const) {
      const inside = new Uint8Array(fixture.inside)
      const isInside = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < fixture.width && y < fixture.height
          ? inside[y * fixture.width + x] === 1
          : false
      const known = makeKnownHalo(fixture.width, fixture.height, () => true)
      const expected = normalizeTypeScript(
        extractMaskContours({
          width: fixture.width,
          height: fixture.height,
          isInside,
          isKnown: () => true,
          smoothingPasses: 0,
        })
      )
      const actual = normalizeWasm(
        wasm.prepare_contour_geometry(
          inside,
          known,
          fixture.width,
          fixture.height,
          fixture.origin[0],
          fixture.origin[1]
        )
      )
      expect(actual.paths).toEqual(expected)
      expect(actual.closed).toEqual(expected.map(() => 1))
      expect(actual.origin).toEqual(fixture.origin)
    }
  })

  parity('suppresses edges against unknown streamed frontiers', () => {
    const width = 2
    const height = 2
    const inside = new Uint8Array([1, 1, 1, 1])
    const isKnown = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
    const expected = extractMaskContours({
      width,
      height,
      isInside: () => true,
      isKnown,
      smoothingPasses: 0,
    })
    const actual = wasm.prepare_contour_geometry(
      inside,
      makeKnownHalo(width, height, isKnown),
      width,
      height,
      0,
      0
    )
    expect(normalizeWasm(actual).paths).toEqual(normalizeTypeScript(expected))
    expect(actual.path_offsets.length).toBe(0)
  })

  parity('meets the contour promotion CPU, p95, and transfer gates', () => {
    const fixtures = [16, 64, 128]
    const percentile = (values: number[], ratio: number) =>
      [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!
    for (let warmup = 0; warmup < 3; warmup += 1) {
      for (const size of fixtures) {
        const input = makeFixture(size, size)
        extractMaskContours({
          width: size,
          height: size,
          isInside: (x, y) =>
            x >= 0 && y >= 0 && x < size && y < size && input.inside[y * size + x] !== 0,
          isKnown: () => true,
          smoothingPasses: 0,
        })
        wasm.prepare_contour_geometry(input.inside, input.known, size, size, -size, size)
      }
    }

    const typescriptMs: number[] = []
    const wasmMs: number[] = []
    let typescriptBytes = 0
    let wasmBytes = 0
    let typescriptPaths = 0
    let wasmPaths = 0
    for (let run = 0; run < 12; run += 1) {
      for (const size of fixtures) {
        const input = makeFixture(size, size)
        let started = performance.now()
        const expected = extractMaskContours({
          width: size,
          height: size,
          isInside: (x, y) =>
            x >= 0 && y >= 0 && x < size && y < size && input.inside[y * size + x] !== 0,
          isKnown: () => true,
          smoothingPasses: 0,
        })
        typescriptMs.push(performance.now() - started)
        typescriptBytes += contourBytes(expected)
        typescriptPaths += expected.length
        started = performance.now()
        const actual = wasm.prepare_contour_geometry(
          input.inside,
          input.known,
          size,
          size,
          -size,
          size
        )
        wasmMs.push(performance.now() - started)
        wasmBytes +=
          actual.path_offsets.byteLength +
          actual.path_lengths.byteLength +
          actual.points.byteLength +
          actual.closed.byteLength
        wasmPaths += actual.path_offsets.length
      }
    }
    const report = {
      startupMs,
      typescriptMedianMs: percentile(typescriptMs, 0.5),
      typescriptP95Ms: percentile(typescriptMs, 0.95),
      wasmMedianMs: percentile(wasmMs, 0.5),
      wasmP95Ms: percentile(wasmMs, 0.95),
      transferGrowthPercent: (wasmBytes / typescriptBytes - 1) * 100,
      typescriptPaths,
      wasmPaths,
    }
    console.info('contour promotion benchmark', report)
    expect(report.wasmMedianMs).toBeLessThan(report.typescriptMedianMs * 0.85)
    expect(report.wasmP95Ms).toBeLessThan(report.typescriptP95Ms * 0.95)
    expect(report.transferGrowthPercent).toBeLessThanOrEqual(5)
    expect(report.wasmPaths).toBe(report.typescriptPaths)
    expect(report.startupMs).toBeLessThan(50)
  })
})
