import { TOPOLOGY_RESOLVER_VERSION, type TopologyChangeEvent } from './topology'
import type { DynamicGeomorphologyStep } from './dynamic-geomorphology'

export const DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION = 1 as const
export const DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_ENTRIES = 16_384
export const DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_HANDOFFS_PER_TICK = 16_384
export const DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_BYTES = 512 * 1024

const UINT32_MAX = 0xffff_ffff

export interface DynamicGeomorphologyHandoff {
  identityId: string
  sediment: number
  water: number
}

export interface DynamicGeomorphologyLedgerEntry extends DynamicGeomorphologyHandoff {
  lastTick: number
}

export interface DynamicGeomorphologyLedgerSnapshot {
  schemaVersion: typeof DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION
  resolverVersion: string
  tick: number
  entries: DynamicGeomorphologyLedgerEntry[]
}

export interface DynamicGeomorphologyLedgerStats {
  tick: number
  entries: number
  serializedBytes: number
  sediment: number
  water: number
}

export type DynamicGeomorphologyLedgerErrorCode =
  | 'corrupt'
  | 'incompatible-version'
  | 'budget-exceeded'
  | 'unresolved-identity'

export class DynamicGeomorphologyLedgerError extends Error {
  constructor(
    readonly code: DynamicGeomorphologyLedgerErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'DynamicGeomorphologyLedgerError'
  }
}

const assertInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DynamicGeomorphologyLedgerError('corrupt', `${label} must be a safe integer >= 0`)
  }
  return value
}

const assertMass = (value: number, label: string) => {
  assertInteger(value, label)
  if (value > UINT32_MAX) {
    throw new DynamicGeomorphologyLedgerError('corrupt', `${label} exceeds uint32 capacity`)
  }
  return value
}

const assertIdentity = (identityId: string) => {
  if (typeof identityId !== 'string' || !identityId.startsWith('topology:')) {
    throw new DynamicGeomorphologyLedgerError(
      'unresolved-identity',
      `dynamic handoff identity is not canonical: ${String(identityId)}`
    )
  }
  return identityId
}

const addMass = (left: number, right: number, label: string) => {
  if (right > UINT32_MAX - left) {
    throw new DynamicGeomorphologyLedgerError(
      'budget-exceeded',
      `${label} exceeds uint32 capacity in the dynamic corridor ledger`
    )
  }
  return left + right
}

export function dynamicGeomorphologyLedgerBytes(snapshot: DynamicGeomorphologyLedgerSnapshot) {
  return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength
}

export function validateDynamicGeomorphologyLedgerSnapshot(
  value: unknown
): asserts value is DynamicGeomorphologyLedgerSnapshot {
  if (!value || typeof value !== 'object') {
    throw new DynamicGeomorphologyLedgerError(
      'corrupt',
      'dynamic corridor ledger must be an object'
    )
  }
  const candidate = value as Partial<DynamicGeomorphologyLedgerSnapshot>
  if (candidate.schemaVersion !== DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION) {
    throw new DynamicGeomorphologyLedgerError(
      'incompatible-version',
      `dynamic corridor ledger schema ${String(candidate.schemaVersion)} is not supported`
    )
  }
  if (candidate.resolverVersion !== TOPOLOGY_RESOLVER_VERSION) {
    throw new DynamicGeomorphologyLedgerError(
      'incompatible-version',
      `dynamic corridor resolver ${String(candidate.resolverVersion)} is not supported`
    )
  }
  assertInteger(candidate.tick ?? -1, 'ledger tick')
  if (!Array.isArray(candidate.entries)) {
    throw new DynamicGeomorphologyLedgerError(
      'corrupt',
      'dynamic corridor ledger entries must be an array'
    )
  }
  if (candidate.entries.length > DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_ENTRIES) {
    throw new DynamicGeomorphologyLedgerError(
      'budget-exceeded',
      'dynamic corridor entry budget exceeded'
    )
  }
  const identities = new Set<string>()
  for (const entry of candidate.entries) {
    if (!entry || typeof entry !== 'object') {
      throw new DynamicGeomorphologyLedgerError(
        'corrupt',
        'dynamic corridor ledger entry is invalid'
      )
    }
    const identityId = assertIdentity(entry.identityId)
    if (identities.has(identityId)) {
      throw new DynamicGeomorphologyLedgerError(
        'corrupt',
        `duplicate dynamic identity ${identityId}`
      )
    }
    identities.add(identityId)
    assertMass(entry.sediment, `${identityId} sediment`)
    assertMass(entry.water, `${identityId} water`)
    assertInteger(entry.lastTick, `${identityId} lastTick`)
  }
  if (
    dynamicGeomorphologyLedgerBytes(candidate as DynamicGeomorphologyLedgerSnapshot) >
    DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_BYTES
  ) {
    throw new DynamicGeomorphologyLedgerError(
      'budget-exceeded',
      'dynamic corridor ledger byte budget exceeded'
    )
  }
}

