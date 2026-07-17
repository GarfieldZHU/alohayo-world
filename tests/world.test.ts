import { describe, expect, it } from 'vitest'
import {
  BIOME,
  applyMapAreas,
  generateChunk,
  generateWorld,
  hashSeed,
  overlayBlockedAt,
} from '../packages/map/src'
import {
  CONTENT_PACK_MIGRATION_REGISTRY_SHAPE,
  resolveContentPacks,
  type ContentPackManifest,
  type MapAreaDefinition,
  type MapAreaPackDefinition,
} from '../packages/config/src'
import biomes from '../content/core/biomes.json'
import coreManifest from '../content/core/manifest.json'
import terrainRules from '../content/core/terrain-rules.json'
import englishCatalog from '../i18n/en.json'
import chineseCatalog from '../i18n/zh-CN.json'
import archipelagoManifest from '../content/examples/archipelago/manifest.json'
import archipelagoMapAreas from '../content/examples/archipelago/maps/index.json'
import cloudbreakAtoll from '../content/examples/archipelago/maps/areas/cloudbreak-atoll.json'
import coreMapAreas from '../content/maps/core/index.json'
import terrainShowcase from '../content/maps/core/areas/terrain-showcase.json'
import wayfinderIsle from '../content/maps/core/areas/wayfinder-isle.json'

const isWaterBiome = (biome: number) =>
  biome === BIOME.deepOcean ||
  biome === BIOME.ocean ||
  biome === BIOME.shallowSea ||
  biome === BIOME.lake ||
  biome === BIOME.reef
const englishBiomeNames = englishCatalog.content.biomes as Record<string, { name: string }>
const chineseBiomeNames = chineseCatalog.content.biomes as Record<string, { name: string }>
const corePackManifest = coreManifest as ContentPackManifest
const archipelagoPackManifest = archipelagoManifest as ContentPackManifest
const coreMapAreaPack = coreMapAreas as MapAreaPackDefinition
const archipelagoMapAreaPack = archipelagoMapAreas as MapAreaPackDefinition

