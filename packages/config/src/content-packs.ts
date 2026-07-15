import type {
  ContentPackDependencyNode,
  ContentPackMigrationRegistryShape,
  ContentPackMapAreaProvenance,
  ContentPackResolutionDiagnostic,
  ContentPackResolutionReport,
  ContentPackSaveMetadata,
  ContentPackFileKind,
  ContentPackManifest,
  ContentPackOwnershipMode,
  MapAreaDefinition,
  MapAreaPackDefinition,
  ResolvedMapAreaDefinition,
} from './index'

export interface ContentPackResolutionInput {
  manifests: Record<string, ContentPackManifest>
  mapAreaPacks?: Record<string, MapAreaPackDefinition>
  mapAreas?: Record<string, MapAreaDefinition>
}

export interface ResolvedContentPack {
  pack: ContentPackManifest
  manifestPath: string
  dependencyDepth: number
  mapAreaPack?: MapAreaPackDefinition
  mapAreaPackPath?: string
  mapAreas: ResolvedMapAreaDefinition[]
  mapAreaPaths: string[]
}

export interface ResolvedContentPacks {
  orderedPacks: ResolvedContentPack[]
  orderedPackIds: string[]
  mapAreas: MapAreaDefinition[]
  resolvedMapAreas: ResolvedMapAreaDefinition[]
  report: ContentPackResolutionReport
  saveMetadata: ContentPackSaveMetadata
}

interface ManifestEntry {
  pack: ContentPackManifest
  manifestPath: string
}

const CONTENT_PACK_OWNERSHIP_RULES: Record<ContentPackFileKind, ContentPackOwnershipMode> = {
  world: 'authoritative',
  biomes: 'authoritative',
  terrainRules: 'authoritative',
  mapAreas: 'additive',
  characters: 'authoritative',
  entities: 'additive',
}

export const CONTENT_PACK_MIGRATION_REGISTRY_SHAPE: ContentPackMigrationRegistryShape = {
  currentSchemaVersion: 1,
  supportedSchemaVersions: [1],
  failurePolicy: 'hard-fail',
  steps: [],
}

export function resolveContentPacks({
  manifests,
  mapAreaPacks = {},
  mapAreas = {},
}: ContentPackResolutionInput): ResolvedContentPacks {
  const manifestEntries = buildManifestEntries(manifests)
  const orderedPackIds = resolvePackOrder(manifestEntries)
  const depthByPackId = computeDependencyDepths(manifestEntries)
  const packById = new Map(manifestEntries.map((entry) => [entry.pack.id, entry]))
  const seenMapAreaIds = new Map<string, { packId: string; sourceAreaPath: string }>()
  const orderedPacks = orderedPackIds.map((packId) => {
    const entry = packById.get(packId)
    if (!entry) {
      throw new Error(`resolved pack "${packId}" is missing from the manifest set`)
    }

    const mapAreaResolution = resolveMapAreasForPack(entry, mapAreaPacks, mapAreas, seenMapAreaIds)

    return {
      pack: entry.pack,
      manifestPath: entry.manifestPath,
      dependencyDepth: depthByPackId.get(packId) ?? 0,
      mapAreaPack: mapAreaResolution.mapAreaPack,
      mapAreaPackPath: mapAreaResolution.mapAreaPackPath,
      mapAreas: mapAreaResolution.mapAreas,
      mapAreaPaths: mapAreaResolution.mapAreaPaths,
    } satisfies ResolvedContentPack
  })

  const report = buildResolutionReport(orderedPacks, orderedPackIds)
  const saveMetadata = buildSaveMetadata(orderedPacks, orderedPackIds, report.resolutionHash)

  return {
    orderedPacks,
    orderedPackIds,
    mapAreas: orderedPacks.flatMap((pack) => pack.mapAreas.map((entry) => entry.area)),
    resolvedMapAreas: orderedPacks.flatMap((pack) => pack.mapAreas),
    report,
    saveMetadata,
  }
}

function buildManifestEntries(manifests: Record<string, ContentPackManifest>): ManifestEntry[] {
  const entries = Object.entries(manifests)
    .map(([manifestPath, pack]) => ({ manifestPath, pack }))
    .sort((left, right) => left.pack.id.localeCompare(right.pack.id))

  const seenPackIds = new Set<string>()
  for (const entry of entries) {
    if (!entry.pack?.id) {
      throw new Error(`content pack at "${entry.manifestPath}" is missing an id`)
    }
    if (seenPackIds.has(entry.pack.id)) {
      throw new Error(`duplicate content pack id "${entry.pack.id}"`)
    }
    seenPackIds.add(entry.pack.id)
    validateOwnership(entry)
  }
  return entries
}

