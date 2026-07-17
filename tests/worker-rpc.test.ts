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
  it('posts the versioned TypeScript-first capability contract', () => {
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
