import { hydrologyNeighborIndex } from './hydrology'

export const DYNAMIC_GEOMORPHOLOGY_SCHEMA_VERSION = 1 as const
export const DYNAMIC_GEOMORPHOLOGY_MAX_ACTIVE_CELLS = 262_144

export interface DynamicGeomorphologyConfig {
  enabled: boolean
  erosionUnitsPerStep: number
  rainfallUnitsPerStep: number
  sedimentTransportNumerator: number
  sedimentTransportDenominator: number
  waterReleaseNumerator: number
  waterReleaseDenominator: number
}

export const DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG: DynamicGeomorphologyConfig = {
  enabled: false,
  erosionUnitsPerStep: 8,
  rainfallUnitsPerStep: 12,
  sedimentTransportNumerator: 7,
  sedimentTransportDenominator: 8,
  waterReleaseNumerator: 3,
  waterReleaseDenominator: 4,
}

export interface DynamicGeomorphologyCorridor {
  width: number
  height: number
  activeIndices: Uint32Array
  downstreamActive: Int32Array
  erosionPotential: Uint8Array
  depositionPotential: Uint8Array
  floodplain: Uint8Array
}

export interface DynamicGeomorphologyState {
  schemaVersion: typeof DYNAMIC_GEOMORPHOLOGY_SCHEMA_VERSION
  tick: number
  sediment: Uint32Array
  deposited: Uint32Array
  water: Uint32Array
}

export interface DynamicGeomorphologyForcing {
  erosionScale?: number
  rainfallScale?: number
}

export interface DynamicGeomorphologyAccounting {
  processedCells: number
  startingSedimentMass: number
  erodedMass: number
  depositedMass: number
  exportedSedimentMass: number
  retainedSedimentMass: number
  sedimentSaturationLoss: number
  sedimentResidual: number
  startingWaterMass: number
  seasonalWaterInput: number
  exportedWaterMass: number
  retainedWaterMass: number
  waterSaturationLoss: number
  waterResidual: number
}

export interface DynamicGeomorphologyStep {
  state: DynamicGeomorphologyState
  changedCellIndices: Uint32Array
  outletCellIndices: Uint32Array
  outletSediment: Uint32Array
  outletWater: Uint32Array
  accounting: DynamicGeomorphologyAccounting
}

const UINT32_MAX = 0xffff_ffff

