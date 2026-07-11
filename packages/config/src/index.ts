import type { LocaleCode } from './i18n'

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
  ownership?: Partial<Record<ContentPackFileKind, ContentPackOwnershipMode>>
}

export type ContentPackFileKind =
  | 'world'
  | 'biomes'
  | 'terrainRules'
  | 'mapAreas'
  | 'characters'
  | 'entities'

export type ContentPackOwnershipMode = 'authoritative' | 'additive'
export type ContentPackDiagnosticLevel = 'info' | 'warning' | 'error'

export interface ContentPackDependencyNode {
  packId: string
  dependencies: string[]
  dependencyDepth: number
}

export interface ContentPackResolutionDiagnostic {
  level: ContentPackDiagnosticLevel
  code: string
  message: string
  relatedPackIds?: string[]
  relatedAreaIds?: string[]
}

export interface ContentPackResolutionReport {
  orderedPackIds: string[]
  dependencyGraph: ContentPackDependencyNode[]
  mapAreaIds: string[]
  resolutionHash: string
  diagnostics: ContentPackResolutionDiagnostic[]
}

export interface ContentPackSaveMetadataEntry {
  id: string
  version: string
  schemaVersion: number
  manifestPath: string
  dependencyDepth: number
  mapAreaIds: string[]
}

export interface ContentPackSaveMetadata {
  orderedPackIds: string[]
  resolutionHash: string
  packs: ContentPackSaveMetadataEntry[]
  resolvedMapAreaIds: string[]
}

export interface ContentPackMigrationStepDefinition {
  fromSchemaVersion: number
  toSchemaVersion: number
  description: string
  requiredFixtures: string[]
}

export interface ContentPackMigrationRegistryShape {
  currentSchemaVersion: number
  supportedSchemaVersions: number[]
  failurePolicy: 'hard-fail'
  steps: ContentPackMigrationStepDefinition[]
}

export interface WorldSaveWorldState {
  seed: string
  chunkSize: number
  surveyWidth: number
  surveyHeight: number
  activeChunkRadius: number
  retainChunkRadius: number
  minimapChunkRadius: number
}

export interface WorldSaveExplorerState {
  archetypeId: string
  x: number
  y: number
  facing: 'north' | 'east' | 'south' | 'west'
  state: 'idle' | 'walk' | 'run' | 'action'
  activeWeaponSlot: string | null
}

export interface WorldSaveDiscoveryChunk {
  key: string
  chunkX: number
  chunkY: number
  discovered: string
}

export interface WorldSavePreferences {
  locale: LocaleCode
  devMode: boolean
  devShowGrid: boolean
  devShowMinimap: boolean
  devDayNight: boolean
  devLightLevel: number
  devPanelCollapsed: boolean
  devPanelActiveTab: 'movement' | 'world' | 'gear'
  minimapCollapsed: boolean
  minimapMode: 'fit' | 'manual'
  minimapManualRadius: number
}

export interface WorldSaveSnapshot {
  schemaVersion: 1
  engineVersion: string
  savedAt: string
  world: WorldSaveWorldState
  explorer: WorldSaveExplorerState
  discovery: {
    chunks: WorldSaveDiscoveryChunk[]
    discoveredCells: number
    discoveredChunkKeys: string[]
  }
  preferences: WorldSavePreferences
  contentPacks: ContentPackSaveMetadata
}

export interface WorldSaveMigrationStepDefinition {
  fromSchemaVersion: number
  toSchemaVersion: number
  description: string
}

export interface WorldSaveMigrationRegistryShape {
  currentSchemaVersion: number
  supportedSchemaVersions: number[]
  failurePolicy: 'hard-fail'
  steps: WorldSaveMigrationStepDefinition[]
}

export type WorldSaveErrorCode =
  | 'unavailable'
  | 'quota-exceeded'
  | 'corrupt'
  | 'unsupported-version'
  | 'incompatible-content'
  | 'invalid-import'

export interface WorldSaveSummary {
  slotId: string
  savedAt: string
  seed: string
  discoveredChunks: number
  discoveredCells: number
  resolutionHash: string
}

