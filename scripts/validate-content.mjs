import { readdirSync, readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../content/core/manifest.json', import.meta.url)))
const world = JSON.parse(readFileSync(new URL('../content/core/world.json', import.meta.url)))
const biomes = JSON.parse(readFileSync(new URL('../content/core/biomes.json', import.meta.url)))
const mapAreaRoot = new URL('../content/maps/core/areas/', import.meta.url)
const mapAreas = readdirSync(mapAreaRoot)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(new URL(name, mapAreaRoot))))
const abilities = JSON.parse(
  readFileSync(new URL('../content/characters/core/abilities.json', import.meta.url))
)
const appearance = JSON.parse(
  readFileSync(new URL('../content/characters/core/appearance.json', import.meta.url))
)
const slots = JSON.parse(
  readFileSync(new URL('../content/characters/core/slots.json', import.meta.url))
)
const items = JSON.parse(
  readFileSync(new URL('../content/characters/core/items.json', import.meta.url))
)
const equipmentPools = JSON.parse(
  readFileSync(new URL('../content/characters/core/equipment-pools.json', import.meta.url))
)
const archetypes = JSON.parse(
  readFileSync(new URL('../content/characters/core/archetypes.json', import.meta.url))
)
const errors = []

if (manifest.schemaVersion !== 1 || manifest.id !== 'core') errors.push('invalid core manifest')
if (world.schemaVersion !== 1 || world.chunkSize <= 0 || world.width <= 0 || world.height <= 0) {
  errors.push('invalid world definition')
}
if (!Array.isArray(biomes) || biomes.length < 14)
  errors.push('at least fourteen terrain definitions are required')
if (!Array.isArray(world.sizePresets) || world.sizePresets.length < 1) {
  errors.push('at least one world size preset is required')
} else {
  for (const preset of world.sizePresets) {
    if (
      !preset.id ||
      !preset.name ||
      preset.width < 64 ||
      preset.height < 48 ||
      preset.width > 384 ||
      preset.height > 288
    ) {
      errors.push(`invalid world size preset ${preset.id || '<missing>'}`)
    }
  }
}
if (new Set(biomes.map((biome) => biome.id)).size !== biomes.length)
  errors.push('duplicate biome id')
if (new Set(biomes.map((biome) => biome.code)).size !== biomes.length) {
  errors.push('duplicate biome code')
}
for (const biome of biomes) {
  if (!/^#[0-9a-f]{6}$/i.test(biome.color) || !/^#[0-9a-f]{6}$/i.test(biome.accent)) {
    errors.push(`invalid color for ${biome.id}`)
  }
}

const terrainIds = new Set(biomes.map((biome) => biome.id))
for (const area of mapAreas) {
  if (
    area.schemaVersion !== 1 ||
    !area.id ||
    !area.name ||
    area.width <= 0 ||
    area.height <= 0 ||
    !Array.isArray(area.terrainPatches)
  ) {
    errors.push(`invalid map area ${area.id || '<missing>'}`)
    continue
  }
  if (
    !['absolute', 'normalized'].includes(area.placement?.mode) ||
    !Number.isFinite(area.placement?.x) ||
    !Number.isFinite(area.placement?.y)
  ) {
    errors.push(`invalid placement for ${area.id}`)
  }
  if (
    area.placement?.mode === 'normalized' &&
    (area.placement.x < 0 || area.placement.x > 1 || area.placement.y < 0 || area.placement.y > 1)
  ) {
    errors.push(`normalized placement outside 0..1 for ${area.id}`)
  }
  for (const patch of [...area.terrainPatches, ...(area.cells ?? [])]) {
    if (!terrainIds.has(patch.terrainId))
      errors.push(`unknown terrain ${patch.terrainId} in ${area.id}`)
  }
}

if (!Array.isArray(abilities) || abilities.length < 8)
  errors.push('at least eight abilities are required')
const abilityIds = new Set(abilities.map((ability) => ability.id))
if (abilityIds.size !== abilities.length) errors.push('duplicate ability id')
for (const ability of abilities) {
  if (
    !ability.id ||
    !ability.group ||
    ability.minimum > ability.default ||
    ability.default > ability.maximum
  ) {
    errors.push(`invalid ability ${ability.id || '<missing>'}`)
  }
}

const appearanceKeys = [
  'bodyShapes',
  'builds',
  'heights',
  'faceShapes',
  'skinTones',
  'eyeShapes',
  'eyeColors',
  'hairStyles',
  'hairColors',
  'facialHairStyles',
]
for (const key of appearanceKeys) {
  if (!Array.isArray(appearance[key]) || !appearance[key].length) {
    errors.push(`appearance pool ${key} is empty`)
  }
}

const slotIds = new Set(slots.map((slot) => slot.id))
const wearableCount = slots.filter((slot) => slot.kind === 'wearable').length
const decoratorCount = slots.filter((slot) => slot.kind === 'decorator').length
const weaponCount = slots.filter((slot) => slot.kind === 'weapon').length
if (wearableCount < 8) errors.push('at least eight wearable slots are required')
if (decoratorCount < 6) errors.push('at least six decorator slots are required')
if (weaponCount < 2) errors.push('multiple weapon slots are required')
if (slotIds.size !== slots.length) errors.push('duplicate equipment slot id')

const itemIds = new Set(items.map((item) => item.id))
for (const item of items) {
  for (const slotId of item.allowedSlots ?? []) {
    if (!slotIds.has(slotId)) errors.push(`unknown slot ${slotId} for item ${item.id}`)
  }
}
const poolIds = new Set(equipmentPools.map((pool) => pool.id))
for (const pool of equipmentPools) {
  for (const itemId of pool.itemIds ?? []) {
    if (!itemIds.has(itemId)) errors.push(`unknown item ${itemId} in pool ${pool.id}`)
  }
}

const roles = new Set()
for (const archetype of archetypes) {
  roles.add(archetype.role)
  for (const abilityId of Object.keys(archetype.abilities ?? {})) {
    if (!abilityIds.has(abilityId)) {
      errors.push(`unknown ability ${abilityId} in archetype ${archetype.id}`)
    }
  }
  for (const selection of archetype.equipment ?? []) {
    if (!slotIds.has(selection.slotId)) {
      errors.push(`unknown slot ${selection.slotId} in archetype ${archetype.id}`)
    }
    if (selection.fixedItemId && !itemIds.has(selection.fixedItemId)) {
      errors.push(`unknown item ${selection.fixedItemId} in archetype ${archetype.id}`)
    }
    if (selection.poolId && !poolIds.has(selection.poolId)) {
      errors.push(`unknown pool ${selection.poolId} in archetype ${archetype.id}`)
    }
  }
}
for (const role of ['player', 'npc', 'enemy']) {
  if (!roles.has(role)) errors.push(`missing ${role} character archetype`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(
  `validated ${biomes.length} terrains, ${mapAreas.length} map areas, ${abilities.length} abilities, ${slots.length} slots, ${items.length} items, and ${archetypes.length} archetypes`
)
