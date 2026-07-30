import {
  applyMapAreas,
  generateChunkWithAreas,
  generateWorld,
  hashSeed,
  type ChunkBaseLayers,
  type WorldWorkerCapabilities,
  type WorldWorkerDiagnostics,
  type WorldWorkerWasmBatch,
  type WorldWorkerRequest,
  type WorldWorkerResponse,
} from './index'
import { generateChunkRenderHints, type ChunkRenderHints } from './render-hints'
import {
  buildHydrologyCoreRaster,
  type HydrologyCoreBuilder,
  type HydrologyCoreRaster,
} from './hydrology'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorldWorkerRequest>) => void) | null
  postMessage(message: WorldWorkerResponse, options: { transfer: ArrayBufferLike[] }): void
}

type WasmChunkBaseLayers = {
  elevation: Uint8Array
  moisture: Uint8Array
  temperature: Uint8Array
}

type WasmRenderHints = Omit<
  ChunkRenderHints,
  | 'eastBoundaryMask'
  | 'southBoundaryMask'
  | 'regionalDetailMask'
  | 'closeDetailKind'
  | 'detailOffsetX'
  | 'detailOffsetY'
  | 'shoreDistance'
> & {
  eastBoundaryMask?: Uint8Array
  east_boundary_mask?: Uint8Array
  southBoundaryMask?: Uint8Array
  south_boundary_mask?: Uint8Array
  regionalDetailMask?: Uint8Array
  regional_detail_mask?: Uint8Array
  closeDetailKind?: Uint8Array
  close_detail_kind?: Uint8Array
  detailOffsetX?: Uint8Array
  detail_offset_x?: Uint8Array
  detailOffsetY?: Uint8Array
  detail_offset_y?: Uint8Array
  shoreDistance?: Int8Array
  shore_distance?: Int8Array
}

type WasmWorldCoreModule = {
  default?: (input?: string | URL | WebAssembly.Module) => Promise<unknown>
  generate_chunk_base_layers?: (
    seed: number,
    chunkSize: number,
    originX: number,
    originY: number
  ) => WasmChunkBaseLayers
  prepare_chunk_render_hints?: (
    biomes: Uint8Array,
    elevation: Uint8Array,
    chunkSize: number,
    originX: number,
    originY: number
  ) => WasmRenderHints
  build_hydrology_raster?: (
    rawElevation: Float32Array,
    water: Uint8Array,
    width: number,
    height: number
  ) => HydrologyCoreRaster & {
    raw_elevation?: Float32Array
    filled_elevation?: Float32Array
    flow_direction?: Int8Array
    flow_accumulation?: Uint32Array
  }
}

function normalizeWasmRenderHints(hints: WasmRenderHints, size: number): ChunkRenderHints | null {
  const normalized = {
    noise: hints.noise,
    eastBoundaryMask: hints.eastBoundaryMask ?? hints.east_boundary_mask,
    southBoundaryMask: hints.southBoundaryMask ?? hints.south_boundary_mask,
    regionalDetailMask: hints.regionalDetailMask ?? hints.regional_detail_mask,
    closeDetailKind: hints.closeDetailKind ?? hints.close_detail_kind,
    detailOffsetX: hints.detailOffsetX ?? hints.detail_offset_x,
    detailOffsetY: hints.detailOffsetY ?? hints.detail_offset_y,
    shoreDistance: hints.shoreDistance ?? hints.shore_distance,
  }
  if (
    normalized.noise instanceof Uint32Array &&
    normalized.eastBoundaryMask instanceof Uint8Array &&
    normalized.southBoundaryMask instanceof Uint8Array &&
    normalized.regionalDetailMask instanceof Uint8Array &&
    normalized.closeDetailKind instanceof Uint8Array &&
    normalized.detailOffsetX instanceof Uint8Array &&
    normalized.detailOffsetY instanceof Uint8Array &&
    normalized.shoreDistance instanceof Int8Array &&
    normalized.noise.length === size &&
    normalized.eastBoundaryMask.length === size &&
    normalized.southBoundaryMask.length === size &&
    normalized.regionalDetailMask.length === size &&
    normalized.closeDetailKind.length === size &&
    normalized.detailOffsetX.length === size &&
    normalized.detailOffsetY.length === size &&
    normalized.shoreDistance.length === size
  ) {
    return {
      noise: normalized.noise,
      eastBoundaryMask: normalized.eastBoundaryMask,
      southBoundaryMask: normalized.southBoundaryMask,
      regionalDetailMask: normalized.regionalDetailMask,
      closeDetailKind: normalized.closeDetailKind,
      detailOffsetX: normalized.detailOffsetX,
      detailOffsetY: normalized.detailOffsetY,
      shoreDistance: normalized.shoreDistance,
    }
  }
  return null
}

