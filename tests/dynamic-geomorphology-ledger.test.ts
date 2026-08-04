import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG,
  DynamicGeomorphologyLedger,
  DynamicGeomorphologyLedgerError,
  createDynamicGeomorphologyCorridor,
  createDynamicGeomorphologyState,
  stepDynamicGeomorphology,
  type DynamicGeomorphologyHandoff,
  type TopologyChangeEvent,
} from '../packages/map/src'

const identity = (cellIndex: number) => `topology:0,0:${cellIndex + 1}`

const createStep = () => {
  const corridor = createDynamicGeomorphologyCorridor({
    width: 3,
    height: 1,
    activeIndices: Uint32Array.from([0, 1, 2]),
    flowDirection: Int8Array.from([0, 0, -1]),
    erosionPotential: Uint8Array.from([255, 128, 0]),
    depositionPotential: Uint8Array.from([0, 64, 255]),
    floodplain: Uint8Array.from([255, 255, 255]),
  })
  return stepDynamicGeomorphology({
    corridor,
    state: createDynamicGeomorphologyState(corridor),
    config: { ...DEFAULT_DYNAMIC_GEOMORPHOLOGY_CONFIG, enabled: true },
  })
}

describe('dynamic geomorphology canonical handoff ledger', () => {
  it('aggregates a tick deterministically regardless of chunk load order', () => {
    const handoffs: DynamicGeomorphologyHandoff[] = [
      { identityId: 'topology:1,0:7', sediment: 3, water: 5 },
      { identityId: 'topology:0,0:4', sediment: 11, water: 2 },
      { identityId: 'topology:1,0:7', sediment: 9, water: 1 },
    ]
    const first = new DynamicGeomorphologyLedger()
    const second = new DynamicGeomorphologyLedger()

    first.ingest(handoffs, 8)
    second.ingest([handoffs[2]!, handoffs[0]!, handoffs[1]!], 8)

    expect(first.snapshot()).toEqual(second.snapshot())
    expect(first.get('topology:1,0:7')).toEqual({
      identityId: 'topology:1,0:7',
      sediment: 12,
      water: 6,
      lastTick: 8,
    })
  })

  it('resolves phase-zero outlets and rejects an unresolved batch atomically', () => {
    const step = createStep()
    const ledger = new DynamicGeomorphologyLedger()
    ledger.ingestStep(step, identity)
    const committed = ledger.snapshot()

    expect(() =>
      ledger.ingestStep(step, (cellIndex) => (cellIndex === 2 ? null : identity(cellIndex)))
    ).toThrow(DynamicGeomorphologyLedgerError)
    expect(ledger.snapshot()).toEqual(committed)
  })

  it('folds topology aliases into the canonical corridor identity', () => {
    const ledger = new DynamicGeomorphologyLedger()
    ledger.ingest(
      [
        { identityId: 'topology:0,0:1', sediment: 4, water: 2 },
        { identityId: 'topology:1,0:1', sediment: 6, water: 8 },
      ],
      3
    )
    const event: TopologyChangeEvent = {
      type: 'merge',
      revision: 4,
      canonicalId: 'topology:0,0:1',
      aliases: ['topology:1,0:1'],
      medium: 'land',
    }

    ledger.applyTopologyEvent(event)

    expect(ledger.entries()).toEqual([
      { identityId: 'topology:0,0:1', sediment: 10, water: 10, lastTick: 4 },
    ])
  })

  it('supports eviction and rehydration without changing serialized state', () => {
    const ledger = new DynamicGeomorphologyLedger()
    ledger.ingest([{ identityId: 'topology:0,0:2', sediment: 7, water: 13 }], 2)
    const snapshot = ledger.snapshot()
    const removed = ledger.evict(['topology:0,0:2'])

    expect(removed).toEqual([{ identityId: 'topology:0,0:2', sediment: 7, water: 13, lastTick: 2 }])
    expect(ledger.entries()).toEqual([])
    ledger.rehydrate(snapshot)
    expect(ledger.snapshot()).toEqual(snapshot)
  })

  it('bounds work per tick and rejects non-canonical identities', () => {
    const ledger = new DynamicGeomorphologyLedger()
    expect(() => ledger.ingest([{ identityId: 'local-outlet', sediment: 1, water: 1 }], 1)).toThrow(
      DynamicGeomorphologyLedgerError
    )
    expect(() =>
      ledger.ingest(
        new Array(16_385).fill({ identityId: 'topology:0,0:1', sediment: 1, water: 1 }),
        1
      )
    ).toThrow(/per-tick handoff budget/)
  })
})