const emptySnapshot = (): DynamicGeomorphologyLedgerSnapshot => ({
  schemaVersion: DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION,
  resolverVersion: TOPOLOGY_RESOLVER_VERSION,
  tick: 0,
  entries: [],
})

/**
 * Stores only canonical cross-chunk handoffs. The active corridor kernel stays local;
 * callers batch all outlets for a tick, resolve identities through ChunkTopologyResolver,
 * then commit the batch atomically. This makes chunk load order irrelevant and leaves
 * unresolved/provisional outlets retryable instead of silently dropping mass.
 */
export class DynamicGeomorphologyLedger {
  private readonly values = new Map<string, DynamicGeomorphologyLedgerEntry>()
  private tickValue = 0

  constructor(snapshot?: DynamicGeomorphologyLedgerSnapshot) {
    if (snapshot) this.rehydrate(snapshot)
  }

  get tick() {
    return this.tickValue
  }

  get(identityId: string) {
    const entry = this.values.get(assertIdentity(identityId))
    return entry ? { ...entry } : null
  }

  entries() {
    return Array.from(this.values.values())
      .sort((left, right) => left.identityId.localeCompare(right.identityId))
      .map((entry) => ({ ...entry }))
  }

  ingest(handoffs: readonly DynamicGeomorphologyHandoff[], tick: number) {
    assertInteger(tick, 'handoff tick')
    if (tick < this.tickValue) {
      throw new DynamicGeomorphologyLedgerError(
        'corrupt',
        `handoff tick ${tick} precedes ledger tick ${this.tickValue}`
      )
    }
    if (handoffs.length > DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_HANDOFFS_PER_TICK) {
      throw new DynamicGeomorphologyLedgerError(
        'budget-exceeded',
        'dynamic corridor per-tick handoff budget exceeded'
      )
    }

    const grouped = new Map<string, DynamicGeomorphologyHandoff>()
    for (const handoff of handoffs) {
      const identityId = assertIdentity(handoff.identityId)
      assertMass(handoff.sediment, `${identityId} sediment`)
      assertMass(handoff.water, `${identityId} water`)
      const previous = grouped.get(identityId)
      if (!previous) {
        grouped.set(identityId, { identityId, sediment: handoff.sediment, water: handoff.water })
      } else {
        previous.sediment = addMass(previous.sediment, handoff.sediment, `${identityId} sediment`)
        previous.water = addMass(previous.water, handoff.water, `${identityId} water`)
      }
    }

    const next = new Map(this.values)
    for (const handoff of grouped.values()) {
      const previous = next.get(handoff.identityId)
      if (!previous) {
        if (next.size >= DYNAMIC_GEOMORPHOLOGY_LEDGER_MAX_ENTRIES) {
          throw new DynamicGeomorphologyLedgerError(
            'budget-exceeded',
            'dynamic corridor entry budget exceeded'
          )
        }
        next.set(handoff.identityId, { ...handoff, lastTick: tick })
      } else {
        next.set(handoff.identityId, {
          identityId: handoff.identityId,
          sediment: addMass(previous.sediment, handoff.sediment, `${handoff.identityId} sediment`),
          water: addMass(previous.water, handoff.water, `${handoff.identityId} water`),
          lastTick: Math.max(previous.lastTick, tick),
        })
      }
    }
    const snapshot: DynamicGeomorphologyLedgerSnapshot = {
      schemaVersion: DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION,
      resolverVersion: TOPOLOGY_RESOLVER_VERSION,
      tick,
      entries: Array.from(next.values()).sort((left, right) =>
        left.identityId.localeCompare(right.identityId)
      ),
    }
    validateDynamicGeomorphologyLedgerSnapshot(snapshot)
    this.values.clear()
    for (const entry of next.values()) this.values.set(entry.identityId, { ...entry })
    this.tickValue = tick
    return this.stats()
  }

