import { describe, expect, it } from 'vitest'
import {
  createSettlementAgents,
  snapshotSettlementAgents,
  stepSettlementAgents,
  validateSettlementAgentSnapshot,
  type GeneratedRoad,
  type GeneratedSettlement,
} from '@alohayo/map'

const settlements: GeneratedSettlement[] = [
  {
    id: 'a',
    name: 'A',
    kind: 'town',
    x: 0,
    y: 0,
    biome: 7,
    population: 120,
    traffic: 8,
    creatureTags: [],
    roadAccess: 0.8,
  },
  {
    id: 'b',
    name: 'B',
    kind: 'village',
    x: 8,
    y: 0,
    biome: 8,
    population: 80,
    traffic: 5,
    creatureTags: [],
    roadAccess: 0.7,
  },
]

const roads: GeneratedRoad[] = [
  {
    id: 'road:a::b',
    kind: 'road',
    traffic: 6,
    fromSettlementId: 'a',
    toSettlementId: 'b',
    points: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ],
  },
]

describe('bounded settlement agents', () => {
  it('creates stable route choices with a hard per-chunk budget', () => {
    const first = createSettlementAgents({
      settlements,
      roads,
      tick: 4,
      budget: { maxAgents: 2, spawnScale: 1, maxStepsPerTick: 1 },
    })
    const second = createSettlementAgents({
      settlements: [...settlements].reverse(),
      roads: [...roads].reverse(),
      tick: 4,
      budget: { maxAgents: 2, spawnScale: 1, maxStepsPerTick: 1 },
    })
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first.every((agent) => agent.routeRoadIds.length === 1)).toBe(true)
  })

  it('steps and validates save-safe aggregate state', () => {
    const agents = createSettlementAgents({ settlements, roads, tick: 0 })
    const moved = stepSettlementAgents({ agents, tick: 1 })
    expect(moved[0]?.state).toBe('traveling')
    const advanced = stepSettlementAgents({ agents: moved, tick: 2 })
    expect(advanced[0]?.progress).toBeGreaterThan(moved[0]?.progress ?? -1)
    const snapshot = snapshotSettlementAgents(2, advanced)
    expect(() => validateSettlementAgentSnapshot(snapshot)).not.toThrow()
  })
})
