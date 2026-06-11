import { Application, Container, Graphics, Text } from 'pixi.js'
import type {
  BiomeDefinition,
  GameHandle,
  MountGameOptions,
  WorldDefinition,
} from '@alohayo/config'
import type { GeneratedWorld, GenerateWorldResponse } from '@alohayo/map'
import WorldWorker from '../../map/src/world.worker.ts?worker&inline'

interface EngineContent {
  world: WorldDefinition
  biomes: BiomeDefinition[]
}

function loadWorld(
  worker: Worker,
  seed: string,
  width: number,
  height: number
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
    worker.postMessage({ type: 'generate', seed, width, height })
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
  const overlay = new Container()
  viewport.addChild(terrain, transitions, regionalDetails, closeDetails)
  app.stage.addChild(viewport, overlay)

  const biomeByCode = new Map(content.biomes.map((biome) => [biome.code, biome]))
  const status = new Text({
    text: 'Generating world...',
    style: { fill: '#d8f3ff', fontFamily: 'monospace', fontSize: 13 },
  })
  status.position.set(14, 12)
  overlay.addChild(status)

  let paused = false
  let destroyed = false
  let world: GeneratedWorld | null = null
  let scale = 1
  let dragging = false
  let lastX = 0
  let lastY = 0
  let frameCount = 0
  let fps = 0
  let fpsStarted = performance.now()
  const cellSize = content.world.cellSize
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
  }

  const drawWorld = () => {
    if (!world) return
    terrain.clear()
    transitions.clear()
    regionalDetails.clear()
    closeDetails.clear()
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
    world = await loadWorld(worker, seed, worldWidth, worldHeight)
    window.localStorage.setItem('alohayo-world:last-seed', seed)
    drawWorld()
  }
  await generate(options.initialWorld?.seed || content.world.defaultSeed)

  const updateStatus = () => {
    if (!world) return
    status.text = `seed ${world.seed}  hash ${world.hash}  ${world.generationMs.toFixed(
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
    const bounds = app.canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - bounds.left - viewport.x) / scale / cellSize)
    const y = Math.floor((event.clientY - bounds.top - viewport.y) / scale / cellSize)
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return
    const index = y * world.width + x
    const biome = biomeByCode.get(world.biomes[index]!)
    const region = world.waterbody[index]
      ? world.waterbody[index] === 1
        ? 'ocean'
        : `lake ${world.waterbody[index]}`
      : world.landmass[index] === world.mainlandId
        ? 'mainland'
        : `island ${world.landmass[index]}`
    status.text = `${biome?.name ?? 'Unknown'} / ${region} (${x}, ${y})  elevation ${
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
  const onKeyDown = (event: KeyboardEvent) => {
    const amount = 28
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') viewport.x += amount
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') viewport.x -= amount
    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') viewport.y += amount
    if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') viewport.y -= amount
  }

  app.canvas.addEventListener('pointerdown', onPointerDown)
  app.canvas.addEventListener('pointermove', onPointerMove)
  app.canvas.addEventListener('pointerup', onPointerUp)
  app.canvas.addEventListener('pointercancel', onPointerUp)
  app.canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  app.ticker.add(() => {
    if (paused || destroyed) return
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
      app.destroy(true, { children: true, texture: true })
      options.container.replaceChildren()
    },
  }
}
