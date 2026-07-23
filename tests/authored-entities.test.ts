import {
  AuthoredEntityLifecycleError,
  AuthoredEntityLifecycleRegistry,
  type GeneratedAuthoredEntity,
} from '@alohayo/map'
import { describe, expect, it } from 'vitest'

function entity(overrides: Partial<GeneratedAuthoredEntity> = {}): GeneratedAuthoredEntity {
  return {
    id: 'test:guide',
    kind: 'npc-spawn',
    x: -64,
    y: 9,
    areaId: 'test:area',
    areaOrder: 0,
    ...overrides,
  }
}

describe('authored entity lifecycle', () => {
  it('retains once per chunk, releases on eviction, and deterministically respawns on revisit', () => {
    const lifecycle = new AuthoredEntityLifecycleRegistry()
    expect(lifecycle.retainChunk('-1,0', [entity()])).toHaveLength(1)
    expect(lifecycle.retainChunk('-1,0', [entity()])).toEqual([])
    expect(lifecycle.releaseChunk('-1,0')).toHaveLength(1)
    expect(lifecycle.retainChunk('-1,0', [entity()])).toHaveLength(1)
  })

  it('persists a never-respawn despawn state across a fresh registry', () => {
    const lifecycle = new AuthoredEntityLifecycleRegistry()
    const [runtime] = lifecycle.retainChunk('0,0', [entity({ respawnPolicy: 'never' })])
    lifecycle.markDespawned(runtime!.runtimeId)
    const restored = new AuthoredEntityLifecycleRegistry()
    restored.restore(lifecycle.snapshot())
    expect(restored.retainChunk('0,0', [entity({ respawnPolicy: 'never' })])).toEqual([])
  })

  it('rejects unsupported kinds and conflicting stable runtime IDs', () => {
    const lifecycle = new AuthoredEntityLifecycleRegistry()
    expect(() => lifecycle.retainChunk('0,0', [entity({ kind: 'script' as 'npc-spawn' })])).toThrow(
      AuthoredEntityLifecycleError
    )
    lifecycle.retainChunk('0,0', [entity()])
    expect(() => lifecycle.retainChunk('1,0', [entity({ tags: ['different'] })])).toThrow(
      'conflicting authored entity runtime id'
    )
  })
})
