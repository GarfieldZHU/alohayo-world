import type {
  AbilityDefinition,
  CharacterRulesPackDefinition,
  CharacterTerrainInteractionDefinition,
} from '@alohayo/config'

export interface CharacterRulesRegistry {
  pack: CharacterRulesPackDefinition
  abilityIds: ReadonlySet<string>
  terrainIds: ReadonlySet<string>
}

export interface CharacterRulesValidationContext {
  abilities: readonly AbilityDefinition[]
  terrainIds: readonly string[]
}

export interface TerrainTraversalInput {
  terrainId: string
  surfaceEffectIds?: readonly string[]
  equipmentTags?: readonly string[]
  capabilityTags?: readonly string[]
  roleIds?: readonly string[]
}

export interface TerrainTraversalResult {
  blocked: boolean
  movementMultiplier: number
  staminaMultiplier: number
  controlModifier: number
  exposurePerMinute: number
  matchedRuleIds: string[]
  missingRequiredTags: string[]
}

function duplicateIds(values: readonly { id: string }[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value.id)) duplicates.add(value.id)
    seen.add(value.id)
  }
  return [...duplicates].sort()
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be non-negative`)
}

export function createCharacterRulesRegistry(
  pack: CharacterRulesPackDefinition,
  context: CharacterRulesValidationContext
): CharacterRulesRegistry {
  if (pack.schemaVersion !== 1 || !pack.id || !pack.version) {
    throw new Error('invalid character rules pack identity')
  }
  const collections = [
    pack.resources,
    pack.roles,
    pack.weaponFamilies,
    pack.armorProfiles,
    pack.itemCategories,
    pack.terrainInteractions,
  ]
  for (const collection of collections) {
    const duplicates = duplicateIds(collection)
    if (duplicates.length) throw new Error(`duplicate character rule ids: ${duplicates.join(', ')}`)
  }

  const abilityIds = new Set(context.abilities.map((ability) => ability.id))
  const terrainIds = new Set(context.terrainIds)
  const roleIds = new Set(pack.roles.map((role) => role.id))
  for (const resource of pack.resources) {
    assertFiniteNonNegative(resource.minimum, `${resource.id} minimum`)
    for (const abilityId of Object.keys(resource.abilityWeights)) {
      if (!abilityIds.has(abilityId))
        throw new Error(`${resource.id} uses unknown ability ${abilityId}`)
    }
  }
  for (const role of pack.roles) {
    for (const abilityId of role.abilityPriorities) {
      if (!abilityIds.has(abilityId))
        throw new Error(`${role.id} uses unknown ability ${abilityId}`)
    }
    for (const terrainId of role.terrainAffinityIds) {
      if (!terrainIds.has(terrainId))
        throw new Error(`${role.id} uses unknown terrain ${terrainId}`)
    }
  }
  for (const weapon of pack.weaponFamilies) {
    assertFiniteNonNegative(weapon.weight, `${weapon.id} weight`)
    assertFiniteNonNegative(weapon.reach, `${weapon.id} reach`)
    assertFiniteNonNegative(weapon.staminaCost, `${weapon.id} stamina cost`)
    for (const abilityId of [...Object.keys(weapon.requirements), ...Object.keys(weapon.scaling)]) {
      if (!abilityIds.has(abilityId))
        throw new Error(`${weapon.id} uses unknown ability ${abilityId}`)
    }
  }
  for (const armor of pack.armorProfiles) {
    assertFiniteNonNegative(armor.weight, `${armor.id} weight`)
    assertFiniteNonNegative(armor.poise, `${armor.id} poise`)
  }
  for (const rule of pack.terrainInteractions) {
    for (const terrainId of rule.terrainIds) {
      if (!terrainIds.has(terrainId))
        throw new Error(`${rule.id} uses unknown terrain ${terrainId}`)
    }
    for (const roleId of rule.mitigatingRoleIds ?? []) {
      if (!roleIds.has(roleId)) throw new Error(`${rule.id} uses unknown role ${roleId}`)
    }
    assertFiniteNonNegative(rule.movementMultiplier, `${rule.id} movement multiplier`)
    assertFiniteNonNegative(rule.staminaMultiplier, `${rule.id} stamina multiplier`)
    assertFiniteNonNegative(rule.exposurePerMinute, `${rule.id} exposure`)
  }
  return { pack, abilityIds, terrainIds }
}

export function deriveCharacterResources(
  abilities: Readonly<Record<string, number>>,
  registry: CharacterRulesRegistry
): Record<string, number> {
  return Object.fromEntries(
    registry.pack.resources.map((resource) => {
      let value = resource.base
      for (const [abilityId, weight] of Object.entries(resource.abilityWeights)) {
        value += (abilities[abilityId] ?? 0) * weight
      }
      const rounded = Math[resource.rounding](value)
      return [resource.id, Math.max(resource.minimum, rounded)]
    })
  )
}

function ruleMatches(
  rule: CharacterTerrainInteractionDefinition,
  terrainId: string,
  surfaces: ReadonlySet<string>
): boolean {
  if (!rule.terrainIds.includes(terrainId)) return false
  return !rule.surfaceEffectIds?.length || rule.surfaceEffectIds.some((id) => surfaces.has(id))
}

export function evaluateTerrainTraversal(
  input: TerrainTraversalInput,
  registry?: CharacterRulesRegistry
): TerrainTraversalResult {
  const result: TerrainTraversalResult = {
    blocked: false,
    movementMultiplier: 1,
    staminaMultiplier: 1,
    controlModifier: 0,
    exposurePerMinute: 0,
    matchedRuleIds: [],
    missingRequiredTags: [],
  }
  if (!registry) return result

  const surfaces = new Set(input.surfaceEffectIds ?? [])
  const tags = new Set([...(input.equipmentTags ?? []), ...(input.capabilityTags ?? [])])
  const roles = new Set(input.roleIds ?? [])
  const rules = registry.pack.terrainInteractions
    .filter((rule) => ruleMatches(rule, input.terrainId, surfaces))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))

  for (const rule of rules) {
    const mitigated =
      (rule.mitigationTags?.some((tag) => tags.has(tag)) ?? false) ||
      (rule.mitigatingRoleIds?.some((roleId) => roles.has(roleId)) ?? false)
    const required = rule.requiredAnyTags ?? []
    if (required.length && !required.some((tag) => tags.has(tag))) {
      result.blocked = true
      result.missingRequiredTags.push(...required.filter((tag) => !tags.has(tag)))
    }
    result.movementMultiplier *=
      mitigated && rule.mitigatedMovementMultiplier !== undefined
        ? rule.mitigatedMovementMultiplier
        : rule.movementMultiplier
    result.staminaMultiplier *=
      mitigated && rule.mitigatedStaminaMultiplier !== undefined
        ? rule.mitigatedStaminaMultiplier
        : rule.staminaMultiplier
    result.controlModifier +=
      mitigated && rule.mitigatedControlModifier !== undefined
        ? rule.mitigatedControlModifier
        : rule.controlModifier
    result.exposurePerMinute +=
      mitigated && rule.mitigatedExposurePerMinute !== undefined
        ? rule.mitigatedExposurePerMinute
        : rule.exposurePerMinute
    result.matchedRuleIds.push(rule.id)
  }
  result.missingRequiredTags = [...new Set(result.missingRequiredTags)].sort()
  return result
}
