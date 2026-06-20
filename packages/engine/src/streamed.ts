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
  WorldRoadProfileDefinition,
  WorldRoadProfileId,
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
  hashSeed,
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
  surfaces: Graphics
  roads: Graphics
  settlements: Graphics
  landmarks: Graphics
  fog: Graphics
}

interface RpcPending {
  resolve: (value: GeneratedChunk) => void
  reject: (reason?: unknown) => void
}

interface ActiveWeatherState {
  id: string
  wetness: number
  snowCover: number
  mud: number
  fade: number
}

interface DevPanelControls {
  panel: HTMLDivElement
  body: HTMLDivElement
  heading: HTMLDivElement
  collapseButton: HTMLButtonElement
  battleShadowLabel: HTMLLabelElement
  fastMoveLabel: HTMLLabelElement
  flyLabel: HTMLLabelElement
  teleportX: HTMLInputElement
  teleportY: HTMLInputElement
  teleportButton: HTMLButtonElement
  slotSelect: HTMLSelectElement
  itemSelect: HTMLSelectElement
  applyGearButton: HTMLButtonElement
  note: HTMLParagraphElement
  fastMoveToggle: HTMLInputElement
  flyToggle: HTMLInputElement
  fillEquipmentOptions: () => void
  fillItemOptions: () => void
  setCollapsed: (collapsed: boolean) => void
  isCollapsed: () => boolean
}

interface MinimapControls {
  panel: HTMLDivElement
  title: HTMLDivElement
  compass: HTMLSpanElement
  collapseButton: HTMLButtonElement
  zoomOutButton: HTMLButtonElement
  zoomInButton: HTMLButtonElement
  fitButton: HTMLButtonElement
  body: HTMLDivElement
  setCollapsed: (collapsed: boolean) => void
}

type UiTheme = 'light' | 'dark'

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

function normalizeTheme(input?: string | null): UiTheme {
  return input === 'light' ? 'light' : 'dark'
}