function resolvePackOrder(entries: ManifestEntry[]): string[] {
  const packById = new Map(entries.map((entry) => [entry.pack.id, entry]))
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const entry of entries) {
    indegree.set(entry.pack.id, entry.pack.dependencies.length)
    for (const dependencyId of entry.pack.dependencies) {
      if (!packById.has(dependencyId)) {
        throw new Error(`content pack "${entry.pack.id}" depends on missing pack "${dependencyId}"`)
      }
      const dependentPackIds = dependents.get(dependencyId) ?? []
      dependentPackIds.push(entry.pack.id)
      dependents.set(dependencyId, dependentPackIds)
    }
  }

  const ready = entries
    .filter((entry) => (indegree.get(entry.pack.id) ?? 0) === 0)
    .map((entry) => entry.pack.id)
    .sort()
  const orderedPackIds: string[] = []

  while (ready.length > 0) {
    const packId = ready.shift()
    if (!packId) {
      break
    }
    orderedPackIds.push(packId)
    const downstream = (dependents.get(packId) ?? []).sort()
    for (const dependentPackId of downstream) {
      const nextIndegree = (indegree.get(dependentPackId) ?? 0) - 1
      indegree.set(dependentPackId, nextIndegree)
      if (nextIndegree === 0) {
        insertSorted(ready, dependentPackId)
      }
    }
  }

  if (orderedPackIds.length !== entries.length) {
    throw new Error(describeDependencyCycle(entries))
  }

  return orderedPackIds
}

function computeDependencyDepths(entries: ManifestEntry[]): Map<string, number> {
  const packById = new Map(entries.map((entry) => [entry.pack.id, entry]))
  const depths = new Map<string, number>()
  const visiting = new Set<string>()

  const visit = (packId: string): number => {
    const knownDepth = depths.get(packId)
    if (knownDepth !== undefined) {
      return knownDepth
    }
    if (visiting.has(packId)) {
      throw new Error(describeDependencyCycle(entries))
    }
    visiting.add(packId)
    const entry = packById.get(packId)
    if (!entry) {
      throw new Error(`content pack "${packId}" is missing from the manifest set`)
    }
    const depth =
      entry.pack.dependencies.length === 0
        ? 0
        : Math.max(...entry.pack.dependencies.map((dependencyId) => visit(dependencyId))) + 1
    visiting.delete(packId)
    depths.set(packId, depth)
    return depth
  }

  for (const entry of entries) {
    visit(entry.pack.id)
  }
  return depths
}

function describeDependencyCycle(entries: ManifestEntry[]): string {
  const packById = new Map(entries.map((entry) => [entry.pack.id, entry]))
  const visited = new Set<string>()
  const stack: string[] = []

  const search = (packId: string): string | null => {
    if (stack.includes(packId)) {
      const start = stack.indexOf(packId)
      return [...stack.slice(start), packId].join(' -> ')
    }
    if (visited.has(packId)) {
      return null
    }
    visited.add(packId)
    stack.push(packId)
    const entry = packById.get(packId)
    for (const dependencyId of entry?.pack.dependencies ?? []) {
      const cycle = search(dependencyId)
      if (cycle) {
        return cycle
      }
    }
    stack.pop()
    return null
  }

  for (const entry of entries) {
    const cycle = search(entry.pack.id)
    if (cycle) {
      return `content pack dependency cycle: ${cycle}`
    }
  }
  return 'content pack dependency cycle detected'
}

