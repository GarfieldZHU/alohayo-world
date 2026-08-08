import type { WorldWorkerCapabilities, WorldWorkerWasmBatch } from '@alohayo/config'
import type { ChunkRenderHints } from './render-hints'

export type WasmRenderHints = Omit<
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

export function normalizeWasmRenderHints(
  hints: WasmRenderHints,
  size: number
): ChunkRenderHints | null {
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
    return normalized as ChunkRenderHints
  }
  return null
}

export function wasmBatchEnabled(
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

export function renderHintsTransferBytes(hints: ChunkRenderHints): number {
  return [
    hints.noise,
    hints.eastBoundaryMask,
    hints.southBoundaryMask,
    hints.regionalDetailMask,
    hints.closeDetailKind,
    hints.detailOffsetX,
    hints.detailOffsetY,
    hints.shoreDistance,
  ].reduce((total, layer) => total + layer.byteLength, 0)
}
