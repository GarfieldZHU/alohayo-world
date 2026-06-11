export interface ContentPackManifest {
  schemaVersion: 1
  id: string
  name: string
  version: string
  description: string
  dependencies: string[]
  world: string
  biomes: string
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

export interface EntityDefinition {
  id: string
  name: string
  components: Record<string, unknown>
}

export interface WorldManifest {
  pack: ContentPackManifest
  world: WorldDefinition
  biomes: BiomeDefinition[]
}

export interface MountGameOptions {
  container: HTMLElement
  assetBaseUrl?: string
  initialWorld?: { seed?: string }
}

export interface GameHandle {
  pause(): void
  resume(): void
  destroy(): Promise<void>
}