export const WORLD_SAVE_MIGRATION_REGISTRY_SHAPE: WorldSaveMigrationRegistryShape = {
  currentSchemaVersion: 1,
  supportedSchemaVersions: [1],
  failurePolicy: 'hard-fail',
  steps: [],
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
  stream: WorldStreamDefinition
  roads: WorldRoadSystemDefinition
  rivers?: WorldRiverSystemDefinition
  weather?: WorldWeatherDefinition
  dayNight?: WorldDayNightDefinition
  sizePresets?: WorldSizePreset[]
}

export interface WorldStreamDefinition {
  initialChunkRadius: number
  retainChunkRadius: number
  discoveryRadius: number
  minimapChunkRadius: number
  maxChunkRadius: number
}

export interface WorldSizePreset {
  id: string
  name: string
  width: number
  height: number
  chunkRadius: number
  retainChunkRadius: number
  minimapChunkRadius: number
}

export type WorldRoadProfileId = 'trail' | 'road' | 'trade-route' | 'pass'

export interface WorldRoadProfileDefinition {
  id: WorldRoadProfileId
  name: string
  movementMultiplier: number
  width: number
  color: string
  edgeColor: string
  terrainTextureStrength: number
  weatherTextureStrength: number
}

export type WorldRoadConditionId = 'dry' | 'wet' | 'muddy' | 'snowy' | 'slushy' | 'flooded'

export interface WorldRoadConditionDefinition {
  id: WorldRoadConditionId
  movementMultiplier: number
  trafficMultiplier: number
  surfaceAlpha: number
}

export interface WorldRoadGenerationDefinition {
  candidateDistance: number
  trafficRoadMin: number
  trafficTradeRouteMin: number
  ruggedPassThreshold: number
  smoothingIterations: number
  textureStep: number
}

export interface WorldRoadSystemDefinition {
  profiles: WorldRoadProfileDefinition[]
  conditions: WorldRoadConditionDefinition[]
  generation: WorldRoadGenerationDefinition
}

export interface WorldRiverGenerationDefinition {
  sourceStride: number
  sourceChance: number
  sourceElevationMin: number
  sourceMoistureMin: number
  channelDepthMin: number
  traceMargin: number
  minLength: number
  maxLength: number
  meanderStrength: number
  smoothingSamples: number
}

export interface WorldRiverSystemDefinition {
  enabled: boolean
  blockingMovement: boolean
  bridgeRadius: number
  renderWidth: {
    minor: number
    major: number
  }
  generation: WorldRiverGenerationDefinition
}

export interface WorldWeatherStateDefinition {
  id: 'clear' | 'rain' | 'snow' | 'thaw'
  duration: number
  wetness: number
  snowCover: number
  mud: number
}

export interface WorldWeatherDefinition {
  enabled: boolean
  cycleSeconds: number
  cellScale: number
  transitionSeconds: number
  rainThreshold: number
  snowTemperatureMax: number
  surfaceDecay: number
  states: WorldWeatherStateDefinition[]
}

export interface WorldDayPhaseDefinition {
  id: string
  hour: number
  darkness: number
  tint: string
}

export interface WorldMoonlightDefinition {
  enabled: boolean
  tint: string
  strength: number
  midnightLift: number
}

export interface WorldDayNightDefinition {
  enabled: boolean
  dayLengthMinutes: number
  fixedHour: number
  sampleCount: number
  moonlight?: WorldMoonlightDefinition
  phases: WorldDayPhaseDefinition[]
}

export interface BiomeDefinition {
  id: string
  code: number
  name: string
  family:
    | 'ocean'
    | 'coast'
    | 'wetland'
    | 'plain'
    | 'grassland'
    | 'forest'
    | 'arid'
    | 'upland'
    | 'mountain'
    | 'cryosphere'
    | 'volcanic'
  color: string
  accent: string
  description: string
  movementCost: number
  roadCost: number
  occurrence: number
  latitude: { min: number; max: number }
  elevation: { min: number; max: number }
  temperature: { min: number; max: number }
  moisture: { min: number; max: number }
  creatures: {
    habitatTags: string[]
    iconicSpecies: string[]
    abundance: number
  }
  settlement: {
    suitability: number
    roleWeights: Record<string, number>
    roadAccess: number
  }
}

