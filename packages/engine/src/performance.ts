export interface RuntimePerformanceMetrics {
  avgFrameMs: number
  maxFrameMs: number
  fps: number
  lastChunkGenerationMs: number
  maxChunkGenerationMs: number
  estimatedDrawCalls: number
  loadedChunks: number
  longTaskCount: number
  maxLongTaskMs: number
  memoryUsedMB: number | null
  memoryLimitMB: number | null
}

interface BrowserMemoryPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

interface RuntimePerformanceTrackerOptions {
  canvas: HTMLCanvasElement
  sampleDrawCalls: () => number
  sampleLoadedChunks: () => number
}

export interface RuntimePerformanceTracker {
  metrics: RuntimePerformanceMetrics
  destroy(): void
  frame(nowMs: number, fps: number): void
  markChunkGeneration(durationMs: number): void
}

const globalPerformanceKey = '__ALOHAYO_WORLD_PERF__'

export function createRuntimePerformanceTracker({
  canvas,
  sampleDrawCalls,
  sampleLoadedChunks,
}: RuntimePerformanceTrackerOptions): RuntimePerformanceTracker {
  const metrics: RuntimePerformanceMetrics = {
    avgFrameMs: 0,
    maxFrameMs: 0,
    fps: 0,
    lastChunkGenerationMs: 0,
    maxChunkGenerationMs: 0,
    estimatedDrawCalls: 0,
    loadedChunks: 0,
    longTaskCount: 0,
    maxLongTaskMs: 0,
    memoryUsedMB: null,
    memoryLimitMB: null,
  }

  let frameSamples = 0
  let lastFrameNow: number | null = null
  let longTaskObserver: PerformanceObserver | null = null

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.longTaskCount += 1
          metrics.maxLongTaskMs = Math.max(metrics.maxLongTaskMs, entry.duration)
        }
        sync()
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
    } catch {
      longTaskObserver = null
    }
  }

  const sync = () => {
    metrics.estimatedDrawCalls = sampleDrawCalls()
    metrics.loadedChunks = sampleLoadedChunks()
    const memory = (performance as BrowserMemoryPerformance).memory
    metrics.memoryUsedMB = memory ? round2(memory.usedJSHeapSize / (1024 * 1024)) : null
    metrics.memoryLimitMB = memory ? round2(memory.jsHeapSizeLimit / (1024 * 1024)) : null

    canvas.dataset.avgFrameMs = metrics.avgFrameMs.toFixed(2)
    canvas.dataset.maxFrameMs = metrics.maxFrameMs.toFixed(2)
    canvas.dataset.lastChunkMs = metrics.lastChunkGenerationMs.toFixed(1)
    canvas.dataset.maxChunkMs = metrics.maxChunkGenerationMs.toFixed(1)
    canvas.dataset.estimatedDrawCalls = String(metrics.estimatedDrawCalls)
    canvas.dataset.longTaskCount = String(metrics.longTaskCount)
    canvas.dataset.maxLongTaskMs = metrics.maxLongTaskMs.toFixed(1)
    if (metrics.memoryUsedMB !== null) {
      canvas.dataset.memoryUsedMb = metrics.memoryUsedMB.toFixed(1)
    } else {
      delete canvas.dataset.memoryUsedMb
    }
    if (metrics.memoryLimitMB !== null) {
      canvas.dataset.memoryLimitMb = metrics.memoryLimitMB.toFixed(1)
    } else {
      delete canvas.dataset.memoryLimitMb
    }

    ;(window as Window & { [globalPerformanceKey]?: RuntimePerformanceMetrics })[
      globalPerformanceKey
    ] = {
      ...metrics,
    }
  }

  sync()

  return {
    metrics,
    destroy() {
      longTaskObserver?.disconnect()
      delete (window as Window & { [globalPerformanceKey]?: RuntimePerformanceMetrics })[
        globalPerformanceKey
      ]
    },
    frame(nowMs, fps) {
      if (lastFrameNow === null) {
        lastFrameNow = nowMs
        metrics.fps = fps
        sync()
        return
      }
      const frameMs = Math.min(250, Math.max(0, nowMs - lastFrameNow))
      lastFrameNow = nowMs
      frameSamples += 1
      metrics.avgFrameMs =
        frameSamples === 1
          ? frameMs
          : (metrics.avgFrameMs * (frameSamples - 1) + frameMs) / frameSamples
      metrics.maxFrameMs = Math.max(metrics.maxFrameMs, frameMs)
      metrics.fps = fps
      sync()
    },
    markChunkGeneration(durationMs) {
      metrics.lastChunkGenerationMs = durationMs
      metrics.maxChunkGenerationMs = Math.max(metrics.maxChunkGenerationMs, durationMs)
      sync()
    },
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
