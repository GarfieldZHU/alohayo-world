export type RuntimeQualityTier = 'high' | 'balanced' | 'safe'

export interface FramePacingSummary {
  sampleCount: number
  p50FrameMs: number
  p95FrameMs: number
  p99FrameMs: number
  onePercentLowFps: number
  droppedFrameCount: number
}

export interface RuntimeQualityPreset {
  tier: RuntimeQualityTier
  resolutionScale: number
  detailScale: number
  fogScale: number
}

export const RUNTIME_QUALITY_PRESETS: Record<RuntimeQualityTier, RuntimeQualityPreset> = {
  high: { tier: 'high', resolutionScale: 1, detailScale: 1, fogScale: 1 },
  balanced: { tier: 'balanced', resolutionScale: 0.85, detailScale: 0.78, fogScale: 0.82 },
  safe: { tier: 'safe', resolutionScale: 0.68, detailScale: 0.55, fogScale: 0.62 },
}

const FRAME_BUDGET_MS = 16.67

function quantile(sorted: readonly number[], fraction: number) {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
}

export function summarizeFramePacing(samples: readonly number[]): FramePacingSummary {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample >= 0)
    .map((sample) => Math.min(250, sample))
    .sort((left, right) => left - right)
  const slowFrames = sorted.filter((sample) => sample > FRAME_BUDGET_MS).length
  const lowFrameStart = Math.max(0, Math.floor(sorted.length * 0.99))
  const lowFrameSamples = sorted.slice(lowFrameStart)
  const lowFrameMs = lowFrameSamples.length ? Math.max(...lowFrameSamples) : 0
  return {
    sampleCount: sorted.length,
    p50FrameMs: quantile(sorted, 0.5),
    p95FrameMs: quantile(sorted, 0.95),
    p99FrameMs: quantile(sorted, 0.99),
    onePercentLowFps: lowFrameMs > 0 ? Math.min(1000 / lowFrameMs, 240) : 0,
    droppedFrameCount: slowFrames,
  }
}

export interface AdaptiveQualityController {
  readonly tier: RuntimeQualityTier
  readonly preset: RuntimeQualityPreset
  observe(summary: FramePacingSummary): RuntimeQualityPreset
  reset(tier?: RuntimeQualityTier): void
}

/**
 * Uses hysteresis so a noisy frame window cannot thrash resolution. It only returns
 * presentation settings; fixed-step simulation and world generation never depend on it.
 */
export function createAdaptiveQualityController(
  initialTier: RuntimeQualityTier = 'high'
): AdaptiveQualityController {
  let currentTier = initialTier
  let badWindows = 0
  let goodWindows = 0
  const update = (next: RuntimeQualityTier) => {
    currentTier = next
    badWindows = 0
    goodWindows = 0
    return RUNTIME_QUALITY_PRESETS[currentTier]
  }
  return {
    get tier() {
      return currentTier
    },
    get preset() {
      return RUNTIME_QUALITY_PRESETS[currentTier]
    },
    observe(summary) {
      const bad = summary.p95FrameMs > 24 || summary.onePercentLowFps < 42
      const good = summary.p95FrameMs < 16.5 && summary.onePercentLowFps > 55
      if (bad) {
        badWindows += 1
        goodWindows = 0
      } else if (good) {
        goodWindows += 1
        badWindows = 0
      } else {
        badWindows = 0
        goodWindows = 0
      }
      if (badWindows >= 3 && currentTier !== 'safe') {
        return update(currentTier === 'high' ? 'balanced' : 'safe')
      }
      if (goodWindows >= 6 && currentTier !== 'high') {
        return update(currentTier === 'safe' ? 'balanced' : 'high')
      }
      return RUNTIME_QUALITY_PRESETS[currentTier]
    },
    reset(tier = 'high') {
      currentTier = tier
      badWindows = 0
      goodWindows = 0
    },
  }
}