export type TerrainRuleRarity = 'common' | 'uncommon' | 'rare' | 'very-rare'

export interface TerrainSurfaceEffectDefinition {
  id: string
  trigger: string
  effect: string
}

export interface TerrainDestructionRuleDefinition {
  trigger: string
  becomes: string
  notes: string
}

export interface TerrainRuleDefinition {
  terrainId: string
  realWorldDescription: string
  alohayoBehavior: string
  generation: {
    rarity: TerrainRuleRarity
    possibility: string
    conditions: string[]
  }
  surfaceEffects: TerrainSurfaceEffectDefinition[]
  physicalBehavior: {
    movement: string
    control: string
    hazards: string[]
    entryRequirements: string[]
  }
  destruction: {
    destructible: boolean
    methods: TerrainDestructionRuleDefinition[]
  }
}

export interface TerrainRulePackDefinition {
  schemaVersion: 1
  id: string
  name: string
  description: string
  rules: TerrainRuleDefinition[]
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

export interface MapAuthoredEntityDefinition {
  id: string
  kind: string
  x: number
  y: number
  archetypeId?: string
  factionId?: string
  tags?: string[]
  notes?: string
}

export interface MapProtectedRegionDefinition {
  id: string
  x: number
  y: number
  width: number
  height: number
  shape: 'rectangle' | 'ellipse'
  reason: string
  blocks: Array<'terrainPatches' | 'cells' | 'landmarks' | 'entities' | 'modifiers'>
}

export interface MapGeneratorModifierDefinition {
  id: string
  kind: string
  x: number
  y: number
  width: number
  height: number
  shape: 'rectangle' | 'ellipse'
  strength: number
  parameters?: Record<string, string | number | boolean>
  tags?: string[]
  notes?: string
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
  entities?: MapAuthoredEntityDefinition[]
  protectedRegions?: MapProtectedRegionDefinition[]
  modifiers?: MapGeneratorModifierDefinition[]
}

export interface ResolvedMapAreaDefinition {
  area: MapAreaDefinition
  sourcePackId: string
  sourcePackVersion: string
  sourceManifestPath: string
  sourceMapAreaPackId: string
  sourceMapAreaPackPath: string
  sourceAreaPath: string
  ownership: ContentPackOwnershipMode
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
  terrainRules?: TerrainRulePackDefinition
  mapAreas?: MapAreaDefinition[]
  resolvedMapAreas?: ResolvedMapAreaDefinition[]
  contentPackReport?: ContentPackResolutionReport
  contentPackSaveMetadata?: ContentPackSaveMetadata
  characters?: CharacterContentDefinition
}

export interface MountGameOptions {
  container: HTMLElement
  assetBaseUrl?: string
  devMode?: boolean
  locale?: LocaleCode
  theme?: 'light' | 'dark'
  initialWorld?: {
    seed?: string
    width?: number
    height?: number
    chunkRadius?: number
    retainChunkRadius?: number
    minimapChunkRadius?: number
    mapAreaIds?: string[]
  }
}

export interface GameHandle {
  pause(): void
  resume(): void
  setDevMode?(enabled: boolean): void
  setLocale?(locale: LocaleCode): void
  setTheme?(theme: 'light' | 'dark'): void
  save?(): Promise<WorldSaveSummary>
  exportSave?(): Promise<string>
  importSave?(serialized: string): Promise<WorldSaveSummary>
  clearSave?(): Promise<void>
  destroy(): Promise<void>
}

export type { I18nCatalog, LanguageOption, LocaleCode } from './i18n'
export type {
  ContentPackResolutionInput,
  ResolvedContentPack,
  ResolvedContentPacks,
} from './content-packs'
export { CONTENT_PACK_MIGRATION_REGISTRY_SHAPE, resolveContentPacks } from './content-packs'
export {
  formatI18n,
  getI18nCatalog,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  SUPPORTED_LOCALES,
  translateContentDescription,
  translateContentName,
} from './i18n'
