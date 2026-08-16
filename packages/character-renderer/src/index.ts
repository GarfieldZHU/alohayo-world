import type { CharacterContentDefinition, EquipmentItemDefinition } from '@alohayo/config'
import type {
  CharacterActionState,
  CharacterFacing,
  CharacterMotionState,
  GeneratedCharacter,
} from '@alohayo/character'
import { Container, Graphics } from 'pixi.js'

/** Stable layer order for future sprite/GLB adapters. Keep simulation out of this module. */
export const CHARACTER_RENDER_LAYER_ORDER = [
  'shadow',
  'aura',
  'body',
  'head',
  'equipment',
  'weapon',
] as const

export type CharacterRenderLayer = (typeof CHARACTER_RENDER_LAYER_ORDER)[number]

export interface CharacterRenderAssetManifest {
  schemaVersion?: 1
  assetId?: string
  license?: 'project-original' | 'CC0'
  version?: string
  spriteSheetUrl?: string
  glbUrl?: string
  attribution?: string
  directionalClips?: Partial<Record<CharacterFacing, string>>
  fallback?: 'geometric'
  clips?: Partial<Record<CharacterFacing, Partial<Record<string, string>>>>
  byteSize?: number
}

export interface CharacterRenderFrame {
  x: number
  y: number
  cellSize: number
  facing: CharacterFacing
  state: CharacterActionState
  elapsedSeconds: number
  reducedMotion?: boolean
  devMode?: boolean
  devFly?: boolean
}

export interface CharacterRenderModel {
  skinColor: number
  hairColor: number
  clothingColor: number
  hatColor: number
  weaponColor: number
  bodyWidthFactor: number
  bodyHeightFactor: number
  equipmentIds: readonly string[]
  assetManifest?: CharacterRenderAssetManifest
}

export interface CharacterRenderInput {
  character: GeneratedCharacter
  content: CharacterContentDefinition
  motion: CharacterMotionState
  frame: CharacterRenderFrame
}

export interface CharacterRenderCapture {
  layerOrder: readonly CharacterRenderLayer[]
  frame: CharacterRenderFrame
  model: CharacterRenderModel
}

export interface CharacterRenderer {
  render(input: CharacterRenderInput): void
  clear(): void
  capture(): CharacterRenderCapture | null
  dispose(): void
}

const APPEARANCE_COLORS: Record<string, number> = {
  porcelain: 0xf1d6c6,
  fair: 0xe4bfa6,
  warm: 0xc99370,
  olive: 0xa77b55,
  brown: 0x815536,
  deep: 0x4f3023,
  black: 0x151719,
  'dark-brown': 0x33251e,
  auburn: 0x7a3f2d,
  blonde: 0xd2b36c,
  silver: 0x9b9da1,
  white: 0xe5e7e8,
}

