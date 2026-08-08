import './style.css'
import {
  formatI18n,
  getI18nCatalog,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  translateContentName,
  type GameHandle,
  type LocaleCode,
  type WorldSaveWorldState,
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
const saveManagerDetails = document.querySelector<HTMLDetailsElement>('#save-manager')!
const localeStorageKey = 'alohayo-world:locale'
declare global {
  interface Window {
    __ALOHAYO_WORLD_E2E_WORKER_CAPABILITIES__?: import('@alohayo/config').WorldWorkerCapabilities
    __ALOHAYO_WORLD_E2E_ASSET_BASE_URL__?: string
    __ALOHAYO_WORLD_E2E_UI_OPTIONS__?: boolean | import('@alohayo/config').GameUiOptions
  }
}
let handle: GameHandle | null = null
let launcherState: 'idle' | 'loading' | 'running' | 'error' = 'idle'
let mountedWorld: WorldSaveWorldState | null = null
let saveManager: import('./save-manager').SaveManager | null = null
let saveManagerPromise: Promise<import('./save-manager').SaveManager> | null = null
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
const formatUiText = (key: string, values: Record<string, string | number>) =>
  formatI18n(uiText(key), values)
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
  document.documentElement.lang = locale
  document.title = uiText('gameTitle')
  languageLabel.textContent = uiText('language')
  eyebrow.textContent = uiText('eyebrow')
  heroTitle.textContent = uiText('heroTitle')
  heroDescription.textContent = uiText('standaloneDescription')
  seedLabel.textContent = uiText('seedLabel')
  placeholder.textContent = uiText('standalonePlaceholder')
  footerCopy.textContent = uiText('footerControlsStandalone')
  saveManager?.updateCopy()
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

const ensureSaveManager = async () => {
  if (saveManager) return saveManager
  saveManagerPromise ??= import('./save-manager').then(({ createSaveManager }) => {
    const manager = createSaveManager({
      getHandle: () => handle,
      getLocale: () => locale,
      getWorld: () => mountedWorld,
      uiText,
      formatUiText,
      launch,
    })
    saveManager = manager
    if (handle) void manager.refresh()
    return manager
  })
  return saveManagerPromise
}

saveManagerDetails.addEventListener('toggle', () => {
  if (saveManagerDetails.open) void ensureSaveManager()
})

const worldFromPreset = () => {
  const preset = sizePresets[sizeIndex]!
  return {
    seed: seedInput.value.trim() || 'alohayo',
    width: preset.width,
    height: preset.height,
    chunkRadius: preset.chunkRadius,
    retainChunkRadius: preset.retainChunkRadius,
    minimapChunkRadius: preset.minimapChunkRadius,
  }
}

const launch = async (savedWorld?: WorldSaveWorldState): Promise<boolean> => {
  launcherState = 'loading'
  submitButton.disabled = true
  submitButton.textContent = uiText('surveying')
  await handle?.destroy()
  handle = null
  try {
    const { mountGame } = await import('@alohayo/embed')
    const world = savedWorld
      ? {
          seed: savedWorld.seed,
          width: savedWorld.surveyWidth,
          height: savedWorld.surveyHeight,
          chunkRadius: savedWorld.activeChunkRadius,
          retainChunkRadius: savedWorld.retainChunkRadius,
          minimapChunkRadius: savedWorld.minimapChunkRadius,
        }
      : worldFromPreset()
    seedInput.value = world.seed
    const nextMountedWorld: WorldSaveWorldState = {
      seed: world.seed,
      chunkSize: savedWorld?.chunkSize ?? 64,
      surveyWidth: world.width,
      surveyHeight: world.height,
      activeChunkRadius: world.chunkRadius,
      retainChunkRadius: world.retainChunkRadius,
      minimapChunkRadius: world.minimapChunkRadius,
    }
    handle = await mountGame({
      container,
      assetBaseUrl:
        import.meta.env.MODE === 'test' && window.__ALOHAYO_WORLD_E2E_ASSET_BASE_URL__
          ? window.__ALOHAYO_WORLD_E2E_ASSET_BASE_URL__
          : new URL('./embed/', window.location.href).toString(),
      locale,
      ui:
        import.meta.env.MODE === 'test'
          ? (window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ ?? false)
          : undefined,
      workerCapabilities:
        import.meta.env.MODE === 'test'
          ? window.__ALOHAYO_WORLD_E2E_WORKER_CAPABILITIES__
          : undefined,
      initialWorld: {
        ...world,
      },
    })
    mountedWorld = nextMountedWorld
    if (savedWorld) {
      const matchingPreset = sizePresets.findIndex(
        (preset) =>
          preset.width === savedWorld.surveyWidth &&
          preset.height === savedWorld.surveyHeight &&
          preset.chunkRadius === savedWorld.activeChunkRadius
      )
      if (matchingPreset >= 0) {
        sizeIndex = matchingPreset
        updateSizeButton()
      }
    }
    launcherState = 'running'
    submitButton.textContent = uiText('resurvey')
    if (saveManager) {
      await saveManager.refresh()
      saveManager.setEnabled(true)
    }
    return true
  } catch (error) {
    container.textContent =
      error instanceof Error ? error.message : uiText('gameStartErrorStandalone')
    launcherState = 'error'
    submitButton.textContent = uiText('retry')
    saveManager?.setEnabled(false)
    return false
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
