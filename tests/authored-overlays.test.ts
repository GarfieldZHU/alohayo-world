import { describe, expect, it } from 'vitest'
import type { MapAreaDefinition } from '@alohayo/config'
import { modifierStrengthAt, overlayBlockedAt, resolveAuthoredOverlays } from '@alohayo/map'

function area(overrides: Partial<MapAreaDefinition>): MapAreaDefinition {
  return {
    schemaVersion: 1,
    id: 'test:area',
    name: 'Test area',
    description: 'Authored overlay fixture.',
    enabled: true,
    placement: { mode: 'normalized', x: 0.5, y: 0.5 },
    width: 10,
    height: 10,
    terrainPatches: [],
    ...overrides,
  }
}

describe('authored overlay runtime', () => {
  it('uses the same centered coordinate contract as streamed authored areas', () => {
    const resolved = resolveAuthoredOverlays({
      areas: [
        area({
          entities: [{ id: 'test:spawn', kind: 'npc-spawn', x: 2, y: 3 }],
        }),
      ],
      surveyWidth: 101,
      surveyHeight: 81,
      centered: true,
    })

    expect(resolved.entities[0]).toMatchObject({ x: -3, y: -2, areaId: 'test:area' })
  })

  it('lets an earlier protected region suppress later overlays and procedural layers', () => {
    const resolved = resolveAuthoredOverlays({
      areas: [
        area({
          id: 'test:reserve',
          placement: { mode: 'absolute', x: 0, y: 0 },
          protectedRegions: [
            {
              id: 'test:protected',
              x: 1,
              y: 1,
              width: 6,
              height: 6,
              shape: 'rectangle',
              reason: 'Test precedence.',
              blocks: ['entities', 'modifiers', 'settlements'],
            },
          ],
        }),
        area({
          id: 'test:later',
          placement: { mode: 'absolute', x: 0, y: 0 },
          entities: [{ id: 'test:blocked', kind: 'npc-spawn', x: 3, y: 3 }],
          modifiers: [
            {
              id: 'test:blocked-modifier',
              kind: 'settlement-bias',
              x: 2,
              y: 2,
              width: 3,
              height: 3,
              shape: 'rectangle',
              strength: 0.8,
            },
          ],
        }),
      ],
      surveyWidth: 32,
      surveyHeight: 32,
      centered: false,
    })

    expect(resolved.entities).toEqual([])
    expect(resolved.modifiers).toEqual([])
    expect(overlayBlockedAt(resolved.protectedRegions, 'settlements', 3, 3)).toBe(true)
  })

  it('combines and clamps matching registered modifier strengths', () => {
    const resolved = resolveAuthoredOverlays({
      areas: [
        area({
          placement: { mode: 'absolute', x: 0, y: 0 },
          modifiers: [
            {
              id: 'test:first',
              kind: 'settlement-bias',
              x: 0,
              y: 0,
              width: 8,
              height: 8,
              shape: 'rectangle',
              strength: 0.75,
            },
            {
              id: 'test:second',
              kind: 'settlement-bias',
              x: 2,
              y: 2,
              width: 4,
              height: 4,
              shape: 'ellipse',
              strength: 0.6,
            },
          ],
        }),
      ],
      surveyWidth: 32,
      surveyHeight: 32,
      centered: false,
    })

    expect(modifierStrengthAt(resolved.modifiers, 'settlement-bias', 3, 3)).toBe(1)
    expect(modifierStrengthAt(resolved.modifiers, 'road-bias', 3, 3)).toBe(0)
  })
})
