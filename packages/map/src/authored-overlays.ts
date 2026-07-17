import type {
  MapAreaDefinition,
  MapAuthoredEntityDefinition,
  MapGeneratorModifierDefinition,
  MapProtectedRegionDefinition,
} from '@alohayo/config'

export type ProtectedOverlayKind = MapProtectedRegionDefinition['blocks'][number]

interface AuthoredProvenance {
  areaId: string
  areaOrder: number
}

export interface GeneratedAuthoredEntity extends MapAuthoredEntityDefinition, AuthoredProvenance {}

export interface GeneratedProtectedRegion
  extends MapProtectedRegionDefinition, AuthoredProvenance {}

export interface GeneratedGeneratorModifier
  extends MapGeneratorModifierDefinition, AuthoredProvenance {}

export interface ResolvedAuthoredOverlays {
  entities: GeneratedAuthoredEntity[]
  protectedRegions: GeneratedProtectedRegion[]
  modifiers: GeneratedGeneratorModifier[]
}

interface ResolveAuthoredOverlaysOptions {
  areas: MapAreaDefinition[]
  surveyWidth: number
  surveyHeight: number
  centered: boolean
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
}

function areaOrigin(
  area: MapAreaDefinition,
  surveyWidth: number,
  surveyHeight: number,
  centered: boolean
) {
  if (area.placement.mode === 'absolute') {
    return { x: Math.round(area.placement.x), y: Math.round(area.placement.y) }
  }
  const centerOffsetX = centered ? surveyWidth / 2 : 0
  const centerOffsetY = centered ? surveyHeight / 2 : 0
  return {
    x: Math.round((surveyWidth - area.width) * area.placement.x - centerOffsetX),
    y: Math.round((surveyHeight - area.height) * area.placement.y - centerOffsetY),
  }
}

function intersectsBounds(
  item: { x: number; y: number; width?: number; height?: number },
  bounds?: ResolveAuthoredOverlaysOptions['bounds']
) {
  if (!bounds) return true
  const maxX = item.x + (item.width ?? 1) - 1
  const maxY = item.y + (item.height ?? 1) - 1
  return !(maxX < bounds.minX || maxY < bounds.minY || item.x > bounds.maxX || item.y > bounds.maxY)
}

export function pointInProtectedRegion(region: GeneratedProtectedRegion, x: number, y: number) {
  if (x < region.x || y < region.y || x >= region.x + region.width || y >= region.y + region.height)
    return false
  if (region.shape === 'rectangle') return true
  const normalizedX = (x - region.x + 0.5) / region.width - 0.5
  const normalizedY = (y - region.y + 0.5) / region.height - 0.5
  return normalizedX * normalizedX * 4 + normalizedY * normalizedY * 4 <= 1
}

export function overlayBlockedAt(
  regions: GeneratedProtectedRegion[],
  kind: ProtectedOverlayKind,
  x: number,
  y: number,
  areaOrder = Number.POSITIVE_INFINITY
) {
  return regions.some(
    (region) =>
      region.areaOrder < areaOrder &&
      region.blocks.includes(kind) &&
      pointInProtectedRegion(region, x, y)
  )
}

export function modifierStrengthAt(
  modifiers: GeneratedGeneratorModifier[],
  kind: string,
  x: number,
  y: number
) {
  let strength = 0
  for (const modifier of modifiers) {
    if (modifier.kind !== kind) continue
    const normalizedX = x - modifier.x
    const normalizedY = y - modifier.y
    const inside =
      modifier.shape === 'rectangle'
        ? normalizedX >= 0 &&
          normalizedY >= 0 &&
          normalizedX < modifier.width &&
          normalizedY < modifier.height
        : ((normalizedX + 0.5) / modifier.width - 0.5) ** 2 * 4 +
            ((normalizedY + 0.5) / modifier.height - 0.5) ** 2 * 4 <=
          1
    if (inside) strength += modifier.strength
  }
  return Math.max(-1, Math.min(1, strength))
}

export function resolveAuthoredOverlays({
  areas,
  surveyWidth,
  surveyHeight,
  centered,
  bounds,
}: ResolveAuthoredOverlaysOptions): ResolvedAuthoredOverlays {
  const protectedRegions: GeneratedProtectedRegion[] = []
  const entities: GeneratedAuthoredEntity[] = []
  const modifiers: GeneratedGeneratorModifier[] = []

  areas.forEach((area, areaOrder) => {
    if (!area.enabled) return
    const origin = areaOrigin(area, surveyWidth, surveyHeight, centered)
    for (const region of area.protectedRegions ?? []) {
      const resolved = {
        ...region,
        x: origin.x + region.x,
        y: origin.y + region.y,
        areaId: area.id,
        areaOrder,
      }
      if (intersectsBounds(resolved, bounds)) protectedRegions.push(resolved)
    }
    for (const entity of area.entities ?? []) {
      const resolved = {
        ...entity,
        x: origin.x + entity.x,
        y: origin.y + entity.y,
        areaId: area.id,
        areaOrder,
      }
      if (
        intersectsBounds(resolved, bounds) &&
        !overlayBlockedAt(protectedRegions, 'entities', resolved.x, resolved.y, areaOrder)
      )
        entities.push(resolved)
    }
    for (const modifier of area.modifiers ?? []) {
      const resolved = {
        ...modifier,
        x: origin.x + modifier.x,
        y: origin.y + modifier.y,
        areaId: area.id,
        areaOrder,
      }
      if (
        intersectsBounds(resolved, bounds) &&
        !overlayBlockedAt(protectedRegions, 'modifiers', resolved.x, resolved.y, areaOrder)
      )
        modifiers.push(resolved)
    }
  })

  return { entities, protectedRegions, modifiers }
}
