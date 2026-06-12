export interface ContentPackManifest {
  schemaVersion: 1
  id: string
  name: string
  version: string
  description: string
  dependencies: string[]
  world: string
  biomes: string
  mapAreas?: string
  characters?: string
}

export interface WorldDefinition {
  schemaVersion: 1
  id: string
  name: string
  defaultSeed: string
  width: number
  height: number
  chunkSize: number
  cellSize: number
  generator: 'continental-v1'
  sizePresets?: WorldSizePreset[]
}

export interface WorldSizePreset {
  id: string
  name: string
  width: number
  height: number
}

export interface BiomeDefinition {
  id: string
  code: number
  name: string
  color: string
  accent: string
  description: string
  movementCost: number
}

export interface MapAreaPackDefinition {
  schemaVersion: 1
  id: string
  name: string
  description: string
  areas: string[]
}

export interface MapAreaPlacement {
  mode: 'absolute' | 'normalized'
  x: number
  y: number
}

export interface MapTerrainPatch {
  shape: 'rectangle' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
  terrainId: string
  elevation?: number
  moisture?: number
  temperature?: number
}

export interface MapCellPatch {
  x: number
  y: number
  terrainId: string
  elevation?: number
  moisture?: number
  temperature?: number
}

export interface MapLandmarkDefinition {
  id: string
  name: string
  x: number
  y: number
  kind: string
  description: string
}

export interface MapAreaDefinition {
  schemaVersion: 1
  id: string
  name: string
  description: string
  enabled: boolean
  placement: MapAreaPlacement
  width: number
  height: number
  terrainPatches: MapTerrainPatch[]
  cells?: MapCellPatch[]
  landmarks?: MapLandmarkDefinition[]
}

export interface AbilityDefinition {
  id: string
  name: string
  abbreviation: string
  description: string
  minimum: number
  maximum: number
  default: number
  group: string
}

export type CharacterRole = 'player' | 'npc' | 'enemy'
export type EquipmentSlotKind = 'wearable' | 'decorator' | 'weapon'

export interface EquipmentSlotDefinition {
  id: string
  name: string
  kind: EquipmentSlotKind
  accepts: string[]
  layer: number
  optional: boolean
}

export interface EquipmentItemDefinition {
  id: string
  name: string
  tags: string[]
  allowedSlots: string[]
  appearance: Record<string, string>
  modifiers?: Record<string, number>
  shareable: boolean
}

export interface EquipmentPoolDefinition {
  id: string
  itemIds: string[]
  allowEmpty: boolean
}

export interface CharacterAppearancePools {
  bodyShapes: string[]
  builds: string[]
  heights: string[]
  faceShapes: string[]
  skinTones: string[]
  eyeShapes: string[]
  eyeColors: string[]
  hairStyles: string[]
  hairColors: string[]
  facialHairStyles: string[]
}

export interface CharacterAppearanceSelection {
  fixed?: Partial<Record<keyof CharacterAppearancePools, string>>
  pools?: Partial<Record<keyof CharacterAppearancePools, string[]>>
}

export interface CharacterAbilityRoll {
  minimum: number
  maximum: number
  fixed?: number
}

export interface CharacterEquipmentSelection {
  slotId: string
  fixedItemId?: string
  poolId?: string
  shared?: boolean
}

export interface CharacterMovementDefinition {
  walkSpeed: number
  runMultiplier: number
  actionRange: number
}

export interface CharacterActionDefinition {
  id: string
  name: string
  description: string
  input: 'interact'
  duration: number
  range: number
  target: 'landmark' | 'self'
}

export interface CharacterArchetypeDefinition {
  schemaVersion: 1
  id: string
  name: string
  role: CharacterRole
  description: string
  abilities: Record<string, CharacterAbilityRoll>
  appearance: CharacterAppearanceSelection
  equipment: CharacterEquipmentSelection[]
  weaponSetSlots: string[]
  movement: CharacterMovementDefinition
  actionIds: string[]
  tags: string[]
}

export interface CharacterContentDefinition {
  schemaVersion: 1
  abilities: AbilityDefinition[]
  appearancePools: CharacterAppearancePools
  slots: EquipmentSlotDefinition[]
  items: EquipmentItemDefinition[]
  equipmentPools: EquipmentPoolDefinition[]
  actions: CharacterActionDefinition[]
  archetypes: CharacterArchetypeDefinition[]
}

export interface EntityDefinition {
  id: string
  name: string
  components: Record<string, unknown>
}

export interface WorldManifest {
  pack: ContentPackManifest
  world: WorldDefinition
  biomes: BiomeDefinition[]
  mapAreas?: MapAreaDefinition[]
  characters?: CharacterContentDefinition
}

export interface ActiveBiomeSnapshot {
  biomeId: string
  biomeName: string
  region: string
  x: number
  y: number
  elevation: number
  moisture: number
  temperature: number
  movementCost: number
}

export interface MountGameOptions {
  container: HTMLElement
  assetBaseUrl?: string
  initialWorld?: { seed?: string; width?: number; height?: number }
  onBiomeChange?: (snapshot: ActiveBiomeSnapshot) => void
}

export interface GameHandle {
  pause(): void
  resume(): void
  destroy(): Promise<void>
}
