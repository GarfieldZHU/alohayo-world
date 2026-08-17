import {
  DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
  stepDynamicGeomorphology,
  type DynamicGeomorphologyConfig,
  type DynamicGeomorphologyCorridor,
  type DynamicGeomorphologyForcing,
  type DynamicGeomorphologyState,
  type DynamicGeomorphologyStep,
} from './dynamic-geomorphology'

export const DYNAMIC_GEOMORPHOLOGY_EVOLUTION_SCHEMA_VERSION = 1 as const
export const DYNAMIC_GEOMORPHOLOGY_MAX_PROPOSALS = 4_096

export interface SeasonalGeomorphologyDefinition {
  yearTicks: number
  wetSeasonStart: number
  wetSeasonLength: number
  wetSeasonRainfallScale: number
  wetSeasonErosionScale: number
  drySeasonRainfallScale: number
  drySeasonErosionScale: number
}

export const DEFAULT_SEASONAL_GEOMORPHOLOGY: SeasonalGeomorphologyDefinition = {
  yearTicks: 360,
  wetSeasonStart: 90,
  wetSeasonLength: 120,
  wetSeasonRainfallScale: 255,
  wetSeasonErosionScale: 220,
  drySeasonRainfallScale: 64,
  drySeasonErosionScale: 96,
}

export interface TerrainPromotionProposal {
  cellIndex: number
  kind: 'floodplain-promotion' | 'delta-growth' | 'channel-migration'
  strength: number
}

export interface DynamicGeomorphologyEvolutionSnapshot {
  schemaVersion: typeof DYNAMIC_GEOMORPHOLOGY_EVOLUTION_SCHEMA_VERSION
  tick: number
  seasonPhase: number
  proposals: TerrainPromotionProposal[]
}

export interface SeasonalGeomorphologyStep extends DynamicGeomorphologyStep {
  forcing: DynamicGeomorphologyForcing & { rainfallScale: number; erosionScale: number }
  seasonPhase: number
  proposals: TerrainPromotionProposal[]
}