const integerAtLeast = (value: number, minimum: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer >= ${minimum}`)
  }
  return value
}

const checkedRatio = (numerator: number, denominator: number, label: string) => {
  integerAtLeast(numerator, 0, `${label} numerator`)
  integerAtLeast(denominator, 1, `${label} denominator`)
  if (numerator > denominator) throw new RangeError(`${label} must be between zero and one`)
}

export function validateDynamicGeomorphologyConfig(config: DynamicGeomorphologyConfig) {
  integerAtLeast(config.erosionUnitsPerStep, 0, 'erosionUnitsPerStep')
  integerAtLeast(config.rainfallUnitsPerStep, 0, 'rainfallUnitsPerStep')
  checkedRatio(
    config.sedimentTransportNumerator,
    config.sedimentTransportDenominator,
    'sediment transport'
  )
  checkedRatio(config.waterReleaseNumerator, config.waterReleaseDenominator, 'water release')
  return config
}

export function createDynamicGeomorphologyCorridor(args: {
  width: number
  height: number
  activeIndices: Uint32Array
  flowDirection: Int8Array
  erosionPotential: Uint8Array
  depositionPotential: Uint8Array
  floodplain: Uint8Array
}): DynamicGeomorphologyCorridor {
  const { width, height, activeIndices, flowDirection } = args
  const size =
    integerAtLeast(width, 1, 'corridor width') * integerAtLeast(height, 1, 'corridor height')
  if (
    flowDirection.length !== size ||
    args.erosionPotential.length !== size ||
    args.depositionPotential.length !== size ||
    args.floodplain.length !== size
  ) {
    throw new RangeError('dynamic geomorphology baselines must match width * height')
  }
  if (activeIndices.length > DYNAMIC_GEOMORPHOLOGY_MAX_ACTIVE_CELLS) {
    throw new RangeError('dynamic geomorphology active-cell budget exceeded')
  }

  const activePosition = new Map<number, number>()
  for (let position = 0; position < activeIndices.length; position += 1) {
    const index = activeIndices[position]!
    if (index >= size) throw new RangeError(`active cell ${index} is outside the corridor`)
    if (activePosition.has(index)) throw new RangeError(`active cell ${index} is duplicated`)
    activePosition.set(index, position)
  }

  const downstreamActive = new Int32Array(activeIndices.length)
  downstreamActive.fill(-1)
  const erosionPotential = new Uint8Array(activeIndices.length)
  const depositionPotential = new Uint8Array(activeIndices.length)
  const floodplain = new Uint8Array(activeIndices.length)
  for (let position = 0; position < activeIndices.length; position += 1) {
    const index = activeIndices[position]!
    const downstream = hydrologyNeighborIndex(index, flowDirection[index]!, width, height)
    downstreamActive[position] = downstream < 0 ? -1 : (activePosition.get(downstream) ?? -1)
    erosionPotential[position] = args.erosionPotential[index]!
    depositionPotential[position] = args.depositionPotential[index]!
    floodplain[position] = args.floodplain[index]!
  }

  return {
    width,
    height,
    activeIndices: activeIndices.slice(),
    downstreamActive,
    erosionPotential,
    depositionPotential,
    floodplain,
  }
}

export function createDynamicGeomorphologyState(
  corridor: DynamicGeomorphologyCorridor
): DynamicGeomorphologyState {
  return {
    schemaVersion: DYNAMIC_GEOMORPHOLOGY_SCHEMA_VERSION,
    tick: 0,
    sediment: new Uint32Array(corridor.activeIndices.length),
    deposited: new Uint32Array(corridor.activeIndices.length),
    water: new Uint32Array(corridor.activeIndices.length),
  }
}

const addBounded = (target: Uint32Array, index: number, amount: number) => {
  const available = UINT32_MAX - target[index]!
  const accepted = Math.min(available, amount)
  target[index] = target[index]! + accepted
  return amount - accepted
}

const sum = (values: Uint32Array) => {
  let total = 0
  for (const value of values) total += value
  return total
}

const scaledUnits = (units: number, scale: number | undefined, label: string) => {
  const normalizedScale = scale ?? 255
  integerAtLeast(normalizedScale, 0, label)
  if (normalizedScale > 255) throw new RangeError(`${label} must be <= 255`)
  return Math.floor((units * normalizedScale) / 255)
}

export function stepDynamicGeomorphology(args: {
  corridor: DynamicGeomorphologyCorridor
  state: DynamicGeomorphologyState
  config?: DynamicGeomorphologyConfig
  forcing?: DynamicGeomorphologyForcing
}): DynamicGeomorphologyStep {
  const config = validateDynamicGeomorphologyConfig(
    args.config ?? DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG
  )
  const { corridor, state } = args
  const count = corridor.activeIndices.length
  if (
    state.schemaVersion !== DYNAMIC_GEOMORPHOLOGY_SCHEMA_VERSION ||
    state.sediment.length !== count ||
    state.deposited.length !== count ||
    state.water.length !== count
  ) {
    throw new RangeError('dynamic geomorphology state does not match its corridor')
  }
  if (!config.enabled) {
    return {
      state,
      changedCellIndices: new Uint32Array(),
      outletCellIndices: new Uint32Array(),
      outletSediment: new Uint32Array(),
      outletWater: new Uint32Array(),
      accounting: {
        processedCells: 0,
        startingSedimentMass: sum(state.sediment) + sum(state.deposited),
        erodedMass: 0,
        depositedMass: 0,
        exportedSedimentMass: 0,
        retainedSedimentMass: sum(state.sediment) + sum(state.deposited),
        sedimentSaturationLoss: 0,
        sedimentResidual: 0,
        startingWaterMass: sum(state.water),
        seasonalWaterInput: 0,
        exportedWaterMass: 0,
        retainedWaterMass: sum(state.water),
        waterSaturationLoss: 0,
        waterResidual: 0,
      },
    }
  }

  const nextSediment = new Uint32Array(count)
  const nextDeposited = state.deposited.slice()
  const nextWater = new Uint32Array(count)
  const outletIndices: number[] = []
  const outletSediment: number[] = []
  const outletWater: number[] = []
  const changed: number[] = []
  const erosionUnits = scaledUnits(
    config.erosionUnitsPerStep,
    args.forcing?.erosionScale,
    'erosionScale'
  )
  const rainfallUnits = scaledUnits(
    config.rainfallUnitsPerStep,
    args.forcing?.rainfallScale,
    'rainfallScale'
  )
  let erodedMass = 0
  let depositedMass = 0
  let exportedSedimentMass = 0
  let exportedWaterMass = 0
  let seasonalWaterInput = 0
  let sedimentSaturationLoss = 0
  let waterSaturationLoss = 0

  for (let position = 0; position < count; position += 1) {
    const erosion = Math.floor((corridor.erosionPotential[position]! * erosionUnits) / 255)
    erodedMass += erosion
    const availableSediment = state.sediment[position]! + erosion
    const localDeposit = Math.floor(
      (availableSediment *
        corridor.depositionPotential[position]! *
        (config.sedimentTransportDenominator - config.sedimentTransportNumerator)) /
        (255 * config.sedimentTransportDenominator)
    )
    depositedMass += localDeposit
    sedimentSaturationLoss += addBounded(nextDeposited, position, localDeposit)
    const transportedSediment = availableSediment - localDeposit

    const rainfall = corridor.floodplain[position] ? rainfallUnits : 0
    seasonalWaterInput += rainfall
    const availableWater = state.water[position]! + rainfall
    const releasedWater = Math.floor(
      (availableWater * config.waterReleaseNumerator) / config.waterReleaseDenominator
    )
    const retainedWater = availableWater - releasedWater
    waterSaturationLoss += addBounded(nextWater, position, retainedWater)

    const downstream = corridor.downstreamActive[position]!
    if (downstream >= 0) {
      sedimentSaturationLoss += addBounded(nextSediment, downstream, transportedSediment)
      waterSaturationLoss += addBounded(nextWater, downstream, releasedWater)
    } else {
      outletIndices.push(corridor.activeIndices[position]!)
      const boundedSediment = Math.min(UINT32_MAX, transportedSediment)
      const boundedWater = Math.min(UINT32_MAX, releasedWater)
      outletSediment.push(boundedSediment)
      outletWater.push(boundedWater)
      exportedSedimentMass += boundedSediment
      exportedWaterMass += boundedWater
      sedimentSaturationLoss += transportedSediment - boundedSediment
      waterSaturationLoss += releasedWater - boundedWater
    }
  }

  for (let position = 0; position < count; position += 1) {
    if (
      nextSediment[position] !== state.sediment[position] ||
      nextDeposited[position] !== state.deposited[position] ||
      nextWater[position] !== state.water[position]
    ) {
      changed.push(corridor.activeIndices[position]!)
    }
  }

  const startingSedimentMass = sum(state.sediment) + sum(state.deposited)
  const retainedSedimentMass = sum(nextSediment) + sum(nextDeposited)
  const startingWaterMass = sum(state.water)
  const retainedWaterMass = sum(nextWater)
  return {
    state: {
      schemaVersion: DYNAMIC_GEOMORPHOLOGY_SCHEMA_VERSION,
      tick: state.tick + 1,
      sediment: nextSediment,
      deposited: nextDeposited,
      water: nextWater,
    },
    changedCellIndices: Uint32Array.from(changed),
    outletCellIndices: Uint32Array.from(outletIndices),
    outletSediment: Uint32Array.from(outletSediment),
    outletWater: Uint32Array.from(outletWater),
    accounting: {
      processedCells: count,
      startingSedimentMass,
      erodedMass,
      depositedMass,
      exportedSedimentMass,
      retainedSedimentMass,
      sedimentSaturationLoss,
      sedimentResidual:
        startingSedimentMass +
        erodedMass -
        exportedSedimentMass -
        retainedSedimentMass -
        sedimentSaturationLoss,
      startingWaterMass,
      seasonalWaterInput,
      exportedWaterMass,
      retainedWaterMass,
      waterSaturationLoss,
      waterResidual:
        startingWaterMass +
        seasonalWaterInput -
        exportedWaterMass -
        retainedWaterMass -
        waterSaturationLoss,
    },
  }
}
