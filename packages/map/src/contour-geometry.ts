import type { WorldWorkerCapabilities } from '@alohayo/config'
import { extractMaskContours } from './contours'

export const CONTOUR_GEOMETRY_ABI_VERSION = 1 as const

export interface ChunkContourGeometry {
  abiVersion: typeof CONTOUR_GEOMETRY_ABI_VERSION
  width: number
  height: number
  originX: number
  originY: number
  pathOffsets: Uint32Array
  pathLengths: Uint32Array
  points: Float32Array
  closed: Uint8Array
}

export interface WasmContourGeometry {
  abi_version?: number
  width: number
  height: number
  origin_x?: number
  origin_y?: number
  path_offsets: Uint32Array
  path_lengths: Uint32Array
  points: Float32Array
  closed: Uint8Array
}

export function contourBatchEnabled(capabilities: WorldWorkerCapabilities | undefined): boolean {
  return Boolean(
    capabilities?.protocolVersion === 1 &&
    capabilities.wasm.enabled &&
    capabilities.wasm.batches.includes('contour-geometry')
  )
}

function fromContours(
  contours: readonly Float32Array[],
  width: number,
  height: number,
  originX: number,
  originY: number
): ChunkContourGeometry {
  const pathOffsets: number[] = []
  const pathLengths: number[] = []
  const points: number[] = []
  const closed: number[] = []
  for (const contour of contours) {
    pathOffsets.push(points.length / 2)
    pathLengths.push(contour.length / 2)
    points.push(...contour)
    closed.push(
      contour.length >= 4 && contour[0] === contour.at(-2) && contour[1] === contour.at(-1) ? 1 : 0
    )
  }
  return {
    abiVersion: CONTOUR_GEOMETRY_ABI_VERSION,
    width,
    height,
    originX,
    originY,
    pathOffsets: Uint32Array.from(pathOffsets),
    pathLengths: Uint32Array.from(pathLengths),
    points: Float32Array.from(points),
    closed: Uint8Array.from(closed),
  }
}

/** Builds a seam-safe coarse fallback; unknown outside samples suppress border edges. */
export function generateChunkContourGeometry(args: {
  inside: Uint8Array
  width: number
  height: number
  originX: number
  originY: number
}): ChunkContourGeometry {
  const { inside, width, height, originX, originY } = args
  if (inside.length !== width * height) throw new RangeError('contour mask length mismatch')
  return fromContours(
    extractMaskContours({
      width,
      height,
      isInside: (x, y) =>
        x >= 0 && y >= 0 && x < width && y < height && inside[y * width + x] !== 0,
      isKnown: (x, y) => x >= 0 && y >= 0 && x < width && y < height,
      smoothingPasses: 0,
    }),
    width,
    height,
    originX,
    originY
  )
}

export function normalizeWasmContourGeometry(
  value: WasmContourGeometry,
  width: number,
  height: number,
  originX: number,
  originY: number
): ChunkContourGeometry | null {
  const pathCount = value.path_offsets?.length ?? 0
  if (
    (value.abi_version ?? CONTOUR_GEOMETRY_ABI_VERSION) !== CONTOUR_GEOMETRY_ABI_VERSION ||
    value.width !== width ||
    value.height !== height ||
    value.path_lengths.length !== pathCount ||
    value.closed.length !== pathCount ||
    value.points.length % 2 !== 0
  ) {
    return null
  }
  for (let index = 0; index < pathCount; index += 1) {
    const offset = value.path_offsets[index]!
    const length = value.path_lengths[index]!
    if (offset + length > value.points.length / 2) return null
  }
  return {
    abiVersion: CONTOUR_GEOMETRY_ABI_VERSION,
    width,
    height,
    originX,
    originY,
    pathOffsets: value.path_offsets,
    pathLengths: value.path_lengths,
    points: value.points,
    closed: value.closed,
  }
}
