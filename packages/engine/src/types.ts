import type {
  BiomeDefinition,
  CharacterContentDefinition,
  LocaleCode,
  MapAreaDefinition,
  WorldDefinition,
} from '@alohayo/config'
import type { GeneratedChunk } from '@alohayo/map'
import type { Container, Graphics } from 'pixi.js'

export interface EngineContent {
  world: WorldDefinition
  biomes: BiomeDefinition[]
  mapAreas: MapAreaDefinition[]
  characters: CharacterContentDefinition
}

export interface ChunkView {
  container: Container
  terrain: Graphics
  transitions: Graphics
  regionalDetails: Graphics
  closeDetails: Graphics
  grid: Graphics
  surfaces: Graphics
  rivers: Graphics
  roads: Graphics
  settlements: Graphics
  landmarks: Graphics
  fog: Container
  fogFill: Graphics
  fogCutout: Graphics
}

export interface RpcPending {
  resolve: (value: GeneratedChunk) => void
  reject: (reason?: unknown) => void
}

export interface ActiveWeatherState {
  id: string
  wetness: number
  snowCover: number
  mud: number
  fade: number
}

export interface ActiveDayNightState {
  enabled: boolean
  dynamic: boolean
  hour: number
  label: string
  phaseId: string
  lightLevel: number
  moonlight: number
  gradient: string
}

export interface DevPanelControls {
  panel: HTMLDivElement
  body: HTMLDivElement
  heading: HTMLDivElement
  collapseButton: HTMLButtonElement
  battleShadowLabel: HTMLLabelElement
  fastMoveLabel: HTMLLabelElement
  flyLabel: HTMLLabelElement
  gridLabel: HTMLLabelElement
  dayNightLabel: HTMLLabelElement
  lightLevelLabel: HTMLLabelElement
  lightLevelValue: HTMLSpanElement
  lightLevelSlider: HTMLInputElement
  teleportX: HTMLInputElement
  teleportY: HTMLInputElement
  teleportButton: HTMLButtonElement
  slotSelect: HTMLSelectElement
  itemSelect: HTMLSelectElement
  applyGearButton: HTMLButtonElement
  note: HTMLParagraphElement
  battleShadowToggle: HTMLInputElement
  fastMoveToggle: HTMLInputElement
  flyToggle: HTMLInputElement
  gridToggle: HTMLInputElement
  dayNightToggle: HTMLInputElement
  fillEquipmentOptions: () => void
  fillItemOptions: () => void
  setCollapsed: (collapsed: boolean) => void
  isCollapsed: () => boolean
}

export interface MinimapControls {
  panel: HTMLDivElement
  title: HTMLDivElement
  clock: HTMLSpanElement
  compass: HTMLSpanElement
  collapseButton: HTMLButtonElement
  zoomOutButton: HTMLButtonElement
  zoomInButton: HTMLButtonElement
  fitButton: HTMLButtonElement
  body: HTMLDivElement
  setCollapsed: (collapsed: boolean) => void
}

export type UiTheme = 'light' | 'dark'
export type ThemeText = (key: string) => string
export type LocaleSetter = (locale: LocaleCode) => void
