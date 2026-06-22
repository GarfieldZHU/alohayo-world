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
  LocaleCode,
  GameHandle,
  MountGameOptions,
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
import { hashSeed, type GeneratedChunk, type GeneratedLandmark } from '@alohayo/map'
import WorldWorker from '../../map/src/world.worker.ts?worker&inline'
import { applyThemeToDevPanel, createDevPanel, renderDevPanelLocale } from './dev-panel'
import {
  applyThemeToMinimapControls,
  createMinimapControls,
  renderMinimapLocale,
} from './minimap-controls'
import { themePalette } from './theme'
import type {
  ActiveWeatherState,
  ChunkView,
  DevPanelControls,
  EngineContent,
  UiTheme,
} from './types'
import {
  REGION_NAME,
  cellNoise,
  chunkKey,
  clamp,
  colorFromHex,
  computeGameCameraScale,
  createWorkerRpc,
  deriveChunkRadius,
  normalizeTheme,
  profileById,
  toChunkCoord,
} from './utils'
import { drawBoundaryBlend, drawRiver, drawWaterCloseDetail } from './water-render'

export async function createGame(
  options: MountGameOptions,
  content: EngineContent
): Promise<GameHandle> {
  let theme: UiTheme = normalizeTheme(options.theme)
  const palette = () => themePalette(theme)
  const app = new Application()
  await app.init({
    resizeTo: options.container,
    antialias: false,
    background: palette().containerBackground,
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
  if (getComputedStyle(options.container).position === 'static') {
    options.container.style.position = 'relative'
  }
  const visionFogElement = document.createElement('div')
  visionFogElement.dataset.alohayoWorldVisionFog = 'true'
  Object.assign(visionFogElement.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '6',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 140ms ease, background 80ms linear',
  } satisfies Partial<CSSStyleDeclaration>)
  options.container.appendChild(visionFogElement)

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
    style: { fill: palette().statusFill, fontFamily: 'monospace', fontSize: 13 },
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
  const riverMasks = new Map<string, Uint8Array>()
  const bridgeMasks = new Map<string, Uint8Array>()
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
  let devShowGrid = window.localStorage.getItem('alohayo-world:dev-grid') !== 'false'
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
    options.container.style.background = palette().containerBackground
  }

  const applyCurrentDevPanelTheme = (panel: DevPanelControls | null, interactive = false) => {
    applyThemeToDevPanel(panel, palette(), devPanelCollapsed, interactive)
  }

  const applyCurrentMinimapTheme = (controls: ReturnType<typeof createMinimapControls> | null) => {
    applyThemeToMinimapControls(controls, palette(), devMode, minimapMode)
  }

  const refreshGridVisibility = () => {
    for (const view of chunkViews.values()) {
      view.grid.visible = devMode && devShowGrid
    }
    app.canvas.dataset.devGrid = devMode && devShowGrid ? 'true' : 'false'
  }

  const updateDetailLevel = () => {
    for (const view of chunkViews.values()) {
      view.regionalDetails.visible = devMode ? scale >= 1.15 : scale >= 2.05
      view.closeDetails.visible = devMode ? scale >= 2.15 : scale >= 3.35
      view.surfaces.visible = scale >= 1
      view.rivers.visible = scale >= 0.95
      view.roads.visible = scale >= 1.05
      view.settlements.visible = scale >= 0.85
      view.landmarks.visible = scale >= 1.15
    }
  }

  const buildDevPanel = () =>
    devMode
      ? createDevPanel({
          getText: devText,
          getSlotName: translateSlotName,
          getItemName: translateItemName,
          getUnequipName: () => devText('unequip'),
          getExplorerEquipment: () => explorer?.equipment ?? null,
          getSlotById: (slotId) => slotById.get(slotId),
          getAvailableItems: () => content.characters.items,
          getBattleShadow: () => devBattleShadow,
          setBattleShadow: (enabled) => {
            devBattleShadow = enabled
            refreshFogVisibility()
          },
          getGrid: () => devShowGrid,
          setGrid: (enabled) => {
            devShowGrid = enabled
            window.localStorage.setItem('alohayo-world:dev-grid', enabled ? 'true' : 'false')
            refreshGridVisibility()
          },
          getFastMove: () => devFastMove,
          setFastMove: (enabled) => {
            devFastMove = enabled
          },
          getFly: () => devFly,
          setFly: (enabled) => {
            devFly = enabled
          },
          teleport: (x, y) => {
            void teleportExplorer(x, y)
          },
          applyEquipment: (slotId, itemId, itemName) => {
            if (!explorer) return
            const selected = explorer.equipment.find((entry) => entry.slotId === slotId)
            if (!selected) return
            selected.itemId = itemId
            const slot = slotById.get(slotId)
            if (slot?.kind === 'weapon' && selected.itemId) explorer.activeWeaponSlot = slotId
            actionMessage = formatI18n(devText('equipmentSet'), {
              slotName: translateSlotName(slotId, slot?.name ?? slotId),
              itemName,
            })
            actionMessageUntil = performance.now() + 1800
            updateStatus()
            drawExplorer(performance.now() / 1000)
          },
          onRefreshVisuals: () => {
            refreshFog()
            drawExplorer(performance.now() / 1000)
          },
          onStatusChange: updateStatus,
          getCollapsed: () => devPanelCollapsed,
          setCollapsedState: (collapsed) => {
            devPanelCollapsed = collapsed
          },
          storageKey: devPanelStateStorageKey,
        })
      : null

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
    view.fogFill.clear()
    view.fogCutout.clear()
    if (devMode && !devBattleShadow) return
    const fogColor = 0x05101a
    const edgeFeather = cellSize * 0.28
    for (let localY = 0; localY < chunk.chunkSize; localY += 1) {
      for (let localX = 0; localX < chunk.chunkSize; localX += 1) {
        const index = localY * chunk.chunkSize + localX
        if (discovered[index]) continue
        const north = localY > 0 && !discovered[index - chunk.chunkSize]
        const south = localY < chunk.chunkSize - 1 && !discovered[index + chunk.chunkSize]
        const west = localX > 0 && !discovered[index - 1]
        const east = localX < chunk.chunkSize - 1 && !discovered[index + 1]
        const originX = localX * cellSize
        const originY = localY * cellSize
        if (north && south && west && east) {
          view.fogFill
            .rect(originX, originY, cellSize + 0.2, cellSize + 0.2)
            .fill({ color: fogColor, alpha: 0.84 })
          continue
        }
        view.fogFill
          .roundRect(
            originX - (west ? edgeFeather : 0),
            originY - (north ? edgeFeather : 0),
            cellSize + (west ? edgeFeather : 0) + (east ? edgeFeather : 0) + 0.2,
            cellSize + (north ? edgeFeather : 0) + (south ? edgeFeather : 0) + 0.2,
            cellSize * 0.34
          )
          .fill({ color: fogColor, alpha: 0.84 })
      }
    }
  }

  const refreshFogVisibility = () => {
    const fogVisible = !devMode
    for (const view of chunkViews.values()) {
      view.fog.visible = fogVisible
    }
    app.canvas.dataset.devBattleShadow = devMode && devBattleShadow ? 'true' : 'false'
  }

  const drawBattleShadow = () => {
    const showVisionFog = !devMode || devBattleShadow
    if (!showVisionFog || !explorerMotion) {
      visionFogElement.style.opacity = '0'
      visionFogElement.style.background = 'transparent'
      return
    }

    const centerX = viewport.x + explorerMotion.x * cellSize * scale
    const centerY = viewport.y + explorerMotion.y * cellSize * scale
    const innerRadius = Math.max(cellSize * scale * (devMode ? 2.8 : 3.05), devMode ? 76 : 88)
    const edgeStartRadius = innerRadius + Math.max(5, innerRadius * 0.04)
    const exploredRadius = innerRadius + Math.max(28, innerRadius * 0.18)
    const deepFogRadius = exploredRadius + Math.max(48, innerRadius * 0.34)
    const maxRadius = deepFogRadius + Math.max(58, innerRadius * 0.38)
    const center = `${centerX.toFixed(2)}px ${centerY.toFixed(2)}px`
    const edgeTint = devMode ? 'rgba(86, 108, 122, 0.08)' : 'rgba(70, 87, 100, 0.08)'
    const exploredFog = devMode ? 'rgba(34, 49, 60, 0.28)' : 'rgba(42, 56, 67, 0.3)'
    const deepFog = devMode ? 'rgba(12, 21, 30, 0.54)' : 'rgba(14, 23, 31, 0.56)'
    const outerFog = devMode ? 'rgba(4, 9, 15, 0.72)' : 'rgba(5, 11, 18, 0.74)'
    visionFogElement.style.opacity = '1'
    visionFogElement.style.background = `radial-gradient(circle at ${center},
      rgba(0, 0, 0, 0) 0px,
      rgba(0, 0, 0, 0) ${innerRadius.toFixed(2)}px,
      ${edgeTint} ${edgeStartRadius.toFixed(2)}px,
      ${exploredFog} ${exploredRadius.toFixed(2)}px,
      ${deepFog} ${deepFogRadius.toFixed(2)}px,
      ${outerFog} ${maxRadius.toFixed(2)}px,
      rgba(2, 6, 11, ${devMode ? '0.86' : '0.8'}) 100%)`
  }

  const redrawChunkGrid = (chunk: GeneratedChunk) => {
    const key = chunkKey(chunk.chunkX, chunk.chunkY)
    const view = chunkViews.get(key)
    if (!view) return
    view.grid.clear()
    const majorStep = 8
    for (let localX = 0; localX <= chunk.chunkSize; localX += 1) {
      const x = localX * cellSize
      view.grid.moveTo(x, 0).lineTo(x, chunk.chunkSize * cellSize)
    }
    for (let localY = 0; localY <= chunk.chunkSize; localY += 1) {
      const y = localY * cellSize
      view.grid.moveTo(0, y).lineTo(chunk.chunkSize * cellSize, y)
    }
    view.grid.stroke({ color: 0x0b1823, width: 0.28, alpha: 0.18 })
    for (let localX = 0; localX <= chunk.chunkSize; localX += majorStep) {
      const x = localX * cellSize
      view.grid.moveTo(x, 0).lineTo(x, chunk.chunkSize * cellSize)
    }
    for (let localY = 0; localY <= chunk.chunkSize; localY += majorStep) {
      const y = localY * cellSize
      view.grid.moveTo(0, y).lineTo(chunk.chunkSize * cellSize, y)
    }
    view.grid.stroke({ color: 0x102537, width: 0.42, alpha: 0.24 })
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

  const rebuildRiverMask = (chunk: GeneratedChunk) => {
    const riverMask = new Uint8Array(chunk.chunkSize * chunk.chunkSize)
    const bridgeMask = new Uint8Array(chunk.chunkSize * chunk.chunkSize)
    for (const river of chunk.rivers) {
      const radius = Math.max(0, Math.ceil(river.width))
      for (let pointIndex = 1; pointIndex < river.points.length; pointIndex += 1) {
        const from = river.points[pointIndex - 1]!
        const to = river.points[pointIndex]!
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
              riverMask[index] = 1
            }
          }
        }
      }
    }

    const roadMask = roadMasks.get(chunkKey(chunk.chunkX, chunk.chunkY))
    if (roadMask) {
      for (let index = 0; index < roadMask.length; index += 1) {
        if (roadMask[index] && riverMask[index]) bridgeMask[index] = 1
      }
    }
    riverMasks.set(chunkKey(chunk.chunkX, chunk.chunkY), riverMask)
    bridgeMasks.set(chunkKey(chunk.chunkX, chunk.chunkY), bridgeMask)
  }

  const riverBlocksAt = (chunk: GeneratedChunk, index: number) => {
    if (!content.world.rivers?.blockingMovement) return false
    const riverMask = riverMasks.get(chunkKey(chunk.chunkX, chunk.chunkY))
    const bridgeMask = bridgeMasks.get(chunkKey(chunk.chunkX, chunk.chunkY))
    return Boolean(riverMask?.[index] && !bridgeMask?.[index])
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
      const grid = new Graphics()
      const surfaces = new Graphics()
      const rivers = new Graphics()
      const roads = new Graphics()
      const settlements = new Graphics()
      const landmarks = new Graphics()
      const fog = new Container()
      const fogFill = new Graphics()
      const fogCutout = new Graphics()
      fogCutout.blendMode = 'erase'
      fog.addChild(fogFill, fogCutout)
      container.addChild(
        terrain,
        transitions,
        regionalDetails,
        closeDetails,
        grid,
        surfaces,
        rivers,
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
        grid,
        surfaces,
        rivers,
        roads,
        settlements,
        landmarks,
        fog,
        fogFill,
        fogCutout,
      }
      chunkViews.set(key, view)
    }

    view.container.position.set(chunk.originX * cellSize, chunk.originY * cellSize)
    view.terrain.clear()
    view.transitions.clear()
    view.regionalDetails.clear()
    view.closeDetails.clear()
    view.grid.clear()
    view.surfaces.clear()
    view.rivers.clear()
    view.roads.clear()
    view.settlements.clear()
    view.landmarks.clear()
    view.fog.visible = !devMode
    view.fogFill.clear()
    view.fogCutout.clear()
    rebuildRoadMask(chunk)
    rebuildRiverMask(chunk)

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
        view.terrain.rect(originX, originY, cellSize, cellSize).fill(biome.color)

        const rightBiome =
          localX + 1 < chunk.chunkSize
            ? (biomeByCode.get(chunk.biomes[index + 1]!) ?? biome)
            : biomeAtCell(chunk.originX + localX + 1, chunk.originY + localY)
        if (rightBiome && rightBiome.code !== biome.code) {
          drawBoundaryBlend(
            view.transitions,
            'east',
            originX,
            originY,
            cellSize,
            noise,
            biome,
            rightBiome
          )
        }

        const belowBiome =
          localY + 1 < chunk.chunkSize
            ? (biomeByCode.get(chunk.biomes[index + chunk.chunkSize]!) ?? biome)
            : biomeAtCell(chunk.originX + localX, chunk.originY + localY + 1)
        if (belowBiome && belowBiome.code !== biome.code) {
          drawBoundaryBlend(
            view.transitions,
            'south',
            originX,
            originY,
            cellSize,
            noise,
            biome,
            belowBiome
          )
        }

        if ((devMode || scale >= 2.05) && noise % 11 === 0) {
          view.regionalDetails
            .rect(originX + 1, originY + 1, Math.max(1, cellSize - 2), 0.5)
            .fill({ color: biome.accent, alpha: 0.52 })
        }

        if ((devMode || scale >= 3.35) && noise % 7 === 0) {
          const detailX = originX + 1 + ((noise >>> 7) % Math.max(1, cellSize - 2))
          const detailY = originY + 1 + ((noise >>> 11) % Math.max(1, cellSize - 2))
          if (biome.id.includes('ocean') || biome.id.includes('sea') || biome.id.includes('lake')) {
            drawWaterCloseDetail(
              view.closeDetails,
              originX,
              originY,
              cellSize,
              noise,
              colorFromHex(biome.accent, 0x7bd3f7)
            )
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

    for (const river of chunk.rivers) {
      drawRiver(view.rivers, river, chunk.originX, chunk.originY, cellSize, content.world.rivers)
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

    view.regionalDetails.visible = devMode ? scale >= 1.15 : scale >= 2.05
    view.closeDetails.visible = devMode ? scale >= 2.15 : scale >= 3.35
    view.grid.visible = devMode && devShowGrid
    view.surfaces.visible = scale >= 1
    view.rivers.visible = scale >= 0.95
    view.roads.visible = scale >= 1.05
    view.settlements.visible = scale >= 0.85
    view.landmarks.visible = scale >= 1.15
    redrawChunkSurfaces(chunk, activeWeather())
    redrawChunkFog(key)
    redrawChunkGrid(chunk)
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
        riverSystem: content.world.rivers,
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
      riverMasks.delete(key)
      bridgeMasks.delete(key)
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
        if (riverBlocksAt(data.chunk, data.index)) return false
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
    const frameY = minimapCollapsed ? 58 : 96
    minimapLayer
      .roundRect(frameX, frameY, minimapSize, minimapSize, 10)
      .fill({ color: palette().minimapFill, alpha: 0.86 })
      .stroke({ color: palette().minimapStroke, alpha: 0.8, width: 1.2 })

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
      .stroke({ color: palette().minimapExplorerStroke, width: 1 })
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

  const biomeAtCell = (cellX: number, cellY: number) => {
    const targetChunkX = Math.floor(cellX / chunkSize)
    const targetChunkY = Math.floor(cellY / chunkSize)
    const targetChunk = chunks.get(chunkKey(targetChunkX, targetChunkY))
    if (!targetChunk) return null
    const localX = cellX - targetChunk.originX
    const localY = cellY - targetChunk.originY
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= targetChunk.chunkSize ||
      localY >= targetChunk.chunkSize
    ) {
      return null
    }
    const biomeCode = targetChunk.biomes[localY * targetChunk.chunkSize + localX]
    if (biomeCode === undefined) return null
    return biomeByCode.get(biomeCode) ?? null
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
  let devPanel = buildDevPanel()
  const minimapControls = createMinimapControls({
    minimapChunkRadius,
    clamp,
    getText: minimapText,
    getCollapsed: () => minimapCollapsed,
    setCollapsedState: (collapsed) => {
      minimapCollapsed = collapsed
    },
    getMode: () => minimapMode,
    setMode: (mode) => {
      minimapMode = mode
    },
    getManualRadius: () => minimapManualRadius,
    setManualRadius: (radius) => {
      minimapManualRadius = radius
    },
    redraw: drawMinimap,
    applyTheme: applyCurrentMinimapTheme,
  })
  if (devPanel) options.container.appendChild(devPanel.panel)
  options.container.appendChild(minimapControls.panel)
  renderDevPanelLocale(devPanel, devText)
  renderMinimapLocale(minimapControls, minimapText, minimapCollapsed)

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
  refreshGridVisibility()
  drawBattleShadow()
  refreshWeatherLayers(performance.now(), true)
  drawMinimap()
  applyCurrentDevPanelTheme(devPanel)
  applyCurrentMinimapTheme(minimapControls)
  if (devPanel) {
    const panel = devPanel.panel
    panel.addEventListener('mouseenter', () => applyCurrentDevPanelTheme(devPanel, true))
    panel.addEventListener('mouseleave', () => applyCurrentDevPanelTheme(devPanel, false))
    panel.addEventListener('focusin', () => applyCurrentDevPanelTheme(devPanel, true))
    panel.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!panel.contains(document.activeElement)) applyCurrentDevPanelTheme(devPanel, false)
      }, 0)
    })
  }
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
      applyCurrentMinimapTheme(minimapControls)
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
    drawBattleShadow()
    updateStatus()
  }

  const resizeObserver = new ResizeObserver(() => {
    onResize()
  })
  resizeObserver.observe(options.container)

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
    drawBattleShadow()
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
      renderDevPanelLocale(devPanel, devText)
      renderMinimapLocale(minimapControls, minimapText, minimapCollapsed)
      drawMinimap()
      updateStatus()
      drawExplorer(performance.now() / 1000)
      drawBattleShadow()
      applyCurrentMinimapTheme(minimapControls)
    },
    setDevMode(enabled) {
      devMode = enabled
      if (!devMode) {
        devFastMove = false
        devBattleShadow = true
      }
      devPanel?.panel.remove()
      devPanel = buildDevPanel()
      if (devPanel) {
        options.container.appendChild(devPanel.panel)
        renderDevPanelLocale(devPanel, devText)
        devPanel.fastMoveToggle.checked = devFastMove
        const panel = devPanel.panel
        panel.addEventListener('mouseenter', () => applyCurrentDevPanelTheme(devPanel, true))
        panel.addEventListener('mouseleave', () => applyCurrentDevPanelTheme(devPanel, false))
        panel.addEventListener('focusin', () => applyCurrentDevPanelTheme(devPanel, true))
        panel.addEventListener('focusout', () => {
          window.setTimeout(() => {
            if (!panel.contains(document.activeElement)) applyCurrentDevPanelTheme(devPanel, false)
          }, 0)
        })
      }
      renderMinimapLocale(minimapControls, minimapText, minimapCollapsed)
      refreshFog()
      refreshFogVisibility()
      refreshGridVisibility()
      drawMinimap()
      updateStatus()
      drawExplorer(performance.now() / 1000)
      drawBattleShadow()
      applyCurrentDevPanelTheme(devPanel)
      applyCurrentMinimapTheme(minimapControls)
      if (devPanel) {
        devPanel.fastMoveToggle.checked = devFastMove
        devPanel.flyToggle.checked = devFly
        devPanel.battleShadowToggle.checked = devBattleShadow
        devPanel.gridToggle.checked = devShowGrid
      }
    },
    setTheme(nextTheme) {
      theme = normalizeTheme(nextTheme)
      status.style.fill = palette().statusFill
      applyThemeToContainer()
      drawMinimap()
      applyCurrentDevPanelTheme(devPanel)
      applyCurrentMinimapTheme(minimapControls)
    },
    async destroy() {
      if (destroyed) return
      destroyed = true
      rpc.rejectAll(new Error('Game destroyed'))
      worker.terminate()
      resizeObserver.disconnect()
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