function resolveMapAreasForPack(
  entry: ManifestEntry,
  mapAreaPacks: Record<string, MapAreaPackDefinition>,
  mapAreas: Record<string, MapAreaDefinition>,
  seenMapAreaIds: Map<string, { packId: string; sourceAreaPath: string }>
): Pick<ResolvedContentPack, 'mapAreaPack' | 'mapAreaPackPath' | 'mapAreas' | 'mapAreaPaths'> {
  if (!entry.pack.mapAreas) {
    return {
      mapAreas: [],
      mapAreaPaths: [],
    }
  }

  const mapAreaPackPath = resolveRelativeModulePath(entry.manifestPath, entry.pack.mapAreas)
  const mapAreaPack = mapAreaPacks[mapAreaPackPath]
  if (!mapAreaPack) {
    throw new Error(
      `content pack "${entry.pack.id}" references missing map area pack "${entry.pack.mapAreas}"`
    )
  }
  if (mapAreaPack.schemaVersion !== 1) {
    throw new Error(`map area pack "${mapAreaPack.id}" must use schemaVersion 1`)
  }

  const areaDefinitions = mapAreaPack.areas.map((areaPath) => {
    const resolvedPath = resolveRelativeModulePath(mapAreaPackPath, areaPath)
    const area = mapAreas[resolvedPath]
    if (!area) {
      throw new Error(`map area pack "${mapAreaPack.id}" references missing area "${areaPath}"`)
    }
    const previous = seenMapAreaIds.get(area.id)
    if (previous) {
      throw new Error(
        `duplicate map area id "${area.id}" from pack "${entry.pack.id}" at "${resolvedPath}"; first declared by pack "${previous.packId}" at "${previous.sourceAreaPath}"`
      )
    }
    seenMapAreaIds.set(area.id, { packId: entry.pack.id, sourceAreaPath: resolvedPath })
    return { area, resolvedPath }
  })

  return {
    mapAreaPack,
    mapAreaPackPath,
    mapAreas: areaDefinitions.map(
      ({ area, resolvedPath }) =>
        ({
          area,
          sourcePackId: entry.pack.id,
          sourcePackVersion: entry.pack.version,
          sourceManifestPath: entry.manifestPath,
          sourceMapAreaPackId: mapAreaPack.id,
          sourceMapAreaPackPath: mapAreaPackPath,
          sourceAreaPath: resolvedPath,
          ownership: resolveOwnership(entry.pack, 'mapAreas'),
        }) satisfies ResolvedMapAreaDefinition
    ),
    mapAreaPaths: areaDefinitions.map(({ resolvedPath }) => resolvedPath),
  }
}

function validateOwnership(entry: ManifestEntry) {
  const declaredOwnership = entry.pack.ownership ?? {}
  for (const [fileKind, ownership] of Object.entries(declaredOwnership) as Array<
    [ContentPackFileKind, ContentPackOwnershipMode]
  >) {
    const expectedOwnership = CONTENT_PACK_OWNERSHIP_RULES[fileKind]
    if (!expectedOwnership) {
      throw new Error(
        `content pack "${entry.pack.id}" declares unknown ownership kind "${fileKind}"`
      )
    }
    if (ownership !== expectedOwnership) {
      throw new Error(
        `content pack "${entry.pack.id}" must declare ownership "${expectedOwnership}" for "${fileKind}"`
      )
    }
    if (!hasFileReference(entry.pack, fileKind)) {
      throw new Error(
        `content pack "${entry.pack.id}" declares ownership for "${fileKind}" but provides no file reference`
      )
    }
  }
}

function resolveOwnership(
  pack: ContentPackManifest,
  fileKind: ContentPackFileKind
): ContentPackOwnershipMode {
  return pack.ownership?.[fileKind] ?? CONTENT_PACK_OWNERSHIP_RULES[fileKind]
}

function hasFileReference(pack: ContentPackManifest, fileKind: ContentPackFileKind): boolean {
  switch (fileKind) {
    case 'world':
      return Boolean(pack.world)
    case 'biomes':
      return Boolean(pack.biomes)
    case 'terrainRules':
      return false
    case 'mapAreas':
      return Boolean(pack.mapAreas)
    case 'characters':
      return Boolean(pack.characters)
    case 'entities':
      return false
  }
}

function insertSorted(values: string[], nextValue: string) {
  if (values.includes(nextValue)) {
    return
  }
  values.push(nextValue)
  values.sort()
}

function resolveRelativeModulePath(fromPath: string, relativePath: string): string {
  if (relativePath.startsWith('/')) {
    return normalizeModulePath(relativePath)
  }

  const baseParts = fromPath.split('/')
  baseParts.pop()
  for (const part of relativePath.split('/')) {
    if (!part || part === '.') {
      continue
    }
    if (part === '..') {
      if (baseParts.length > 0) {
        baseParts.pop()
      }
      continue
    }
    baseParts.push(part)
  }
  return normalizeModulePath(baseParts.join('/'))
}

function normalizeModulePath(path: string): string {
  const normalizedParts: string[] = []
  const isAbsolute = path.startsWith('/')
  for (const part of path.split('/')) {
    if (!part || part === '.') {
      continue
    }
    if (part === '..') {
      if (normalizedParts.length > 0 && normalizedParts[normalizedParts.length - 1] !== '..') {
        normalizedParts.pop()
      } else if (!isAbsolute) {
        normalizedParts.push('..')
      }
      continue
    }
    normalizedParts.push(part)
  }
  const normalizedPath = normalizedParts.join('/')
  if (isAbsolute) {
    return `/${normalizedPath}`
  }
  return normalizedPath
}

