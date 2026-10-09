import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_WORKER_CAPABILITIES } from '@alohayo/map'
import { createChunkRequestQueue, createWorkerRpc } from '../packages/engine/src/utils'

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  sent: unknown[] = []

  postMessage(message: unknown) {
    this.sent.push(message)
  }
}

const request = {
  seed: 'worker-test',
  chunkX: 0,
  chunkY: 0,
  chunkSize: 2,
  surveyWidth: 4,
  surveyHeight: 4,
}

describe('world worker RPC', () => {
  it('posts the versioned stable Wasm capability contract', () => {
    const worker = new FakeWorker()
    const rpc = createWorkerRpc(worker as unknown as Worker)

    const result = rpc.requestChunk(request)
    const rejected = expect(result).rejects.toThrow('test cleanup')

    expect(worker.sent).toMatchObject([
      {
        type: 'generate-chunk',
        capabilities: DEFAULT_WORLD_WORKER_CAPABILITIES,
      },
    ])
    rpc.rejectAll(new Error('test cleanup'))
    return rejected
  })

  it('allows callers to force the TypeScript fallback contract', () => {
    const worker = new FakeWorker()
    const capabilities = {
      protocolVersion: 1 as const,
      wasm: { abiVersion: 1 as const, enabled: false, batches: [] },
    }
    const rpc = createWorkerRpc(worker as unknown as Worker, { capabilities })
    const result = rpc.requestChunk(request)
    const rejected = expect(result).rejects.toThrow('test cleanup')

    expect(worker.sent).toMatchObject([{ capabilities }])
    rpc.rejectAll(new Error('test cleanup'))
    return rejected
  })

  it('round-trips pairwise hydrology requests without transferring live watershed inputs', async () => {
    const worker = new FakeWorker()
    const rpc = createWorkerRpc(worker as unknown as Worker)
    const firstWatershed = new Uint32Array([1, 2, 3, 4])
    const secondWatershed = new Uint32Array([5, 6, 7, 8])
    const result = rpc.requestHydrologyPair({
      seed: 'worker-test',
      firstChunkX: -1,
      firstChunkY: 0,
      secondChunkX: 0,
      secondChunkY: 0,
      direction: 'east',
      chunkSize: 2,
      surveyWidth: 4,
      surveyHeight: 4,
      firstWatershed,
      secondWatershed,
    })
    const sent = worker.sent[0] as { id: string; type: string }
    const response = {
      type: 'reconciled-hydrology-pair',
      id: sent.id,
      result: {
        schemaVersion: 1,
        state: 'reconciled',
        direction: 'east',
        firstChunk: { chunkX: -1, chunkY: 0 },
        secondChunk: { chunkX: 0, chunkY: 0 },
        windowWidth: 36,
        windowHeight: 34,
        halo: 16,
        seamDepth: 8,
        patches: [],
      },
      diagnostics: {
        protocolVersion: 1,
        implementation: 'typescript',
        elapsedMs: 1,
        transferBytes: 0,
        wasmStartupMs: 0,
      },
    } as const

    expect(sent.type).toBe('reconcile-hydrology-pair')
    expect(Array.from(firstWatershed)).toEqual([1, 2, 3, 4])
    expect(Array.from(secondWatershed)).toEqual([5, 6, 7, 8])
    expect(worker.sent).toMatchObject([{ capabilities: DEFAULT_WORLD_WORKER_CAPABILITIES }])
    worker.onmessage?.(new MessageEvent('message', { data: response }))
    await expect(result).resolves.toEqual(response)
  })

  it('rejects a stalled request after the startup timeout', async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const rpc = createWorkerRpc(worker as unknown as Worker, { timeoutMs: 25 })
    const result = rpc.requestChunk(request)
    const rejected = expect(result).rejects.toThrow('timed out')

    await vi.advanceTimersByTimeAsync(25)

    await rejected
    vi.useRealTimers()
  })

  it('rejects pending requests on message deserialization errors', async () => {
    const worker = new FakeWorker()
    const rpc = createWorkerRpc(worker as unknown as Worker)
    const result = rpc.requestChunk(request)
    const rejected = expect(result).rejects.toThrow('could not be decoded')

    worker.onmessageerror?.(new MessageEvent('messageerror'))

    await rejected
  })
})

describe('chunk request queue', () => {
  it('starts serialized work only after the previous worker request settles', async () => {
    let releaseFirst: ((value: never) => void) | undefined
    const starts: number[] = []
    const queue = createChunkRequestQueue(1)
    const first = queue.schedule(
      () =>
        new Promise((resolve) => {
          starts.push(1)
          releaseFirst = resolve
        })
    )
    const second = queue.schedule(async () => {
      starts.push(2)
      return {} as never
    })

    await Promise.resolve()
    expect(starts).toEqual([1])
    expect(queue.pendingCount()).toBe(2)
    releaseFirst?.({} as never)
    await first
    await second
    expect(starts).toEqual([1, 2])
  })
})
