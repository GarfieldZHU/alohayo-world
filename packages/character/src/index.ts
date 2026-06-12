import type {
  CharacterAppearancePools,
  CharacterArchetypeDefinition,
  CharacterContentDefinition,
  CharacterRole,
  EquipmentItemDefinition,
} from '@alohayo/config'
import { hashSeed } from '@alohayo/map'

export interface GeneratedCharacterAppearance {
  bodyShape: string
  build: string
  height: string
  faceShape: string
  skinTone: string
  eyeShape: string
  eyeColor: string
  hairStyle: string
  hairColor: string
  facialHairStyle: string
}

export interface GeneratedEquipment {
  slotId: string
  itemId: string | null
  shared: boolean
}

export interface GeneratedCharacter {
  id: string
  archetypeId: string
  name: string
  role: CharacterRole
  abilities: Record<string, number>
  appearance: GeneratedCharacterAppearance
  equipment: GeneratedEquipment[]
  activeWeaponSlot: string | null
  tags: string[]
}

function createRandom(seedText: string): () => number {
  let state = hashSeed(seedText) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function choose<T>(values: readonly T[], random: () => number, label: string): T {
  if (!values.length) throw new Error(`character pool ${label} is empty`)
  return values[Math.floor(random() * values.length)]!
}

function appearanceKey(key: keyof CharacterAppearancePools): keyof GeneratedCharacterAppearance {
  const keys: Record<keyof CharacterAppearancePools, keyof GeneratedCharacterAppearance> = {
    bodyShapes: 'bodyShape',
    builds: 'build',
    heights: 'height',
    faceShapes: 'faceShape',
    skinTones: 'skinTone',
    eyeShapes: 'eyeShape',
    eyeColors: 'eyeColor',
    hairStyles: 'hairStyle',
    hairColors: 'hairColor',
    facialHairStyles: 'facialHairStyle',
  }
  return keys[key]
}

function generateAppearance(
  archetype: CharacterArchetypeDefinition,
  pools: CharacterAppearancePools,
  random: () => number
): GeneratedCharacterAppearance {
  const result = {} as GeneratedCharacterAppearance
  for (const key of Object.keys(pools) as (keyof CharacterAppearancePools)[]) {
    const outputKey = appearanceKey(key)
    const fixed = archetype.appearance.fixed?.[key]
    const candidates = archetype.appearance.pools?.[key] ?? pools[key]
    result[outputKey] = fixed ?? choose(candidates, random, key)
  }
  return result
}

function findItem(
  content: CharacterContentDefinition,
  itemId: string,
  slotId: string
): EquipmentItemDefinition {
  const item = content.items.find((candidate) => candidate.id === itemId)
  if (!item) throw new Error(`unknown equipment item ${itemId}`)
  if (!item.allowedSlots.includes(slotId)) {
    throw new Error(`item ${itemId} cannot be equipped in ${slotId}`)
  }
  return item
}

export function generateCharacter(
  content: CharacterContentDefinition,
  archetypeId: string,
  seed: string
): GeneratedCharacter {
  const archetype = content.archetypes.find((candidate) => candidate.id === archetypeId)
  if (!archetype) throw new Error(`unknown character archetype ${archetypeId}`)
  const random = createRandom(`${seed}:${archetypeId}`)
  const abilities: Record<string, number> = {}

  for (const definition of content.abilities) {
    const roll = archetype.abilities[definition.id]
    const minimum = Math.max(definition.minimum, roll?.minimum ?? definition.default)
    const maximum = Math.min(definition.maximum, roll?.maximum ?? definition.default)
    abilities[definition.id] =
      roll?.fixed ?? Math.round(minimum + random() * Math.max(0, maximum - minimum))
  }

  const equipment = archetype.equipment.map((selection) => {
    let itemId = selection.fixedItemId ?? null
    if (!itemId && selection.poolId) {
      const pool = content.equipmentPools.find((candidate) => candidate.id === selection.poolId)
      if (!pool) throw new Error(`unknown equipment pool ${selection.poolId}`)
      const candidates = pool.allowEmpty ? [...pool.itemIds, null] : pool.itemIds
      itemId = choose(candidates, random, selection.poolId)
    }
    if (itemId) findItem(content, itemId, selection.slotId)
    return { slotId: selection.slotId, itemId, shared: selection.shared ?? false }
  })

  return {
    id: `${archetype.id}:${hashSeed(seed).toString(16)}`,
    archetypeId: archetype.id,
    name: archetype.name,
    role: archetype.role,
    abilities,
    appearance: generateAppearance(archetype, content.appearancePools, random),
    equipment,
    activeWeaponSlot: archetype.weaponSetSlots[0] ?? null,
    tags: [...archetype.tags],
  }
}
