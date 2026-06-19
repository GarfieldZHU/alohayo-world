import { Application, Container, Graphics, Text } from 'pixi.js'
import {
  CHARACTER_CELL_FRACTION,
  createCharacterMotion,
  generateCharacter,
  startCharacterAction,
  stepCharacterMotion,
  type CharacterMotionState,
  type GeneratedCharacter,
} from '@alohayo/character'
import type {
  BiomeDefinition,
  CharacterContentDefinition,
  LocaleCode,
  GameHandle,
  MapAreaDefinition,
  MountGameOptions,
  WorldDefinition,
} from '@alohayo/config'
import {
  formatI18n,
  getI18nCatalog,
  normalizeLocale,
  translateContentDescription,
  translateContentName,
} from '@alohayo/config'
import {
  CHUNK_REGION,
  type GeneratedChunk,
  type GeneratedLandmark,
  type WorldWorkerRequest,
  type WorldWorkerResponse,
} from '@alohayo/map'
import WorldWorker from '../../map/src/world.worker.ts?worker&inline'

interface EngineContent {
  world: WorldDefinition
  biomes: BiomeDefinition[]
  mapAreas: MapAreaDefinition[]
  characters: CharacterContentDefinition
}

interface ChunkView {
  container: Container
  terrain: Graphics
  transitions: Graphics
  regionalDetails: Graphics
  closeDetails: Graphics
  roads: Graphics
  settlements: Graphics
  landmarks: Graphics
  fog: Graphics
}

interface RpcPending {
  resolve: (value: GeneratedChunk) => void
  reject: (reason?: unknown) => void
}

interface DevPanelControls {
  panel: HTMLDivElement
  heading: HTMLDivElement
  battleShadowLabel: HTMLLabelElement
  fastMoveLabel: HTMLLabelElement
  teleportX: HTMLInputElement
  teleportY: HTMLInputElement
  teleportButton: HTMLButtonElement
  slotSelect: HTMLSelectElement
  itemSelect: HTMLSelectElement
  applyGearButton: HTMLButtonElement
  note: HTMLParagraphElement
  fastMoveToggle: HTMLInputElement
  fillEquipmentOptions: () => void
  fillItemOptions: () => void
}

const REGION_NAME: Record<number, string> = {
  [CHUNK_REGION.sea]: 'sea',
  [CHUNK_REGION.lake]: 'lake',
  [CHUNK_REGION.mainland]: 'mainland',
  [CHUNK_REGION.island]: 'island',
}

function createWorkerRpc(worker: Worker) {
  let nextId = 1
  const pending = new Map<string, RpcPending>()

  worker.onmessage = (event: MessageEvent<WorldWorkerResponse>) => {
    if (event.data.type !== 'generated-chunk') return
    const request = pending.get(event.data.id)
    if (!request) return
    pending.delete(event.data.id)
    request.resolve(event.data.chunk)
  }

  worker.onerror = (event) => {
    for (const request of pending.values()) {
      request.reject(new Error(event.message || 'World worker failed'))
    }
    pending.clear()
  }

  return {
    requestChunk(
      payload: Omit<Extract<WorldWorkerRequest, { type: 'generate-chunk' }>, 'type' | 'id'>
    ) {
      return new Promise<GeneratedChunk>((resolve, reject) => {
        const id = `chunk-${nextId++}`
        pending.set(id, { resolve, reject })
        worker.postMessage({ type: 'generate-chunk', id, ...payload })
      })
    },
    rejectAll(reason: Error) {
      for (const request of pending.values()) request.reject(reason)
      pending.clear()
    },
  }
}

