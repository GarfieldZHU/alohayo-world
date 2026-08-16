import type { GeneratedRoad, GeneratedSettlement } from './index'
import {
  DEFAULT_TRAFFIC_SYSTEM,
  DEFAULT_VEHICLE_PROFILES,
  simulateSettlementTraffic,
  type VehicleTraversalProfile,
} from './traffic'
import type { RegionalWeatherSample } from './regional-weather'
import type { WorldTrafficDefinition } from '@alohayo/config'

export const SETTLEMENT_AGENT_SCHEMA_VERSION = 1 as const
export const SETTLEMENT_AGENT_MAX_PER_CHUNK = 256

export interface SettlementAgentBudget {
  maxAgents: number
  spawnScale: number
  maxStepsPerTick: number
}

export const DEFAULT_SETTLEMENT_AGENT_BUDGET: SettlementAgentBudget = {
  maxAgents: 64,
  spawnScale: 0.35,
  maxStepsPerTick: 1,
}

export interface SettlementAgent {
  id: string
  originSettlementId: string
  destinationSettlementId: string
  routeRoadIds: string[]
  routeIndex: number
  progress: number
  vehicleProfileId: string
  cargo: number
  state: 'traveling' | 'arrived' | 'waiting'
}

export interface SettlementAgentBatchSnapshot {
  schemaVersion: typeof SETTLEMENT_AGENT_SCHEMA_VERSION
  tick: number
  agents: SettlementAgent[]
}

function boundedInteger(value: number, label: string, max?: number) {
  if (!Number.isSafeInteger(value) || value < 0 || (max !== undefined && value > max)) {
    throw new RangeError(`${label} must be a bounded non-negative integer`)
  }
  return value
}

function chooseProfile(index: number, profiles: readonly VehicleTraversalProfile[]) {
  return profiles[index % profiles.length] ?? DEFAULT_VEHICLE_PROFILES[0]!
}

function routeFor(settlement: GeneratedSettlement, roads: readonly GeneratedRoad[]) {
  return roads
    .filter(
      (road) => road.fromSettlementId === settlement.id || road.toSettlementId === settlement.id
    )
    .sort((left, right) => right.traffic - left.traffic || left.id.localeCompare(right.id))
    .map((road) => ({
      road,
      destinationSettlementId:
        road.fromSettlementId === settlement.id ? road.toSettlementId : road.fromSettlementId,
    }))
}

function validateBudget(budget: SettlementAgentBudget) {
  if (!Number.isFinite(budget.spawnScale) || budget.spawnScale < 0 || budget.spawnScale > 1) {
    throw new RangeError('settlement agent spawnScale must be between zero and one')
  }
  boundedInteger(budget.maxAgents, 'settlement agent maxAgents', SETTLEMENT_AGENT_MAX_PER_CHUNK)
  boundedInteger(budget.maxStepsPerTick, 'settlement agent maxStepsPerTick', 8)
  return budget
}

/** Creates bounded, deterministic route-choice agents. No renderer state is touched. */
export function createSettlementAgents(args: {
  settlements: readonly GeneratedSettlement[]
  roads: readonly GeneratedRoad[]
  tick: number
  weather?: RegionalWeatherSample
  traffic?: WorldTrafficDefinition
  budget?: SettlementAgentBudget
  profiles?: readonly VehicleTraversalProfile[]
}): SettlementAgent[] {
  const budget = validateBudget(args.budget ?? DEFAULT_SETTLEMENT_AGENT_BUDGET)
  boundedInteger(args.tick, 'settlement agent tick')
  const profiles = args.profiles?.length ? args.profiles : DEFAULT_VEHICLE_PROFILES
  const snapshots = simulateSettlementTraffic(
    args.settlements,
    args.roads,
    [],
    args.tick,
    args.weather,
    args.traffic ?? DEFAULT_TRAFFIC_SYSTEM
  )
  const settlementById = new Map(args.settlements.map((settlement) => [settlement.id, settlement]))
  const agents: SettlementAgent[] = []
  for (const snapshot of snapshots) {
    if (agents.length >= budget.maxAgents) break
    const settlement = settlementById.get(snapshot.settlementId)
    if (!settlement) continue
    const routes = routeFor(settlement, args.roads)
    const count = Math.min(
      budget.maxAgents - agents.length,
      Math.max(0, Math.floor(snapshot.demand * budget.spawnScale))
    )
    for (let index = 0; index < count; index += 1) {
      const route = routes[index % Math.max(1, routes.length)]
      if (!route) break
      const profile = chooseProfile(index, profiles)
      agents.push({
        id: `agent:${snapshot.settlementId}:${route.destinationSettlementId}:${index}`,
        originSettlementId: snapshot.settlementId,
        destinationSettlementId: route.destinationSettlementId,
        routeRoadIds: [route.road.id],
        routeIndex: 0,
        progress: 0,
        vehicleProfileId: profile.id,
        cargo: Math.min(profile.capacity, Math.max(0, Math.floor(snapshot.demand))),
        state: snapshot.congestion > 0.85 ? 'waiting' : 'traveling',
      })
    }
  }
  return agents.sort((left, right) => left.id.localeCompare(right.id))
}

