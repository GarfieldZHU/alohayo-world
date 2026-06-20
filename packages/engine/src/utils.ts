import type {
  WorldDefinition,
  WorldRoadProfileDefinition,
  WorldRoadProfileId,
} from '@alohayo/config'
import type {
  GeneratedChunk,
  WorldWorkerRequest,
  WorldWorkerResponse,
} from '@alohayo/map'
import type { RpcPending, UiTheme } from './types'

export const REGION_NAME: Record<number, string> = {
  0: 'sea',
  1: 'lake',
  2: 'mainland',
  3: 'island',
}

export function createWorkerRpc(worker: Worker) {
  let nextId = 1
  const pending = new Map<string, RpcPending>()

  worker.onmessage = (event: MessageEvent<WorldWorkerResponse>) => {
    if (event.data.type !== 'generated-chunk') return
    const request = pending.get(event.data.id)
    if (!request) return
    pending.delete(event.data.id)
    request.resolve(event.data.chunk)
  }

  worker.onerror = (event) => {
    for (const request of pending.values()) {
      request.reject(new Error(event.message || 'World worker failed'))
    }
    pending.clear()
  }

  return {
    requestChunk(
      payload: Omit<Extract<WorldWorkerRequest, { type: 'generate-chunk' }>, 'type' | 'id'>
    ) {
      return new Promise<GeneratedChunk>((resolve, reject) => {
        const id = `chunk-${nextId++}`
        pending.set(id, { resolve, reject })
        worker.postMessage({ type: 'generate-chunk', id, ...payload })
      })
    },
    rejectAll(reason: Error) {
      for (const request of pending.values()) request.reject(reason)
      pending.clear()
    },
  }
}

export function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeTheme(input?: string | null): UiTheme {
  return input === 'light' ? 'light' : 'dark'
}

export function cellNoise(x: number, y: number, salt = 0) {
  let value = Math.imul(x + salt, 374761393) ^ Math.imul(y - salt, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}

export function colorFromHex(value: string, fallback: number): number {
  return /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback
}

export function profileById(
  world: WorldDefinition
): Map<WorldRoadProfileId, WorldRoadProfileDefinition> {
  return new Map(
    world.roads.profiles.map(
      (profile) => [profile.id, profile] satisfies [WorldRoadProfileId, WorldRoadProfileDefinition]
    )
  )
}

export function toChunkCoord(cell: number, chunkSize: number): { chunk: number; local: number } {
  const chunk = Math.floor(cell / chunkSize)
  const local = cell - chunk * chunkSize
  return { chunk, local }
}

export function deriveChunkRadius(
  width: number,
  height: number,
  chunkSize: number,
  fallback: number
): number {
  const radius = Math.round(Math.max(width, height) / Math.max(1, chunkSize * 4))
  return Math.max(fallback, radius)
}

export function computeGameCameraScale(
  screenWidth: number,
  screenHeight: number,
  cellSize: number
) {
  const targetVisibleCellsX = 32
  const targetVisibleCellsY = 22
  return clamp(
    Math.min(
      screenWidth / (cellSize * targetVisibleCellsX),
      screenHeight / (cellSize * targetVisibleCellsY)
    ),
    2.2,
    9
  )
}
