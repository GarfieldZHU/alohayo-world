import { describe, expect, it } from 'vitest'
import { generateCharacter } from '../packages/character/src'
import {
  CHARACTER_RENDER_LAYER_ORDER,
  resolveCharacterRenderModel,
} from '../packages/character-renderer/src'
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

describe('character renderer contract', () => {
  it('keeps presentation layers explicit and stable', () => {
    expect(CHARACTER_RENDER_LAYER_ORDER).toEqual([
      'shadow',
      'aura',
      'body',
      'head',
      'equipment',
      'weapon',
    ])
  })

  it('resolves appearance and equipped colors deterministically', () => {
    const explorer = generateCharacter(content, 'core:explorer', 'renderer-fixture')
    const first = resolveCharacterRenderModel(explorer, content)
    const second = resolveCharacterRenderModel(explorer, content, {
      spriteSheetUrl: '/assets/characters/explorer.sheet.json',
      directionalClips: { south: 'idle-south' },
    })
    expect(first).toEqual(resolveCharacterRenderModel(explorer, content))
    expect(first.equipmentIds.length).toBeGreaterThan(0)
    expect(second.assetManifest?.directionalClips?.south).toBe('idle-south')
    expect(second.bodyWidthFactor).toBeGreaterThan(0)
    expect(second.bodyHeightFactor).toBeGreaterThan(0)
  })
})
