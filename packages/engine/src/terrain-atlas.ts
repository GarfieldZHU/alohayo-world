export const TERRAIN_ATLAS_FAMILIES = [
  'water',
  'coast',
  'grass',
  'forest',
  'wetland',
  'arid',
  'rock',
  'snow-volcanic',
] as const

export type TerrainAtlasFamily = (typeof TERRAIN_ATLAS_FAMILIES)[number]

export interface TerrainAtlasManifest {
  version: 1
  url: string
  tileSize: number
  gutter: number
  families: readonly TerrainAtlasFamily[]
}

export const DEFAULT_TERRAIN_ATLAS_MANIFEST: TerrainAtlasManifest = {
  version: 1,
  url: '/assets/terrain-texture-atlas.svg',
  tileSize: 64,
  gutter: 8,
  families: TERRAIN_ATLAS_FAMILIES,
}

export interface TerrainAtlasResidencyOptions {
  maxChunks?: number
  maxBytes?: number
  bytesPerChunk?: number
}

interface ResidentChunk {
  key: string
  lod: 0 | 1
  references: number
  bytes: number
  lastUsed: number
}

export function chooseTerrainAtlasLod(args: {
  qualityTier: 'high' | 'balanced' | 'safe'
  deviceMemoryGB?: number
  reducedMotion?: boolean
}): 0 | 1 {
  if (args.reducedMotion || args.qualityTier === 'safe' || (args.deviceMemoryGB ?? 8) <= 2) return 1
  return args.qualityTier === 'balanced' ? 1 : 0
}

/** Retains chunk atlas usage only; actual Pixi texture ownership remains with the caller. */
export class TerrainAtlasResidency {
  private readonly chunks = new Map<string, ResidentChunk>()
  private clock = 0
  private readonly maxChunks: number
  private readonly maxBytes: number
  private readonly bytesPerChunk: number

  constructor(options: TerrainAtlasResidencyOptions = {}) {
    this.maxChunks = Math.max(1, Math.floor(options.maxChunks ?? 12))
    this.maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 8 * 1024 * 1024))
    this.bytesPerChunk = Math.max(1, Math.floor(options.bytesPerChunk ?? 64 * 64 * 4))
  }

  acquire(key: string, lod: 0 | 1 = 0) {
    if (!key) throw new RangeError('terrain atlas chunk key is required')
    const current = this.chunks.get(key) ?? {
      key,
      lod,
      references: 0,
      bytes: lod === 0 ? this.bytesPerChunk : Math.floor(this.bytesPerChunk / 2),
      lastUsed: 0,
    }
    current.lod = lod
    current.references += 1
    current.lastUsed = ++this.clock
    this.chunks.set(key, current)
    this.evict()
    return { ...current }
  }

  release(key: string) {
    const current = this.chunks.get(key)
    if (!current) return
    current.references = Math.max(0, current.references - 1)
    current.lastUsed = ++this.clock
    this.evict()
  }

  stats() {
    return {
      residentChunks: this.chunks.size,
      referencedChunks: Array.from(this.chunks.values()).filter((chunk) => chunk.references > 0)
        .length,
      bytes: Array.from(this.chunks.values()).reduce((sum, chunk) => sum + chunk.bytes, 0),
      lod1Chunks: Array.from(this.chunks.values()).filter((chunk) => chunk.lod === 1).length,
    }
  }

  clear() {
    this.chunks.clear()
  }

  private evict() {
    while (true) {
      const stats = this.stats()
      if (stats.residentChunks <= this.maxChunks && stats.bytes <= this.maxBytes) return
      const candidate = Array.from(this.chunks.values())
        .filter((chunk) => chunk.references === 0)
        .sort((left, right) => left.lastUsed - right.lastUsed)[0]
      if (!candidate) return
      this.chunks.delete(candidate.key)
    }
  }
}