const integer = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be >= 0`)
  return value
}

function validateDefinition(definition: SeasonalGeomorphologyDefinition) {
  integer(definition.yearTicks, 'yearTicks')
  integer(definition.wetSeasonStart, 'wetSeasonStart')
  integer(definition.wetSeasonLength, 'wetSeasonLength')
  for (const [key, value] of Object.entries(definition)) {
    if (key.endsWith('Scale') && (!Number.isInteger(value) || value < 0 || value > 255)) {
      throw new RangeError(`${key} must be an integer between 0 and 255`)
    }
  }
  if (!definition.yearTicks || definition.wetSeasonStart >= definition.yearTicks) {
    throw new RangeError('season definition must fit inside yearTicks')
  }
  if (!definition.wetSeasonLength || definition.wetSeasonLength > definition.yearTicks) {
    throw new RangeError('wetSeasonLength must fit inside yearTicks')
  }
  return definition
}

export function seasonalGeomorphologyForcing(
  tick: number,
  definition: SeasonalGeomorphologyDefinition = DEFAULT_SEASONAL_GEOMORPHOLOGY
) {
  validateDefinition(definition)
  integer(tick, 'tick')
  const phase = tick % definition.yearTicks
  const wetEnd = definition.wetSeasonStart + definition.wetSeasonLength
  const inWetSeason = phase >= definition.wetSeasonStart && phase < wetEnd
  if (!inWetSeason) {
    return {
      phase,
      rainfallScale: definition.drySeasonRainfallScale,
      erosionScale: definition.drySeasonErosionScale,
    }
  }
  const progress = phase - definition.wetSeasonStart
  const midpoint = Math.max(1, Math.floor(definition.wetSeasonLength / 2))
  const envelope =
    progress <= midpoint
      ? Math.floor((progress * 255) / midpoint)
      : Math.floor(
          ((definition.wetSeasonLength - progress) * 255) /
            Math.max(1, definition.wetSeasonLength - midpoint)
        )
  const blend = Math.max(0, Math.min(255, envelope))
  const mix = (dry: number, wet: number) => Math.floor(dry + ((wet - dry) * blend) / 255)
  return {
    phase,
    rainfallScale: mix(definition.drySeasonRainfallScale, definition.wetSeasonRainfallScale),
    erosionScale: mix(definition.drySeasonErosionScale, definition.wetSeasonErosionScale),
  }
}

export function deriveTerrainPromotionProposals(args: {
  corridor: DynamicGeomorphologyCorridor
  step: DynamicGeomorphologyStep
  maxProposals?: number
}): TerrainPromotionProposal[] {
  const maxProposals = Math.min(
    DYNAMIC_GEOMORPHOLOGY_MAX_PROPOSALS,
    Math.max(0, Math.floor(args.maxProposals ?? DYNAMIC_GEOMORPHOLOGY_MAX_PROPOSALS))
  )
  const positions = new Map<number, number>()
  args.corridor.activeIndices.forEach((index, position) => positions.set(index, position))
  const proposals: TerrainPromotionProposal[] = []
  for (const cellIndex of args.step.changedCellIndices) {
    const position = positions.get(cellIndex)
    if (position === undefined) continue
    const deposited = args.step.state.deposited[position]!
    const floodplain = args.corridor.floodplain[position]!
    const depositionPotential = args.corridor.depositionPotential[position]!
    if (deposited > 0 && floodplain > 0) {
      proposals.push({
        cellIndex,
        kind:
          deposited >= 4 && depositionPotential >= 128 ? 'delta-growth' : 'floodplain-promotion',
        strength: Math.min(255, Math.floor(deposited / 4) + Math.floor(floodplain / 4)),
      })
    } else if (args.step.outletCellIndices.includes(cellIndex)) {
      proposals.push({ cellIndex, kind: 'channel-migration', strength: 64 })
    }
  }
  return proposals
    .sort((left, right) => left.cellIndex - right.cellIndex || left.kind.localeCompare(right.kind))
    .slice(0, maxProposals)
}

export function stepSeasonalGeomorphology(args: {
  corridor: DynamicGeomorphologyCorridor
  state: DynamicGeomorphologyState
  tick?: number
  season?: SeasonalGeomorphologyDefinition
  config?: DynamicGeomorphologyConfig
}): SeasonalGeomorphologyStep {
  const tick = args.tick ?? args.state.tick
  const forcing = seasonalGeomorphologyForcing(tick, args.season)
  const step = stepDynamicGeomorphology({
    corridor: args.corridor,
    state: args.state,
    config: args.config ?? DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
    forcing,
  })
  return {
    ...step,
    forcing,
    seasonPhase: forcing.phase,
    proposals: deriveTerrainPromotionProposals({ corridor: args.corridor, step }),
  }
}

export function snapshotDynamicGeomorphologyEvolution(
  step: Pick<SeasonalGeomorphologyStep, 'state' | 'seasonPhase' | 'proposals'>
): DynamicGeomorphologyEvolutionSnapshot {
  return {
    schemaVersion: DYNAMIC_GEOMORPHOLOGY_EVOLUTION_SCHEMA_VERSION,
    tick: step.state.tick,
    seasonPhase: step.seasonPhase,
    proposals: step.proposals.slice(0, DYNAMIC_GEOMORPHOLOGY_MAX_PROPOSALS),
  }
}

export function validateDynamicGeomorphologyEvolutionSnapshot(
  value: unknown
): asserts value is DynamicGeomorphologyEvolutionSnapshot {
  if (!value || typeof value !== 'object') throw new RangeError('geomorphology snapshot is invalid')
  const candidate = value as Partial<DynamicGeomorphologyEvolutionSnapshot>
  if (
    candidate.schemaVersion !== DYNAMIC_GEOMORPHOLOGY_EVOLUTION_SCHEMA_VERSION ||
    !Number.isSafeInteger(candidate.tick) ||
    (candidate.tick ?? -1) < 0 ||
    !Number.isSafeInteger(candidate.seasonPhase) ||
    (candidate.seasonPhase ?? -1) < 0 ||
    !Array.isArray(candidate.proposals) ||
    candidate.proposals.length > DYNAMIC_GEOMORPHOLOGY_MAX_PROPOSALS
  ) {
    throw new RangeError('geomorphology snapshot does not match schema version 1')
  }
  for (const proposal of candidate.proposals) {
    if (
      !proposal ||
      !Number.isSafeInteger(proposal.cellIndex) ||
      proposal.cellIndex < 0 ||
      !['floodplain-promotion', 'delta-growth', 'channel-migration'].includes(proposal.kind) ||
      !Number.isInteger(proposal.strength) ||
      proposal.strength < 0 ||
      proposal.strength > 255
    ) {
      throw new RangeError('geomorphology proposal is invalid')
    }
  }
}
