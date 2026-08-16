import { describe, expect, it } from 'vitest'
import {
  createAdaptiveQualityController,
  summarizeFramePacing,
} from '../packages/engine/src/performance-quality'

describe('adaptive frame pacing', () => {
  it('reports percentile and 1%-low metrics from a bounded trace', () => {
    const summary = summarizeFramePacing([8, 10, 12, 16, 18, 30, 42])
    expect(summary.sampleCount).toBe(7)
    expect(summary.p95FrameMs).toBeGreaterThan(18)
    expect(summary.onePercentLowFps).toBeLessThan(24)
    expect(summary.droppedFrameCount).toBe(3)
  })

  it('uses downgrade and upgrade hysteresis without changing simulation state', () => {
    const controller = createAdaptiveQualityController()
    const bad = {
      sampleCount: 60,
      p50FrameMs: 18,
      p95FrameMs: 31,
      p99FrameMs: 45,
      onePercentLowFps: 22,
      droppedFrameCount: 20,
    }
    controller.observe(bad)
    controller.observe(bad)
    expect(controller.tier).toBe('high')
    controller.observe(bad)
    expect(controller.tier).toBe('balanced')
    for (let index = 0; index < 18; index += 1) {
      controller.observe({
        sampleCount: 60,
        p50FrameMs: 12,
        p95FrameMs: 15,
        p99FrameMs: 16,
        onePercentLowFps: 62,
        droppedFrameCount: 0,
      })
    }
    expect(controller.tier).toBe('high')
  })
})
