import type { GameHandle, MountGameOptions } from '@alohayo/config'
import type { BiomeDefinition, WorldDefinition } from '@alohayo/config'

export async function mountGame(options: MountGameOptions): Promise<GameHandle> {
  if (!(options.container instanceof HTMLElement)) {
    throw new TypeError('mountGame requires an HTMLElement container')
  }
  const [{ createGame }, world, biomes] = await Promise.all([
    import('@alohayo/engine'),
    import('../../../content/core/world.json'),
    import('../../../content/core/biomes.json'),
  ])
  return createGame(options, {
    world: world.default as WorldDefinition,
    biomes: biomes.default as BiomeDefinition[],
  })
}

export type {
  BiomeDefinition,
  ContentPackManifest,
  EntityDefinition,
  GameHandle,
  MountGameOptions,
  WorldDefinition,
  WorldManifest,
} from '@alohayo/config'
