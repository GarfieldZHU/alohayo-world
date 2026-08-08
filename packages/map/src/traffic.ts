import type { WorldTrafficDefinition, WorldVehicleProfileDefinition } from '@alohayo/config'
import type { GeneratedRoad, GeneratedSettlement, GeneratedTransportStructure } from './index'
import type { RegionalWeatherSample } from './regional-weather'

export interface SettlementTrafficSnapshot {
  settlementId: string
  demand: number
  congestion: number
  maintenance: number
  supplyAccess: number
  dominantRoadId: string | null
}

export interface VehicleTraversalProfile extends WorldVehicleProfileDefinition {
  source: 'mount' | 'vehicle'
}

export const DEFAULT_TRAFFIC_SYSTEM: WorldTrafficDefinition = {
  enabled: true,
  tickSeconds: 12,
  congestionScale: 0.22,
  maintenanceScale: 0.16,
  supplyScale: 0.3,
}

export const DEFAULT_VEHICLE_PROFILES: VehicleTraversalProfile[] = [
  {
    id: 'core:pack-mount',
    kind: 'mount',
    source: 'mount',
    capabilityTags: ['traversal:mount'],
    roadKinds: ['trail', 'road', 'trade-route', 'pass'],
    speedMultiplier: 1.35,
    capacity: 2,
    maintenanceRate: 0.02,
  },
  {
    id: 'core:handcart',
    kind: 'vehicle',
    source: 'vehicle',
    capabilityTags: ['traversal:vehicle'],
    roadKinds: ['road', 'trade-route'],
    speedMultiplier: 1.12,
    capacity: 6,
    maintenanceRate: 0.034,
  },
]

function weatherModifier(weather?: RegionalWeatherSample): number {
  if (!weather) return 1
  return 1 + weather.precipitation * 0.22 + weather.accumulation * 0.12
}

/**
 * Bounded deterministic demand model for settlement diagnostics. It deliberately
 * returns aggregate values instead of spawning moving agents in the render loop.
 */
export function simulateSettlementTraffic(
  settlements: readonly GeneratedSettlement[],
  roads: readonly GeneratedRoad[],
  structures: readonly GeneratedTransportStructure[],
  tick: number,
  weather?: RegionalWeatherSample,
  config?: WorldTrafficDefinition
): SettlementTrafficSnapshot[] {
  const resolvedConfig = config ?? DEFAULT_TRAFFIC_SYSTEM
  if (!resolvedConfig.enabled) return []
  const weatherScale = weatherModifier(weather)
  return settlements
    .map((settlement) => {
      const connected = roads
        .filter(
          (road) => road.fromSettlementId === settlement.id || road.toSettlementId === settlement.id
        )
        .sort((left, right) => right.traffic - left.traffic || left.id.localeCompare(right.id))
      const dominant = connected[0] ?? null
      const structureCount = dominant
        ? structures.filter((structure) => structure.roadId === dominant.id).length
        : 0
      const pulse = 0.94 + (Math.abs(tick * 31 + settlement.id.length * 17) % 13) / 100
      const demand = Math.max(0, settlement.traffic * pulse * weatherScale)
      const congestion = Math.min(
        1,
        demand * resolvedConfig.congestionScale * (dominant ? 1 : 1.25) + structureCount * 0.04
      )
      const maintenance = Math.min(
        1,
        demand * resolvedConfig.maintenanceScale + structureCount * 0.05
      )
      const supplyAccess = Math.max(
        0,
        Math.min(1, settlement.roadAccess * (1 - congestion * resolvedConfig.supplyScale))
      )
      return {
        settlementId: settlement.id,
        demand,
        congestion,
        maintenance,
        supplyAccess,
        dominantRoadId: dominant?.id ?? null,
      }
    })
    .sort((left, right) => left.settlementId.localeCompare(right.settlementId))
}
