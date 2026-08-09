import type { BiomeDefinition } from '@alohayo/config'
import type { ChunkTerrainTextureHints } from '@alohayo/map'
import type { Graphics } from 'pixi.js'

function colorFromHex(value: string, fallback: number) {
  const parsed = Number.parseInt(value.replace('#', ''), 16)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizedOffset(value: number, cellSize: number, inset = 0.8) {
  return inset + (value / 255) * Math.max(0.6, cellSize - inset * 2)
}

/**
 * Draw presentation-only terrain motifs into the existing regional-details batch.
 * The helper intentionally owns no Pixi textures and creates no display object per
 * cell; WASM supplies recipes, while this module owns the artistic language.
 */
export function drawTerrainTextureOverlay(args: {
  graphics: Graphics
  biomes: Uint8Array
  hints: ChunkTerrainTextureHints
  renderNoise: Uint32Array
  biomeByCode: Map<number, BiomeDefinition>
  chunkSize: number
  cellSize: number
  intensity?: number
}) {
  const { graphics, biomes, hints, renderNoise, biomeByCode, chunkSize, cellSize } = args
  const intensity = args.intensity ?? 0.92
  const maxMark = Math.max(0.2, cellSize * 0.16)

  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const index = localY * chunkSize + localX
      const packedPattern = hints.pattern[index]!
      const pattern = packedPattern >>> 4
      const density = packedPattern & 0x0f
      if (density === 0) continue
      const biome = biomeByCode.get(biomes[index]!)
      if (!biome) continue
      const x = localX * cellSize
      const y = localY * cellSize
      const noise = renderNoise[index]!
      const grain = (noise >>> 8) & 0xff
      const direction = (noise >>> 16) & 0xff
      const strength = 34 + density * 9
      const alpha = Math.min(0.34, (strength / 255) * intensity * 0.58)
      const accent = colorFromHex(biome.accent, 0xffffff)
      const base = colorFromHex(biome.color, 0x6f8290)
      const offsetX = normalizedOffset(grain, cellSize)
      const offsetY = normalizedOffset(direction, cellSize)

      switch (pattern) {
        case 1:
          graphics
            .moveTo(x + 0.7, y + offsetY)
            .lineTo(x + cellSize * 0.46, y + offsetY - maxMark * 0.35)
            .lineTo(x + cellSize - 0.7, y + offsetY)
            .stroke({ color: accent, width: Math.max(0.18, cellSize * 0.045), alpha })
          break
        case 2:
          graphics
            .moveTo(x + offsetX, y + 0.7)
            .lineTo(x + offsetX + maxMark * 0.7, y + cellSize - 0.7)
            .stroke({ color: accent, width: Math.max(0.18, cellSize * 0.05), alpha })
          break
        case 3:
          graphics
            .moveTo(x + offsetX, y + cellSize - 0.7)
            .lineTo(x + offsetX + maxMark * 0.28, y + cellSize * 0.45)
            .stroke({ color: accent, width: Math.max(0.2, cellSize * 0.055), alpha })
          break
        case 4:
          graphics
            .circle(x + offsetX, y + offsetY, maxMark)
            .fill({ color: accent, alpha: alpha * 0.78 })
            .circle(x + cellSize - offsetX, y + cellSize - offsetY, maxMark * 0.72)
            .fill({ color: base, alpha: alpha * 0.6 })
          break
        case 5:
          graphics
            .moveTo(x + offsetX, y + cellSize - 0.6)
            .lineTo(x + offsetX - maxMark * 0.18, y + offsetY)
            .moveTo(x + cellSize - offsetX, y + cellSize - 0.6)
            .lineTo(x + cellSize - offsetX + maxMark * 0.18, y + offsetY + 0.4)
            .stroke({ color: accent, width: Math.max(0.18, cellSize * 0.05), alpha })
          break
        case 6:
          graphics
            .moveTo(x + 0.7, y + offsetY)
            .lineTo(x + cellSize - 0.7, y + offsetY - maxMark * 0.24)
            .stroke({ color: accent, width: Math.max(0.18, cellSize * 0.045), alpha })
          break
        case 7:
        case 8:
          graphics
            .moveTo(x + 0.7, y + cellSize - 0.7)
            .lineTo(x + offsetX, y + offsetY)
            .lineTo(x + cellSize - 0.7, y + cellSize - 0.7)
            .stroke({ color: accent, width: Math.max(0.2, cellSize * 0.055), alpha })
          break
        case 9:
          graphics
            .circle(x + offsetX, y + offsetY, maxMark * 0.72)
            .fill({ color: 0xffffff, alpha: alpha * 0.7 })
          break
        case 10:
          graphics
            .moveTo(x + offsetX, y + cellSize - 0.7)
            .lineTo(x + cellSize * 0.5, y + offsetY)
            .lineTo(x + cellSize - offsetX, y + cellSize - 0.7)
            .stroke({ color: accent, width: Math.max(0.2, cellSize * 0.055), alpha })
          break
        default:
          graphics.circle(x + offsetX, y + offsetY, maxMark * 0.56).fill({ color: base, alpha })
      }
    }
  }
}