describe('world generation', () => {
  it('documents every terrain with rules and localized names', () => {
    const biomeIds = new Set(biomes.map((biome) => biome.id))
    const ruleIds = new Set(terrainRules.rules.map((rule) => rule.terrainId))

    expect(ruleIds).toEqual(biomeIds)
    for (const biome of biomes) {
      expect(englishBiomeNames[biome.id]?.name).toBeTruthy()
      expect(chineseBiomeNames[biome.id]?.name).toBeTruthy()
      const rule = terrainRules.rules.find((candidate) => candidate.terrainId === biome.id)
      expect(rule?.realWorldDescription.length).toBeGreaterThan(32)
      expect(rule?.alohayoBehavior.length).toBeGreaterThan(32)
      expect(rule?.generation.conditions.length).toBeGreaterThanOrEqual(2)
      expect(rule?.surfaceEffects.length).toBeGreaterThan(0)
      expect(rule?.physicalBehavior.movement).toBeTruthy()
      expect(rule?.destruction.methods.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic for a seed', () => {
    const first = generateWorld('alohayo', 32, 24)
    const second = generateWorld('alohayo', 32, 24)
    expect(first.hash).toBe(second.hash)
    expect(first.biomes).toEqual(second.biomes)
    expect(first.slope).toEqual(second.slope)
    expect(first.flowDirection).toEqual(second.flowDirection)
    expect(first.flowAccumulation).toEqual(second.flowAccumulation)
    expect(first.watershed).toEqual(second.watershed)
  })

  it('changes when the seed changes', () => {
    expect(generateWorld('alohayo', 32, 24).hash).not.toBe(generateWorld('cloudbreak', 32, 24).hash)
  })

  it('generates streamed chunks deterministically', () => {
    const first = generateChunk('alohayo', -2, 3, 32)
    const second = generateChunk('alohayo', -2, 3, 32)
    expect(first.hash).toBe(second.hash)
    expect(first.biomes).toEqual(second.biomes)
    expect(first.region).toEqual(second.region)
    expect(first.flowAccumulation).toEqual(second.flowAccumulation)
  })

  it('uses the same FNV seed contract as Rust', () => {
    expect(hashSeed('alohayo')).toBe(2244857266)
  })

  it('generates deterministic settlements and roads for the same seed', () => {
    const first = generateChunk('trade-routes', 1, -1, 64)
    const second = generateChunk('trade-routes', 1, -1, 64)
    expect(first.settlements).toEqual(second.settlements)
    expect(first.rivers).toEqual(second.rivers)
    expect(first.roads).toEqual(second.roads)
    const world = generateWorld('trade-routes-network', 160, 120)
    expect(
      world.roads.some((road) => road.points.some((point) => !Number.isInteger(point.x)))
    ).toBe(true)
    const riverSamples = Array.from({ length: 12 }, (_, index) =>
      generateWorld(`river-sample-${index}`, 160, 120)
    )
    expect(riverSamples.some((sample) => sample.rivers.length > 0)).toBe(true)
  })

  it('exposes extended terrain families in generated worlds', () => {
    const world = generateWorld('terrain-spectrum', 160, 120)
    const codes = new Set(world.biomes)
    expect(codes.has(BIOME.tundra) || codes.has(BIOME.snow) || codes.has(BIOME.glacier)).toBe(true)
    expect(codes.has(BIOME.savanna) || codes.has(BIOME.desert) || codes.has(BIOME.oasis)).toBe(true)
    expect(world.settlements.length).toBeGreaterThan(0)
  })

  it('assigns every cell to valid terrain and topology', () => {
    const world = generateWorld('atlas-topology', 96, 72)
    const validCodes = new Set<number>(Object.values(BIOME))
    expect(world.biomes.every((code) => validCodes.has(code))).toBe(true)
    expect(world.mainlandId).toBeGreaterThan(0)
    for (let index = 0; index < world.biomes.length; index += 1) {
      expect(Boolean(world.landmass[index]) !== Boolean(world.waterbody[index])).toBe(true)
    }
  })

  it('keeps seeded ocean coverage within the configured wide range', () => {
    const ratios = Array.from({ length: 18 }, (_, index) => {
      const world = generateWorld(`coverage-${index}`, 96, 72)
      const waterCells = world.biomes.reduce(
        (total, biome) => total + Number(isWaterBiome(biome)),
        0
      )
      return waterCells / world.biomes.length
    })

    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(0.1)
      expect(ratio).toBeLessThanOrEqual(0.8)
    }

    const average = ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length
    expect(average).toBeGreaterThanOrEqual(0.3)
    expect(average).toBeLessThanOrEqual(0.6)
  })

  it('builds hydrology outputs with real drainage fields', () => {
    const world = generateWorld('hydrology-fields', 96, 72)
    expect(world.slope.length).toBe(world.biomes.length)
    expect(world.flowDirection.length).toBe(world.biomes.length)
    expect(world.flowAccumulation.length).toBe(world.biomes.length)
    expect(world.watershed.length).toBe(world.biomes.length)
    expect(world.depression.length).toBe(world.biomes.length)
    expect(world.erosionPotential.length).toBe(world.biomes.length)
    expect(world.sedimentLoad.length).toBe(world.biomes.length)
    expect(world.deposition.length).toBe(world.biomes.length)
    expect(world.floodplain.length).toBe(world.biomes.length)
    expect(world.flowAccumulation.some((value) => value > 6)).toBe(true)
    expect(world.watershed.some((value) => value > 0)).toBe(true)
    expect(world.erosionPotential.some((value) => value > 0)).toBe(true)
    expect(world.sedimentLoad.some((value) => value > 0)).toBe(true)
    expect(world.deposition.some((value) => value > 0)).toBe(true)
    expect(world.floodplain.some((value) => value > 0)).toBe(true)
  })

  it('keeps geomorphology metadata deterministic and config-sensitive', () => {
    const baseline = generateWorld('geomorphology-config', 96, 72)
    const repeated = generateWorld('geomorphology-config', 96, 72)
    const lowTransport = generateWorld(
      'geomorphology-config',
      96,
      72,
      undefined,
      undefined,
      undefined,
      {
        erosionSlopeWeight: 0.62,
        erosionFlowWeight: 0.38,
        depressionRetention: 0.72,
        sedimentTransport: 0.2,
        depositionSlopeMax: 0.2,
        floodplainAccumulationMin: 0.28,
        floodplainSlopeMax: 0.16,
        floodplainRadius: 2,
      }
    )

    expect(baseline.hash).toBe(repeated.hash)
    expect(Array.from(baseline.sedimentLoad)).toEqual(Array.from(repeated.sedimentLoad))
    expect(lowTransport.hash).not.toBe(baseline.hash)
    expect(Array.from(lowTransport.deposition)).not.toEqual(Array.from(baseline.deposition))
  })

  it('keeps river mouths and drainage moving toward equal or lower terrain', () => {
    const world = generateWorld('hydrology-river-gradient', 160, 120)
    for (const river of world.rivers.slice(0, 8)) {
      for (let index = 1; index < river.points.length; index += 1) {
        const previous = river.points[index - 1]!
        const current = river.points[index]!
        const previousX = Math.max(0, Math.min(world.width - 1, Math.round(previous.x)))
        const previousY = Math.max(0, Math.min(world.height - 1, Math.round(previous.y)))
        const currentX = Math.max(0, Math.min(world.width - 1, Math.round(current.x)))
        const currentY = Math.max(0, Math.min(world.height - 1, Math.round(current.y)))
        const previousElevation = world.elevation[previousY * world.width + previousX]! / 255
        const currentElevation = world.elevation[currentY * world.width + currentX]! / 255
        expect(currentElevation).toBeLessThanOrEqual(previousElevation + 0.06)
      }
    }
  })

  it('applies authored map areas and landmarks deterministically', () => {
    const terrainCodes = {
      'core:shallow-sea': BIOME.shallowSea,
      'core:coast': BIOME.coast,
      'core:grassland': BIOME.grassland,
      'core:highland': BIOME.highland,
      'core:bare-rock': BIOME.bareRock,
    }
    const first = applyMapAreas(
      generateWorld('authored', 128, 96),
      [wayfinderIsle as MapAreaDefinition],
      terrainCodes
    )
    const second = applyMapAreas(
      generateWorld('authored', 128, 96),
      [wayfinderIsle as MapAreaDefinition],
      terrainCodes
    )
    expect(first.hash).toBe(second.hash)
    expect(first.areaIds).toContain('core:wayfinder-isle')
    expect(first.landmarks[0]?.id).toBe('core:wayfinder-beacon')
    expect(first.landmarks.some((landmark) => landmark.id === 'core:wayfinder-isle-keeper')).toBe(
      true
    )
    expect(first.authoredEntities[0]).toMatchObject({
      id: 'core:wayfinder-isle-keeper',
      areaId: 'core:wayfinder-isle',
    })
    expect(first.protectedRegions[0]?.blocks).toContain('settlements')
    expect(first.generatorModifiers[0]).toMatchObject({
      kind: 'settlement-bias',
      strength: 0.35,
    })
    expect(
      first.settlements.every(
        (settlement) =>
          !overlayBlockedAt(first.protectedRegions, 'settlements', settlement.x, settlement.y)
      )
    ).toBe(true)
    expect(first.authoredArea.some((area) => area > 0)).toBe(true)
  })

  it('can enable a dev terrain showcase containing every core terrain', () => {
    const terrainCodes = Object.fromEntries(biomes.map((biome) => [biome.id, biome.code]))
    const showcase = { ...(terrainShowcase as MapAreaDefinition), enabled: true }
    const world = applyMapAreas(
      generateWorld('terrain-showcase', 128, 96),
      [showcase],
      terrainCodes
    )
    const codes = new Set(world.biomes)

    for (const biome of biomes) {
      expect(codes.has(biome.code), biome.id).toBe(true)
    }
    expect(world.areaIds).toContain('core:terrain-showcase')
  })

  it('keeps richer authored overlay contracts in example content packs', () => {
    expect(cloudbreakAtoll.entities).toEqual([
      expect.objectContaining({
        id: 'archipelago:cloudbreak-scout',
        kind: 'npc-spawn',
        archetypeId: 'core:wayfinder',
      }),
    ])
    expect(cloudbreakAtoll.protectedRegions).toEqual([
      expect.objectContaining({
        id: 'archipelago:cloudbreak-lagoon-core',
        shape: 'ellipse',
      }),
    ])
    expect(cloudbreakAtoll.modifiers).toEqual([
      expect.objectContaining({
        id: 'archipelago:cloudbreak-harbor-bias',
        kind: 'settlement-bias',
        strength: 0.42,
      }),
    ])
  })

  it('resolves content packs in dependency order and merges authored areas deterministically', () => {
    const resolution = resolveContentPacks({
      manifests: {
        '/content/examples/archipelago/manifest.json': archipelagoPackManifest,
        '/content/core/manifest.json': corePackManifest,
      },
      mapAreaPacks: {
        '/content/maps/core/index.json': coreMapAreaPack,
        '/content/examples/archipelago/maps/index.json': archipelagoMapAreaPack,
      },
      mapAreas: {
        '/content/maps/core/areas/terrain-showcase.json': terrainShowcase as MapAreaDefinition,
        '/content/maps/core/areas/wayfinder-isle.json': wayfinderIsle as MapAreaDefinition,
        '/content/examples/archipelago/maps/areas/cloudbreak-atoll.json':
          cloudbreakAtoll as MapAreaDefinition,
      },
    })

    expect(resolution.orderedPackIds).toEqual(['core', 'archipelago'])
    expect(
      resolution.orderedPacks.map((pack) => ({
        id: pack.pack.id,
        depth: pack.dependencyDepth,
        areaIds: pack.mapAreas.map((entry) => entry.area.id),
      }))
    ).toEqual([
      {
        id: 'core',
        depth: 0,
        areaIds: ['core:wayfinder-isle', 'core:terrain-showcase'],
      },
      {
        id: 'archipelago',
        depth: 1,
        areaIds: ['archipelago:cloudbreak-atoll'],
      },
    ])
    expect(resolution.mapAreas.map((area) => area.id)).toEqual([
      'core:wayfinder-isle',
      'core:terrain-showcase',
      'archipelago:cloudbreak-atoll',
    ])
    expect(resolution.report.orderedPackIds).toEqual(['core', 'archipelago'])
    expect(resolution.report.mapAreaIds).toEqual([
      'core:wayfinder-isle',
      'core:terrain-showcase',
      'archipelago:cloudbreak-atoll',
    ])
    expect(resolution.report.resolutionHash).toBe('fnv32:10cb56c6')
    expect(resolution.report.mapAreaProvenance[2]).toMatchObject({
      areaId: 'archipelago:cloudbreak-atoll',
      sourcePackId: 'archipelago',
      sourcePackVersion: '0.1.0',
      sourceMapAreaPackId: 'archipelago:map-areas',
      ownership: 'additive',
      resolutionOrder: 2,
    })
    expect(resolution.saveMetadata).toMatchObject({
      orderedPackIds: ['core', 'archipelago'],
      resolutionHash: 'fnv32:10cb56c6',
      resolvedMapAreaIds: [
        'core:wayfinder-isle',
        'core:terrain-showcase',
        'archipelago:cloudbreak-atoll',
      ],
    })
    expect(resolution.resolvedMapAreas[2]).toMatchObject({
      sourcePackId: 'archipelago',
      sourceMapAreaPackId: 'archipelago:map-areas',
      sourceAreaPath: '/content/examples/archipelago/maps/areas/cloudbreak-atoll.json',
      ownership: 'additive',
    })
    expect(resolution.resolvedMapAreas[2]?.area.entities?.[0]?.id).toBe(
      'archipelago:cloudbreak-scout'
    )
    expect(resolution.resolvedMapAreas[2]?.area.protectedRegions?.[0]?.id).toBe(
      'archipelago:cloudbreak-lagoon-core'
    )
    expect(resolution.resolvedMapAreas[2]?.area.modifiers?.[0]?.id).toBe(
      'archipelago:cloudbreak-harbor-bias'
    )
  })

  it('changes the resolution hash when pack versions change', () => {
    const base = resolveContentPacks({
      manifests: {
        '/content/examples/archipelago/manifest.json': archipelagoPackManifest,
        '/content/core/manifest.json': corePackManifest,
      },
      mapAreaPacks: {
        '/content/maps/core/index.json': coreMapAreaPack,
        '/content/examples/archipelago/maps/index.json': archipelagoMapAreaPack,
      },
      mapAreas: {
        '/content/maps/core/areas/terrain-showcase.json': terrainShowcase as MapAreaDefinition,
        '/content/maps/core/areas/wayfinder-isle.json': wayfinderIsle as MapAreaDefinition,
        '/content/examples/archipelago/maps/areas/cloudbreak-atoll.json':
          cloudbreakAtoll as MapAreaDefinition,
      },
    })
    const changed = resolveContentPacks({
      manifests: {
        '/content/examples/archipelago/manifest.json': {
          ...archipelagoPackManifest,
          version: '0.1.1',
        } satisfies ContentPackManifest,
        '/content/core/manifest.json': corePackManifest,
      },
      mapAreaPacks: {
        '/content/maps/core/index.json': coreMapAreaPack,
        '/content/examples/archipelago/maps/index.json': archipelagoMapAreaPack,
      },
      mapAreas: {
        '/content/maps/core/areas/terrain-showcase.json': terrainShowcase as MapAreaDefinition,
        '/content/maps/core/areas/wayfinder-isle.json': wayfinderIsle as MapAreaDefinition,
        '/content/examples/archipelago/maps/areas/cloudbreak-atoll.json':
          cloudbreakAtoll as MapAreaDefinition,
      },
    })

    expect(changed.report.resolutionHash).not.toBe(base.report.resolutionHash)
    expect(changed.saveMetadata.resolutionHash).toBe(changed.report.resolutionHash)
  })

  it('reports overlapping map-area diagnostics deterministically', () => {
    const overlappingPack = {
      schemaVersion: 1,
      id: 'overlap-pack',
      name: 'Overlap Pack',
      version: '0.1.0',
      description: 'Pack used to verify overlap diagnostics.',
      dependencies: ['core'],
      world: './world.json',
      biomes: './biomes.json',
      mapAreas: './maps/index.json',
    } satisfies ContentPackManifest
    const overlapIndex = {
      schemaVersion: 1,
      id: 'overlap-pack:map-areas',
      name: 'Overlap Areas',
      description: 'Fixture pack.',
      areas: ['./areas/overlap-fixture.json'],
    } satisfies MapAreaPackDefinition
    const overlapArea = {
      ...(wayfinderIsle as MapAreaDefinition),
      id: 'overlap-pack:fixture',
      placement: { mode: 'absolute', x: 12, y: 12 },
    } satisfies MapAreaDefinition

    const resolution = resolveContentPacks({
      manifests: {
        '/content/core/manifest.json': corePackManifest,
        '/content/overlap/manifest.json': overlappingPack,
      },
      mapAreaPacks: {
        '/content/maps/core/index.json': coreMapAreaPack,
        '/content/overlap/maps/index.json': overlapIndex,
      },
      mapAreas: {
        '/content/maps/core/areas/terrain-showcase.json': terrainShowcase as MapAreaDefinition,
        '/content/maps/core/areas/wayfinder-isle.json': {
          ...(wayfinderIsle as MapAreaDefinition),
          placement: { mode: 'absolute', x: 0, y: 0 },
        },
        '/content/overlap/maps/areas/overlap-fixture.json': overlapArea,
      },
    })

    expect(resolution.report.diagnostics).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        code: 'overlapping-map-areas',
        relatedPackIds: ['core', 'overlap-pack'],
        relatedAreaIds: ['core:wayfinder-isle', 'overlap-pack:fixture'],
      })
    )
  })

  it('exports the current migration registry shape for future schema versions', () => {
    expect(CONTENT_PACK_MIGRATION_REGISTRY_SHAPE).toEqual({
      currentSchemaVersion: 1,
      supportedSchemaVersions: [1],
      failurePolicy: 'hard-fail',
      steps: [],
    })
  })

  it('fails on missing content-pack dependencies', () => {
    expect(() =>
      resolveContentPacks({
        manifests: {
          '/content/examples/archipelago/manifest.json': archipelagoPackManifest,
        },
      })
    ).toThrow('depends on missing pack "core"')
  })

  it('fails on cyclic content-pack dependencies', () => {
    expect(() =>
      resolveContentPacks({
        manifests: {
          '/content/a/manifest.json': {
            ...corePackManifest,
            id: 'pack-a',
            dependencies: ['pack-b'],
          } satisfies ContentPackManifest,
          '/content/b/manifest.json': {
            ...archipelagoPackManifest,
            id: 'pack-b',
            dependencies: ['pack-a'],
          } satisfies ContentPackManifest,
        },
      })
    ).toThrow('content pack dependency cycle')
  })

  it('fails when declared ownership does not match the supported file policy', () => {
    expect(() =>
      resolveContentPacks({
        manifests: {
          '/content/examples/archipelago/manifest.json': {
            ...archipelagoPackManifest,
            ownership: {
              mapAreas: 'authoritative',
            },
          } satisfies ContentPackManifest,
          '/content/core/manifest.json': corePackManifest,
        },
      })
    ).toThrow('must declare ownership "additive" for "mapAreas"')
  })

  it('reports both sources when map area IDs collide', () => {
    const duplicateArea = {
      ...(cloudbreakAtoll as MapAreaDefinition),
      id: 'core:wayfinder-isle',
    } satisfies MapAreaDefinition

    expect(() =>
      resolveContentPacks({
        manifests: {
          '/content/core/manifest.json': corePackManifest,
          '/content/examples/archipelago/manifest.json': archipelagoPackManifest,
        },
        mapAreaPacks: {
          '/content/maps/core/index.json': coreMapAreaPack,
          '/content/examples/archipelago/maps/index.json': archipelagoMapAreaPack,
        },
        mapAreas: {
          '/content/maps/core/areas/terrain-showcase.json': terrainShowcase as MapAreaDefinition,
          '/content/maps/core/areas/wayfinder-isle.json': wayfinderIsle as MapAreaDefinition,
          '/content/examples/archipelago/maps/areas/cloudbreak-atoll.json': duplicateArea,
        },
      })
    ).toThrow(
      'duplicate map area id "core:wayfinder-isle" from pack "archipelago" at "/content/examples/archipelago/maps/areas/cloudbreak-atoll.json"; first declared by pack "core" at "/content/maps/core/areas/wayfinder-isle.json"'
    )
  })
})
