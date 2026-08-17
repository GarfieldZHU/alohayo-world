import type { CharacterActionState, CharacterFacing } from '@alohayo/character'
import type { CharacterRenderAssetManifest } from './index'

export const CHARACTER_ASSET_MANIFEST_SCHEMA_VERSION = 1 as const
export const CHARACTER_ASSET_MAX_CLIPS = 64
export const CHARACTER_ASSET_MAX_RESIDENT = 32

export type CharacterAssetAdapter = 'sprite' | 'glb' | 'geometric'
export type CharacterAssetClipSource = 'action-direction' | 'direction' | 'geometric'

export interface ResolvedCharacterAssetClip {
  adapter: CharacterAssetAdapter
  source: CharacterAssetClipSource
  assetId?: string
  clipId?: string
  facing: CharacterFacing
  state: CharacterActionState
}

export interface CharacterAssetManifestV1 extends CharacterRenderAssetManifest {
  schemaVersion?: typeof CHARACTER_ASSET_MANIFEST_SCHEMA_VERSION
  assetId?: string
  license?: 'project-original' | 'CC0'
  version?: string
  fallback?: 'geometric'
  clips?: Partial<Record<CharacterFacing, Partial<Record<string, string>>>>
  byteSize?: number
}

export function validateCharacterAssetManifest(
  value: unknown
): asserts value is CharacterAssetManifestV1 {
  if (!value || typeof value !== 'object')
    throw new RangeError('character asset manifest is invalid')
  const manifest = value as Partial<CharacterAssetManifestV1>
  if (
    manifest.schemaVersion !== undefined &&
    manifest.schemaVersion !== CHARACTER_ASSET_MANIFEST_SCHEMA_VERSION
  ) {
    throw new RangeError('character asset manifest schema is not supported')
  }
  if (manifest.spriteSheetUrl !== undefined && typeof manifest.spriteSheetUrl !== 'string') {
    throw new RangeError('character spriteSheetUrl must be a string')
  }
  if (manifest.glbUrl !== undefined && typeof manifest.glbUrl !== 'string') {
    throw new RangeError('character glbUrl must be a string')
  }
  if (manifest.license !== undefined && !['project-original', 'CC0'].includes(manifest.license)) {
    throw new RangeError('character asset license must be project-original or CC0')
  }
  if (manifest.fallback !== undefined && manifest.fallback !== 'geometric') {
    throw new RangeError('character asset fallback must be geometric')
  }
  if (manifest.directionalClips) {
    for (const clip of Object.values(manifest.directionalClips)) {
      if (clip !== undefined && typeof clip !== 'string') {
        throw new RangeError('character directional clip IDs must be strings')
      }
    }
  }
  if (manifest.clips) {
    const clips = Object.values(manifest.clips).flatMap((direction) =>
      direction ? Object.values(direction) : []
    )
    if (
      clips.length > CHARACTER_ASSET_MAX_CLIPS ||
      clips.some((clip) => typeof clip !== 'string')
    ) {
      throw new RangeError('character clip manifest is invalid or exceeds its budget')
    }
  }
  if (
    manifest.byteSize !== undefined &&
    (!Number.isSafeInteger(manifest.byteSize) || manifest.byteSize < 0)
  ) {
    throw new RangeError('character asset byteSize must be a non-negative integer')
  }
}

export function selectCharacterAssetAdapter(args: {
  manifest?: CharacterAssetManifestV1
  spriteSupported?: boolean
  glbSupported?: boolean
}): CharacterAssetAdapter {
  if (!args.manifest) return 'geometric'
  validateCharacterAssetManifest(args.manifest)
  if (args.spriteSupported !== false && args.manifest.spriteSheetUrl) return 'sprite'
  if (args.glbSupported !== false && args.manifest.glbUrl) return 'glb'
  return 'geometric'
}

/** Resolves the most specific authored clip while keeping geometric fallback explicit. */
export function resolveCharacterAssetClip(args: {
  manifest?: CharacterAssetManifestV1
  assetId?: string
  facing: CharacterFacing
  state: CharacterActionState
  reducedMotion?: boolean
}): ResolvedCharacterAssetClip {
  const state = args.reducedMotion ? 'idle' : args.state
  const manifest = args.manifest
  if (!manifest) {
    return { adapter: 'geometric', source: 'geometric', facing: args.facing, state }
  }
  validateCharacterAssetManifest(manifest)
  const directional = manifest.clips?.[args.facing]?.[state]
  if (directional && manifest.spriteSheetUrl) {
    return {
      adapter: 'sprite',
      source: 'action-direction',
      ...(args.assetId ? { assetId: args.assetId } : {}),
      clipId: directional,
      facing: args.facing,
      state,
    }
  }
  const facingClip = manifest.directionalClips?.[args.facing]
  if (facingClip && manifest.spriteSheetUrl) {
    return {
      adapter: 'sprite',
      source: 'direction',
      ...(args.assetId ? { assetId: args.assetId } : {}),
      clipId: facingClip,
      facing: args.facing,
      state,
    }
  }
  return {
    adapter: 'geometric',
    source: 'geometric',
    ...(args.assetId ? { assetId: args.assetId } : {}),
    facing: args.facing,
    state,
  }
}

interface ResidentAsset {
  assetId: string
  bytes: number
  references: number
  lastUsed: number
}

/** Reference-counted residency contract for adapters; it owns no GPU object itself. */
export class CharacterAssetResidency {
  private readonly assets = new Map<string, ResidentAsset>()
  private clock = 0

  constructor(private readonly maxResident = CHARACTER_ASSET_MAX_RESIDENT) {}

  acquire(assetId: string, bytes = 0) {
    if (!assetId) throw new RangeError('character assetId is required')
    const current = this.assets.get(assetId) ?? {
      assetId,
      bytes: Math.max(0, bytes),
      references: 0,
      lastUsed: 0,
    }
    current.references += 1
    current.bytes = Math.max(current.bytes, Math.max(0, bytes))
    current.lastUsed = ++this.clock
    this.assets.set(assetId, current)
    this.evict()
    return { ...current }
  }

  release(assetId: string) {
    const current = this.assets.get(assetId)
    if (!current) return
    current.references = Math.max(0, current.references - 1)
    current.lastUsed = ++this.clock
    this.evict()
  }

  stats() {
    return {
      resident: this.assets.size,
      referenced: Array.from(this.assets.values()).filter((asset) => asset.references > 0).length,
      bytes: Array.from(this.assets.values()).reduce((sum, asset) => sum + asset.bytes, 0),
    }
  }

  clear() {
    this.assets.clear()
  }

  private evict() {
    while (this.assets.size > this.maxResident) {
      const candidate = Array.from(this.assets.values())
        .filter((asset) => asset.references === 0)
        .sort((left, right) => left.lastUsed - right.lastUsed)[0]
      if (!candidate) return
      this.assets.delete(candidate.assetId)
    }
  }
}
