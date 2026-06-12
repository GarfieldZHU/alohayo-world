import { describe, expect, it } from 'vitest'
import {
  CHARACTER_TERRAIN_AREA_RATIO,
  createCharacterMotion,
  generateCharacter,
  startCharacterAction,
  stepCharacterMotion,
} from '../packages/character/src'
import type { CharacterContentDefinition } from '../packages/config/src'
import abilities from '../content/characters/core/abilities.json'
import actions from '../content/characters/core/actions.json'
import appearancePools from '../content/characters/core/appearance.json'
import archetypes from '../content/characters/core/archetypes.json'
import equipmentPools from '../content/characters/core/equipment-pools.json'
import items from '../content/characters/core/items.json'
import slots from '../content/characters/core/slots.json'

const content = {
  schemaVersion: 1,
  abilities,
  actions,
  appearancePools,
  archetypes,
  equipmentPools,
  items,
  slots,
} as CharacterContentDefinition

describe('character generation', () => {
  it('is deterministic and fills every configured ability', () => {
    const first = generateCharacter(content, 'core:explorer', 'alohayo')
    const second = generateCharacter(content, 'core:explorer', 'alohayo')
    expect(first).toEqual(second)
    expect(Object.keys(first.abilities)).toHaveLength(abilities.length)
  })

  it('uses the same system for player, npc, and enemy roles', () => {
    expect(generateCharacter(content, 'core:explorer', 'one').role).toBe('player')
    expect(generateCharacter(content, 'core:beacon-keeper', 'two').role).toBe('npc')
    expect(generateCharacter(content, 'core:shore-raider', 'three').role).toBe('enemy')
  })

  it('supports fixed appearance and multiple switchable weapons', () => {
    const keeper = generateCharacter(content, 'core:beacon-keeper', 'keeper')
    const explorer = generateCharacter(content, 'core:explorer', 'explorer')
    expect(keeper.appearance.hairStyle).toBe('bun')
    expect(explorer.activeWeaponSlot).toBe('weapon:primary')
    expect(explorer.equipment.filter((entry) => entry.slotId.startsWith('weapon:')).length).toBe(3)
  })

  it('uses a one-ninth terrain-cell character footprint contract', () => {
    expect(CHARACTER_TERRAIN_AREA_RATIO).toBeCloseTo(1 / 9)
  })

  it('walks, runs faster, respects collisions, and locks during actions', () => {
    const character = generateCharacter(content, 'core:explorer', 'motion')
    const walk = createCharacterMotion(4.5, 4.5)
    const run = createCharacterMotion(4.5, 4.5)
    const context = {
      character,
      deltaSeconds: 1,
      canOccupy: () => true,
      movementCost: () => 1,
    }
    stepCharacterMotion(walk, {
      ...context,
      input: { x: 1, y: 0, running: false },
    })
    stepCharacterMotion(run, {
      ...context,
      input: { x: 1, y: 0, running: true },
    })
    expect(walk.state).toBe('walk')
    expect(run.state).toBe('run')
    expect(run.x - 4.5).toBeGreaterThan(walk.x - 4.5)

    const blocked = createCharacterMotion(4.5, 4.5)
    stepCharacterMotion(blocked, {
      ...context,
      input: { x: 1, y: 0, running: false },
      canOccupy: () => false,
    })
    expect(blocked.x).toBe(4.5)
    expect(blocked.state).toBe('idle')

    startCharacterAction(blocked, 0.5)
    stepCharacterMotion(blocked, {
      ...context,
      deltaSeconds: 0.1,
      input: { x: 1, y: 0, running: true },
    })
    expect(blocked.x).toBe(4.5)
    expect(blocked.state).toBe('action')
  })
})
