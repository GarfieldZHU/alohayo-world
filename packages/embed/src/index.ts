import type {
  AbilityDefinition,
  BiomeDefinition,
  CharacterAppearancePools,
  CharacterActionDefinition,
  CharacterArchetypeDefinition,
  CharacterContentDefinition,
  EquipmentItemDefinition,
  EquipmentPoolDefinition,
  EquipmentSlotDefinition,
  GameHandle,
  MapAreaDefinition,
  MountGameOptions,
  WorldDefinition,
} from '@alohayo/config'
import {
  formatI18n,
  getI18nCatalog,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  SUPPORTED_LOCALES,
  translateContentDescription,
  translateContentName,
} from '@alohayo/config'

const areaModules = import.meta.glob('../../../content/maps/**/areas/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, MapAreaDefinition>

export async function mountGame(options: MountGameOptions): Promise<GameHandle> {
  if (!(options.container instanceof HTMLElement)) {
    throw new TypeError('mountGame requires an HTMLElement container')
  }
  const [
    { createGame },
    world,
    biomes,
    abilities,
    actions,
    appearancePools,
    slots,
    items,
    equipmentPools,
    archetypes,
  ] = await Promise.all([
    import('@alohayo/engine'),
    import('../../../content/core/world.json'),
    import('../../../content/core/biomes.json'),
    import('../../../content/characters/core/abilities.json'),
    import('../../../content/characters/core/actions.json'),
    import('../../../content/characters/core/appearance.json'),
    import('../../../content/characters/core/slots.json'),
    import('../../../content/characters/core/items.json'),
    import('../../../content/characters/core/equipment-pools.json'),
    import('../../../content/characters/core/archetypes.json'),
  ])
  const characters: CharacterContentDefinition = {
    schemaVersion: 1,
    abilities: abilities.default as AbilityDefinition[],
    actions: actions.default as CharacterActionDefinition[],
    appearancePools: appearancePools.default as CharacterAppearancePools,
    slots: slots.default as EquipmentSlotDefinition[],
    items: items.default as EquipmentItemDefinition[],
    equipmentPools: equipmentPools.default as EquipmentPoolDefinition[],
    archetypes: archetypes.default as CharacterArchetypeDefinition[],
  }
  return createGame(options, {
    world: world.default as WorldDefinition,
    biomes: biomes.default as BiomeDefinition[],
    mapAreas: Object.values(areaModules),
    characters,
  })
}

export type {
  BiomeDefinition,
  CharacterArchetypeDefinition,
  CharacterContentDefinition,
  ContentPackManifest,
  EntityDefinition,
  GameHandle,
  I18nCatalog,
  LanguageOption,
  LocaleCode,
  MapAreaDefinition,
  MountGameOptions,
  WorldDefinition,
  WorldManifest,
} from '@alohayo/config'

export {
  formatI18n,
  getI18nCatalog,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  SUPPORTED_LOCALES,
  translateContentDescription,
  translateContentName,
}