let wasmRenderHintsBaseUrl: string | null = null
let wasmRenderHintsPromise: Promise<WasmWorldCoreModule | null> | null = null
let wasmStartupMs = 0

async function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function wasmBatchEnabled(
  capabilities: WorldWorkerCapabilities | undefined,
  batch: WorldWorkerWasmBatch
) {
  return Boolean(
    capabilities?.protocolVersion === 1 &&
    capabilities.wasm.enabled &&
    capabilities.wasm.abiVersion === 1 &&
    capabilities.wasm.batches.includes(batch)
  )
}

function normalizeBaseUrl(baseUrl?: string) {
  if (!baseUrl) return null
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

async function loadWasmRenderHintsModule(baseUrl?: string) {
  const normalized = normalizeBaseUrl(baseUrl)
  if (!normalized) return null
  if (wasmRenderHintsPromise && wasmRenderHintsBaseUrl === normalized) return wasmRenderHintsPromise
  wasmRenderHintsBaseUrl = normalized
  const started = performance.now()
  wasmRenderHintsPromise = settleWithin(
    (async () => {
      try {
        const moduleUrl = new URL('wasm/world_core.js', normalized).toString()
        const wasmUrl = new URL('wasm/world_core_bg.wasm', normalized).toString()
        const module = (await import(/* @vite-ignore */ moduleUrl)) as WasmWorldCoreModule
        if (typeof module.default === 'function') await module.default(wasmUrl)
        if (typeof module.prepare_chunk_render_hints !== 'function') return null
        return module
      } catch {
        return null
      }
    })(),
    3_000
  )
  void wasmRenderHintsPromise.then(() => {
    wasmStartupMs = performance.now() - started
  })
  return wasmRenderHintsPromise
}

function validBaseLayers(layers: WasmChunkBaseLayers, size: number): layers is ChunkBaseLayers {
  return (
    layers.elevation instanceof Uint8Array &&
    layers.moisture instanceof Uint8Array &&
    layers.temperature instanceof Uint8Array &&
    layers.elevation.length === size &&
    layers.moisture.length === size &&
    layers.temperature.length === size
  )
}

function normalizeHydrologyCore(
  result: ReturnType<NonNullable<WasmWorldCoreModule['build_hydrology_raster']>>,
  input: Parameters<HydrologyCoreBuilder>[0]
): HydrologyCoreRaster | null {
  const core = {
    width: input.width,
    height: input.height,
    rawElevation: result.rawElevation ?? result.raw_elevation ?? input.rawElevation,
    filledElevation: result.filledElevation ?? result.filled_elevation,
    water: result.water ?? input.water,
    slope: result.slope,
    flowDirection: result.flowDirection ?? result.flow_direction,
    flowAccumulation: result.flowAccumulation ?? result.flow_accumulation,
    watershed: result.watershed,
    depression: result.depression,
  }
  const size = input.width * input.height
  return core.rawElevation instanceof Float32Array &&
    core.filledElevation instanceof Float32Array &&
    core.water instanceof Uint8Array &&
    core.slope instanceof Uint8Array &&
    core.flowDirection instanceof Int8Array &&
    core.flowAccumulation instanceof Uint32Array &&
    core.watershed instanceof Uint32Array &&
    core.depression instanceof Uint8Array &&
    [
      core.rawElevation,
      core.filledElevation,
      core.water,
      core.slope,
      core.flowDirection,
      core.flowAccumulation,
      core.watershed,
      core.depression,
    ].every((layer) => layer.length === size)
    ? core
    : null
}

async function buildHydrologyCoreProvider(
  request: Extract<WorldWorkerRequest, { type: 'generate-chunk' }>
): Promise<{
  builder?: HydrologyCoreBuilder
  implementation: 'typescript' | 'wasm'
  fallbackReason?: string
  elapsedMs: number
}> {
  const started = performance.now()
  if (!wasmBatchEnabled(request.capabilities, 'hydrology-raster')) {
    return { implementation: 'typescript', elapsedMs: performance.now() - started }
  }
  const module = await loadWasmRenderHintsModule(request.wasmBaseUrl)
  if (!module?.build_hydrology_raster) {
    return {
      implementation: 'typescript',
      fallbackReason: 'wasm-module-unavailable',
      elapsedMs: performance.now() - started,
    }
  }
  let fallbackReason: string | undefined
  let elapsedMs = performance.now() - started
  const builder: HydrologyCoreBuilder = (input) => {
    const callStarted = performance.now()
    try {
      const result = normalizeHydrologyCore(
        module.build_hydrology_raster!(input.rawElevation, input.water, input.width, input.height),
        input
      )
      if (result) {
        elapsedMs += performance.now() - callStarted
        return result
      }
      fallbackReason = 'invalid-wasm-output'
    } catch {
      fallbackReason = 'wasm-execution-failed'
    }
    const fallback = buildHydrologyCoreRaster(input)
    elapsedMs += performance.now() - callStarted
    return fallback
  }
  return {
    builder,
    get implementation() {
      return fallbackReason ? 'typescript' : 'wasm'
    },
    get fallbackReason() {
      return fallbackReason
    },
    get elapsedMs() {
      return elapsedMs
    },
  }
}

async function buildChunkBaseLayers(
  request: Extract<WorldWorkerRequest, { type: 'generate-chunk' }>
): Promise<{
  layers?: ChunkBaseLayers
  implementation: 'typescript' | 'wasm'
  fallbackReason?: string
  elapsedMs: number
}> {
  const started = performance.now()
  if (!wasmBatchEnabled(request.capabilities, 'chunk-base-layers')) {
    return { implementation: 'typescript', elapsedMs: performance.now() - started }
  }
  const module = await loadWasmRenderHintsModule(request.wasmBaseUrl)
  if (!module?.generate_chunk_base_layers) {
    return {
      implementation: 'typescript',
      fallbackReason: 'wasm-module-unavailable',
      elapsedMs: performance.now() - started,
    }
  }
  try {
    const layers = module.generate_chunk_base_layers(
      hashSeed(request.seed),
      request.chunkSize,
      request.chunkX * request.chunkSize,
      request.chunkY * request.chunkSize
    )
    return validBaseLayers(layers, request.chunkSize * request.chunkSize)
      ? { layers, implementation: 'wasm', elapsedMs: performance.now() - started }
      : {
          implementation: 'typescript',
          fallbackReason: 'invalid-wasm-output',
          elapsedMs: performance.now() - started,
        }
  } catch {
    return {
      implementation: 'typescript',
      fallbackReason: 'wasm-execution-failed',
      elapsedMs: performance.now() - started,
    }
  }
}

async function buildChunkRenderHints(
  chunk: ReturnType<typeof generateChunkWithAreas>,
  wasmBaseUrl: string | undefined,
  capabilities: WorldWorkerCapabilities | undefined
) {
  const started = performance.now()
  if (!wasmBatchEnabled(capabilities, 'render-hints')) {
    return {
      hints: generateChunkRenderHints({
        biomes: chunk.biomes,
        elevation: chunk.elevation,
        chunkSize: chunk.chunkSize,
        originX: chunk.originX,
        originY: chunk.originY,
      }),
      implementation: 'typescript' as const,
      elapsedMs: performance.now() - started,
    }
  }
  const module = await loadWasmRenderHintsModule(wasmBaseUrl)
  if (module?.prepare_chunk_render_hints) {
    try {
      const wasmHints = module.prepare_chunk_render_hints(
        chunk.biomes,
        chunk.elevation,
        chunk.chunkSize,
        chunk.originX,
        chunk.originY
      )
      const hints = normalizeWasmRenderHints(wasmHints, chunk.chunkSize * chunk.chunkSize)
      if (hints)
        return { hints, implementation: 'wasm' as const, elapsedMs: performance.now() - started }
      return {
        hints: generateChunkRenderHints({
          biomes: chunk.biomes,
          elevation: chunk.elevation,
          chunkSize: chunk.chunkSize,
          originX: chunk.originX,
          originY: chunk.originY,
        }),
        implementation: 'typescript' as const,
        fallbackReason: 'invalid-wasm-output',
        elapsedMs: performance.now() - started,
      }
    } catch {
      // Keep the deterministic TypeScript fallback authoritative when Wasm is unavailable
      // or temporarily inconsistent during local development.
    }
  }
  return {
    hints: generateChunkRenderHints({
      biomes: chunk.biomes,
      elevation: chunk.elevation,
      chunkSize: chunk.chunkSize,
      originX: chunk.originX,
      originY: chunk.originY,
    }),
    implementation: 'typescript' as const,
    fallbackReason: 'wasm-module-unavailable',
    elapsedMs: performance.now() - started,
  }
}

workerScope.onmessage = async (event: MessageEvent<WorldWorkerRequest>) => {
  if (event.data.type === 'generate') {
    let world = generateWorld(
      event.data.seed,
      event.data.width,
      event.data.height,
      event.data.biomeDefinitions,
      event.data.riverSystem,
      event.data.roadSystem,
      event.data.geomorphology
    )
    if (event.data.mapAreas?.length && event.data.terrainCodes) {
      world = applyMapAreas(
        world,
        event.data.mapAreas,
        event.data.terrainCodes,
        event.data.biomeDefinitions,
        event.data.riverSystem,
        event.data.roadSystem,
        event.data.geomorphology
      )
    }
    workerScope.postMessage(
      { type: 'generated', id: event.data.id, world },
      {
        transfer: [
          world.elevation.buffer,
          world.moisture.buffer,
          world.temperature.buffer,
          world.biomes.buffer,
          world.slope.buffer,
          world.flowDirection.buffer,
          world.flowAccumulation.buffer,
          world.watershed.buffer,
          world.depression.buffer,
          world.erosionPotential.buffer,
          world.sedimentLoad.buffer,
          world.deposition.buffer,
          world.floodplain.buffer,
          world.landmass.buffer,
          world.waterbody.buffer,
          world.authoredArea.buffer,
        ],
      }
    )
    return
  }

  if (event.data.type !== 'generate-chunk') return
  try {
    const baseLayers = await buildChunkBaseLayers(event.data)
    const hydrology = await buildHydrologyCoreProvider(event.data)
    const chunk = generateChunkWithAreas(
      event.data.seed,
      event.data.chunkX,
      event.data.chunkY,
      event.data.chunkSize,
      event.data.surveyWidth,
      event.data.surveyHeight,
      event.data.mapAreas ?? [],
      event.data.terrainCodes ?? {},
      event.data.biomeDefinitions,
      event.data.riverSystem,
      event.data.roadSystem,
      event.data.geomorphology,
      baseLayers.layers,
      hydrology.builder
    )
    const renderHints = await buildChunkRenderHints(
      chunk,
      event.data.wasmBaseUrl,
      event.data.capabilities
    )
    chunk.renderHints = renderHints.hints
    const transferables = [
      chunk.elevation.buffer,
      chunk.moisture.buffer,
      chunk.temperature.buffer,
      chunk.biomes.buffer,
      chunk.slope.buffer,
      chunk.flowDirection.buffer,
      chunk.flowAccumulation.buffer,
      chunk.watershed.buffer,
      chunk.depression.buffer,
      chunk.erosionPotential.buffer,
      chunk.sedimentLoad.buffer,
      chunk.deposition.buffer,
      chunk.floodplain.buffer,
      chunk.renderHints.noise.buffer,
      chunk.renderHints.eastBoundaryMask.buffer,
      chunk.renderHints.southBoundaryMask.buffer,
      chunk.renderHints.regionalDetailMask.buffer,
      chunk.renderHints.closeDetailKind.buffer,
      chunk.renderHints.detailOffsetX.buffer,
      chunk.renderHints.detailOffsetY.buffer,
      chunk.renderHints.shoreDistance.buffer,
      chunk.topology.componentIds.buffer,
      chunk.topology.edges.north.buffer,
      chunk.topology.edges.east.buffer,
      chunk.topology.edges.south.buffer,
      chunk.topology.edges.west.buffer,
      chunk.authoredArea.buffer,
      chunk.region.buffer,
    ]
    const diagnostics: WorldWorkerDiagnostics = {
      protocolVersion: 1,
      implementation: [
        baseLayers.implementation,
        renderHints.implementation,
        hydrology.implementation,
      ].every((implementation) => implementation === baseLayers.implementation)
        ? baseLayers.implementation
        : 'mixed',
      batches: {
        'chunk-base-layers': baseLayers.implementation,
        'render-hints': renderHints.implementation,
        'hydrology-raster': hydrology.implementation,
      },
      fallbacks: [
        ...(baseLayers.fallbackReason
          ? [{ batch: 'chunk-base-layers' as const, reason: baseLayers.fallbackReason }]
          : []),
        ...(renderHints.fallbackReason
          ? [{ batch: 'render-hints' as const, reason: renderHints.fallbackReason }]
          : []),
        ...(hydrology.fallbackReason
          ? [{ batch: 'hydrology-raster' as const, reason: hydrology.fallbackReason }]
          : []),
      ],
      timingsMs: {
        'chunk-base-layers': baseLayers.elapsedMs,
        'render-hints': renderHints.elapsedMs,
        'hydrology-raster': hydrology.elapsedMs,
      },
      wasmStartupMs,
      transferBytes: transferables.reduce((sum, buffer) => sum + buffer.byteLength, 0),
    }
    workerScope.postMessage(
      { type: 'generated-chunk', id: event.data.id, chunk, diagnostics },
      {
        transfer: transferables,
      }
    )
  } catch (error) {
    workerScope.postMessage(
      {
        type: 'worker-error',
        id: event.data.id,
        error: {
          code: 'generation-failed',
          message: error instanceof Error ? error.message : 'Unknown generation failure',
          recoverable: true,
        },
      },
      { transfer: [] }
    )
  }
}
