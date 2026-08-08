import type { WorldTransportSystemDefinition } from '@alohayo/config'
import type { GeneratedRoad, GeneratedTransportStructure } from './index'

export interface TransportCellSample {
  nearWater: boolean
  moisture: number
  ruggedness: number
}

export interface TraversalQuery {
  capabilityTags?: readonly string[]
  baseMovementMultiplier?: number
  structure?: GeneratedTransportStructure | null
}

export interface TraversalResult {
  allowed: boolean
  movementMultiplier: number
  missingTags: string[]
  reason: 'open' | 'capability-required' | 'no-structure'
}

export const DEFAULT_TRANSPORT_SYSTEM: WorldTransportSystemDefinition = {
  profiles: [
    {
      id: 'bridge',
      requiredTags: ['traversal:bridge'],
      movementMultiplier: 0.92,
      maintenanceRate: 0.012,
    },
    {
      id: 'causeway',
      requiredTags: ['traversal:causeway'],
      movementMultiplier: 1.08,
      maintenanceRate: 0.018,
    },
    {
      id: 'ferry',
      requiredTags: ['traversal:ferry'],
      movementMultiplier: 1.2,
      maintenanceRate: 0.024,
    },
    {
      id: 'switchback',
      requiredTags: ['traversal:switchback'],
      movementMultiplier: 1.12,
      maintenanceRate: 0.014,
    },
  ],
  generation: {
    enabled: true,
    waterDistance: 2.5,
    causewayMoistureMin: 0.68,
    switchbackRuggednessMin: 0.62,
    ferryTrafficMin: 3,
  },
}

export function resolveTransportSystem(
  system?: WorldTransportSystemDefinition
): WorldTransportSystemDefinition {
  return system ?? DEFAULT_TRANSPORT_SYSTEM
}

function profileFor(
  system: WorldTransportSystemDefinition,
  kind: GeneratedTransportStructure['kind']
) {
  return system.profiles.find((profile) => profile.id === kind) ?? system.profiles[0]!
}

/**
 * Derive one deterministic structure marker per qualifying road. Structure
 * records are gameplay hints only; terrain and the road graph remain authoritative.
 */
export function buildTransportStructures(
  roads: readonly GeneratedRoad[],
  sampleCell: (x: number, y: number) => TransportCellSample,
  system?: WorldTransportSystemDefinition
): GeneratedTransportStructure[] {
  const resolved = resolveTransportSystem(system)
  if (!resolved.generation.enabled || !roads.length) return []
  const structures: GeneratedTransportStructure[] = []
  for (const road of roads) {
    if (road.points.length < 2) continue
    const midpointIndex = Math.floor(road.points.length / 2)
    const point = road.points[midpointIndex]!
    const sample = sampleCell(point.x, point.y)
    let kind: GeneratedTransportStructure['kind'] | null = null
    if (road.kind === 'pass' && sample.ruggedness >= resolved.generation.switchbackRuggednessMin) {
      kind = 'switchback'
    } else if (sample.nearWater && road.traffic >= resolved.generation.ferryTrafficMin) {
      kind = 'ferry'
    } else if (sample.nearWater && sample.moisture >= resolved.generation.causewayMoistureMin) {
      kind = 'causeway'
    } else if (sample.nearWater) {
      kind = 'bridge'
    }
    if (!kind) continue
    const profile = profileFor(resolved, kind)
    structures.push({
      id: `transport:${kind}:${road.id}`,
      kind,
      roadId: road.id,
      x: point.x,
      y: point.y,
      roadPointIndex: midpointIndex,
      requiredTags: [...profile.requiredTags].sort(),
      movementMultiplier: profile.movementMultiplier,
      maintenanceRate: profile.maintenanceRate,
    })
  }
  return structures.sort((left, right) => left.id.localeCompare(right.id))
}

export function evaluateTransportTraversal(query: TraversalQuery): TraversalResult {
  const baseMovementMultiplier = Math.max(0.01, query.baseMovementMultiplier ?? 1)
  const structure = query.structure
  if (!structure) {
    return {
      allowed: true,
      movementMultiplier: baseMovementMultiplier,
      missingTags: [],
      reason: 'open',
    }
  }
  const capabilities = new Set(query.capabilityTags ?? [])
  const missingTags = structure.requiredTags.filter((tag) => !capabilities.has(tag))
  if (missingTags.length) {
    return {
      allowed: false,
      movementMultiplier: Number.POSITIVE_INFINITY,
      missingTags,
      reason: 'capability-required',
    }
  }
  return {
    allowed: true,
    movementMultiplier: baseMovementMultiplier * structure.movementMultiplier,
    missingTags: [],
    reason: 'open',
  }
}
