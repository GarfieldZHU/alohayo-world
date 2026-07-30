import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
  createDynamicGeomorphologyCorridor,
  createDynamicGeomorphologyState,
  stepDynamicGeomorphology,
} from '../packages/map/src'

const createFixture = () => {
  const flowDirection = Int8Array.from([0, 0, 0, -1, -1, -1, -1, -1])
  return createDynamicGeomorphologyCorridor({
    width: 4,
    height: 2,
    activeIndices: Uint32Array.from([0, 1, 2, 3]),
    flowDirection,
    erosionPotential: Uint8Array.from([255, 192, 96, 32, 0, 0, 0, 0]),
    depositionPotential: Uint8Array.from([0, 64, 128, 255, 0, 0, 0, 0]),
    floodplain: Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 0]),
  })
}

const enabledConfig = {
  ...DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
  enabled: true,
}

describe('dynamic geomorphology phase-zero kernel', () => {
  it('is byte-deterministic and conserves integer water and sediment mass', () => {
    const corridor = createFixture()
    const state = createDynamicGeomorphologyState(corridor)
    const first = stepDynamicGeomorphology({ corridor, state, config: enabledConfig })
    const repeated = stepDynamicGeomorphology({ corridor, state, config: enabledConfig })

    expect(first.state).toEqual(repeated.state)
    expect(first.changedCellIndices).toEqual(repeated.changedCellIndices)
    expect(first.outletCellIndices).toEqual(repeated.outletCellIndices)
    expect(first.outletSediment).toEqual(repeated.outletSediment)
    expect(first.outletWater).toEqual(repeated.outletWater)
    expect(first.accounting).toEqual(repeated.accounting)
    expect(first.accounting.sedimentResidual).toBe(0)
    expect(first.accounting.waterResidual).toBe(0)
    expect(first.accounting.processedCells).toBe(corridor.activeIndices.length)
  })

  it('converges after pause/resume because the explicit state owns the tick', () => {
    const corridor = createFixture()
    const initial = createDynamicGeomorphologyState(corridor)
    let uninterrupted = initial
    for (let step = 0; step < 4; step += 1) {
      uninterrupted = stepDynamicGeomorphology({
        corridor,
        state: uninterrupted,
        config: enabledConfig,
      }).state
    }

    const pausedAfterTwo = stepDynamicGeomorphology({
      corridor,
      state: stepDynamicGeomorphology({
        corridor,
        state: initial,
        config: enabledConfig,
      }).state,
      config: enabledConfig,
    }).state
    let resumed = pausedAfterTwo
    for (let step = 0; step < 2; step += 1) {
      resumed = stepDynamicGeomorphology({
        corridor,
        state: resumed,
        config: enabledConfig,
      }).state
    }

    expect(resumed).toEqual(uninterrupted)
    expect(resumed.tick).toBe(4)
  })

  it('keeps the static fallback inert and scans no active cells', () => {
    const corridor = createFixture()
    const state = createDynamicGeomorphologyState(corridor)
    state.sediment[1] = 17
    state.water[2] = 9
    const result = stepDynamicGeomorphology({ corridor, state })

    expect(result.state).toBe(state)
    expect(result.state.tick).toBe(0)
    expect(result.changedCellIndices).toHaveLength(0)
    expect(result.accounting.processedCells).toBe(0)
    expect(result.accounting.sedimentResidual).toBe(0)
    expect(result.accounting.waterResidual).toBe(0)
  })

  it('scales work with the active corridor and emits provisional local outlets', () => {
    const width = 64
    const height = 64
    const size = width * height
    const activeIndices = Uint32Array.from({ length: 32 }, (_, index) => index)
    const flowDirection = new Int8Array(size)
    flowDirection.fill(-1)
    for (let index = 0; index < activeIndices.length - 1; index += 1) {
      flowDirection[index] = 0
    }
    const corridor = createDynamicGeomorphologyCorridor({
      width,
      height,
      activeIndices,
      flowDirection,
      erosionPotential: new Uint8Array(size).fill(128),
      depositionPotential: new Uint8Array(size).fill(64),
      floodplain: new Uint8Array(size).fill(255),
    })
    const result = stepDynamicGeomorphology({
      corridor,
      state: createDynamicGeomorphologyState(corridor),
      config: enabledConfig,
    })

    expect(result.accounting.processedCells).toBe(32)
    expect(result.accounting.processedCells).toBeLessThan(size / 100)
    expect(result.outletCellIndices).toEqual(Uint32Array.from([31]))
    expect(result.accounting.sedimentResidual).toBe(0)
    expect(result.accounting.waterResidual).toBe(0)
  })

  it('rejects duplicate active cells before a simulation can diverge', () => {
    expect(() =>
      createDynamicGeomorphologyCorridor({
        width: 2,
        height: 2,
        activeIndices: Uint32Array.from([0, 0]),
        flowDirection: new Int8Array(4),
        erosionPotential: new Uint8Array(4),
        depositionPotential: new Uint8Array(4),
        floodplain: new Uint8Array(4),
      })
    ).toThrow(/duplicated/)
  })
})