export function stepSettlementAgents(args: {
  agents: readonly SettlementAgent[]
  tick: number
  weather?: RegionalWeatherSample
  profiles?: readonly VehicleTraversalProfile[]
  budget?: SettlementAgentBudget
}): SettlementAgent[] {
  const budget = validateBudget(args.budget ?? DEFAULT_SETTLEMENT_AGENT_BUDGET)
  boundedInteger(args.tick, 'settlement agent tick')
  const profiles = args.profiles?.length ? args.profiles : DEFAULT_VEHICLE_PROFILES
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const disruption = args.weather
    ? Math.max(0.25, 1 - args.weather.precipitation * 0.35 - args.weather.accumulation * 0.15)
    : 1
  return args.agents.slice(0, budget.maxAgents).map((agent) => {
    const profile = profileById.get(agent.vehicleProfileId) ?? profiles[0]!
    const speed = Math.max(1, Math.floor(profile.speedMultiplier * disruption * 100))
    const steps = Math.min(budget.maxStepsPerTick, agent.state === 'waiting' ? 0 : 1)
    const progress = Math.min(1000, agent.progress + speed * steps)
    return {
      ...agent,
      progress,
      state: progress >= 1000 ? 'arrived' : agent.state === 'waiting' ? 'traveling' : agent.state,
    }
  })
}

export function snapshotSettlementAgents(
  tick: number,
  agents: readonly SettlementAgent[]
): SettlementAgentBatchSnapshot {
  boundedInteger(tick, 'settlement agent tick')
  return {
    schemaVersion: SETTLEMENT_AGENT_SCHEMA_VERSION,
    tick,
    agents: agents.slice(0, SETTLEMENT_AGENT_MAX_PER_CHUNK).map((agent) => ({
      ...agent,
      routeRoadIds: agent.routeRoadIds.slice(),
    })),
  }
}

export function validateSettlementAgentSnapshot(
  value: unknown
): asserts value is SettlementAgentBatchSnapshot {
  if (!value || typeof value !== 'object')
    throw new RangeError('settlement agent snapshot is invalid')
  const candidate = value as Partial<SettlementAgentBatchSnapshot>
  if (
    candidate.schemaVersion !== SETTLEMENT_AGENT_SCHEMA_VERSION ||
    !Number.isSafeInteger(candidate.tick) ||
    (candidate.tick ?? -1) < 0 ||
    !Array.isArray(candidate.agents) ||
    candidate.agents.length > SETTLEMENT_AGENT_MAX_PER_CHUNK
  ) {
    throw new RangeError('settlement agent snapshot does not match schema version 1')
  }
  const ids = new Set<string>()
  for (const agent of candidate.agents) {
    if (
      !agent ||
      typeof agent.id !== 'string' ||
      ids.has(agent.id) ||
      typeof agent.originSettlementId !== 'string' ||
      typeof agent.destinationSettlementId !== 'string' ||
      !Array.isArray(agent.routeRoadIds) ||
      agent.routeRoadIds.some((roadId) => typeof roadId !== 'string') ||
      !['traveling', 'arrived', 'waiting'].includes(agent.state) ||
      !Number.isSafeInteger(agent.progress) ||
      agent.progress < 0 ||
      agent.progress > 1000 ||
      !Number.isSafeInteger(agent.routeIndex) ||
      agent.routeIndex < 0 ||
      !Number.isSafeInteger(agent.cargo) ||
      agent.cargo < 0
    ) {
      throw new RangeError('settlement agent snapshot contains an invalid agent')
    }
    ids.add(agent.id)
  }
}
