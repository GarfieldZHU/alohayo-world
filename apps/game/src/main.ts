import './style.css'
import type { GameHandle } from '@alohayo/config'

const form = document.querySelector<HTMLFormElement>('#launcher')!
const seedInput = document.querySelector<HTMLInputElement>('#seed')!
const sizeButton = document.querySelector<HTMLButtonElement>('#map-size')!
const container = document.querySelector<HTMLElement>('#game')!
let handle: GameHandle | null = null
const sizePresets = [
  { name: 'Large', width: 256, height: 192 },
  { name: 'Huge', width: 320, height: 240 },
  { name: 'Continental', width: 384, height: 288 },
] as const
let sizeIndex = 0
seedInput.value = window.localStorage.getItem('alohayo-world:last-seed') || 'alohayo'

sizeButton.addEventListener('click', () => {
  sizeIndex = Math.min(sizeIndex + 1, sizePresets.length - 1)
  const preset = sizePresets[sizeIndex]!
  sizeButton.textContent =
    sizeIndex === sizePresets.length - 1
      ? `${preset.name} · ${preset.width}×${preset.height} (maximum)`
      : `${preset.name} · ${preset.width}×${preset.height}`
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  button.disabled = true
  button.textContent = 'Generating...'
  await handle?.destroy()
  try {
    const { mountGame } = await import('@alohayo/embed')
    handle = await mountGame({
      container,
      initialWorld: {
        seed: seedInput.value.trim() || 'alohayo',
        width: sizePresets[sizeIndex]!.width,
        height: sizePresets[sizeIndex]!.height,
      },
    })
    button.textContent = 'Regenerate'
  } catch (error) {
    container.textContent = error instanceof Error ? error.message : 'Unable to start the world'
    button.textContent = 'Retry'
  } finally {
    button.disabled = false
  }
})
