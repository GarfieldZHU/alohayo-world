import type { CharacterRulesPackDefinition } from '@alohayo/config'
import {
  createCharacterRulesRegistry,
  deriveCharacterResources,
  evaluateCharacterTerrainTraversal,
  evaluateTerrainTraversal,
} from '@alohayo/character-rules'
import { describe, expect, it } from 'vitest'
import abilities from '../content/characters/core/abilities.json'
import armorProfiles from '../content/characters/extensions/eastern-frontier-v1/armors.json'
import index from '../content/characters/extensions/eastern-frontier-v1/index.json'
import itemCategories from '../content/characters/extensions/eastern-frontier-v1/item-categories.json'
import resources from '../content/characters/extensions/eastern-frontier-v1/resources.json'
import roles from '../content/characters/extensions/eastern-frontier-v1/roles.json'
import terrainInteractions from '../content/characters/extensions/eastern-frontier-v1/terrain-interactions.json'
import weaponFamilies from '../content/characters/extensions/eastern-frontier-v1/weapons.json'
import biomes from '../content/core/biomes.json'

const pack = {
  ...index,
  resources,
  roles,
  weaponFamilies,
  armorProfiles,
  itemCategories,
  terrainInteractions,
} as unknown as CharacterRulesPackDefinition

const registry = createCharacterRulesRegistry(pack, {
  abilities,
  terrainIds: biomes.map((biome) => biome.id),
})

describe('character rules plugin', () => {
  it('derives deterministic resources from data-defined ability weights', () => {
    const values = deriveCharacterResources(
      {
        'core:strength': 10,
        'core:agility': 8,
        'core:endurance': 12,
        'core:intelligence': 9,
        'core:willpower': 11,
        'core:charisma': 7,
      },
      registry
    )

    expect(values['rules:vitality']).toBe(61)
    expect(values['rules:stamina']).toBe(62)
    expect(values['rules:focus']).toBe(46)
    expect(values['rules:load']).toBe(42)
  })

  it('returns neutral traversal when the optional plugin is absent', () => {
    expect(evaluateTerrainTraversal({ terrainId: 'core:mountain' })).toEqual({
      blocked: false,
      movementMultiplier: 1,
      staminaMultiplier: 1,
      controlModifier: 0,
      exposurePerMinute: 0,
      matchedRuleIds: [],
      missingRequiredTags: [],
    })
  })

  it('blocks open water without a traversal capability and permits a boat', () => {
    const blocked = evaluateTerrainTraversal({ terrainId: 'core:ocean' }, registry)
    const boat = evaluateTerrainTraversal(
      { terrainId: 'core:ocean', capabilityTags: ['traversal:boat'] },
      registry
    )

    expect(blocked.blocked).toBe(true)
    expect(blocked.missingRequiredTags).toContain('traversal:boat')
    expect(boat).toMatchObject({
      blocked: false,
      movementMultiplier: 1,
      staminaMultiplier: 1,
      controlModifier: 0,
      exposurePerMinute: 0,
    })
  })

  it('derives traversal capability from a character equipment loadout', () => {
    const result = evaluateCharacterTerrainTraversal(
      {
        terrainId: 'core:ocean',
        equipment: [{ tags: ['traversal:boat'] }, { tags: ['equipment:travel'] }],
      },
      registry
    )

    expect(result).toMatchObject({ blocked: false, movementMultiplier: 1 })
    expect(result.matchedRuleIds).toContain('terrain:open-water')
  })

  it('applies role mitigation and composes matching surface rules deterministically', () => {
    const passSentinel = evaluateTerrainTraversal(
      { terrainId: 'core:mountain', roleIds: ['role:pass-sentinel'] },
      registry
    )
    const muddyLowland = evaluateTerrainTraversal(
      { terrainId: 'core:lowland', surfaceEffectIds: ['surface:mud'] },
      registry
    )

    expect(passSentinel).toMatchObject({ movementMultiplier: 1.25, staminaMultiplier: 1.2 })
    expect(passSentinel.matchedRuleIds).toEqual(['terrain:mountain'])
    expect(muddyLowland).toMatchObject({ movementMultiplier: 1.25, controlModifier: -0.15 })
  })

  it('rejects unknown cross-module IDs before creating a registry', () => {
    expect(() =>
      createCharacterRulesRegistry(
        {
          ...pack,
          roles: [{ ...pack.roles[0]!, terrainAffinityIds: ['core:not-real'] }],
        },
        { abilities, terrainIds: biomes.map((biome) => biome.id) }
      )
    ).toThrow('unknown terrain core:not-real')
  })
})