function parseColor(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  if (value.startsWith('#')) {
    const parsed = Number.parseInt(value.slice(1), 16)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return APPEARANCE_COLORS[value] ?? fallback
}

function itemForSlots(
  character: GeneratedCharacter,
  content: CharacterContentDefinition,
  slots: readonly string[]
): EquipmentItemDefinition | undefined {
  const selection = character.equipment.find(
    (entry) => slots.includes(entry.slotId) && entry.itemId
  )
  return content.items.find((item) => item.id === selection?.itemId)
}

/** Resolves data-driven appearance without touching Pixi or the simulation. */
export function resolveCharacterRenderModel(
  character: GeneratedCharacter,
  content: CharacterContentDefinition,
  assetManifest?: CharacterRenderAssetManifest
): CharacterRenderModel {
  const clothing = itemForSlots(character, content, ['wear:outer', 'wear:torso'])
  const hat = itemForSlots(character, content, ['wear:head', 'decor:head'])
  const activeWeapon = character.activeWeaponSlot
    ? itemForSlots(character, content, [character.activeWeaponSlot])
    : undefined
  const equipmentIds = character.equipment
    .filter((entry) => entry.itemId)
    .map((entry) => entry.itemId!)

  return {
    skinColor: parseColor(character.appearance.skinTone, 0xc99370),
    hairColor: parseColor(character.appearance.hairColor, 0x33251e),
    clothingColor: parseColor(clothing?.appearance.color, 0x72d7c8),
    hatColor: parseColor(hat?.appearance.color, 0x9bb2bf),
    weaponColor: parseColor(activeWeapon?.appearance.color, 0xf0d79b),
    bodyWidthFactor:
      character.appearance.bodyShape === 'broad'
        ? 0.95
        : character.appearance.bodyShape === 'slender'
          ? 0.68
          : 0.82,
    bodyHeightFactor:
      character.appearance.height === 'very-tall' || character.appearance.height === 'tall'
        ? 0.46
        : character.appearance.height === 'short'
          ? 0.34
          : 0.4,
    equipmentIds,
    ...(assetManifest ? { assetManifest } : {}),
  }
}

function clearGraphics(layers: readonly Graphics[]): void {
  for (const layer of layers) layer.clear()
}

/**
 * Pixi adapter for the renderer-neutral character contract. The adapter owns only
 * presentation layers; movement, collision, equipment rules, and save state remain
 * in @alohayo/character and @alohayo/engine.
 */
export function createPixiCharacterRenderer(
  target: Container,
  devTarget?: Graphics
): CharacterRenderer {
  const layers = Object.fromEntries(
    CHARACTER_RENDER_LAYER_ORDER.map((name) => [name, new Graphics()])
  ) as Record<CharacterRenderLayer, Graphics>
  for (const name of CHARACTER_RENDER_LAYER_ORDER) target.addChild(layers[name])
  let lastCapture: CharacterRenderCapture | null = null

  const renderer: CharacterRenderer = {
    render(input) {
      const { character, content, motion, frame } = input
      const model = resolveCharacterRenderModel(character, content)
      const centerPixelX = frame.x * frame.cellSize
      const centerPixelY = frame.y * frame.cellSize
      const footprint = frame.cellSize / 3
      const moving = motion.state === 'walk' || motion.state === 'run'
      const animate = !frame.reducedMotion
      const strideSpeed = motion.state === 'run' ? 15 : 9
      const bob =
        animate && moving ? Math.sin(frame.elapsedSeconds * strideSpeed) * footprint * 0.08 : 0
      const actionPulse =
        animate && motion.state === 'action' ? 1 + Math.sin(frame.elapsedSeconds * 24) * 0.15 : 1
      const bodyWidth = footprint * model.bodyWidthFactor
      const bodyHeight = footprint * model.bodyHeightFactor
      const headRadius = footprint * 0.2
      const facingOffsetX =
        motion.facing === 'west'
          ? -footprint * 0.12
          : motion.facing === 'east'
            ? footprint * 0.12
            : 0

      clearGraphics(Object.values(layers))
      devTarget?.clear()
      layers.shadow
        .ellipse(centerPixelX, centerPixelY + footprint * 0.18, footprint * 0.46, footprint * 0.13)
        .fill({ color: 0x030711, alpha: 0.38 })
      layers.aura.circle(centerPixelX, centerPixelY, frame.cellSize * 0.45 * actionPulse).stroke({
        color: motion.state === 'action' ? 0xf0d79b : 0xffffff,
        width: Math.max(0.35, frame.cellSize * 0.08),
        alpha: 0.78,
      })
      layers.head
        .circle(centerPixelX + facingOffsetX, centerPixelY - footprint * 0.27 + bob, headRadius)
        .fill({ color: model.skinColor })
        .circle(
          centerPixelX + facingOffsetX,
          centerPixelY - footprint * 0.34 + bob,
          headRadius * 0.9
        )
        .fill({ color: model.hairColor, alpha: 0.92 })
      layers.equipment
        .rect(
          centerPixelX - headRadius * 1.05,
          centerPixelY - footprint * 0.52 + bob,
          headRadius * 2.1,
          headRadius * 0.42
        )
        .fill({ color: model.hatColor, alpha: 0.88 })
      layers.body
        .rect(
          centerPixelX - bodyWidth / 2,
          centerPixelY - footprint * 0.04 + bob,
          bodyWidth,
          bodyHeight
        )
        .fill({ color: model.clothingColor })
      const weaponStartX = centerPixelX + bodyWidth * 0.55
      const weaponStartY = centerPixelY + bob
      const weaponDirection = motion.facing === 'west' ? -1 : 1
      const weaponEndX = weaponStartX + footprint * 0.44 * weaponDirection
      const weaponEndY =
        weaponStartY + (motion.facing === 'north' ? -footprint * 0.24 : footprint * 0.18)
      layers.weapon
        .moveTo(weaponStartX, weaponStartY)
        .lineTo(weaponEndX, weaponEndY)
        .stroke({
          color: model.weaponColor,
          width: Math.max(0.5, frame.cellSize * 0.12),
          alpha: 0.92,
        })
      if (frame.devMode && frame.devFly && devTarget) {
        devTarget
          .circle(centerPixelX, centerPixelY, frame.cellSize * 2.6)
          .stroke({ color: 0x8ef2ff, width: Math.max(0.45, frame.cellSize * 0.1), alpha: 0.9 })
          .circle(centerPixelX, centerPixelY, frame.cellSize * 2.05)
          .stroke({ color: 0x1cc8e8, width: Math.max(0.35, frame.cellSize * 0.08), alpha: 0.55 })
      }
      lastCapture = {
        layerOrder: CHARACTER_RENDER_LAYER_ORDER,
        frame: { ...frame, facing: motion.facing, state: motion.state },
        model,
      }
    },
    clear() {
      clearGraphics(Object.values(layers))
      devTarget?.clear()
      lastCapture = null
    },
    capture() {
      if (!lastCapture) return null
      return {
        layerOrder: [...lastCapture.layerOrder],
        frame: { ...lastCapture.frame },
        model: {
          ...lastCapture.model,
          equipmentIds: [...lastCapture.model.equipmentIds],
          ...(lastCapture.model.assetManifest
            ? { assetManifest: { ...lastCapture.model.assetManifest } }
            : {}),
        },
      }
    },
    dispose() {
      renderer.clear()
      for (const name of CHARACTER_RENDER_LAYER_ORDER) {
        target.removeChild(layers[name])
        layers[name].destroy()
      }
    },
  }
  return renderer
}

export {
  CHARACTER_ASSET_MANIFEST_SCHEMA_VERSION,
  CHARACTER_ASSET_MAX_CLIPS,
  CHARACTER_ASSET_MAX_RESIDENT,
  CharacterAssetResidency,
  resolveCharacterAssetClip,
  selectCharacterAssetAdapter,
  validateCharacterAssetManifest,
  type CharacterAssetAdapter,
  type CharacterAssetClipSource,
  type CharacterAssetManifestV1,
  type ResolvedCharacterAssetClip,
} from './asset-manifest'
