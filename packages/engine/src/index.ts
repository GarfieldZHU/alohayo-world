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
  GameHandle,
  MapAreaDefinition,
  MountGameOptions,
  WorldDefinition,
} from '@alohayo/config'
import type { GeneratedWorld, GenerateWorldResponse } from '@alohayo/map'
import WorldWorker from '../../map/src/world.worker.ts?worker&inline'

interface EngineContent {
  world: WorldDefinition
  biomes: BiomeDefinition[]
  mapAreas: MapAreaDefinition[]
  characters: CharacterContentDefinition
}

function loadWorld(
  worker: Worker,
  seed: string,
  width: number,
  height: number,
  mapAreas: MapAreaDefinition[],
  terrainCodes: Record<string, number>
): Promise<GeneratedWorld> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('World generation timed out')), 15000)
    worker.onmessage = (event: MessageEvent<GenerateWorldResponse>) => {
      window.clearTimeout(timeout)
      resolve(event.data.world)
    }
    worker.onerror = (event) => {
      window.clearTimeout(timeout)
      reject(new Error(event.message || 'World generation failed'))
    }
    worker.postMessage({ type: 'generate', seed, width, height, mapAreas, terrainCodes })
  })
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
  const viewport = new Container()
  const terrain = new Graphics()
  const transitions = new Graphics()
  const regionalDetails = new Graphics()
  const closeDetails = new Graphics()
  const landmarks = new Graphics()
  const characterLayer = new Graphics()
  const overlay = new Container()
  viewport.addChild(terrain, transitions, regionalDetails, closeDetails, landmarks, characterLayer)
  app.stage.addChild(viewport, overlay)

  const biomeByCode = new Map(content.biomes.map((biome) => [biome.code, biome]))
  const terrainCodes = Object.fromEntries(content.biomes.map((biome) => [biome.id, biome.code]))
  const status = new Text({
    text: 'Generating world...',
    style: { fill: '#d8f3ff', fontFamily: 'monospace', fontSize: 13 },
  })
  status.position.set(14, 12)
  overlay.addChild(status)

  let paused = false
  let destroyed = false
  let world: GeneratedWorld | null = null
  let explorer: GeneratedCharacter | null = null
  let explorerMotion: CharacterMotionState | null = null
  let scale = 1
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
  const pressedKeys = new Set<string>()
  const cellSize = content.world.cellSize
  const fixedStep = 1 / 60
  const requestedWidth = Math.round(options.initialWorld?.width ?? content.world.width)
  const requestedHeight = Math.round(options.initialWorld?.height ?? content.world.height)
  const worldWidth = Math.max(64, Math.min(384, requestedWidth))
  const worldHeight = Math.max(48, Math.min(288, requestedHeight))

  const cellNoise = (x: number, y: number, salt = 0) => {
    let value = Math.imul(x + salt, 374761393) ^ Math.imul(y - salt, 668265263)
    value = Math.imul(value ^ (value >>> 13), 1274126177)
    return (value ^ (value >>> 16)) >>> 0
  }

  const updateDetailLevel = () => {
    regionalDetails.visible = scale >= 1.15
    closeDetails.visible = scale >= 2.15
    landmarks.visible = scale >= 1.15
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

  const findSpawn = (): { x: number; y: number } | null => {
    if (!world) return null
    const centerX = Math.floor(world.width / 2)
    const centerY = Math.floor(world.height / 2)
    for (let radius = 0; radius < Math.max(world.width, world.height); radius += 1) {
      for (
        let y = Math.max(0, centerY - radius);
        y <= Math.min(world.height - 1, centerY + radius);
        y += 1
      ) {
        for (
          let x = Math.max(0, centerX - radius);
          x <= Math.min(world.width - 1, centerX + radius);
          x += 1
        ) {
          const index = y * world.width + x
          if (world.landmass[index] === world.mainlandId) return { x: x + 0.5, y: y + 0.5 }
        }
      }
    }
    return null
  }

  const drawExplorer = (elapsedSeconds = 0) => {
    characterLayer.clear()
    if (!world || !explorer || !explorerMotion) return
    app.canvas.dataset.characterX = explorerMotion.x.toFixed(4)
    app.canvas.dataset.characterY = explorerMotion.y.toFixed(4)
    app.canvas.dataset.characterState = explorerMotion.state
    app.canvas.dataset.characterAreaRatio = '0.111111'
    const centerPixelX = explorerMotion.x * cellSize
    const centerPixelY = explorerMotion.y * cellSize
    const skin = appearanceColor(explorer.appearance.skinTone, 0xc99370)
    const hair = appearanceColor(explorer.appearance.hairColor, 0x33251e)
    const clothing = itemColor(['wear:outer', 'wear:torso'], 0x72d7c8)
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
        centerPixelX - bodyWidth / 2,
        centerPixelY - footprint * 0.04 + bob,
        bodyWidth,
        bodyHeight
      )
      .fill({ color: clothing })
  }

  const drawWorld = () => {
    if (!world) return
    terrain.clear()
    transitions.clear()
    regionalDetails.clear()
    closeDetails.clear()
    landmarks.clear()
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const index = y * world.width + x
        const biome = biomeByCode.get(world.biomes[index]!) ?? content.biomes[0]!
        const originX = x * cellSize
        const originY = y * cellSize
        const noise = cellNoise(x, y, world.elevation[index]!)
        terrain.rect(x * cellSize, y * cellSize, cellSize + 0.5, cellSize + 0.5).fill(biome.color)

        const rightIndex = x + 1 < world.width ? index + 1 : -1
        if (rightIndex >= 0 && world.biomes[rightIndex] !== world.biomes[index]) {
          const rightBiome = biomeByCode.get(world.biomes[rightIndex]!) ?? biome
          const offset = noise % Math.max(1, cellSize - 1)
          transitions
            .rect(originX + cellSize - 0.65, originY, 1.3, cellSize)
            .fill({ color: rightBiome.color, alpha: 0.34 })
          transitions
            .rect(originX + cellSize - 1, originY + offset, 1.5, 1)
            .fill({ color: rightBiome.accent, alpha: 0.48 })
        }

        const belowIndex = y + 1 < world.height ? index + world.width : -1
        if (belowIndex >= 0 && world.biomes[belowIndex] !== world.biomes[index]) {
          const belowBiome = biomeByCode.get(world.biomes[belowIndex]!) ?? biome
          const offset = (noise >>> 4) % Math.max(1, cellSize - 1)
          transitions
            .rect(originX, originY + cellSize - 0.65, cellSize, 1.3)
            .fill({ color: belowBiome.color, alpha: 0.34 })
          transitions
            .rect(originX + offset, originY + cellSize - 1, 1, 1.5)
            .fill({ color: belowBiome.accent, alpha: 0.48 })
        }

        if (noise % 11 === 0) {
          regionalDetails
            .rect(originX + 1, originY + 1, Math.max(1, cellSize - 2), 0.5)
            .fill({ color: biome.accent, alpha: 0.52 })
        }

        if (noise % 7 === 0) {
          const detailX = originX + 1 + ((noise >>> 7) % Math.max(1, cellSize - 2))
          const detailY = originY + 1 + ((noise >>> 11) % Math.max(1, cellSize - 2))
          const id = biome.id
          if (id.includes('ocean') || id.includes('sea') || id.includes('lake')) {
            closeDetails.rect(originX + 0.5, detailY, cellSize - 1, 0.45).fill({
              color: biome.accent,
              alpha: 0.7,
            })
          } else if (id.includes('forest')) {
            closeDetails.circle(detailX, detailY, 0.8).fill({
              color: biome.accent,
              alpha: 0.86,
            })
          } else if (id.includes('mountain') || id.includes('rock') || id.includes('highland')) {
            closeDetails
              .moveTo(originX + 0.5, originY + cellSize - 0.5)
              .lineTo(originX + cellSize / 2, originY + 0.5)
              .lineTo(originX + cellSize - 0.5, originY + cellSize - 0.5)
              .stroke({ color: biome.accent, width: 0.55, alpha: 0.82 })
          } else if (id.includes('wetland')) {
            closeDetails
              .moveTo(detailX, originY + cellSize - 0.5)
              .lineTo(detailX, originY + 1)
              .stroke({ color: biome.accent, width: 0.55, alpha: 0.8 })
          } else {
            closeDetails.circle(detailX, detailY, 0.45).fill({
              color: biome.accent,
              alpha: 0.72,
            })
          }
        }
      }
    }
    for (const landmark of world.landmarks) {
      const x = landmark.x * cellSize + cellSize / 2
      const y = landmark.y * cellSize + cellSize / 2
      landmarks
        .moveTo(x, y - 2)
        .lineTo(x + 2, y)
        .lineTo(x, y + 2)
        .lineTo(x - 2, y)
        .closePath()
        .fill({ color: 0xf0d79b, alpha: 0.95 })
        .stroke({ color: 0xffffff, width: 0.45, alpha: 0.8 })
    }
    const spawn = findSpawn()
    explorerMotion = spawn ? createCharacterMotion(spawn.x, spawn.y) : null
    drawExplorer()
    scale = Math.min(
      1,
      Math.max(
        0.35,
        Math.min(
          (app.screen.width - 24) / (world.width * cellSize),
          (app.screen.height - 66) / (world.height * cellSize)
        )
      )
    )
    viewport.scale.set(scale)
    updateDetailLevel()
    viewport.position.set(
      (app.screen.width - world.width * cellSize * scale) / 2,
      Math.max(54, (app.screen.height - world.height * cellSize * scale) / 2)
    )
  }

  const generate = async (seed: string) => {
    status.text = `Generating "${seed}"...`
    explorer = generateCharacter(content.characters, 'core:explorer', seed)
    world = await loadWorld(worker, seed, worldWidth, worldHeight, content.mapAreas, terrainCodes)
    window.localStorage.setItem('alohayo-world:last-seed', seed)
    drawWorld()
  }
  await generate(options.initialWorld?.seed || content.world.defaultSeed)

  const updateStatus = () => {
    if (!world) return
    if (actionMessage && performance.now() < actionMessageUntil) {
      status.text = actionMessage
      return
    }
    status.text = `${explorer?.name ?? 'Explorer'}  seed ${world.seed}  hash ${
      world.hash
    }  ${explorerMotion?.state ?? 'idle'}  ${world.generationMs.toFixed(
      1
    )}ms  ${world.width}x${world.height}  ${fps}fps  zoom ${scale.toFixed(2)}x`
  }
  const onPointerDown = (event: PointerEvent) => {
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
    app.canvas.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!world) return
    if (dragging) {
      viewport.x += event.clientX - lastX
      viewport.y += event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
    }
    if (actionMessage && performance.now() < actionMessageUntil) return
    const bounds = app.canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - bounds.left - viewport.x) / scale / cellSize)
    const y = Math.floor((event.clientY - bounds.top - viewport.y) / scale / cellSize)
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return
    const index = y * world.width + x
    const biome = biomeByCode.get(world.biomes[index]!)
    const areaId = world.areaIds[world.authoredArea[index]!] ?? ''
    const region = world.waterbody[index]
      ? world.waterbody[index] === 1
        ? 'ocean'
        : `lake ${world.waterbody[index]}`
      : world.landmass[index] === world.mainlandId
        ? 'mainland'
        : `island ${world.landmass[index]}`
    status.text = `${biome?.name ?? 'Unknown'} / ${region}${
      areaId ? ` / ${areaId}` : ''
    } (${x}, ${y})  elevation ${
      world.elevation[index]
    }  moisture ${world.moisture[index]}  temperature ${world.temperature[index]}`
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
    scale = Math.max(0.35, Math.min(4, scale * (event.deltaY > 0 ? 0.88 : 1.14)))
    viewport.scale.set(scale)
    viewport.position.set(pointerX - worldX * scale, pointerY - worldY * scale)
    updateDetailLevel()
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

  const performAction = () => {
    if (!world || !explorer || !explorerMotion) return
    const actionId = explorer.actionIds[0]
    const action = content.characters.actions.find((candidate) => candidate.id === actionId)
    if (!action) return
    startCharacterAction(explorerMotion, action.duration)
    let nearest = null as GeneratedWorld['landmarks'][number] | null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const landmark of world.landmarks) {
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
    actionMessage =
      action.target === 'self'
        ? `${explorer.name} uses ${action.name}.`
        : nearest
          ? `${explorer.name} examines ${nearest.name}: ${nearest.description}`
          : `${explorer.name} uses ${action.name}, but nothing is within reach.`
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

  const canOccupy = (x: number, y: number) => {
    if (!world) return false
    const radius = CHARACTER_CELL_FRACTION / 2
    for (const offsetX of [-radius, radius]) {
      for (const offsetY of [-radius, radius]) {
        const cellX = Math.floor(x + offsetX)
        const cellY = Math.floor(y + offsetY)
        if (cellX < 0 || cellY < 0 || cellX >= world.width || cellY >= world.height) return false
        const biome = biomeByCode.get(world.biomes[cellY * world.width + cellX]!)
        if (!biome || biome.movementCost >= 7) return false
      }
    }
    return true
  }

  const movementCost = (x: number, y: number) => {
    if (!world) return 1
    const cellX = Math.max(0, Math.min(world.width - 1, Math.floor(x)))
    const cellY = Math.max(0, Math.min(world.height - 1, Math.floor(y)))
    return biomeByCode.get(world.biomes[cellY * world.width + cellX]!)?.movementCost ?? 1
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
    stepCharacterMotion(explorerMotion, {
      character: explorer,
      deltaSeconds,
      input: { x: inputX, y: inputY, running: pressedKeys.has('shift') },
      canOccupy,
      movementCost,
    })
    if (explorerMotion.x !== previousX || explorerMotion.y !== previousY) {
      viewport.x -= (explorerMotion.x - previousX) * cellSize * scale
      viewport.y -= (explorerMotion.y - previousY) * cellSize * scale
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
    async destroy() {
      if (destroyed) return
      destroyed = true
      worker.terminate()
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
