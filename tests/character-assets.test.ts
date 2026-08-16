import { describe, expect, it } from 'vitest'
import {
  CharacterAssetResidency,
  resolveCharacterAssetClip,
  selectCharacterAssetAdapter,
  validateCharacterAssetManifest,
} from '@alohayo/character-renderer'

describe('character asset adapters', () => {
  it('prefers a capability-gated sprite, then GLB, then geometric fallback', () => {
    const manifest = {
      schemaVersion: 1 as const,
      assetId: 'core:explorer',
      license: 'project-original' as const,
      spriteSheetUrl: '/assets/characters/explorer.sheet.json',
      glbUrl: '/assets/characters/explorer.glb',
      fallback: 'geometric' as const,
    }
    expect(selectCharacterAssetAdapter({ manifest })).toBe('sprite')
    expect(selectCharacterAssetAdapter({ manifest, spriteSupported: false })).toBe('glb')
    expect(
      selectCharacterAssetAdapter({ manifest, spriteSupported: false, glbSupported: false })
    ).toBe('geometric')
    expect(() => validateCharacterAssetManifest(manifest)).not.toThrow()
  })

  it('bounds residency and releases unreferenced assets on eviction', () => {
    const residency = new CharacterAssetResidency(2)
    residency.acquire('a', 10)
    residency.release('a')
    residency.acquire('b', 20)
    residency.release('b')
    residency.acquire('c', 30)
    expect(residency.stats()).toEqual({ resident: 2, referenced: 1, bytes: 50 })
    residency.release('c')
    residency.acquire('d', 40)
    expect(residency.stats().resident).toBe(2)
  })

  it('resolves directional action clips and reduced-motion fallback deterministically', () => {
    const manifest = {
      schemaVersion: 1 as const,
      assetId: 'core:wayfinder',
      license: 'project-original' as const,
      spriteSheetUrl: '/assets/wayfinder.png',
      directionalClips: { east: 'east-idle' },
      clips: { east: { walk: 'east-walk' } },
    }
    expect(
      resolveCharacterAssetClip({
        manifest,
        assetId: manifest.assetId,
        facing: 'east',
        state: 'walk',
      })
    ).toMatchObject({ adapter: 'sprite', source: 'action-direction', clipId: 'east-walk' })
    expect(
      resolveCharacterAssetClip({
        manifest,
        assetId: manifest.assetId,
        facing: 'east',
        state: 'run',
        reducedMotion: true,
      })
    ).toMatchObject({ adapter: 'sprite', source: 'direction', clipId: 'east-idle', state: 'idle' })
    expect(resolveCharacterAssetClip({ facing: 'north', state: 'idle' })).toMatchObject({
      adapter: 'geometric',
      source: 'geometric',
    })
  })
})
