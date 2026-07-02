import type { ContentPackManifest, MapAreaDefinition, MapAreaPackDefinition } from './index'

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
  mapAreas: MapAreaDefinition[]
  mapAreaPaths: string[]
}

export interface ResolvedContentPacks {
  orderedPacks: ResolvedContentPack[]
  orderedPackIds: string[]
  mapAreas: MapAreaDefinition[]
}

interface ManifestEntry {
  pack: ContentPackManifest
  manifestPath: string
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
  const seenMapAreaIds = new Set<string>()
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

  return {
    orderedPacks,
    orderedPackIds,
    mapAreas: orderedPacks.flatMap((pack) => pack.mapAreas),
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
  seenMapAreaIds: Set<string>
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
    if (seenMapAreaIds.has(area.id)) {
      throw new Error(`duplicate map area id "${area.id}"`)
    }
    seenMapAreaIds.add(area.id)
    return { area, resolvedPath }
  })

  return {
    mapAreaPack,
    mapAreaPackPath,
    mapAreas: areaDefinitions.map(({ area }) => area),
    mapAreaPaths: areaDefinitions.map(({ resolvedPath }) => resolvedPath),
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
