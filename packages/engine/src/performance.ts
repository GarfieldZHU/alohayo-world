import {
  createAdaptiveQualityController,
  summarizeFramePacing,
  type RuntimeQualityTier,
  type RuntimeQualityPreset,
} from './performance-quality'

export interface RuntimePerformanceMetrics {
  avgFrameMs: number
  maxFrameMs: number
  p50FrameMs: number
  p95FrameMs: number
  p99FrameMs: number
  onePercentLowFps: number
  droppedFrameCount: number
  qualityTier: RuntimeQualityTier
  qualityResolutionScale: number
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
  applyQuality?: (preset: RuntimeQualityPreset) => void
}

export interface RuntimePerformanceTracker {
  metrics: RuntimePerformanceMetrics
  destroy(): void
  frame(nowMs: number, fps: number): void
  markChunkGeneration(durationMs: number): void
  resetRuntimeWindow(nowMs?: number): void
}

const globalPerformanceKey = '__ALOHAYO_WORLD_PERF__'

export function createRuntimePerformanceTracker({
  canvas,
  sampleDrawCalls,
  sampleLoadedChunks,
  applyQuality,
}: RuntimePerformanceTrackerOptions): RuntimePerformanceTracker {
  const metrics: RuntimePerformanceMetrics = {
    avgFrameMs: 0,
    maxFrameMs: 0,
    p50FrameMs: 0,
    p95FrameMs: 0,
    p99FrameMs: 0,
    onePercentLowFps: 0,
    droppedFrameCount: 0,
    qualityTier: 'high',
    qualityResolutionScale: 1,
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
  const frameTrace: number[] = []
  let qualityWindow: number[] = []
  const qualityController = createAdaptiveQualityController()
  let lastFrameNow: number | null = null
  let longTaskObserver: PerformanceObserver | null = null
  let runtimeWindowStartedAt = performance.now()

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.startTime < runtimeWindowStartedAt) continue
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
    canvas.dataset.p50FrameMs = metrics.p50FrameMs.toFixed(2)
    canvas.dataset.p95FrameMs = metrics.p95FrameMs.toFixed(2)
    canvas.dataset.p99FrameMs = metrics.p99FrameMs.toFixed(2)
    canvas.dataset.onePercentLowFps = metrics.onePercentLowFps.toFixed(1)
    canvas.dataset.droppedFrameCount = String(metrics.droppedFrameCount)
    canvas.dataset.qualityTier = metrics.qualityTier
    canvas.dataset.qualityResolutionScale = metrics.qualityResolutionScale.toFixed(2)
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
      frameTrace.push(frameMs)
      qualityWindow.push(frameMs)
      if (frameTrace.length > 600) frameTrace.shift()
      if (qualityWindow.length >= 60) {
        const quality = qualityController.observe(summarizeFramePacing(qualityWindow))
        metrics.qualityTier = quality.tier
        metrics.qualityResolutionScale = quality.resolutionScale
        applyQuality?.(quality)
        qualityWindow = []
      }
      const summary = summarizeFramePacing(frameTrace)
      metrics.p50FrameMs = summary.p50FrameMs
      metrics.p95FrameMs = summary.p95FrameMs
      metrics.p99FrameMs = summary.p99FrameMs
      metrics.onePercentLowFps = summary.onePercentLowFps
      metrics.droppedFrameCount = summary.droppedFrameCount
      metrics.fps = fps
      sync()
    },
    markChunkGeneration(durationMs) {
      metrics.lastChunkGenerationMs = durationMs
      metrics.maxChunkGenerationMs = Math.max(metrics.maxChunkGenerationMs, durationMs)
      sync()
    },
    resetRuntimeWindow(nowMs = performance.now()) {
      runtimeWindowStartedAt = nowMs
      frameSamples = 0
      lastFrameNow = null
      metrics.avgFrameMs = 0
      metrics.maxFrameMs = 0
      metrics.p50FrameMs = 0
      metrics.p95FrameMs = 0
      metrics.p99FrameMs = 0
      metrics.onePercentLowFps = 0
      metrics.droppedFrameCount = 0
      metrics.fps = 0
      metrics.longTaskCount = 0
      metrics.maxLongTaskMs = 0
      frameTrace.length = 0
      qualityWindow = []
      qualityController.reset()
      metrics.qualityTier = qualityController.tier
      metrics.qualityResolutionScale = qualityController.preset.resolutionScale
      applyQuality?.(qualityController.preset)
      sync()
    },
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
