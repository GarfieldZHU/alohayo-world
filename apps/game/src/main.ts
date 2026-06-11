import './style.css'
import type { GameHandle } from '@alohayo/config'

const form = document.querySelector<HTMLFormElement>('#launcher')!
const seedInput = document.querySelector<HTMLInputElement>('#seed')!
const container = document.querySelector<HTMLElement>('#game')!
let handle: GameHandle | null = null
seedInput.value = window.localStorage.getItem('alohayo-world:last-seed') || 'alohayo'

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = form.querySelector('button')!
  button.disabled = true
  button.textContent = 'Generating...'
  await handle?.destroy()
  try {
    const { mountGame } = await import('@alohayo/embed')
    handle = await mountGame({
      container,
      initialWorld: { seed: seedInput.value.trim() || 'alohayo' },
    })
    button.textContent = 'Regenerate'
  } catch (error) {
    container.textContent = error instanceof Error ? error.message : 'Unable to start the world'
    button.textContent = 'Retry'
  } finally {
    button.disabled = false
  }
})
