import { Application, Container, Graphics, Text } from 'pixi.js'
import type {
  BiomeDefinition,
  GameHandle,
  MountGameOptions,
  WorldDefinition,
} from '@alohayo/config'
import type { GeneratedWorld, GenerateWorldResponse } from '@alohayo/map'

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

  const worker = new Worker(new URL('../../map/src/world.worker.ts', import.meta.url), {
    type: 'module',
  })
  const viewport = new Container()
  const terrain = new Graphics()
  const overlay = new Container()
  viewport.addChild(terrain)
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

  const drawWorld = () => {
    if (!world) return
    terrain.clear()
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const index = y * world.width + x
        const biome = biomeByCode.get(world.biomes[index]!) ?? content.biomes[0]!
        terrain.rect(x * cellSize, y * cellSize, cellSize + 0.5, cellSize + 0.5).fill(biome.color)
        if ((x * 13 + y * 7 + world.elevation[index]!) % 17 === 0) {
          terrain
            .rect(x * cellSize + 1, y * cellSize + 1, Math.max(1, cellSize / 3), 1)
            .fill({ color: biome.accent, alpha: 0.58 })
        }
      }
    }
    viewport.position.set(
      Math.max(12, (app.screen.width - world.width * cellSize) / 2),
      Math.max(54, (app.screen.height - world.height * cellSize) / 2)
    )
  }

  const generate = async (seed: string) => {
    status.text = `Generating "${seed}"...`
    world = await loadWorld(worker, seed, content.world.width, content.world.height)
    window.localStorage.setItem('alohayo-world:last-seed', seed)
    drawWorld()
  }
  await generate(options.initialWorld?.seed || content.world.defaultSeed)

  const updateStatus = () => {
    if (!world) return
    status.text = `seed ${world.seed}  hash ${world.hash}  ${world.generationMs.toFixed(
      1
    )}ms  ${fps}fps  zoom ${scale.toFixed(2)}x`
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
    status.text = `${biome?.name ?? 'Unknown'} (${x}, ${y})  elevation ${
      world.elevation[index]
    }  moisture ${world.moisture[index]}  temperature ${world.temperature[index]}`
  }
  const onPointerUp = () => {
    dragging = false
  }
  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    scale = Math.max(0.35, Math.min(4, scale * (event.deltaY > 0 ? 0.9 : 1.1)))
    viewport.scale.set(scale)
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