function cellNoise(x: number, y: number, salt = 0) {
  let value = Math.imul(x + salt, 374761393) ^ Math.imul(y - salt, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}

function colorFromHex(value: string, fallback: number): number {
  return /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback
}

function profileById(world: WorldDefinition): Map<WorldRoadProfileId, WorldRoadProfileDefinition> {
  return new Map(
    world.roads.profiles.map(
      (profile) => [profile.id, profile] satisfies [WorldRoadProfileId, WorldRoadProfileDefinition]
    )
  )
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

function computeGameCameraScale(screenWidth: number, screenHeight: number, cellSize: number) {
  const targetVisibleCellsX = 32
  const targetVisibleCellsY = 22
  return clamp(
    Math.min(
      screenWidth / (cellSize * targetVisibleCellsX),
      screenHeight / (cellSize * targetVisibleCellsY)
    ),
    2.2,
    9
  )
}

export async function createGame(
  options: MountGameOptions,
  content: EngineContent
): Promise<GameHandle> {
  let theme: UiTheme = normalizeTheme(options.theme)
  const themePalette = () =>
    theme === 'light'
      ? {
          containerBackground: '#e7eef8',
          statusFill: '#143247',
          minimapFill: 0xf6fbff,
          minimapStroke: 0x3b82f6,
          minimapExplorerStroke: 0xe7eef8,
          minimapPanelBorder: 'rgba(59,130,246,0.18)',
          minimapPanelBackground: 'rgba(255,255,255,0.78)',
          minimapPanelText: '#143247',
          minimapPanelMuted: '#476072',
          minimapPanelButtonBackground: 'rgba(219, 234, 254, 0.95)',
          minimapPanelButtonActive: '#2563eb',
          devBorder: 'rgba(59,130,246,0.28)',
          devBackground: 'rgba(255, 255, 255, 0.56)',
          devBackgroundHover: 'rgba(255, 255, 255, 0.94)',
          devText: '#143247',
          devAccent: '#2563eb',
          devMuted: '#476072',
          devInputBackground: 'rgba(231, 238, 248, 0.92)',
          devInputBorder: '#98b0c8',
          devButtonBackground: 'rgba(219, 234, 254, 0.96)',
        }
      : {
          containerBackground: '#07111f',
          statusFill: '#d8f3ff',
          minimapFill: 0x091725,
          minimapStroke: 0x72d7c8,
          minimapExplorerStroke: 0x10222f,
          minimapPanelBorder: 'rgba(114,215,200,0.24)',
          minimapPanelBackground: 'rgba(7,17,31,0.74)',
          minimapPanelText: '#d8f3ff',
          minimapPanelMuted: '#9bb2bf',
          minimapPanelButtonBackground: '#173241',
          minimapPanelButtonActive: '#72d7c8',
          devBorder: 'rgba(114,215,200,0.35)',
          devBackground: 'rgba(7, 17, 31, 0.42)',
          devBackgroundHover: 'rgba(7, 17, 31, 0.92)',
          devText: '#d8f3ff',
          devAccent: '#72d7c8',
          devMuted: '#9bb2bf',
          devInputBackground: '#0c1e2b',
          devInputBorder: '#315263',
          devButtonBackground: '#173241',
        }
  const app = new Application()
  await app.init({
    resizeTo: options.container,
    antialias: false,
    background: themePalette().containerBackground,
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
  const roadProfiles = profileById(content.world)
  const terrainCodes = Object.fromEntries(content.biomes.map((biome) => [biome.id, biome.code]))
  const enabledMapAreaIds = new Set(options.initialWorld?.mapAreaIds ?? [])
  const mapAreas = content.mapAreas
    .filter((area) => area.enabled || enabledMapAreaIds.has(area.id))
    .map((area) => (area.enabled ? area : { ...area, enabled: true }))
  const slotById = new Map(content.characters.slots.map((slot) => [slot.id, slot]))
  const status = new Text({
    text: 'Surveying...',
    style: { fill: themePalette().statusFill, fontFamily: 'monospace', fontSize: 13 },
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
  const roadMasks = new Map<string, Uint8Array>()
  const pendingChunks = new Map<string, Promise<GeneratedChunk>>()
  const discovery = new Map<string, Uint8Array>()
  const dirtyFog = new Set<string>()
  let discoveredCells = 0
  const discoveredChunks = new Set<string>()
  let explorer: GeneratedCharacter | null = null
  let explorerMotion: CharacterMotionState | null = null
  let scale = 1
  let weatherTick = -1
  let devMode = Boolean(options.devMode)
  let locale: LocaleCode = normalizeLocale(
    options.locale ?? window.localStorage.getItem('alohayo-world:locale')
  )
  let devFastMove = false
  let devFly = false
  let devBattleShadow = true
  let devPanelCollapsed = window.localStorage.getItem('alohayo-world:dev-panel-collapsed') === '1'
  let minimapCollapsed = window.localStorage.getItem('alohayo-world:minimap-collapsed') === 'true'
  let minimapMode: 'fit' | 'manual' = 'fit'
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
  let minimapManualRadius = minimapChunkRadius
  const worldSeed = options.initialWorld?.seed?.trim() || content.world.defaultSeed
  window.localStorage.setItem('alohayo-world:last-seed', worldSeed)
  window.localStorage.setItem('alohayo-world:locale', locale)
  const devPanelStateStorageKey = 'alohayo-world:dev-panel-collapsed'

  const catalog = () => getI18nCatalog(locale)
  const uiText = (key: string) => catalog().ui[key] ?? key
  const devText = (key: string) => catalog().devPanel[key] ?? key
  const minimapText = (key: string) => catalog().ui[key] ?? key
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

  const applyThemeToContainer = () => {
    options.container.dataset.alohayoWorldTheme = theme
    options.container.style.background = themePalette().containerBackground
  }

  const applyThemeToDevPanel = (panel: DevPanelControls | null, interactive = false) => {
    if (!panel) return
    const palette = themePalette()
    Object.assign(panel.panel.style, {
      border: `1px solid ${palette.devBorder}`,
      background: interactive ? palette.devBackgroundHover : palette.devBackground,
      color: palette.devText,
      opacity: interactive ? '1' : devPanelCollapsed ? '0.66' : '0.22',
    } satisfies Partial<CSSStyleDeclaration>)
    panel.heading.style.color = palette.devAccent
    panel.note.style.color = palette.devMuted
    panel.collapseButton.style.color = palette.devText

    for (const element of [panel.teleportX, panel.teleportY, panel.slotSelect, panel.itemSelect]) {
      Object.assign(element.style, {
        color: palette.devText,
        background: palette.devInputBackground,
        border: `1px solid ${palette.devInputBorder}`,
      } satisfies Partial<CSSStyleDeclaration>)
    }

    for (const button of [panel.teleportButton, panel.applyGearButton]) {
      Object.assign(button.style, {
        color: palette.devText,
        background: palette.devButtonBackground,
        border: `1px solid ${palette.devInputBorder}`,
      } satisfies Partial<CSSStyleDeclaration>)
    }
  }

  const updateDetailLevel = () => {
    for (const view of chunkViews.values()) {
      view.regionalDetails.visible = scale >= 1.15
      view.closeDetails.visible = scale >= 2.15
      view.surfaces.visible = scale >= 1
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
    app.canvas.dataset.devFly = devFly ? 'true' : 'false'
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
    if (devMode && devFly) {
      devLayer
        .circle(centerPixelX, centerPixelY, cellSize * 2.6)
        .stroke({ color: 0x8ef2ff, width: Math.max(0.45, cellSize * 0.1), alpha: 0.9 })
        .circle(centerPixelX, centerPixelY, cellSize * 2.05)
        .stroke({ color: 0x1cc8e8, width: Math.max(0.35, cellSize * 0.08), alpha: 0.55 })
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
    if (devMode && !devBattleShadow) return
    for (let localY = 0; localY < chunk.chunkSize; localY += 1) {
      for (let localX = 0; localX < chunk.chunkSize; localX += 1) {
        const index = localY * chunk.chunkSize + localX
        if (discovered[index]) continue
        const north = localY > 0 && !discovered[index - chunk.chunkSize]
        const south = localY < chunk.chunkSize - 1 && !discovered[index + chunk.chunkSize]
        const west = localX > 0 && !discovered[index - 1]
        const east = localX < chunk.chunkSize - 1 && !discovered[index + 1]
        if (north && south && west && east) {
          view.fog
            .rect(localX * cellSize, localY * cellSize, cellSize + 0.25, cellSize + 0.25)
            .fill({ color: 0x05101a, alpha: 0.82 })
          continue
        }
        view.fog
          .circle(
            localX * cellSize + cellSize / 2,
            localY * cellSize + cellSize / 2,
            cellSize * 0.76
          )
          .fill({ color: 0x05101a, alpha: 0.82 })
      }
    }
  }

  const refreshFogVisibility = () => {
    const fogVisible = !devMode || devBattleShadow
    for (const view of chunkViews.values()) {
      view.fog.visible = fogVisible
    }
    app.canvas.dataset.devBattleShadow = devMode && devBattleShadow ? 'true' : 'false'
  }

  const activeWeather = (nowMs = performance.now()): ActiveWeatherState => {
    const weather = content.world.weather
    if (!weather?.enabled || !weather.states.length) {
      return { id: 'clear', wetness: 0, snowCover: 0, mud: 0, fade: 0 }
    }
    const totalDuration = weather.states.reduce((sum, state) => sum + state.duration, 0)
    const seedBias = (cellNoise(hashSeed(worldSeed), content.world.chunkSize, 17) % 1000) / 1000
    const cycle = (nowMs / 1000 / Math.max(1, weather.cycleSeconds) + seedBias) % 1
    let cursor = 0
    for (const state of weather.states) {
      const next = cursor + state.duration / totalDuration
      if (cycle <= next || state === weather.states[weather.states.length - 1]) {
        const local = clamp((cycle - cursor) / Math.max(0.0001, next - cursor), 0, 1)
        const fade = Math.sin(local * Math.PI) * weather.surfaceDecay
        return {
          id: state.id,
          wetness: state.wetness,
          snowCover: state.snowCover,
          mud: state.mud,
          fade,
        }
      }
      cursor = next
    }
    return { id: 'clear', wetness: 0, snowCover: 0, mud: 0, fade: 0 }
  }

  const roadProfile = (id: WorldRoadProfileId) =>
    roadProfiles.get(id) ?? content.world.roads.profiles[0]!

  const rebuildRoadMask = (chunk: GeneratedChunk) => {
    const mask = new Uint8Array(chunk.chunkSize * chunk.chunkSize)
    for (const road of chunk.roads) {
      const profile = roadProfile(road.kind)
      const radius = Math.max(0, Math.ceil(profile.width))
      for (let pointIndex = 1; pointIndex < road.points.length; pointIndex += 1) {
        const from = road.points[pointIndex - 1]!
        const to = road.points[pointIndex]!
        const length = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 2))
        for (let step = 0; step <= length; step += 1) {
          const t = step / length
          const x = from.x + (to.x - from.x) * t
          const y = from.y + (to.y - from.y) * t
          const localX = Math.round(x - chunk.originX)
          const localY = Math.round(y - chunk.originY)
          for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
              const nx = localX + offsetX
              const ny = localY + offsetY
              if (nx < 0 || ny < 0 || nx >= chunk.chunkSize || ny >= chunk.chunkSize) continue
              const index = ny * chunk.chunkSize + nx
              mask[index] = Math.max(
                mask[index]!,
                profile.id === 'trade-route'
                  ? 4
                  : profile.id === 'road'
                    ? 3
                    : profile.id === 'pass'
                      ? 2
                      : 1
              )
            }
          }
        }
      }
    }
    roadMasks.set(chunkKey(chunk.chunkX, chunk.chunkY), mask)
  }

  const roadProfileAt = (
    chunk: GeneratedChunk,
    index: number
  ): WorldRoadProfileDefinition | null => {
    const mask = roadMasks.get(chunkKey(chunk.chunkX, chunk.chunkY))
    const value = mask?.[index] ?? 0
    if (!value) return null
    return value === 4
      ? roadProfile('trade-route')
      : value === 3
        ? roadProfile('road')
        : value === 2
          ? roadProfile('pass')
          : roadProfile('trail')
  }

  const roadTextureTint = (biome: BiomeDefinition, state: ActiveWeatherState) => {
    const snowTemperatureMax = content.world.weather?.snowTemperatureMax ?? 0.42
    if (state.snowCover > 0.2 && biome.temperature.max <= snowTemperatureMax + 0.2) {
      return 0xe8edf5
    }
    if (
      state.mud > 0.2 &&
      (biome.family === 'wetland' ||
        biome.family === 'forest' ||
        biome.family === 'grassland' ||
        biome.family === 'plain')
    ) {
      return 0x5f4631
    }
    if (biome.family === 'mountain' || biome.family === 'upland') return 0x8a8277
    if (biome.family === 'arid') return 0xb89263
    if (biome.family === 'forest') return 0x5a6f45
    return 0x7d6b58
  }

  const redrawChunkSurfaces = (chunk: GeneratedChunk, state: ActiveWeatherState) => {
    const key = chunkKey(chunk.chunkX, chunk.chunkY)
    const view = chunkViews.get(key)
    if (!view) return
    view.surfaces.clear()
    for (let localY = 0; localY < chunk.chunkSize; localY += 1) {
      for (let localX = 0; localX < chunk.chunkSize; localX += 1) {
        const index = localY * chunk.chunkSize + localX
        const biome = biomeByCode.get(chunk.biomes[index]!) ?? content.biomes[0]!
        const x = localX * cellSize
        const y = localY * cellSize
        const noise = cellNoise(chunk.originX + localX, chunk.originY + localY, 404)
        if (
          state.wetness > 0.08 &&
          noise % 7 === 0 &&
          !biome.id.includes('ocean') &&
          !biome.id.includes('sea')
        ) {
          view.surfaces.rect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1).fill({
            color: 0x4a6f88,
            alpha: state.wetness * state.fade * 0.12,
          })
        }
        if (
          state.mud > 0.08 &&
          noise % 11 === 0 &&
          (biome.family === 'plain' ||
            biome.family === 'grassland' ||
            biome.family === 'forest' ||
            biome.family === 'wetland')
        ) {
          view.surfaces
            .circle(
              x + 1 + (noise % Math.max(1, cellSize - 1)),
              y + 1 + ((noise >>> 4) % Math.max(1, cellSize - 1)),
              0.5
            )
            .fill({
              color: 0x4b3828,
              alpha: state.mud * state.fade * 0.18,
            })
        }
        if (
          state.snowCover > 0.08 &&
          biome.temperature.max <= (content.world.weather?.snowTemperatureMax ?? 0.42) + 0.25 &&
          noise % 5 === 0
        ) {
          view.surfaces.rect(x + 0.3, y + 0.3, cellSize - 0.6, cellSize - 0.6).fill({
            color: 0xf3f7fb,
            alpha: state.snowCover * state.fade * 0.22,
          })
        }
      }
    }
    for (const road of chunk.roads) {
      const profile = roadProfile(road.kind)
      const width = profile.width * 0.58
      let started = false
      for (const point of road.points) {
        const localX = Math.round(point.x - chunk.originX)
        const localY = Math.round(point.y - chunk.originY)
        if (localX < 0 || localY < 0 || localX >= chunk.chunkSize || localY >= chunk.chunkSize)
          continue
        const index = localY * chunk.chunkSize + localX
        const biome = biomeByCode.get(chunk.biomes[index]!) ?? content.biomes[0]!
        const x = (point.x - chunk.originX) * cellSize + cellSize / 2
        const y = (point.y - chunk.originY) * cellSize + cellSize / 2
        const tint = roadTextureTint(biome, state)
        if (!started) {
          view.surfaces.moveTo(x, y)
          started = true
        } else {
          view.surfaces.lineTo(x, y)
        }
        if (
          cellNoise(localX, localY, 912) %
            Math.max(2, content.world.roads.generation.textureStep) ===
          0
        ) {
          view.surfaces.circle(x, y, Math.max(0.18, width * 0.36)).fill({
            color: tint,
            alpha:
              profile.terrainTextureStrength * 0.18 +
              profile.weatherTextureStrength *
                state.fade *
                Math.max(state.mud, state.snowCover, state.wetness) *
                0.24,
          })
        }
      }
      if (started && state.fade > 0.02) {
        const overlayColor =
          state.snowCover > state.mud && state.snowCover > state.wetness
            ? 0xf0f4f9
            : state.mud > state.wetness
              ? 0x5f4631
              : 0x6d8ca4
        view.surfaces.stroke({
          color: overlayColor,
          width,
          alpha: profile.weatherTextureStrength * state.fade * 0.3,
        })
      }
    }
  }

  const refreshWeatherLayers = (nowMs = performance.now(), force = false) => {
    if (!content.world.weather?.enabled) return
    const nextTick = Math.floor(nowMs / 1000)
    if (!force && nextTick === weatherTick) return
    weatherTick = nextTick
    const state = activeWeather(nowMs)
    for (const chunk of chunks.values()) redrawChunkSurfaces(chunk, state)
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
      const surfaces = new Graphics()
      const roads = new Graphics()
      const settlements = new Graphics()
      const landmarks = new Graphics()
      const fog = new Graphics()
      container.addChild(
        terrain,
        transitions,
        regionalDetails,
        closeDetails,
        surfaces,
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
        surfaces,
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
    view.surfaces.clear()
    view.roads.clear()
    view.settlements.clear()
    view.landmarks.clear()
    view.fog.visible = !(devMode && devBattleShadow)
    rebuildRoadMask(chunk)

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
      const profile = roadProfile(road.kind)
      const color = colorFromHex(profile.color, 0xc8b6a1)
      const edgeColor = colorFromHex(profile.edgeColor, 0x5f4631)
      const width = profile.width
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
      if (started) {
        view.roads.stroke({ color: edgeColor, width: width + 0.34, alpha: 0.76 })
        view.roads.stroke({ color, width, alpha: 0.93 })
      }
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
    view.surfaces.visible = scale >= 1
    view.roads.visible = scale >= 1.05
    view.settlements.visible = scale >= 0.85
    view.landmarks.visible = scale >= 1.15
    redrawChunkSurfaces(chunk, activeWeather())
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
        mapAreas,
        terrainCodes,
        biomeDefinitions: content.biomes,
        roadSystem: content.world.roads,
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
      roadMasks.delete(key)
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
        if (devMode && devFly) continue
        if (data.biome.movementCost >= 7) return false
      }
    }
    return true
  }

  const movementCost = (x: number, y: number) => {
    if (devMode && devFly) return 1
    const data = getCellData(Math.floor(x), Math.floor(y))
    if (!data) return 1
    const road = roadProfileAt(data.chunk, data.index)
    const roadMultiplier = road?.movementMultiplier ?? 1
    return Math.max(0.38, data.biome.movementCost * roadMultiplier)
  }

  const drawMinimap = () => {
    minimapLayer.clear()
    if (!explorerMotion || devMode || minimapCollapsed) return
    let minChunkX = Number.POSITIVE_INFINITY
    let maxChunkX = Number.NEGATIVE_INFINITY
    let minChunkY = Number.POSITIVE_INFINITY
    let maxChunkY = Number.NEGATIVE_INFINITY
    for (const key of discoveredChunks) {
      const [chunkXText, chunkYText] = key.split(',')
      const chunkX = Number.parseInt(chunkXText ?? '', 10)
      const chunkY = Number.parseInt(chunkYText ?? '', 10)
      if (Number.isNaN(chunkX) || Number.isNaN(chunkY)) continue
      minChunkX = Math.min(minChunkX, chunkX)
      maxChunkX = Math.max(maxChunkX, chunkX)
      minChunkY = Math.min(minChunkY, chunkY)
      maxChunkY = Math.max(maxChunkY, chunkY)
    }
    const activeRadius =
      minimapMode === 'fit' && Number.isFinite(minChunkX)
        ? clamp(
            Math.max(
              Math.ceil((maxChunkX - minChunkX + 1) / 2),
              Math.ceil((maxChunkY - minChunkY + 1) / 2)
            ) + 1,
            2,
            Math.max(minimapChunkRadius * 3, 18)
          )
        : minimapManualRadius
    const minimapSize = 154
    const tile = Math.max(3, Math.floor(minimapSize / (activeRadius * 2 + 1)))
    const frameX = app.screen.width - minimapSize - 18
    const frameY = 68
    minimapLayer
      .roundRect(frameX, frameY, minimapSize, minimapSize, 10)
      .fill({ color: themePalette().minimapFill, alpha: 0.86 })
      .stroke({ color: themePalette().minimapStroke, alpha: 0.8, width: 1.2 })

    const centerChunkX =
      minimapMode === 'fit' && Number.isFinite(minChunkX)
        ? Math.floor((minChunkX + maxChunkX) / 2)
        : Math.floor(explorerMotion.x / chunkSize)
    const centerChunkY =
      minimapMode === 'fit' && Number.isFinite(minChunkY)
        ? Math.floor((minChunkY + maxChunkY) / 2)
        : Math.floor(explorerMotion.y / chunkSize)
    const centerOffset = activeRadius * tile + Math.floor(tile / 2)

    for (const chunk of chunks.values()) {
      const dx = chunk.chunkX - centerChunkX
      const dy = chunk.chunkY - centerChunkY
      if (Math.abs(dx) > activeRadius || Math.abs(dy) > activeRadius) continue
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
      .stroke({ color: themePalette().minimapExplorerStroke, width: 1 })
  }

  const createMinimapControls = () => {
    const panel = document.createElement('div')
    panel.dataset.alohayoWorldMinimap = 'true'
    Object.assign(panel.style, {
      position: 'absolute',
      inset: '16px 16px auto auto',
      zIndex: '18',
      width: '170px',
      borderRadius: '14px',
      padding: '8px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
    } satisfies Partial<CSSStyleDeclaration>)

    const header = document.createElement('div')
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '6px',
    } satisfies Partial<CSSStyleDeclaration>)
    panel.appendChild(header)

    const title = document.createElement('div')
    Object.assign(title.style, {
      flex: '1',
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontWeight: '700',
    } satisfies Partial<CSSStyleDeclaration>)
    header.appendChild(title)

    const compass = document.createElement('span')
    Object.assign(compass.style, {
      fontSize: '11px',
      fontWeight: '700',
      padding: '2px 6px',
      borderRadius: '999px',
    } satisfies Partial<CSSStyleDeclaration>)
    header.appendChild(compass)

    const collapseButton = document.createElement('button')
    collapseButton.type = 'button'
    Object.assign(collapseButton.style, {
      border: '0',
      cursor: 'pointer',
      borderRadius: '999px',
      padding: '2px 7px',
      fontSize: '11px',
      fontWeight: '700',
    } satisfies Partial<CSSStyleDeclaration>)
    header.appendChild(collapseButton)

    const body = document.createElement('div')
    Object.assign(body.style, {
      display: 'flex',
      gap: '6px',
    } satisfies Partial<CSSStyleDeclaration>)
    panel.appendChild(body)

    const makeButton = () => {
      const button = document.createElement('button')
      button.type = 'button'
      Object.assign(button.style, {
        flex: '1',
        border: '0',
        cursor: 'pointer',
        borderRadius: '8px',
        padding: '7px 8px',
        fontSize: '11px',
        fontWeight: '700',
      } satisfies Partial<CSSStyleDeclaration>)
      body.appendChild(button)
      return button
    }

    const zoomOutButton = makeButton()
    zoomOutButton.addEventListener('click', () => {
      minimapMode = 'manual'
      minimapManualRadius = clamp(minimapManualRadius + 1, 2, Math.max(minimapChunkRadius * 3, 18))
      drawMinimap()
      applyThemeToMinimapControls(controls)
    })

    const zoomInButton = makeButton()
    zoomInButton.addEventListener('click', () => {
      minimapMode = 'manual'
      minimapManualRadius = clamp(minimapManualRadius - 1, 2, Math.max(minimapChunkRadius * 3, 18))
      drawMinimap()
      applyThemeToMinimapControls(controls)
    })

    const fitButton = makeButton()
    fitButton.addEventListener('click', () => {
      minimapMode = 'fit'
      drawMinimap()
      applyThemeToMinimapControls(controls)
    })

    const controls: MinimapControls = {
      panel,
      title,
      compass,
      collapseButton,
      zoomOutButton,
      zoomInButton,
      fitButton,
      body,
      setCollapsed(nextCollapsed) {
        minimapCollapsed = nextCollapsed
        body.style.display = minimapCollapsed ? 'none' : 'flex'
        collapseButton.textContent = minimapCollapsed
          ? minimapText('minimapExpand')
          : minimapText('minimapCollapse')
        window.localStorage.setItem(
          'alohayo-world:minimap-collapsed',
          minimapCollapsed ? 'true' : 'false'
        )
        drawMinimap()
      },
    }

    collapseButton.addEventListener('click', () => {
      controls.setCollapsed(!minimapCollapsed)
      applyThemeToMinimapControls(controls)
    })

    return controls
  }

  const renderMinimapLocale = (controls: MinimapControls | null) => {
    if (!controls) return
    controls.title.textContent = minimapText('minimapTitle')
    controls.compass.textContent = minimapText('minimapCompass')
    controls.zoomOutButton.textContent = minimapText('minimapZoomOut')
    controls.zoomInButton.textContent = minimapText('minimapZoomIn')
    controls.fitButton.textContent = minimapText('minimapFit')
    controls.setCollapsed(minimapCollapsed)
  }

  const applyThemeToMinimapControls = (controls: MinimapControls | null) => {
    if (!controls) return
    const palette = themePalette()
    Object.assign(controls.panel.style, {
      display: devMode ? 'none' : 'block',
      border: `1px solid ${palette.minimapPanelBorder}`,
      background: palette.minimapPanelBackground,
      color: palette.minimapPanelText,
    } satisfies Partial<CSSStyleDeclaration>)
    Object.assign(controls.compass.style, {
      background: palette.minimapPanelButtonBackground,
      color: palette.minimapPanelMuted,
    } satisfies Partial<CSSStyleDeclaration>)
    for (const button of [
      controls.collapseButton,
      controls.zoomOutButton,
      controls.zoomInButton,
      controls.fitButton,
    ]) {
      Object.assign(button.style, {
        background: palette.minimapPanelButtonBackground,
        color: palette.minimapPanelText,
      } satisfies Partial<CSSStyleDeclaration>)
    }
    controls.fitButton.style.outline =
      minimapMode === 'fit' ? `1px solid ${palette.minimapPanelButtonActive}` : '0'
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

  const refreshFog = () => {
    for (const key of chunkViews.keys()) redrawChunkFog(key)
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

  const cameraTarget = () => {
    if (!explorerMotion) return { x: viewport.x, y: viewport.y }
    return {
      x: app.screen.width / 2 - explorerMotion.x * cellSize * scale,
      y: app.screen.height / 2 - explorerMotion.y * cellSize * scale,
    }
  }

  const syncGameCameraScale = () => {
    if (devMode) return
    scale = computeGameCameraScale(app.screen.width, app.screen.height, cellSize)
    viewport.scale.set(scale)
  }

  const updateCamera = (force = false) => {
    if (!explorerMotion) return
    const target = cameraTarget()
    if (devMode || force) {
      viewport.position.set(target.x, target.y)
      return
    }
    const followAlpha = 0.2
    viewport.x += (target.x - viewport.x) * followAlpha
    viewport.y += (target.y - viewport.y) * followAlpha
  }

  const recenterOnExplorer = () => {
    if (!explorerMotion) return
    syncGameCameraScale()
    updateCamera(true)
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
      inset: 'auto auto 16px 16px',
      zIndex: '20',
      width: 'min(280px, calc(100% - 32px))',
      padding: '10px',
      borderRadius: '12px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
      transition: 'opacity 140ms ease, background 140ms ease, transform 140ms ease',
    } satisfies Partial<CSSStyleDeclaration>)

    const header = document.createElement('div')
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      marginBottom: '8px',
    } satisfies Partial<CSSStyleDeclaration>)
    panel.appendChild(header)

    const heading = document.createElement('div')
    heading.textContent = devText('heading')
    Object.assign(heading.style, {
      fontSize: '12px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      flex: '1',
      marginBottom: '0',
    } satisfies Partial<CSSStyleDeclaration>)
    header.appendChild(heading)

    const collapseButton = document.createElement('button')
    collapseButton.type = 'button'
    Object.assign(collapseButton.style, {
      border: '0',
      background: 'transparent',
      cursor: 'pointer',
      padding: '2px 6px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '700',
    } satisfies Partial<CSSStyleDeclaration>)
    header.appendChild(collapseButton)

    const body = document.createElement('div')
    panel.appendChild(body)

    const makeRow = () => {
      const row = document.createElement('div')
      Object.assign(row.style, {
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
        alignItems: 'center',
      } satisfies Partial<CSSStyleDeclaration>)
      body.appendChild(row)
      return row
    }

    const makeInput = (value = '') => {
      const input = document.createElement('input')
      input.value = value
      Object.assign(input.style, {
        flex: '1',
        minWidth: '0',
        borderRadius: '8px',
        padding: '8px 10px',
      } satisfies Partial<CSSStyleDeclaration>)
      return input
    }

    const makeButton = (text: string) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = text
      Object.assign(button.style, {
        borderRadius: '8px',
        padding: '8px 10px',
        cursor: 'pointer',
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
      refreshFogVisibility()
      updateStatus()
      refreshFog()
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

    const flyRow = makeRow()
    const flyToggle = document.createElement('input')
    flyToggle.type = 'checkbox'
    flyToggle.checked = devFly
    flyToggle.addEventListener('change', () => {
      devFly = flyToggle.checked
      updateStatus()
      drawExplorer(performance.now() / 1000)
    })
    const flyLabel = document.createElement('label')
    flyLabel.textContent = devText('fly')
    flyLabel.style.flex = '1'
    flyRow.append(flyToggle, flyLabel)

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
        borderRadius: '8px',
        padding: '8px 10px',
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
    } satisfies Partial<CSSStyleDeclaration>)
    body.appendChild(note)

    const controls: DevPanelControls = {
      panel,
      body,
      heading,
      collapseButton,
      battleShadowLabel,
      fastMoveLabel,
      flyLabel,
      teleportX,
      teleportY,
      teleportButton,
      slotSelect,
      itemSelect,
      applyGearButton,
      note,
      fastMoveToggle,
      flyToggle,
      fillEquipmentOptions,
      fillItemOptions,
      setCollapsed(nextCollapsed) {
        devPanelCollapsed = nextCollapsed
        body.style.display = devPanelCollapsed ? 'none' : 'block'
        collapseButton.textContent = devPanelCollapsed ? devText('expand') : devText('collapse')
        collapseButton.setAttribute('aria-expanded', devPanelCollapsed ? 'false' : 'true')
        panel.style.transform = devPanelCollapsed ? 'translateY(2px)' : 'translateY(0)'
        window.localStorage.setItem(devPanelStateStorageKey, devPanelCollapsed ? 'true' : 'false')
        applyThemeToDevPanel(controls, false)
      },
      isCollapsed: () => devPanelCollapsed,
    }

    collapseButton.addEventListener('click', () => {
      controls.setCollapsed(!devPanelCollapsed)
    })
    panel.addEventListener('mouseenter', () => applyThemeToDevPanel(controls, true))
    panel.addEventListener('mouseleave', () => applyThemeToDevPanel(controls, false))
    panel.addEventListener('focusin', () => applyThemeToDevPanel(controls, true))
    panel.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!panel.contains(document.activeElement)) applyThemeToDevPanel(controls, false)
      }, 0)
    })

    controls.setCollapsed(devPanelCollapsed)
    applyThemeToDevPanel(controls, false)
    return controls
  }

  const renderDevPanelLocale = (panel: DevPanelControls | null) => {
    if (!panel) return
    panel.heading.textContent = devText('heading')
    panel.setCollapsed(panel.isCollapsed())
    panel.battleShadowLabel.textContent = devText('battleShadow')
    panel.fastMoveLabel.textContent = devText('fastMove')
    panel.flyLabel.textContent = devText('fly')
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

  applyThemeToContainer()
  explorer = generateCharacter(content.characters, 'core:explorer', worldSeed)
  await ensureChunkNeighborhood(0, 0, activeChunkRadius)
  const spawn = await findSpawn()
  explorerMotion = createCharacterMotion(spawn.x, spawn.y)
  let devPanel = createDevPanel()
  const minimapControls = createMinimapControls()
  if (devPanel) options.container.appendChild(devPanel.panel)
  options.container.appendChild(minimapControls.panel)
  renderDevPanelLocale(devPanel)
  renderMinimapLocale(minimapControls)

  const surveyPixels = (activeChunkRadius * 2 + 1) * chunkSize * cellSize
  scale = devMode
    ? clamp(
        Math.min((app.screen.width - 24) / surveyPixels, (app.screen.height - 66) / surveyPixels),
        0.35,
        1
      )
    : computeGameCameraScale(app.screen.width, app.screen.height, cellSize)
  viewport.scale.set(scale)
  viewport.position.set(
    app.screen.width / 2 - spawn.x * cellSize * scale,
    app.screen.height / 2 - spawn.y * cellSize * scale
  )
  updateDetailLevel()
  revealAroundExplorer()
  drawExplorer()
  refreshFogVisibility()
  refreshWeatherLayers(performance.now(), true)
  drawMinimap()
  applyThemeToDevPanel(devPanel)
  applyThemeToMinimapControls(minimapControls)
  if (devPanel) {
    devPanel.teleportX.value = Math.floor(spawn.x).toString()
    devPanel.teleportY.value = Math.floor(spawn.y).toString()
    devPanel.fastMoveToggle.checked = devFastMove
    devPanel.flyToggle.checked = devFly
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
    if (!devMode) return
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
    if (!devMode) return
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
      if (devPanel) devPanel.fastMoveToggle.checked = devFastMove
      updateStatus()
    }
    if (devMode && key === 'g' && !event.repeat) {
      event.preventDefault()
      devFly = !devFly
      if (devPanel) devPanel.flyToggle.checked = devFly
      updateStatus()
      drawExplorer(performance.now() / 1000)
    }
    if (key === 'm' && !event.repeat && !devMode) {
      event.preventDefault()
      minimapControls.setCollapsed(!minimapCollapsed)
      applyThemeToMinimapControls(minimapControls)
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

  const onResize = () => {
    if (!explorerMotion) return
    syncGameCameraScale()
    updateCamera(true)
    drawMinimap()
    updateStatus()
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
      if (devMode) {
        viewport.x -= (explorerMotion.x - previousX) * cellSize * scale
        viewport.y -= (explorerMotion.y - previousY) * cellSize * scale
      }
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
  window.addEventListener('resize', onResize)

  app.ticker.add(() => {
    if (paused || destroyed) return
    const simulationNow = performance.now()
    simulationAccumulator += Math.min(0.1, (simulationNow - simulationStarted) / 1000)
    simulationStarted = simulationNow
    while (simulationAccumulator >= fixedStep) {
      stepSimulation(fixedStep)
      simulationAccumulator -= fixedStep
    }
    if (!devMode) updateCamera()
    refreshWeatherLayers(simulationNow)
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
      renderMinimapLocale(minimapControls)
      drawMinimap()
      updateStatus()
      drawExplorer(performance.now() / 1000)
      applyThemeToMinimapControls(minimapControls)
    },
    setDevMode(enabled) {
      devMode = enabled
      if (!devMode) {
        devFastMove = false
        devBattleShadow = true
      }
      devPanel?.panel.remove()
      devPanel = createDevPanel()
      if (devPanel) {
        options.container.appendChild(devPanel.panel)
        renderDevPanelLocale(devPanel)
        devPanel.fastMoveToggle.checked = devFastMove
      }
      renderMinimapLocale(minimapControls)
      refreshFog()
      drawMinimap()
      updateStatus()
      drawExplorer(performance.now() / 1000)
      applyThemeToDevPanel(devPanel)
      applyThemeToMinimapControls(minimapControls)
    },
    setTheme(nextTheme) {
      theme = normalizeTheme(nextTheme)
      status.style.fill = themePalette().statusFill
      applyThemeToContainer()
      drawMinimap()
      applyThemeToDevPanel(devPanel)
      applyThemeToMinimapControls(minimapControls)
    },
    async destroy() {
      if (destroyed) return
      destroyed = true
      rpc.rejectAll(new Error('Game destroyed'))
      worker.terminate()
      devPanel?.panel.remove()
      minimapControls.panel.remove()
      app.canvas.removeEventListener('pointerdown', onPointerDown)
      app.canvas.removeEventListener('pointermove', onPointerMove)
      app.canvas.removeEventListener('pointerup', onPointerUp)
      app.canvas.removeEventListener('pointercancel', onPointerUp)
      app.canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
      app.destroy(true, { children: true, texture: true })
      options.container.replaceChildren()
    },
  }
}
