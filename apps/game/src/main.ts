import './style.css'
import type { GameHandle } from '@alohayo/config'

const form = document.querySelector<HTMLFormElement>('#launcher')!
const seedInput = document.querySelector<HTMLInputElement>('#seed')!
const sizeButton = document.querySelector<HTMLButtonElement>('#map-size')!
const container = document.querySelector<HTMLElement>('#game')!
let handle: GameHandle | null = null
const sizePresets = [
  {
    name: 'Frontier',
    width: 512,
    height: 384,
    chunkRadius: 2,
    retainChunkRadius: 3,
    minimapChunkRadius: 6,
  },
  {
    name: 'Expanse',
    width: 768,
    height: 576,
    chunkRadius: 3,
    retainChunkRadius: 4,
    minimapChunkRadius: 8,
  },
  {
    name: 'Horizon',
    width: 1024,
    height: 768,
    chunkRadius: 4,
    retainChunkRadius: 5,
    minimapChunkRadius: 10,
  },
] as const
let sizeIndex = 0
seedInput.value = window.localStorage.getItem('alohayo-world:last-seed') || 'alohayo'

const updateSizeButton = () => {
  const preset = sizePresets[sizeIndex]!
  sizeButton.textContent =
    sizeIndex === sizePresets.length - 1
      ? `${preset.name} · ${preset.width}×${preset.height} / Maximum`
      : `${preset.name} · ${preset.width}×${preset.height} / Enlarge`
}

const launch = async () => {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  button.disabled = true
  button.textContent = 'Surveying...'
  await handle?.destroy()
  try {
    const { mountGame } = await import('@alohayo/embed')
    const preset = sizePresets[sizeIndex]!
    handle = await mountGame({
      container,
      initialWorld: {
        seed: seedInput.value.trim() || 'alohayo',
        width: preset.width,
        height: preset.height,
        chunkRadius: preset.chunkRadius,
        retainChunkRadius: preset.retainChunkRadius,
        minimapChunkRadius: preset.minimapChunkRadius,
      },
    })
    button.textContent = 'Resurvey'
  } catch (error) {
    container.textContent = error instanceof Error ? error.message : 'Unable to start the world'
    button.textContent = 'Retry'
  } finally {
    button.disabled = false
  }
}

sizeButton.addEventListener('click', async () => {
  sizeIndex = Math.min(sizeIndex + 1, sizePresets.length - 1)
  updateSizeButton()
  if (handle) await launch()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  await launch()
})

updateSizeButton()