function buildResolutionReport(
  orderedPacks: ResolvedContentPack[],
  orderedPackIds: string[]
): ContentPackResolutionReport {
  const dependencyGraph = orderedPacks.map(
    (pack) =>
      ({
        packId: pack.pack.id,
        dependencies: [...pack.pack.dependencies],
        dependencyDepth: pack.dependencyDepth,
      }) satisfies ContentPackDependencyNode
  )
  const mapAreaIds = orderedPacks.flatMap((pack) => pack.mapAreas.map((entry) => entry.area.id))
  const diagnostics: ContentPackResolutionDiagnostic[] = []
  let resolutionOrder = 0
  const mapAreaProvenance: ContentPackMapAreaProvenance[] = orderedPacks.flatMap((pack) =>
    pack.mapAreas.map((entry) => ({
      areaId: entry.area.id,
      sourcePackId: entry.sourcePackId,
      sourcePackVersion: entry.sourcePackVersion,
      sourceManifestPath: entry.sourceManifestPath,
      sourceMapAreaPackId: entry.sourceMapAreaPackId,
      sourceAreaPath: entry.sourceAreaPath,
      ownership: entry.ownership,
      resolutionOrder: resolutionOrder++,
    }))
  )

  for (let index = 0; index < orderedPacks.length; index += 1) {
    const leftPack = orderedPacks[index]
    if (!leftPack) {
      continue
    }
    for (let compareIndex = index + 1; compareIndex < orderedPacks.length; compareIndex += 1) {
      const rightPack = orderedPacks[compareIndex]
      if (!rightPack) {
        continue
      }
      for (const leftArea of leftPack.mapAreas) {
        for (const rightArea of rightPack.mapAreas) {
          if (areasOverlap(leftArea.area, rightArea.area)) {
            diagnostics.push({
              level: 'warning',
              code: 'overlapping-map-areas',
              message: `map areas "${leftArea.area.id}" and "${rightArea.area.id}" overlap in ${leftArea.area.placement.mode} placement space`,
              relatedPackIds: [leftPack.pack.id, rightPack.pack.id],
              relatedAreaIds: [leftArea.area.id, rightArea.area.id],
            })
          }
        }
      }
    }
  }

  return {
    orderedPackIds,
    dependencyGraph,
    mapAreaIds,
    resolutionHash: hashResolutionSignature(orderedPacks),
    diagnostics,
    mapAreaProvenance,
  }
}

function buildSaveMetadata(
  orderedPacks: ResolvedContentPack[],
  orderedPackIds: string[],
  resolutionHash: string
): ContentPackSaveMetadata {
  return {
    orderedPackIds,
    resolutionHash,
    packs: orderedPacks.map((pack) => ({
      id: pack.pack.id,
      version: pack.pack.version,
      schemaVersion: pack.pack.schemaVersion,
      manifestPath: pack.manifestPath,
      dependencyDepth: pack.dependencyDepth,
      mapAreaIds: pack.mapAreas.map((entry) => entry.area.id),
    })),
    resolvedMapAreaIds: orderedPacks.flatMap((pack) => pack.mapAreas.map((entry) => entry.area.id)),
  }
}

function areasOverlap(left: MapAreaDefinition, right: MapAreaDefinition): boolean {
  if (left.placement.mode !== right.placement.mode) {
    return false
  }

  const leftRight = left.placement.x + left.width
  const leftBottom = left.placement.y + left.height
  const rightRight = right.placement.x + right.width
  const rightBottom = right.placement.y + right.height

  return (
    left.placement.x < rightRight &&
    leftRight > right.placement.x &&
    left.placement.y < rightBottom &&
    leftBottom > right.placement.y
  )
}

function hashResolutionSignature(orderedPacks: ResolvedContentPack[]): string {
  const signature = orderedPacks
    .flatMap((pack) => [
      `pack:${pack.pack.id}@${pack.pack.version}@${pack.manifestPath}@${pack.dependencyDepth}`,
      ...pack.mapAreas.map(
        (entry) =>
          `area:${entry.area.id}@${entry.sourceAreaPath}@${entry.sourcePackId}@${entry.sourcePackVersion}`
      ),
    ])
    .join('|')

  let hash = 2166136261
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
