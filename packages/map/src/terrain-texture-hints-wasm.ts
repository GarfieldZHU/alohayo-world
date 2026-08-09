import type { WorldWorkerCapabilities, WorldWorkerWasmBatch } from '@alohayo/config'
import type { ChunkTerrainTextureHints } from './terrain-texture-hints'

export type WasmTerrainTextureHints = {
  pattern?: Uint8Array
}

export function normalizeWasmTerrainTextureHints(
  hints: WasmTerrainTextureHints,
  size: number
): ChunkTerrainTextureHints | null {
  const normalized = {
    pattern: hints.pattern,
  }
  if (normalized.pattern instanceof Uint8Array && normalized.pattern.length === size) {
    return { pattern: normalized.pattern }
  }
  return null
}

export function terrainTextureHintsTransferBytes(hints: ChunkTerrainTextureHints): number {
  return hints.pattern.byteLength
}

export function terrainTextureBatchEnabled(
  capabilities: WorldWorkerCapabilities | undefined,
  batch: WorldWorkerWasmBatch = 'terrain-texture-hints'
) {
  return Boolean(
    capabilities?.protocolVersion === 1 &&
    capabilities.wasm.enabled &&
    capabilities.wasm.abiVersion === 1 &&
    capabilities.wasm.batches.includes(batch)
  )
}
