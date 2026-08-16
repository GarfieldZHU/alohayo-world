import { describe, expect, it } from 'vitest'
import {
  createDynamicGeomorphologyCorridor,
  createDynamicGeomorphologyState,
  DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
  seasonalGeomorphologyForcing,
  snapshotDynamicGeomorphologyEvolution,
  stepSeasonalGeomorphology,
  validateDynamicGeomorphologyEvolutionSnapshot,
} from '@alohayo/map'

function corridor() {
  return createDynamicGeomorphologyCorridor({
    width: 4,
    height: 1,
    activeIndices: new Uint32Array([0, 1, 2, 3]),
    flowDirection: new Int8Array([1, 1, 1, -1]),
    erosionPotential: new Uint8Array([255, 255, 255, 255]),
    depositionPotential: new Uint8Array([0, 0, 255, 255]),
    floodplain: new Uint8Array([255, 255, 255, 255]),
  })
}

describe('seasonal geomorphology evolution', () => {
  it('replays integer seasonal forcing and wraps by year', () => {
    const definition = {
      yearTicks: 20,
      wetSeasonStart: 5,
      wetSeasonLength: 10,
      wetSeasonRainfallScale: 255,
      wetSeasonErosionScale: 220,
      drySeasonRainfallScale: 20,
      drySeasonErosionScale: 40,
    }
    expect(seasonalGeomorphologyForcing(5, definition)).toEqual({
      phase: 5,
      rainfallScale: 20,
      erosionScale: 40,
    })
    expect(seasonalGeomorphologyForcing(10, definition).rainfallScale).toBe(255)
    expect(seasonalGeomorphologyForcing(25, definition)).toEqual(
      seasonalGeomorphologyForcing(5, definition)
    )
  })

  it('keeps accounting exact while emitting bounded promotion proposals', () => {
    const state = createDynamicGeomorphologyState(corridor())
    const result = stepSeasonalGeomorphology({
      corridor: corridor(),
      state,
      config: { ...DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG, enabled: true },
      tick: 180,
    })
    expect(result.accounting.sedimentResidual).toBe(0)
    expect(result.accounting.waterResidual).toBe(0)
    expect(result.proposals.every((proposal) => proposal.strength <= 255)).toBe(true)
    const snapshot = snapshotDynamicGeomorphologyEvolution(result)
    expect(() => validateDynamicGeomorphologyEvolutionSnapshot(snapshot)).not.toThrow()
  })
})
