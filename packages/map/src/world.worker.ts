import {
  applyMapAreas,
  generateChunkWithAreas,
  generateWorld,
  hashSeed,
  type ChunkBaseLayers,
  type WorldWorkerRequest,
  type WorldWorkerResponse,
} from './index'
import { generateChunkRenderHints, type ChunkRenderHints } from './render-hints'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorldWorkerRequest>) => void) | null
  postMessage(message: WorldWorkerResponse, options: { transfer: ArrayBufferLike[] }): void
}

type WasmChunkBaseLayers = {
  elevation: Uint8Array
  moisture: Uint8Array
  temperature: Uint8Array
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
  ) => ChunkRenderHints
}

let wasmRenderHintsBaseUrl: string | null = null
let wasmRenderHintsPromise: Promise<WasmWorldCoreModule | null> | null = null

function normalizeBaseUrl(baseUrl?: string) {
  if (!baseUrl) return null
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

async function loadWasmRenderHintsModule(baseUrl?: string) {
  const normalized = normalizeBaseUrl(baseUrl)
  if (!normalized) return null
  if (wasmRenderHintsPromise && wasmRenderHintsBaseUrl === normalized) return wasmRenderHintsPromise
  wasmRenderHintsBaseUrl = normalized
  wasmRenderHintsPromise = (async () => {
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
  })()
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

async function buildChunkBaseLayers(
  request: Extract<WorldWorkerRequest, { type: 'generate-chunk' }>
): Promise<ChunkBaseLayers | undefined> {
  // Keep production on the proven TypeScript reference until browser-side byte parity is
  // exercised explicitly. `?wasm=1` is the opt-in test switch for the coarse batch path.
  if (!request.wasmBaseUrl?.includes('wasm=1')) return undefined
  const module = await loadWasmRenderHintsModule(request.wasmBaseUrl)
  if (!module?.generate_chunk_base_layers) return undefined
  try {
    const layers = module.generate_chunk_base_layers(
      hashSeed(request.seed),
      request.chunkSize,
      request.chunkX * request.chunkSize,
      request.chunkY * request.chunkSize
    )
    return validBaseLayers(layers, request.chunkSize * request.chunkSize) ? layers : undefined
  } catch {
    // The TypeScript batch remains the deterministic fallback for stale or failed Wasm assets.
    return undefined
  }
}

async function buildChunkRenderHints(
  chunk: ReturnType<typeof generateChunkWithAreas>,
  wasmBaseUrl?: string
) {
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
      return {
        noise: wasmHints.noise,
        eastBoundaryMask:
          (wasmHints as ChunkRenderHints & { east_boundary_mask?: Uint8Array }).eastBoundaryMask ??
          (wasmHints as ChunkRenderHints & { east_boundary_mask?: Uint8Array }).east_boundary_mask!,
        southBoundaryMask:
          (wasmHints as ChunkRenderHints & { south_boundary_mask?: Uint8Array })
            .southBoundaryMask ??
          (wasmHints as ChunkRenderHints & { south_boundary_mask?: Uint8Array })
            .south_boundary_mask!,
        regionalDetailMask:
          (wasmHints as ChunkRenderHints & { regional_detail_mask?: Uint8Array })
            .regionalDetailMask ??
          (wasmHints as ChunkRenderHints & { regional_detail_mask?: Uint8Array })
            .regional_detail_mask!,
        closeDetailKind:
          (wasmHints as ChunkRenderHints & { close_detail_kind?: Uint8Array }).closeDetailKind ??
          (wasmHints as ChunkRenderHints & { close_detail_kind?: Uint8Array }).close_detail_kind!,
        detailOffsetX:
          (wasmHints as ChunkRenderHints & { detail_offset_x?: Uint8Array }).detailOffsetX ??
          (wasmHints as ChunkRenderHints & { detail_offset_x?: Uint8Array }).detail_offset_x!,
        detailOffsetY:
          (wasmHints as ChunkRenderHints & { detail_offset_y?: Uint8Array }).detailOffsetY ??
          (wasmHints as ChunkRenderHints & { detail_offset_y?: Uint8Array }).detail_offset_y!,
      } satisfies ChunkRenderHints
    } catch {
      // Keep the deterministic TypeScript fallback authoritative when Wasm is unavailable
      // or temporarily inconsistent during local development.
    }
  }
  return generateChunkRenderHints({
    biomes: chunk.biomes,
    elevation: chunk.elevation,
    chunkSize: chunk.chunkSize,
    originX: chunk.originX,
    originY: chunk.originY,
  })
}

workerScope.onmessage = async (event: MessageEvent<WorldWorkerRequest>) => {
  if (event.data.type === 'generate') {
    let world = generateWorld(
      event.data.seed,
      event.data.width,
      event.data.height,
      event.data.biomeDefinitions,
      event.data.riverSystem,
      event.data.roadSystem
    )
    if (event.data.mapAreas?.length && event.data.terrainCodes) {
      world = applyMapAreas(
        world,
        event.data.mapAreas,
        event.data.terrainCodes,
        event.data.biomeDefinitions,
        event.data.riverSystem,
        event.data.roadSystem
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
          world.landmass.buffer,
          world.waterbody.buffer,
          world.authoredArea.buffer,
        ],
      }
    )
    return
  }

  if (event.data.type !== 'generate-chunk') return
  const baseLayers = await buildChunkBaseLayers(event.data)
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
    baseLayers
  )
  chunk.renderHints = await buildChunkRenderHints(chunk, event.data.wasmBaseUrl)
  workerScope.postMessage(
    { type: 'generated-chunk', id: event.data.id, chunk },
    {
      transfer: [
        chunk.elevation.buffer,
        chunk.moisture.buffer,
        chunk.temperature.buffer,
        chunk.biomes.buffer,
        chunk.slope.buffer,
        chunk.flowDirection.buffer,
        chunk.flowAccumulation.buffer,
        chunk.watershed.buffer,
        chunk.depression.buffer,
        chunk.renderHints.noise.buffer,
        chunk.renderHints.eastBoundaryMask.buffer,
        chunk.renderHints.southBoundaryMask.buffer,
        chunk.renderHints.regionalDetailMask.buffer,
        chunk.renderHints.closeDetailKind.buffer,
        chunk.renderHints.detailOffsetX.buffer,
        chunk.renderHints.detailOffsetY.buffer,
        chunk.topology.componentIds.buffer,
        chunk.topology.edges.north.buffer,
        chunk.topology.edges.east.buffer,
        chunk.topology.edges.south.buffer,
        chunk.topology.edges.west.buffer,
        chunk.authoredArea.buffer,
        chunk.region.buffer,
      ],
    }
  )
}
