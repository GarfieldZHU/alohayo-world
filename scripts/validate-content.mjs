import { readdirSync, readFileSync } from 'node:fs'
import { dirname, posix } from 'node:path'

const contentRoot = new URL('../content/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('../content/core/manifest.json', import.meta.url)))
const world = JSON.parse(readFileSync(new URL('../content/core/world.json', import.meta.url)))
const biomes = JSON.parse(readFileSync(new URL('../content/core/biomes.json', import.meta.url)))
const terrainRules = JSON.parse(
  readFileSync(new URL('../content/core/terrain-rules.json', import.meta.url))
)
const englishCatalog = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url)))
const chineseCatalog = JSON.parse(readFileSync(new URL('../i18n/zh-CN.json', import.meta.url)))
const mapAreaRoot = new URL('../content/maps/core/areas/', import.meta.url)
const mapAreas = readdirSync(mapAreaRoot)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(new URL(name, mapAreaRoot))))
const allManifestEntries = collectManifestEntries(contentRoot)
const manifestById = new Map(allManifestEntries.map((entry) => [entry.manifest.id, entry]))
const abilities = JSON.parse(
  readFileSync(new URL('../content/characters/core/abilities.json', import.meta.url))
)
const actions = JSON.parse(
  readFileSync(new URL('../content/characters/core/actions.json', import.meta.url))
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

const orderedPackIds = validateContentPackDependencies(allManifestEntries, errors)
const resolvedPackAreas = orderedPackIds.flatMap((packId) => {
  const entry = manifestById.get(packId)
  if (!entry) {
    return []
  }
  return resolvePackMapAreas(entry, errors)
})

const resolvedMapAreaIds = new Set()
for (const area of resolvedPackAreas) {
  if (resolvedMapAreaIds.has(area.id)) {
    errors.push(`duplicate map area id ${area.id}`)
    continue
  }
  resolvedMapAreaIds.add(area.id)
}

if (manifest.schemaVersion !== 1 || manifest.id !== 'core') errors.push('invalid core manifest')
if (world.schemaVersion !== 1 || world.chunkSize <= 0 || world.width <= 0 || world.height <= 0) {
  errors.push('invalid world definition')
}
if (!world.roads?.profiles?.length || !world.roads?.generation) {
  errors.push('world road profiles and generation settings are required')
} else {
  for (const profile of world.roads.profiles) {
    if (
      !profile.id ||
      !profile.name ||
      profile.movementMultiplier <= 0 ||
      profile.width <= 0 ||
      !/^#[0-9a-f]{6}$/i.test(profile.color) ||
      !/^#[0-9a-f]{6}$/i.test(profile.edgeColor)
    ) {
      errors.push(`invalid road profile ${profile.id || '<missing>'}`)
    }
  }
  const generation = world.roads.generation
  if (
    generation.candidateDistance < 16 ||
    generation.trafficRoadMin < 1 ||
    generation.trafficTradeRouteMin < generation.trafficRoadMin ||
    generation.ruggedPassThreshold <= 0 ||
    generation.ruggedPassThreshold >= 1 ||
    generation.smoothingIterations < 0 ||
    generation.textureStep < 1
  ) {
    errors.push('invalid road generation settings')
  }
}
if (world.weather) {
  if (!world.weather.states?.length || world.weather.cycleSeconds <= 0) {
    errors.push('invalid world weather settings')
  }
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
      preset.width > 2048 ||
      preset.height > 1536 ||
      preset.chunkRadius < 1 ||
      preset.retainChunkRadius < preset.chunkRadius ||
      preset.minimapChunkRadius < preset.chunkRadius
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
if (terrainRules.schemaVersion !== 1 || !Array.isArray(terrainRules.rules)) {
  errors.push('invalid terrain rule pack')
} else {
  const ruleIds = new Set(terrainRules.rules.map((rule) => rule.terrainId))
  if (ruleIds.size !== terrainRules.rules.length) errors.push('duplicate terrain rule id')
  for (const terrainId of terrainIds) {
    if (!ruleIds.has(terrainId)) errors.push(`missing terrain rule for ${terrainId}`)
    if (!englishCatalog.content?.biomes?.[terrainId]?.name) {
      errors.push(`missing English biome name for ${terrainId}`)
    }
    if (!chineseCatalog.content?.biomes?.[terrainId]?.name) {
      errors.push(`missing Chinese biome name for ${terrainId}`)
    }
  }
  for (const rule of terrainRules.rules) {
    if (!terrainIds.has(rule.terrainId))
      errors.push(`terrain rule uses unknown terrain ${rule.terrainId}`)
    if (
      !rule.realWorldDescription ||
      !rule.alohayoBehavior ||
      !['common', 'uncommon', 'rare', 'very-rare'].includes(rule.generation?.rarity) ||
      !rule.generation?.possibility ||
      !Array.isArray(rule.generation?.conditions) ||
      rule.generation.conditions.length < 2 ||
      !Array.isArray(rule.surfaceEffects) ||
      rule.surfaceEffects.length < 1 ||
      !rule.physicalBehavior?.movement ||
      !rule.physicalBehavior?.control ||
      !Array.isArray(rule.physicalBehavior?.hazards) ||
      !Array.isArray(rule.physicalBehavior?.entryRequirements) ||
      typeof rule.destruction?.destructible !== 'boolean' ||
      !Array.isArray(rule.destruction?.methods)
    ) {
      errors.push(`invalid terrain rule for ${rule.terrainId || '<missing>'}`)
      continue
    }
    for (const surface of rule.surfaceEffects) {
      if (!surface.id || !surface.trigger || !surface.effect) {
        errors.push(`invalid surface effect in ${rule.terrainId}`)
      }
    }
    for (const method of rule.destruction.methods) {
      if (!method.trigger || !method.notes || !terrainIds.has(method.becomes)) {
        errors.push(`invalid destruction rule in ${rule.terrainId}`)
      }
    }
  }
}
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
for (const area of resolvedPackAreas) {
  if (!area.terrainPatches?.length) {
    errors.push(`resolved content pack area ${area.id || '<missing>'} has no terrain patches`)
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
const actionIds = new Set(actions.map((action) => action.id))
for (const action of actions) {
  if (
    !action.id ||
    action.duration < 0 ||
    action.range < 0 ||
    !['landmark', 'self'].includes(action.target)
  ) {
    errors.push(`invalid action ${action.id || '<missing>'}`)
  }
}
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
  if (
    !archetype.movement ||
    archetype.movement.walkSpeed <= 0 ||
    archetype.movement.runMultiplier < 1 ||
    archetype.movement.actionRange <= 0
  ) {
    errors.push(`invalid movement profile in archetype ${archetype.id}`)
  }
  for (const actionId of archetype.actionIds ?? []) {
    if (!actionIds.has(actionId)) errors.push(`unknown action ${actionId} in ${archetype.id}`)
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
  `validated ${allManifestEntries.length} content packs, ${biomes.length} terrains, ${terrainRules.rules.length} terrain rules, ${resolvedPackAreas.length} resolved map areas, ${abilities.length} abilities, ${actions.length} actions, ${slots.length} slots, ${items.length} items, and ${archetypes.length} archetypes`
)

function collectManifestEntries(rootUrl) {
  return walkDirectory(rootUrl)
    .filter((path) => path.endsWith('manifest.json'))
    .sort()
    .map((path) => ({
      path,
      manifest: readJsonFromContentPath(path),
    }))
}

function walkDirectory(directoryUrl) {
  const entries = readdirSync(directoryUrl, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const nextUrl = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directoryUrl)
    if (entry.isDirectory()) {
      files.push(...walkDirectory(nextUrl))
    } else {
      files.push(contentPathFromUrl(nextUrl))
    }
  }
  return files
}

function validateContentPackDependencies(entries, errors) {
  const packIds = new Set()
  for (const entry of entries) {
    if (!entry.manifest?.id) {
      errors.push(`content pack at ${entry.path} is missing an id`)
      continue
    }
    if (packIds.has(entry.manifest.id)) {
      errors.push(`duplicate content pack id ${entry.manifest.id}`)
      continue
    }
    packIds.add(entry.manifest.id)
  }

  const packById = new Map(entries.map((entry) => [entry.manifest.id, entry]))
  const indegree = new Map()
  const dependents = new Map()

  for (const entry of entries) {
    const dependencies = entry.manifest.dependencies ?? []
    indegree.set(entry.manifest.id, dependencies.length)
    for (const dependencyId of dependencies) {
      if (!packById.has(dependencyId)) {
        errors.push(`content pack ${entry.manifest.id} depends on missing pack ${dependencyId}`)
        continue
      }
      const values = dependents.get(dependencyId) ?? []
      values.push(entry.manifest.id)
      dependents.set(dependencyId, values)
    }
  }

  const ready = entries
    .filter((entry) => (indegree.get(entry.manifest.id) ?? 0) === 0)
    .map((entry) => entry.manifest.id)
    .sort()
  const ordered = []

  while (ready.length > 0) {
    const packId = ready.shift()
    ordered.push(packId)
    for (const dependentId of (dependents.get(packId) ?? []).sort()) {
      const nextIndegree = (indegree.get(dependentId) ?? 0) - 1
      indegree.set(dependentId, nextIndegree)
      if (nextIndegree === 0 && !ready.includes(dependentId)) {
        ready.push(dependentId)
        ready.sort()
      }
    }
  }

  if (ordered.length !== entries.length) {
    errors.push('content pack dependency cycle detected')
  }

  return ordered
}

function resolvePackMapAreas(entry, errors) {
  if (!entry.manifest.mapAreas) {
    return []
  }
  const packIndexPath = resolveRelativeContentPath(entry.path, entry.manifest.mapAreas)
  const packIndex = readJsonFromContentPath(packIndexPath)
  if (packIndex.schemaVersion !== 1 || !Array.isArray(packIndex.areas)) {
    errors.push(`invalid map area pack ${packIndex.id || '<missing>'}`)
    return []
  }
  return packIndex.areas.map((areaPath) => {
    const resolvedAreaPath = resolveRelativeContentPath(packIndexPath, areaPath)
    return readJsonFromContentPath(resolvedAreaPath)
  })
}

function resolveRelativeContentPath(fromPath, relativePath) {
  return posix.normalize(posix.join(dirname(fromPath), relativePath))
}

function readJsonFromContentPath(contentPath) {
  return JSON.parse(readFileSync(new URL(contentPath, contentRoot)))
}

function contentPathFromUrl(fileUrl) {
  return fileUrl.pathname.split('/content/')[1]
}
