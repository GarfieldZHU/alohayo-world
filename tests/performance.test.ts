import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRuntimePerformanceTracker } from '../packages/engine/src/performance'

describe('runtime performance tracker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts frame timing at the first ticker callback', () => {
    vi.stubGlobal('window', globalThis)
    const canvas = { dataset: {} } as HTMLCanvasElement
    const tracker = createRuntimePerformanceTracker({
      canvas,
      sampleDrawCalls: () => 1,
      sampleLoadedChunks: () => 1,
    })

    tracker.frame(1_000, 60)
    expect(tracker.metrics.avgFrameMs).toBe(0)

    tracker.frame(1_016, 60)
    expect(tracker.metrics.avgFrameMs).toBe(16)
    expect(tracker.metrics.maxFrameMs).toBe(16)

    tracker.destroy()
  })
})
