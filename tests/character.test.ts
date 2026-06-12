import { describe, expect, it } from 'vitest'
import { generateCharacter } from '../packages/character/src'
import type { CharacterContentDefinition } from '../packages/config/src'
import abilities from '../content/characters/core/abilities.json'
import appearancePools from '../content/characters/core/appearance.json'
import archetypes from '../content/characters/core/archetypes.json'
import equipmentPools from '../content/characters/core/equipment-pools.json'
import items from '../content/characters/core/items.json'
import slots from '../content/characters/core/slots.json'

const content = {
  schemaVersion: 1,
  abilities,
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
})
