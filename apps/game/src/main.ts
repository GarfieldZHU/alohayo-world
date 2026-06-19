import './style.css'
import {
  getI18nCatalog,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  translateContentName,
  type GameHandle,
  type LocaleCode,
} from '@alohayo/config'

const form = document.querySelector<HTMLFormElement>('#launcher')!
const seedInput = document.querySelector<HTMLInputElement>('#seed')!
const sizeButton = document.querySelector<HTMLButtonElement>('#map-size')!
const submitButton = document.querySelector<HTMLButtonElement>('#submit-button')!
const container = document.querySelector<HTMLElement>('#game')!
const languageLabel = document.querySelector<HTMLElement>('#language-label')!
const eyebrow = document.querySelector<HTMLElement>('#eyebrow')!
const heroTitle = document.querySelector<HTMLElement>('#hero-title')!
const heroDescription = document.querySelector<HTMLElement>('#hero-description')!
const seedLabel = document.querySelector<HTMLElement>('#seed-label')!
const placeholder = document.querySelector<HTMLElement>('#placeholder')!
const footerCopy = document.querySelector<HTMLElement>('#footer-copy')!
const localeStorageKey = 'alohayo-world:locale'
let handle: GameHandle | null = null
let launcherState: 'idle' | 'loading' | 'running' | 'error' = 'idle'
const sizePresets = [
  {
    id: 'frontier',
    name: 'Frontier',
    width: 512,
    height: 384,
    chunkRadius: 2,
    retainChunkRadius: 3,
    minimapChunkRadius: 6,
  },
  {
    id: 'expanse',
    name: 'Expanse',
    width: 768,
    height: 576,
    chunkRadius: 3,
    retainChunkRadius: 4,
    minimapChunkRadius: 8,
  },
  {
    id: 'horizon',
    name: 'Horizon',
    width: 1024,
    height: 768,
    chunkRadius: 4,
    retainChunkRadius: 5,
    minimapChunkRadius: 10,
  },
] as const
let sizeIndex = 0
let locale = normalizeLocale(window.localStorage.getItem(localeStorageKey) || navigator.language)
seedInput.value = window.localStorage.getItem('alohayo-world:last-seed') || 'alohayo'

const catalog = () => getI18nCatalog(locale)
const uiText = (key: string) => catalog().ui[key] ?? key
const languageButtons = new Map<LocaleCode, HTMLButtonElement>(
  LANGUAGE_OPTIONS.map((option) => [
    option.code,
    document.querySelector<HTMLButtonElement>(`#language-${option.code}`)!,
  ])
)

const updateSizeButton = () => {
  const preset = sizePresets[sizeIndex]!
  const presetName = translateContentName(locale, 'worldSizePresets', preset.id, preset.name)
  const action =
    sizeIndex === sizePresets.length - 1
      ? catalog().ui.sizeActionMaximum
      : catalog().ui.sizeActionEnlarge
  sizeButton.textContent = `${presetName} · ${preset.width}×${preset.height} / ${action}`
}

const updateLanguageButtons = () => {
  for (const [code, button] of languageButtons) {
    button.disabled = code === locale
    button.textContent = catalog().languageOptions[code]
  }
}

const updateLauncherCopy = () => {
  const messages = catalog()
  document.documentElement.lang = locale
  document.title = uiText('gameTitle')
  languageLabel.textContent = uiText('language')
  eyebrow.textContent = uiText('eyebrow')
  heroTitle.textContent = uiText('heroTitle')
  heroDescription.textContent = uiText('standaloneDescription')
  seedLabel.textContent = uiText('seedLabel')
  placeholder.textContent = uiText('standalonePlaceholder')
  footerCopy.textContent = uiText('footerControlsStandalone')
  submitButton.textContent =
    launcherState === 'loading'
      ? uiText('surveying')
      : launcherState === 'running'
        ? uiText('resurvey')
        : launcherState === 'error'
          ? uiText('retry')
          : uiText('enterWorld')
  updateLanguageButtons()
  updateSizeButton()
}

const launch = async () => {
  launcherState = 'loading'
  submitButton.disabled = true
  submitButton.textContent = uiText('surveying')
  await handle?.destroy()
  try {
    const { mountGame } = await import('@alohayo/embed')
    const preset = sizePresets[sizeIndex]!
    handle = await mountGame({
      container,
      locale,
      initialWorld: {
        seed: seedInput.value.trim() || 'alohayo',
        width: preset.width,
        height: preset.height,
        chunkRadius: preset.chunkRadius,
        retainChunkRadius: preset.retainChunkRadius,
        minimapChunkRadius: preset.minimapChunkRadius,
      },
    })
    launcherState = 'running'
    submitButton.textContent = uiText('resurvey')
  } catch (error) {
    container.textContent =
      error instanceof Error ? error.message : uiText('gameStartErrorStandalone')
    launcherState = 'error'
    submitButton.textContent = uiText('retry')
  } finally {
    submitButton.disabled = false
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

for (const [code, button] of languageButtons) {
  button.addEventListener('click', async () => {
    locale = code
    window.localStorage.setItem(localeStorageKey, code)
    updateLauncherCopy()
    if (handle) {
      handle.setLocale?.(code)
      if (!handle.setLocale) await launch()
    }
  })
}

updateLauncherCopy()