function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function cellNoise(x: number, y: number, salt = 0) {
  let value = Math.imul(x + salt, 374761393) ^ Math.imul(y - salt, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}

function toChunkCoord(cell: number, chunkSize: number): { chunk: number; local: number } {
  const chunk = Math.floor(cell / chunkSize)
  const local = cell - chunk * chunkSize
  return { chunk, local }
}

function deriveChunkRadius(
  width: number,
  height: number,
  chunkSize: number,
  fallback: number
): number {
  const radius = Math.round(Math.max(width, height) / Math.max(1, chunkSize * 4))
  return Math.max(fallback, radius)
}

export async function createGame(
  options: MountGameOptions,
  content: EngineContent
): Promise<GameHandle> {
  const app = new Application()
  await app.init({
    resizeTo: options.container,
    antialias: false,
    background: '#07111f',
    preference: 'webgl',
  })
  options.container.replaceChildren(app.canvas)
  app.canvas.className = 'alohayo-world-canvas'
  app.canvas.setAttribute('aria-label', 'Alohayo World map')

  const worker = new WorldWorker()
  const rpc = createWorkerRpc(worker)
  const viewport = new Container()
  const chunkLayer = new Container()
  const devLayer = new Graphics()
  const characterLayer = new Graphics()
  const overlay = new Container()
  const minimapLayer = new Graphics()
  viewport.addChild(chunkLayer, devLayer, characterLayer)
  app.stage.addChild(viewport, overlay)
  overlay.addChild(minimapLayer)

  const biomeByCode = new Map(content.biomes.map((biome) => [biome.code, biome]))
  const terrainCodes = Object.fromEntries(content.biomes.map((biome) => [biome.id, biome.code]))
  const slotById = new Map(content.characters.slots.map((slot) => [slot.id, slot]))
  const status = new Text({
    text: 'Surveying...',
    style: { fill: '#d8f3ff', fontFamily: 'monospace', fontSize: 13 },
  })
  status.position.set(14, 12)
  overlay.addChild(status)

  let paused = false
  let destroyed = false
  let dragging = false
  let lastX = 0
  let lastY = 0
  let frameCount = 0
  let fps = 0
  let fpsStarted = performance.now()
  let simulationStarted = performance.now()
  let simulationAccumulator = 0
  let actionMessage = ''
  let actionMessageUntil = 0
  let lastChunkGenerationMs = 0
  const pressedKeys = new Set<string>()
  const chunks = new Map<string, GeneratedChunk>()
  const chunkViews = new Map<string, ChunkView>()
  const pendingChunks = new Map<string, Promise<GeneratedChunk>>()
  const discovery = new Map<string, Uint8Array>()
  const dirtyFog = new Set<string>()
  let discoveredCells = 0
  const discoveredChunks = new Set<string>()
  let explorer: GeneratedCharacter | null = null
  let explorerMotion: CharacterMotionState | null = null
  let scale = 1
  const devMode = Boolean(options.devMode)
  let locale: LocaleCode = normalizeLocale(
    options.locale ?? window.localStorage.getItem('alohayo-world:locale')
  )
  let devFastMove = false
  let devBattleShadow = devMode
  const chunkSize = content.world.chunkSize
  const cellSize = content.world.cellSize
  const fixedStep = 1 / 60
  const surveyWidth = Math.max(
    content.world.width,
    options.initialWorld?.width ?? content.world.width
  )
  const surveyHeight = Math.max(
    content.world.height,
    options.initialWorld?.height ?? content.world.height
  )
  const activeChunkRadius = clamp(
    options.initialWorld?.chunkRadius ??
      deriveChunkRadius(
        surveyWidth,
        surveyHeight,
        chunkSize,
        content.world.stream.initialChunkRadius
      ),
    content.world.stream.initialChunkRadius,
    content.world.stream.maxChunkRadius
  )
  const retainChunkRadius = clamp(
    options.initialWorld?.retainChunkRadius ??
      Math.max(activeChunkRadius + 1, content.world.stream.retainChunkRadius),
    activeChunkRadius + 1,
    content.world.stream.maxChunkRadius + 2
  )
  const minimapChunkRadius = Math.max(
    options.initialWorld?.minimapChunkRadius ?? content.world.stream.minimapChunkRadius,
    activeChunkRadius + 2
  )
  const worldSeed = options.initialWorld?.seed?.trim() || content.world.defaultSeed
  window.localStorage.setItem('alohayo-world:last-seed', worldSeed)
  window.localStorage.setItem('alohayo-world:locale', locale)

  const catalog = () => getI18nCatalog(locale)
  const uiText = (key: string) => catalog().ui[key] ?? key
  const devText = (key: string) => catalog().devPanel[key] ?? key
  const actionText = (key: string) => catalog().actions[key] ?? key
  const translateBiomeName = (biome: BiomeDefinition) =>
    translateContentName(locale, 'biomes', biome.id, biome.name)
  const translateActionName = (actionId: string, fallback: string) =>
    translateContentName(locale, 'actions', actionId, fallback)
  const translateArchetypeName = (archetypeId: string, fallback: string) =>
    translateContentName(locale, 'archetypes', archetypeId, fallback)
  const translateSlotName = (slotId: string, fallback: string) =>
    translateContentName(locale, 'slots', slotId, fallback)
  const translateItemName = (itemId: string, fallback: string) =>
    translateContentName(locale, 'items', itemId, fallback)
  const translateLandmarkName = (landmarkId: string, fallback: string) =>
    translateContentName(locale, 'landmarks', landmarkId, fallback)
  const translateLandmarkDescription = (landmarkId: string, fallback: string) =>
    translateContentDescription(locale, 'landmarks', landmarkId, fallback)
  const translatedExplorerName = () =>
    explorer
      ? translateArchetypeName(explorer.archetypeId, explorer.name)
      : catalog().hud.fallbackExplorerName
  const translatedState = (state: string) => catalog().hud.states[state] ?? state
  const translatedRegion = (region: string) => catalog().hud.regions[region] ?? region

  const updateDetailLevel = () => {
    for (const view of chunkViews.values()) {
      view.regionalDetails.visible = scale >= 1.15
      view.closeDetails.visible = scale >= 2.15
      view.roads.visible = scale >= 1.05
      view.settlements.visible = scale >= 0.85
      view.landmarks.visible = scale >= 1.15
    }
  }

  const appearanceColor = (value: string, fallback: number) => {
    const colors: Record<string, number> = {
      porcelain: 0xf1d6c6,
      fair: 0xe4bfa6,
      warm: 0xc99370,
      olive: 0xa77b55,
      brown: 0x815536,
      deep: 0x4f3023,
      black: 0x151719,
      'dark-brown': 0x33251e,
      auburn: 0x7a3f2d,
      blonde: 0xd2b36c,
      silver: 0x9b9da1,
      white: 0xe5e7e8,
    }
    return colors[value] ?? fallback
  }

  const itemColor = (slotIds: string[], fallback: number) => {
    if (!explorer) return fallback
    const selection = explorer.equipment.find(
      (entry) => slotIds.includes(entry.slotId) && entry.itemId
    )
    const item = content.characters.items.find((candidate) => candidate.id === selection?.itemId)
    const color = item?.appearance.color
    return color?.startsWith('#') ? Number.parseInt(color.slice(1), 16) : fallback
  }

  const activeWeaponColor = (fallback: number) => {
    if (!explorer?.activeWeaponSlot) return fallback
    return itemColor([explorer.activeWeaponSlot], fallback)
  }

  const drawExplorer = (elapsedSeconds = 0) => {
    characterLayer.clear()
    devLayer.clear()
    if (!explorer || !explorerMotion) return
    app.canvas.dataset.characterX = explorerMotion.x.toFixed(4)
    app.canvas.dataset.characterY = explorerMotion.y.toFixed(4)
    app.canvas.dataset.characterState = explorerMotion.state
    app.canvas.dataset.characterAreaRatio = '0.111111'
    app.canvas.dataset.loadedChunks = String(chunks.size)
    app.canvas.dataset.discoveredChunks = String(discoveredChunks.size)
    app.canvas.dataset.chunkRadius = String(activeChunkRadius)
    app.canvas.dataset.devMode = devMode ? 'true' : 'false'
    app.canvas.dataset.devFastMove = devFastMove ? 'true' : 'false'
    app.canvas.dataset.locale = locale
    const centerPixelX = explorerMotion.x * cellSize
    const centerPixelY = explorerMotion.y * cellSize
    const skin = appearanceColor(explorer.appearance.skinTone, 0xc99370)
    const hair = appearanceColor(explorer.appearance.hairColor, 0x33251e)
    const clothing = itemColor(['wear:outer', 'wear:torso'], 0x72d7c8)
    const hat = itemColor(['wear:head', 'decor:head'], 0x9bb2bf)
    const weapon = activeWeaponColor(0xf0d79b)
    const footprint = cellSize * CHARACTER_CELL_FRACTION
    const bodyWidthFactor =
      explorer.appearance.bodyShape === 'broad'
        ? 0.95
        : explorer.appearance.bodyShape === 'slender'
          ? 0.68
          : 0.82
    const bodyHeightFactor =
      explorer.appearance.height === 'very-tall' || explorer.appearance.height === 'tall'
        ? 0.46
        : explorer.appearance.height === 'short'
          ? 0.34
          : 0.4
    const moving = explorerMotion.state === 'walk' || explorerMotion.state === 'run'
    const strideSpeed = explorerMotion.state === 'run' ? 15 : 9
    const bob = moving ? Math.sin(elapsedSeconds * strideSpeed) * footprint * 0.08 : 0
    const bodyWidth = footprint * bodyWidthFactor
    const bodyHeight = footprint * bodyHeightFactor
    const headRadius = footprint * 0.2
    const facingOffsetX =
      explorerMotion.facing === 'west'
        ? -footprint * 0.12
        : explorerMotion.facing === 'east'
          ? footprint * 0.12
          : 0
    const actionPulse =
      explorerMotion.state === 'action' ? 1 + Math.sin(elapsedSeconds * 24) * 0.15 : 1
    if (devMode && devBattleShadow) {
      devLayer
        .circle(centerPixelX, centerPixelY, cellSize * 2.1)
        .stroke({ color: 0xff667a, width: Math.max(0.4, cellSize * 0.1), alpha: 0.9 })
        .circle(centerPixelX, centerPixelY, cellSize * 1.55)
        .fill({ color: 0x7a1022, alpha: 0.12 })
    }
    characterLayer
      .circle(centerPixelX, centerPixelY, cellSize * 0.45 * actionPulse)
      .stroke({
        color: explorerMotion.state === 'action' ? 0xf0d79b : 0xffffff,
        width: Math.max(0.35, cellSize * 0.08),
        alpha: 0.78,
      })
      .circle(centerPixelX + facingOffsetX, centerPixelY - footprint * 0.27 + bob, headRadius)
      .fill({ color: skin })
      .circle(centerPixelX + facingOffsetX, centerPixelY - footprint * 0.34 + bob, headRadius * 0.9)
      .fill({ color: hair, alpha: 0.92 })
      .rect(
        centerPixelX - headRadius * 1.05,
        centerPixelY - footprint * 0.52 + bob,
        headRadius * 2.1,
        headRadius * 0.42
      )
      .fill({ color: hat, alpha: 0.88 })
      .rect(
        centerPixelX - bodyWidth / 2,
        centerPixelY - footprint * 0.04 + bob,
        bodyWidth,
        bodyHeight
      )
      .fill({ color: clothing })
      .moveTo(centerPixelX + bodyWidth * 0.55, centerPixelY + bob)
      .lineTo(
        centerPixelX + bodyWidth * 0.55 + footprint * 0.44,
        centerPixelY + footprint * 0.18 + bob
      )
      .stroke({ color: weapon, width: Math.max(0.5, cellSize * 0.12), alpha: 0.92 })
  }

  const redrawChunkFog = (key: string) => {
    const chunk = chunks.get(key)
    const view = chunkViews.get(key)
    const discovered = discovery.get(key)
    if (!chunk || !view || !discovered) return
    view.fog.clear()
    for (let localY = 0; localY < chunk.chunkSize; localY += 1) {
      for (let localX = 0; localX < chunk.chunkSize; localX += 1) {
        const index = localY * chunk.chunkSize + localX
        if (discovered[index]) continue
        view.fog
          .rect(localX * cellSize, localY * cellSize, cellSize + 0.25, cellSize + 0.25)
          .fill({ color: 0x05101a, alpha: 0.82 })
      }
    }
  }

  const renderChunk = (chunk: GeneratedChunk) => {
    const key = chunkKey(chunk.chunkX, chunk.chunkY)
    let view = chunkViews.get(key)
    if (!view) {
      const container = new Container()
      const terrain = new Graphics()
      const transitions = new Graphics()
      const regionalDetails = new Graphics()
      const closeDetails = new Graphics()
      const roads = new Graphics()
      const settlements = new Graphics()
      const landmarks = new Graphics()
      const fog = new Graphics()
      container.addChild(
        terrain,
        transitions,
        regionalDetails,
        closeDetails,
        roads,
        settlements,
        landmarks,
        fog
      )
      chunkLayer.addChild(container)
      view = {
        container,
        terrain,
        transitions,
        regionalDetails,
        closeDetails,
        roads,
        settlements,
        landmarks,
        fog,
      }
      chunkViews.set(key, view)
    }

    view.container.position.set(chunk.originX * cellSize, chunk.originY * cellSize)
    view.terrain.clear()
    view.transitions.clear()
    view.regionalDetails.clear()
    view.closeDetails.clear()
    view.roads.clear()
    view.settlements.clear()
    view.landmarks.clear()

    for (let localY = 0; localY < chunk.chunkSize; localY += 1) {
      for (let localX = 0; localX < chunk.chunkSize; localX += 1) {
        const index = localY * chunk.chunkSize + localX
        const biome = biomeByCode.get(chunk.biomes[index]!) ?? content.biomes[0]!
        const noise = cellNoise(
          chunk.originX + localX,
          chunk.originY + localY,
          chunk.elevation[index]!
        )
        const originX = localX * cellSize
        const originY = localY * cellSize
        view.terrain.rect(originX, originY, cellSize + 0.5, cellSize + 0.5).fill(biome.color)

        const rightIndex = localX + 1 < chunk.chunkSize ? index + 1 : -1
        if (rightIndex >= 0 && chunk.biomes[rightIndex] !== chunk.biomes[index]) {
          const rightBiome = biomeByCode.get(chunk.biomes[rightIndex]!) ?? biome
          const offset = noise % Math.max(1, cellSize - 1)
          view.transitions
            .rect(originX + cellSize - 0.65, originY, 1.3, cellSize)
            .fill({ color: rightBiome.color, alpha: 0.34 })
          view.transitions
            .rect(originX + cellSize - 1, originY + offset, 1.5, 1)
            .fill({ color: rightBiome.accent, alpha: 0.48 })
        }

        const belowIndex = localY + 1 < chunk.chunkSize ? index + chunk.chunkSize : -1
        if (belowIndex >= 0 && chunk.biomes[belowIndex] !== chunk.biomes[index]) {
          const belowBiome = biomeByCode.get(chunk.biomes[belowIndex]!) ?? biome
          const offset = (noise >>> 4) % Math.max(1, cellSize - 1)
          view.transitions
            .rect(originX, originY + cellSize - 0.65, cellSize, 1.3)
            .fill({ color: belowBiome.color, alpha: 0.34 })
          view.transitions
            .rect(originX + offset, originY + cellSize - 1, 1, 1.5)
            .fill({ color: belowBiome.accent, alpha: 0.48 })
        }

        if (noise % 11 === 0) {
          view.regionalDetails
            .rect(originX + 1, originY + 1, Math.max(1, cellSize - 2), 0.5)
            .fill({ color: biome.accent, alpha: 0.52 })
        }

        if (noise % 7 === 0) {
          const detailX = originX + 1 + ((noise >>> 7) % Math.max(1, cellSize - 2))
          const detailY = originY + 1 + ((noise >>> 11) % Math.max(1, cellSize - 2))
          if (biome.id.includes('ocean') || biome.id.includes('sea') || biome.id.includes('lake')) {
            view.closeDetails.rect(originX + 0.5, detailY, cellSize - 1, 0.45).fill({
              color: biome.accent,
              alpha: 0.7,
            })
          } else if (biome.id.includes('forest')) {
            view.closeDetails.circle(detailX, detailY, 0.8).fill({
              color: biome.accent,
              alpha: 0.86,
            })
          } else if (
            biome.id.includes('mountain') ||
            biome.id.includes('rock') ||
            biome.id.includes('highland')
          ) {
            view.closeDetails
              .moveTo(originX + 0.5, originY + cellSize - 0.5)
              .lineTo(originX + cellSize / 2, originY + 0.5)
              .lineTo(originX + cellSize - 0.5, originY + cellSize - 0.5)
              .stroke({ color: biome.accent, width: 0.55, alpha: 0.82 })
          } else if (biome.id.includes('wetland')) {
            view.closeDetails
              .moveTo(detailX, originY + cellSize - 0.5)
              .lineTo(detailX, originY + 1)
              .stroke({ color: biome.accent, width: 0.55, alpha: 0.8 })
          } else {
            view.closeDetails.circle(detailX, detailY, 0.45).fill({
              color: biome.accent,
              alpha: 0.72,
            })
          }
        }
      }
    }

    for (const road of chunk.roads) {
      const color =
        road.kind === 'trade-route'
          ? 0xf0d79b
          : road.kind === 'road'
            ? 0xc8b6a1
            : road.kind === 'pass'
              ? 0xd7c8bf
              : 0x8f7f69
      const width = road.kind === 'trade-route' ? 1.2 : road.kind === 'road' ? 0.95 : 0.7
      let started = false
      for (const point of road.points) {
        const x = (point.x - chunk.originX) * cellSize + cellSize / 2
        const y = (point.y - chunk.originY) * cellSize + cellSize / 2
        if (!started) {
          view.roads.moveTo(x, y)
          started = true
        } else {
          view.roads.lineTo(x, y)
        }
      }
      if (started) view.roads.stroke({ color, width, alpha: 0.9 })
    }

    for (const settlement of chunk.settlements) {
      const x = (settlement.x - chunk.originX) * cellSize + cellSize / 2
      const y = (settlement.y - chunk.originY) * cellSize + cellSize / 2
      const size =
        settlement.kind === 'city'
          ? 2.1
          : settlement.kind === 'town' || settlement.kind === 'port'
            ? 1.7
            : settlement.kind === 'village' || settlement.kind === 'oasis'
              ? 1.35
              : 1
      const color =
        settlement.kind === 'port'
          ? 0x7bd3f7
          : settlement.kind === 'oasis'
            ? 0x84df9f
            : settlement.kind === 'city'
              ? 0xf3e4b8
              : settlement.kind === 'fort' || settlement.kind === 'watchpost'
                ? 0xd2c6bb
                : 0xf0d79b
      view.settlements
        .circle(x, y, size)
        .fill({ color, alpha: 0.96 })
        .circle(x, y, size + 0.4)
        .stroke({ color: 0x10222f, width: 0.5, alpha: 0.92 })
    }

    for (const landmark of chunk.landmarks) {
      const x = (landmark.x - chunk.originX) * cellSize + cellSize / 2
      const y = (landmark.y - chunk.originY) * cellSize + cellSize / 2
      view.landmarks
        .moveTo(x, y - 2)
        .lineTo(x + 2, y)
        .lineTo(x, y + 2)
        .lineTo(x - 2, y)
        .closePath()
        .fill({ color: 0xf0d79b, alpha: 0.95 })
        .stroke({ color: 0xffffff, width: 0.45, alpha: 0.8 })
    }

    view.regionalDetails.visible = scale >= 1.15
    view.closeDetails.visible = scale >= 2.15
    view.roads.visible = scale >= 1.05
    view.settlements.visible = scale >= 0.85
    view.landmarks.visible = scale >= 1.15
    redrawChunkFog(key)
  }

  const ensureChunk = (chunkX: number, chunkY: number) => {
    const key = chunkKey(chunkX, chunkY)
    const existing = chunks.get(key)
    if (existing) return Promise.resolve(existing)
    const pending = pendingChunks.get(key)
    if (pending) return pending

    const request = rpc
      .requestChunk({
        seed: worldSeed,
        chunkX,
        chunkY,
        chunkSize,
        surveyWidth,
        surveyHeight,
        mapAreas: content.mapAreas,
        terrainCodes,
        biomeDefinitions: content.biomes,
      })
      .then((chunk) => {
        pendingChunks.delete(key)
        chunks.set(key, chunk)
        if (!discovery.has(key))
          discovery.set(key, new Uint8Array(chunk.chunkSize * chunk.chunkSize))
        lastChunkGenerationMs = chunk.generationMs
        renderChunk(chunk)
        return chunk
      })
      .catch((error) => {
        pendingChunks.delete(key)
        throw error
      })

    pendingChunks.set(key, request)
    return request
  }

  const ensureChunkNeighborhood = (centerChunkX: number, centerChunkY: number, radius: number) => {
    const requests: Promise<GeneratedChunk>[] = []
    for (let chunkY = centerChunkY - radius; chunkY <= centerChunkY + radius; chunkY += 1) {
      for (let chunkX = centerChunkX - radius; chunkX <= centerChunkX + radius; chunkX += 1) {
        requests.push(ensureChunk(chunkX, chunkY))
      }
    }
    return Promise.all(requests)
  }

  const evictFarChunks = (centerChunkX: number, centerChunkY: number) => {
    for (const [key, chunk] of chunks) {
      const distance = Math.max(
        Math.abs(chunk.chunkX - centerChunkX),
        Math.abs(chunk.chunkY - centerChunkY)
      )
      if (distance <= retainChunkRadius) continue
      const view = chunkViews.get(key)
      if (view) {
        chunkLayer.removeChild(view.container)
        view.container.destroy({ children: true })
        chunkViews.delete(key)
      }
      chunks.delete(key)
      dirtyFog.delete(key)
    }
  }

  const getChunkForCell = (cellX: number, cellY: number) => {
    const cx = toChunkCoord(cellX, chunkSize)
    const cy = toChunkCoord(cellY, chunkSize)
    return {
      key: chunkKey(cx.chunk, cy.chunk),
      chunkX: cx.chunk,
      chunkY: cy.chunk,
      localX: cx.local,
      localY: cy.local,
    }
  }

  const getCellData = (cellX: number, cellY: number) => {
    const location = getChunkForCell(cellX, cellY)
    const chunk = chunks.get(location.key)
    if (!chunk) return null
    const index = location.localY * chunk.chunkSize + location.localX
    return {
      chunk,
      index,
      biome: biomeByCode.get(chunk.biomes[index]!) ?? content.biomes[0]!,
      areaId: chunk.areaIds[chunk.authoredArea[index]!] ?? '',
      region: REGION_NAME[chunk.region[index]!] ?? 'frontier',
    }
  }

  const canOccupy = (x: number, y: number) => {
    const radius = CHARACTER_CELL_FRACTION / 2
    for (const offsetX of [-radius, radius]) {
      for (const offsetY of [-radius, radius]) {
        const cellX = Math.floor(x + offsetX)
        const cellY = Math.floor(y + offsetY)
        const data = getCellData(cellX, cellY)
        if (!data) {
          const location = getChunkForCell(cellX, cellY)
          void ensureChunk(location.chunkX, location.chunkY)
          return false
        }
        if (data.biome.movementCost >= 7) return false
      }
    }
    return true
  }

  const movementCost = (x: number, y: number) => {
    const data = getCellData(Math.floor(x), Math.floor(y))
    return data?.biome.movementCost ?? 1
  }

  const drawMinimap = () => {
    minimapLayer.clear()
    if (!explorerMotion) return
    const minimapSize = 154
    const tile = Math.max(4, Math.floor(minimapSize / (minimapChunkRadius * 2 + 1)))
    const frameX = app.screen.width - minimapSize - 18
    const frameY = 16
    minimapLayer
      .roundRect(frameX, frameY, minimapSize, minimapSize, 10)
      .fill({ color: 0x091725, alpha: 0.86 })
      .stroke({ color: 0x72d7c8, alpha: 0.8, width: 1.2 })

    const centerChunkX = Math.floor(explorerMotion.x / chunkSize)
    const centerChunkY = Math.floor(explorerMotion.y / chunkSize)
    const centerOffset = minimapChunkRadius * tile + Math.floor(tile / 2)

    for (const chunk of chunks.values()) {
      const dx = chunk.chunkX - centerChunkX
      const dy = chunk.chunkY - centerChunkY
      if (Math.abs(dx) > minimapChunkRadius || Math.abs(dy) > minimapChunkRadius) continue
      const key = chunkKey(chunk.chunkX, chunk.chunkY)
      const discovered = discovery.get(key)
      const discoveredCount = discovered?.reduce((total, value) => total + value, 0) ?? 0
      if (!discoveredCount) continue
      let dominantBiome = chunk.biomes[0]!
      const counts = new Map<number, number>()
      for (let index = 0; index < chunk.biomes.length; index += 1) {
        if (!discovered?.[index]) continue
        const biome = chunk.biomes[index]!
        counts.set(biome, (counts.get(biome) ?? 0) + 1)
        if ((counts.get(biome) ?? 0) > (counts.get(dominantBiome) ?? 0)) dominantBiome = biome
      }
      const biome = biomeByCode.get(dominantBiome) ?? content.biomes[0]!
      const x = frameX + 10 + centerOffset + dx * tile - Math.floor(tile / 2)
      const y = frameY + 10 + centerOffset + dy * tile - Math.floor(tile / 2)
      minimapLayer.rect(x, y, tile - 1, tile - 1).fill({
        color: biome.color,
        alpha: clamp(discoveredCount / chunk.biomes.length, 0.25, 1),
      })
    }

    const explorerChunkX = Math.floor(explorerMotion.x / chunkSize)
    const explorerChunkY = Math.floor(explorerMotion.y / chunkSize)
    const explorerX =
      frameX + 10 + centerOffset + (explorerChunkX - centerChunkX) * tile - Math.floor(tile / 4)
    const explorerY =
      frameY + 10 + centerOffset + (explorerChunkY - centerChunkY) * tile - Math.floor(tile / 4)
    minimapLayer
      .circle(
        explorerX + Math.floor(tile / 4),
        explorerY + Math.floor(tile / 4),
        Math.max(2, tile * 0.22)
      )
      .fill({ color: 0xf6f2d6 })
      .stroke({ color: 0x10222f, width: 1 })
  }

  const updateStatus = () => {
    if (!explorerMotion) return
    if (actionMessage && performance.now() < actionMessageUntil) {
      status.text = actionMessage
      return
    }
    status.text = formatI18n(catalog().hud.status, {
      devPrefix: devMode ? `${catalog().hud.devPrefix}  ` : '',
      explorerName: translatedExplorerName(),
      seedLabel: catalog().hud.seed,
      seed: worldSeed,
      state: translatedState(explorerMotion.state),
      fastSuffix: devFastMove ? ` ${catalog().hud.fast}` : '',
      loadedCount: chunks.size,
      loadedLabel: catalog().hud.loaded,
      discoveredCount: discoveredChunks.size,
      discoveredLabel: catalog().hud.discovered,
      cellsCount: discoveredCells,
      cellsLabel: catalog().hud.cells,
      fps,
      chunkLabel: catalog().hud.chunk,
      chunkMs: lastChunkGenerationMs.toFixed(1),
      zoomLabel: catalog().hud.zoom,
      zoomValue: scale.toFixed(2),
    })
  }

  const revealAroundExplorer = () => {
    if (!explorerMotion) return
    const radius = content.world.stream.discoveryRadius
    const affected = new Set<string>()
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const cellX = Math.floor(explorerMotion.x + offsetX)
        const cellY = Math.floor(explorerMotion.y + offsetY)
        if (Math.hypot(offsetX, offsetY) > radius + 0.25) continue
        const location = getChunkForCell(cellX, cellY)
        const chunk = chunks.get(location.key)
        if (!chunk) continue
        const found = discovery.get(location.key)
        if (!found) continue
        const index = location.localY * chunk.chunkSize + location.localX
        if (found[index]) continue
        found[index] = 1
        discoveredCells += 1
        discoveredChunks.add(location.key)
        affected.add(location.key)
      }
    }
    for (const key of affected) redrawChunkFog(key)
    if (affected.size) drawMinimap()
  }

  const recenterOnExplorer = () => {
    if (!explorerMotion) return
    viewport.position.set(
      app.screen.width / 2 - explorerMotion.x * cellSize * scale,
      app.screen.height / 2 - explorerMotion.y * cellSize * scale
    )
    drawMinimap()
  }

  const teleportExplorer = async (cellX: number, cellY: number) => {
    if (!explorerMotion) return
    const targetChunkX = Math.floor(cellX / chunkSize)
    const targetChunkY = Math.floor(cellY / chunkSize)
    await ensureChunkNeighborhood(targetChunkX, targetChunkY, activeChunkRadius)
    const targetX = cellX + 0.5
    const targetY = cellY + 0.5
    if (!canOccupy(targetX, targetY)) {
      actionMessage = formatI18n(devText('teleportBlocked'), { x: cellX, y: cellY })
      actionMessageUntil = performance.now() + 2200
      updateStatus()
      return
    }
    explorerMotion.x = targetX
    explorerMotion.y = targetY
    explorerMotion.state = 'idle'
    revealAroundExplorer()
    recenterOnExplorer()
    actionMessage = formatI18n(devText('teleported'), { x: cellX, y: cellY })
    actionMessageUntil = performance.now() + 1800
    updateStatus()
  }

  const createDevPanel = (): DevPanelControls | null => {
    if (!devMode) return null

    const panel = document.createElement('div')
    panel.dataset.alohayoWorldDevPanel = 'true'
    Object.assign(panel.style, {
      position: 'absolute',
      inset: '16px auto auto 16px',
      zIndex: '20',
      width: 'min(320px, calc(100% - 32px))',
      padding: '12px',
      border: '1px solid rgba(114,215,200,0.35)',
      borderRadius: '12px',
      background: 'rgba(7, 17, 31, 0.9)',
      color: '#d8f3ff',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
    } satisfies Partial<CSSStyleDeclaration>)

    const heading = document.createElement('div')
    heading.textContent = devText('heading')
    Object.assign(heading.style, {
      fontSize: '12px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#72d7c8',
      marginBottom: '10px',
    } satisfies Partial<CSSStyleDeclaration>)
    panel.appendChild(heading)

    const makeRow = () => {
      const row = document.createElement('div')
      Object.assign(row.style, {
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
        alignItems: 'center',
      } satisfies Partial<CSSStyleDeclaration>)
      panel.appendChild(row)
      return row
    }

    const makeInput = (value = '') => {
      const input = document.createElement('input')
      input.value = value
      Object.assign(input.style, {
        flex: '1',
        minWidth: '0',
        border: '1px solid #315263',
        borderRadius: '8px',
        padding: '8px 10px',
        color: '#d8f3ff',
        background: '#0c1e2b',
      } satisfies Partial<CSSStyleDeclaration>)
      return input
    }

    const makeButton = (text: string) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = text
      Object.assign(button.style, {
        border: '1px solid #315263',
        borderRadius: '8px',
        padding: '8px 10px',
        cursor: 'pointer',
        color: '#d8f3ff',
        background: '#173241',
        fontWeight: '700',
      } satisfies Partial<CSSStyleDeclaration>)
      return button
    }

    const checkboxRow = makeRow()
    const battleShadowToggle = document.createElement('input')
    battleShadowToggle.type = 'checkbox'
    battleShadowToggle.checked = devBattleShadow
    battleShadowToggle.addEventListener('change', () => {
      devBattleShadow = battleShadowToggle.checked
      drawExplorer(performance.now() / 1000)
    })
    const battleShadowLabel = document.createElement('label')
    battleShadowLabel.textContent = devText('battleShadow')
    battleShadowLabel.style.flex = '1'
    checkboxRow.append(battleShadowToggle, battleShadowLabel)

    const fastMoveToggle = document.createElement('input')
    fastMoveToggle.type = 'checkbox'
    fastMoveToggle.checked = devFastMove
    fastMoveToggle.addEventListener('change', () => {
      devFastMove = fastMoveToggle.checked
      updateStatus()
    })
    const fastMoveLabel = document.createElement('label')
    fastMoveLabel.textContent = devText('fastMove')
    fastMoveLabel.style.flex = '1'
    checkboxRow.append(fastMoveToggle, fastMoveLabel)

    const teleportRow = makeRow()
    const teleportX = makeInput('0')
    teleportX.inputMode = 'numeric'
    teleportX.placeholder = 'x'
    const teleportY = makeInput('0')
    teleportY.inputMode = 'numeric'
    teleportY.placeholder = 'y'
    const teleportButton = makeButton(devText('teleport'))
    teleportButton.addEventListener('click', () => {
      const nextX = Number.parseInt(teleportX.value, 10)
      const nextY = Number.parseInt(teleportY.value, 10)
      if (Number.isNaN(nextX) || Number.isNaN(nextY)) return
      void teleportExplorer(nextX, nextY)
    })
    teleportRow.append(teleportX, teleportY, teleportButton)

    const gearRow = makeRow()
    const slotSelect = document.createElement('select')
    const itemSelect = document.createElement('select')
    for (const select of [slotSelect, itemSelect]) {
      Object.assign(select.style, {
        flex: '1',
        minWidth: '0',
        border: '1px solid #315263',
        borderRadius: '8px',
        padding: '8px 10px',
        color: '#d8f3ff',
        background: '#0c1e2b',
      } satisfies Partial<CSSStyleDeclaration>)
    }
    const applyGearButton = makeButton(devText('equip'))
    gearRow.append(slotSelect, itemSelect, applyGearButton)

    const fillEquipmentOptions = () => {
      if (!explorer) return
      slotSelect.replaceChildren()
      for (const equipment of explorer.equipment) {
        const option = document.createElement('option')
        const slot = slotById.get(equipment.slotId)
        option.value = equipment.slotId
        option.textContent = translateSlotName(equipment.slotId, slot?.name ?? equipment.slotId)
        slotSelect.appendChild(option)
      }
    }

    const fillItemOptions = () => {
      itemSelect.replaceChildren()
      const currentSlotId = slotSelect.value
      const emptyOption = document.createElement('option')
      emptyOption.value = ''
      emptyOption.textContent = devText('unequip')
      itemSelect.appendChild(emptyOption)
      for (const item of content.characters.items) {
        if (!item.allowedSlots.includes(currentSlotId)) continue
        const option = document.createElement('option')
        option.value = item.id
        option.textContent = translateItemName(item.id, item.name)
        itemSelect.appendChild(option)
      }
      const selected = explorer?.equipment.find((entry) => entry.slotId === currentSlotId)
      itemSelect.value = selected?.itemId ?? ''
    }

    slotSelect.addEventListener('change', fillItemOptions)
    applyGearButton.addEventListener('click', () => {
      if (!explorer) return
      const currentSlotId = slotSelect.value
      const selected = explorer.equipment.find((entry) => entry.slotId === currentSlotId)
      if (!selected) return
      selected.itemId = itemSelect.value || null
      const slot = slotById.get(currentSlotId)
      if (slot?.kind === 'weapon' && selected.itemId) explorer.activeWeaponSlot = currentSlotId
      actionMessage = formatI18n(devText('equipmentSet'), {
        slotName: translateSlotName(currentSlotId, slot?.name ?? currentSlotId),
        itemName: itemSelect.selectedOptions[0]?.textContent ?? devText('unequip'),
      })
      actionMessageUntil = performance.now() + 1800
      updateStatus()
      drawExplorer(performance.now() / 1000)
    })

    fillEquipmentOptions()
    fillItemOptions()

    const note = document.createElement('p')
    note.textContent = devText('note')
    Object.assign(note.style, {
      margin: '2px 0 0',
      fontSize: '11px',
      color: '#9bb2bf',
    } satisfies Partial<CSSStyleDeclaration>)
    panel.appendChild(note)

    return {
      panel,
      heading,
      battleShadowLabel,
      fastMoveLabel,
      teleportX,
      teleportY,
      teleportButton,
      slotSelect,
      itemSelect,
      applyGearButton,
      note,
      fastMoveToggle,
      fillEquipmentOptions,
      fillItemOptions,
    }
  }

  const renderDevPanelLocale = (panel: DevPanelControls | null) => {
    if (!panel) return
    panel.heading.textContent = devText('heading')
    panel.battleShadowLabel.textContent = devText('battleShadow')
    panel.fastMoveLabel.textContent = devText('fastMove')
    panel.teleportButton.textContent = devText('teleport')
    panel.applyGearButton.textContent = devText('equip')
    panel.note.textContent = devText('note')
    panel.fillEquipmentOptions()
    panel.fillItemOptions()
  }

  const findSpawn = async () => {
    for (let radius = 0; radius <= activeChunkRadius + 2; radius += 1) {
      await ensureChunkNeighborhood(0, 0, radius)
      for (let chunkY = -radius; chunkY <= radius; chunkY += 1) {
        for (let chunkX = -radius; chunkX <= radius; chunkX += 1) {
          const chunk = chunks.get(chunkKey(chunkX, chunkY))
          if (!chunk) continue
          for (let index = 0; index < chunk.biomes.length; index += 1) {
            const biome = biomeByCode.get(chunk.biomes[index]!) ?? content.biomes[0]!
            if (biome.movementCost >= 7) continue
            const localX = index % chunk.chunkSize
            const localY = Math.floor(index / chunk.chunkSize)
            return { x: chunk.originX + localX + 0.5, y: chunk.originY + localY + 0.5 }
          }
        }
      }
    }
    return { x: 0.5, y: 0.5 }
  }

  explorer = generateCharacter(content.characters, 'core:explorer', worldSeed)
  await ensureChunkNeighborhood(0, 0, activeChunkRadius)
  const spawn = await findSpawn()
  explorerMotion = createCharacterMotion(spawn.x, spawn.y)
  const devPanel = createDevPanel()
  if (devPanel) options.container.appendChild(devPanel.panel)
  renderDevPanelLocale(devPanel)

  const surveyPixels = (activeChunkRadius * 2 + 1) * chunkSize * cellSize
  scale = clamp(
    Math.min((app.screen.width - 24) / surveyPixels, (app.screen.height - 66) / surveyPixels),
    0.35,
    1
  )
  viewport.scale.set(scale)
  viewport.position.set(
    app.screen.width / 2 - spawn.x * cellSize * scale,
    app.screen.height / 2 - spawn.y * cellSize * scale
  )
  updateDetailLevel()
  revealAroundExplorer()
  drawExplorer()
  drawMinimap()
  if (devPanel) {
    devPanel.teleportX.value = Math.floor(spawn.x).toString()
    devPanel.teleportY.value = Math.floor(spawn.y).toString()
    devPanel.fastMoveToggle.checked = devFastMove
  }
  status.text = uiText('surveying')
  updateStatus()

  const onPointerDown = (event: PointerEvent) => {
    if (devMode && event.shiftKey) {
      const bounds = app.canvas.getBoundingClientRect()
      const cellX = Math.floor((event.clientX - bounds.left - viewport.x) / scale / cellSize)
      const cellY = Math.floor((event.clientY - bounds.top - viewport.y) / scale / cellSize)
      void teleportExplorer(cellX, cellY)
      return
    }
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
    app.canvas.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (dragging) {
      viewport.x += event.clientX - lastX
      viewport.y += event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
    }
    if (actionMessage && performance.now() < actionMessageUntil) return
    const bounds = app.canvas.getBoundingClientRect()
    const cellX = Math.floor((event.clientX - bounds.left - viewport.x) / scale / cellSize)
    const cellY = Math.floor((event.clientY - bounds.top - viewport.y) / scale / cellSize)
    const data = getCellData(cellX, cellY)
    if (!data) {
      status.text = formatI18n(catalog().hud.surveyingFrontier, { x: cellX, y: cellY })
      return
    }
    status.text = formatI18n(catalog().hud.tooltip, {
      biome: translateBiomeName(data.biome),
      region: translatedRegion(data.region),
      areaSuffix: data.areaId ? formatI18n(catalog().hud.areaSuffix, { areaId: data.areaId }) : '',
      x: cellX,
      y: cellY,
      elevation: data.chunk.elevation[data.index]!,
      moisture: data.chunk.moisture[data.index]!,
      temperature: data.chunk.temperature[data.index]!,
    })
  }

  const onPointerUp = () => {
    dragging = false
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const bounds = app.canvas.getBoundingClientRect()
    const pointerX = event.clientX - bounds.left
    const pointerY = event.clientY - bounds.top
    const worldX = (pointerX - viewport.x) / scale
    const worldY = (pointerY - viewport.y) / scale
    scale = Math.max(0.35, Math.min(4.6, scale * (event.deltaY > 0 ? 0.88 : 1.14)))
    viewport.scale.set(scale)
    viewport.position.set(pointerX - worldX * scale, pointerY - worldY * scale)
    updateDetailLevel()
    drawMinimap()
    updateStatus()
  }

  const movementKeys = new Set([
    'arrowleft',
    'arrowright',
    'arrowup',
    'arrowdown',
    'a',
    'd',
    'w',
    's',
    'shift',
  ])

  const findNearbyLandmarks = () => {
    const results: GeneratedLandmark[] = []
    if (!explorerMotion) return results
    const centerChunkX = Math.floor(explorerMotion.x / chunkSize)
    const centerChunkY = Math.floor(explorerMotion.y / chunkSize)
    for (let chunkY = centerChunkY - 1; chunkY <= centerChunkY + 1; chunkY += 1) {
      for (let chunkX = centerChunkX - 1; chunkX <= centerChunkX + 1; chunkX += 1) {
        const chunk = chunks.get(chunkKey(chunkX, chunkY))
        if (!chunk) continue
        results.push(...chunk.landmarks)
      }
    }
    return results
  }

  const performAction = () => {
    if (!explorer || !explorerMotion) return
    const actionId = explorer.actionIds[0]
    const action = content.characters.actions.find((candidate) => candidate.id === actionId)
    if (!action) return
    startCharacterAction(explorerMotion, action.duration)
    let nearest: GeneratedLandmark | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const landmark of findNearbyLandmarks()) {
      const distance = Math.hypot(
        landmark.x + 0.5 - explorerMotion.x,
        landmark.y + 0.5 - explorerMotion.y
      )
      const actionRange = Math.min(explorer.movement.actionRange, action.range)
      if (distance <= actionRange && distance < nearestDistance) {
        nearest = landmark
        nearestDistance = distance
      }
    }
    const explorerName = translatedExplorerName()
    const actionName = translateActionName(action.id, action.name)
    actionMessage =
      action.target === 'self'
        ? formatI18n(actionText('selfUse'), { explorerName, actionName })
        : nearest
          ? formatI18n(actionText('inspect'), {
              explorerName,
              landmarkName: translateLandmarkName(nearest.id, nearest.name),
              landmarkDescription: translateLandmarkDescription(nearest.id, nearest.description),
            })
          : formatI18n(actionText('noTarget'), { explorerName, actionName })
    actionMessageUntil = performance.now() + 2600
    updateStatus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return
    }
    const key = event.key.toLowerCase()
    if (movementKeys.has(key)) {
      event.preventDefault()
      pressedKeys.add(key)
    }
    if (devMode && key === 'f' && !event.repeat) {
      event.preventDefault()
      devFastMove = !devFastMove
      updateStatus()
    }
    if ((key === 'e' || key === ' ') && !event.repeat) {
      event.preventDefault()
      performAction()
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.key.toLowerCase())
  }

  const onBlur = () => {
    pressedKeys.clear()
  }

  const stepSimulation = (deltaSeconds: number) => {
    if (!explorer || !explorerMotion) return
    const inputX =
      Number(pressedKeys.has('d') || pressedKeys.has('arrowright')) -
      Number(pressedKeys.has('a') || pressedKeys.has('arrowleft'))
    const inputY =
      Number(pressedKeys.has('s') || pressedKeys.has('arrowdown')) -
      Number(pressedKeys.has('w') || pressedKeys.has('arrowup'))
    const previousX = explorerMotion.x
    const previousY = explorerMotion.y
    const simulationCharacter =
      devMode && devFastMove
        ? {
            ...explorer,
            movement: {
              ...explorer.movement,
              walkSpeed: explorer.movement.walkSpeed * 3.5,
            },
          }
        : explorer
    stepCharacterMotion(explorerMotion, {
      character: simulationCharacter,
      deltaSeconds,
      input: { x: inputX, y: inputY, running: pressedKeys.has('shift') },
      canOccupy,
      movementCost,
    })
    const centerChunkX = Math.floor(explorerMotion.x / chunkSize)
    const centerChunkY = Math.floor(explorerMotion.y / chunkSize)
    void ensureChunkNeighborhood(centerChunkX, centerChunkY, activeChunkRadius)
    evictFarChunks(centerChunkX, centerChunkY)
    revealAroundExplorer()
    if (explorerMotion.x !== previousX || explorerMotion.y !== previousY) {
      viewport.x -= (explorerMotion.x - previousX) * cellSize * scale
      viewport.y -= (explorerMotion.y - previousY) * cellSize * scale
      drawMinimap()
    }
  }

  app.canvas.addEventListener('pointerdown', onPointerDown)
  app.canvas.addEventListener('pointermove', onPointerMove)
  app.canvas.addEventListener('pointerup', onPointerUp)
  app.canvas.addEventListener('pointercancel', onPointerUp)
  app.canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  app.ticker.add(() => {
    if (paused || destroyed) return
    const simulationNow = performance.now()
    simulationAccumulator += Math.min(0.1, (simulationNow - simulationStarted) / 1000)
    simulationStarted = simulationNow
    while (simulationAccumulator >= fixedStep) {
      stepSimulation(fixedStep)
      simulationAccumulator -= fixedStep
    }
    drawExplorer(simulationNow / 1000)
    frameCount += 1
    const now = performance.now()
    if (now - fpsStarted >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - fpsStarted))
      frameCount = 0
      fpsStarted = now
      updateStatus()
    }
  })

  return {
    pause() {
      paused = true
      app.ticker.stop()
    },
    resume() {
      paused = false
      simulationStarted = performance.now()
      app.ticker.start()
    },
    setLocale(nextLocale) {
      locale = normalizeLocale(nextLocale)
      window.localStorage.setItem('alohayo-world:locale', locale)
      actionMessage = ''
      actionMessageUntil = 0
      renderDevPanelLocale(devPanel)
      drawMinimap()
      updateStatus()
      drawExplorer(performance.now() / 1000)
    },
    async destroy() {
      if (destroyed) return
      destroyed = true
      rpc.rejectAll(new Error('Game destroyed'))
      worker.terminate()
      devPanel?.panel.remove()
      app.canvas.removeEventListener('pointerdown', onPointerDown)
      app.canvas.removeEventListener('pointermove', onPointerMove)
      app.canvas.removeEventListener('pointerup', onPointerUp)
      app.canvas.removeEventListener('pointercancel', onPointerUp)
      app.canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      app.destroy(true, { children: true, texture: true })
      options.container.replaceChildren()
    },
  }
}