  ingestStep(
    step: DynamicGeomorphologyStep,
    resolveIdentity: (cellIndex: number) => string | null
  ) {
    if (
      step.outletCellIndices.length !== step.outletSediment.length ||
      step.outletCellIndices.length !== step.outletWater.length
    ) {
      throw new DynamicGeomorphologyLedgerError(
        'corrupt',
        'dynamic outlet buffers have mismatched lengths'
      )
    }
    const handoffs: DynamicGeomorphologyHandoff[] = []
    for (let index = 0; index < step.outletCellIndices.length; index += 1) {
      const cellIndex = step.outletCellIndices[index]!
      const identityId = resolveIdentity(cellIndex)
      if (!identityId) {
        throw new DynamicGeomorphologyLedgerError(
          'unresolved-identity',
          `outlet cell ${cellIndex} has no canonical drainage identity`
        )
      }
      handoffs.push({
        identityId,
        sediment: step.outletSediment[index]!,
        water: step.outletWater[index]!,
      })
    }
    return this.ingest(handoffs, step.state.tick)
  }

  merge(canonicalId: string, aliases: readonly string[], tick = this.tickValue) {
    const canonical = assertIdentity(canonicalId)
    const identities = [canonical, ...aliases.map(assertIdentity)]
    const merged: DynamicGeomorphologyHandoff = { identityId: canonical, sediment: 0, water: 0 }
    let lastTick = tick
    for (const identityId of identities) {
      const entry = this.values.get(identityId)
      if (!entry) continue
      merged.sediment = addMass(merged.sediment, entry.sediment, `${canonical} sediment`)
      merged.water = addMass(merged.water, entry.water, `${canonical} water`)
      lastTick = Math.max(lastTick, entry.lastTick)
    }
    if (merged.sediment || merged.water || this.values.has(canonical)) {
      const next = new Map(this.values)
      for (const identityId of identities) next.delete(identityId)
      next.set(canonical, { ...merged, lastTick })
      const snapshot: DynamicGeomorphologyLedgerSnapshot = {
        schemaVersion: DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION,
        resolverVersion: TOPOLOGY_RESOLVER_VERSION,
        tick: Math.max(this.tickValue, tick),
        entries: Array.from(next.values()).sort((left, right) =>
          left.identityId.localeCompare(right.identityId)
        ),
      }
      validateDynamicGeomorphologyLedgerSnapshot(snapshot)
      this.values.clear()
      for (const entry of next.values()) this.values.set(entry.identityId, { ...entry })
      this.tickValue = snapshot.tick
    }
    return this.stats()
  }

  applyTopologyEvent(event: TopologyChangeEvent) {
    if (event.type === 'merge') this.merge(event.canonicalId, event.aliases, event.revision)
    return this.stats()
  }

  evict(identityIds: readonly string[]) {
    const removed: DynamicGeomorphologyLedgerEntry[] = []
    for (const identityId of identityIds) {
      const canonical = assertIdentity(identityId)
      const entry = this.values.get(canonical)
      if (!entry) continue
      removed.push({ ...entry })
      this.values.delete(canonical)
    }
    return removed.sort((left, right) => left.identityId.localeCompare(right.identityId))
  }

  snapshot(): DynamicGeomorphologyLedgerSnapshot {
    const snapshot: DynamicGeomorphologyLedgerSnapshot = {
      schemaVersion: DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION,
      resolverVersion: TOPOLOGY_RESOLVER_VERSION,
      tick: this.tickValue,
      entries: this.entries(),
    }
    validateDynamicGeomorphologyLedgerSnapshot(snapshot)
    return snapshot
  }

  rehydrate(snapshot: DynamicGeomorphologyLedgerSnapshot) {
    validateDynamicGeomorphologyLedgerSnapshot(snapshot)
    this.values.clear()
    for (const entry of snapshot.entries) this.values.set(entry.identityId, { ...entry })
    this.tickValue = snapshot.tick
    return this.stats()
  }

  stats(): DynamicGeomorphologyLedgerStats {
    const snapshot = this.snapshotWithoutValidation()
    return {
      tick: this.tickValue,
      entries: this.values.size,
      serializedBytes: dynamicGeomorphologyLedgerBytes(snapshot),
      sediment: snapshot.entries.reduce((sum, entry) => sum + entry.sediment, 0),
      water: snapshot.entries.reduce((sum, entry) => sum + entry.water, 0),
    }
  }

  private snapshotWithoutValidation(): DynamicGeomorphologyLedgerSnapshot {
    return {
      schemaVersion: DYNAMIC_GEOMORPHOLOGY_LEDGER_SCHEMA_VERSION,
      resolverVersion: TOPOLOGY_RESOLVER_VERSION,
      tick: this.tickValue,
      entries: this.entries(),
    }
  }
}

export function emptyDynamicGeomorphologyLedgerSnapshot(): DynamicGeomorphologyLedgerSnapshot {
  return emptySnapshot()
}
