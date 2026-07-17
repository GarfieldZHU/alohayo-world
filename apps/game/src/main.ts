import './style.css'
import {
  formatI18n,
  getI18nCatalog,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  translateContentName,
  type GameHandle,
  type LocaleCode,
  type WorldSaveSummary,
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
const saveTitle = document.querySelector<HTMLElement>('#save-title')!
const saveDescription = document.querySelector<HTMLElement>('#save-description')!
const saveSlots = document.querySelector<HTMLSelectElement>('#save-slots')!
const saveName = document.querySelector<HTMLInputElement>('#save-name')!
const saveCreate = document.querySelector<HTMLButtonElement>('#save-create')!
const saveLoad = document.querySelector<HTMLButtonElement>('#save-load')!
const saveRename = document.querySelector<HTMLButtonElement>('#save-rename')!
const saveDuplicate = document.querySelector<HTMLButtonElement>('#save-duplicate')!
const saveDelete = document.querySelector<HTMLButtonElement>('#save-delete')!
const saveExport = document.querySelector<HTMLButtonElement>('#save-export')!
const saveImportData = document.querySelector<HTMLTextAreaElement>('#save-import-data')!
const saveImport = document.querySelector<HTMLButtonElement>('#save-import')!
const saveStatus = document.querySelector<HTMLElement>('#save-status')!
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
  saveTitle.textContent = uiText('saveTitle')
  saveDescription.textContent = uiText('saveDescription')
  saveSlots.ariaLabel = uiText('saveSlots')
  saveName.placeholder = uiText('saveName')
  saveCreate.textContent = uiText('saveCreate')
  saveLoad.textContent = uiText('saveLoad')
  saveRename.textContent = uiText('saveRename')
  saveDuplicate.textContent = uiText('saveDuplicate')
  saveDelete.textContent = uiText('saveDelete')
  saveExport.textContent = uiText('saveExport')
  saveImport.textContent = uiText('saveImport')
  saveImportData.placeholder = uiText('saveImportPlaceholder')
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

const selectedSave = () => saveSlots.options[saveSlots.selectedIndex]
const requestedSlot = () => {
  const label = saveName.value.trim() || `Manual ${new Date().toLocaleString(locale)}`
  const slotId = label
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return { label, slotId: slotId || `manual-${Date.now()}` }
}

const setSaveControlsDisabled = (disabled: boolean) => {
  for (const control of [
    saveCreate,
    saveLoad,
    saveRename,
    saveDuplicate,
    saveDelete,
    saveExport,
    saveImport,
  ]) {
    control.disabled = disabled
  }
}

const renderSaveOptions = (summaries: WorldSaveSummary[]) => {
  const previous = saveSlots.value
  saveSlots.replaceChildren()
  for (const summary of summaries) {
    const option = document.createElement('option')
    option.value = summary.slotId
    option.dataset.label = summary.label
    option.textContent = `${summary.label} · ${summary.kind} · ${summary.seed} · ${summary.discoveredCells} cells`
    saveSlots.appendChild(option)
  }
  if (summaries.some((summary) => summary.slotId === previous)) saveSlots.value = previous
  saveStatus.textContent = summaries.length
    ? formatUiText('saveReady', { count: summaries.length })
    : uiText('saveEmpty')
}

const refreshSaves = async () => {
  if (!handle?.listSaves) {
    renderSaveOptions([])
    return
  }
  renderSaveOptions(await handle.listSaves())
}

const runSaveAction = async (action: () => Promise<void>) => {
  setSaveControlsDisabled(true)
  try {
    await action()
    await refreshSaves()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    saveStatus.textContent = formatUiText('saveError', { message })
    saveStatus.dataset.state = 'error'
  } finally {
    setSaveControlsDisabled(!handle)
  }
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
      assetBaseUrl: new URL('./embed/', window.location.href).toString(),
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
    await refreshSaves()
    setSaveControlsDisabled(false)
  } catch (error) {
    container.textContent =
      error instanceof Error ? error.message : uiText('gameStartErrorStandalone')
    launcherState = 'error'
    submitButton.textContent = uiText('retry')
    setSaveControlsDisabled(true)
  } finally {
    submitButton.disabled = false
  }
}

saveCreate.addEventListener('click', () =>
  runSaveAction(async () => {
    const { slotId, label } = requestedSlot()
    const summary = await handle?.save?.(slotId, label)
    if (summary) saveStatus.textContent = formatUiText('saveSuccess', { label: summary.label })
  })
)

saveLoad.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    const summary = await handle?.loadSave?.(option.value)
    if (summary) saveStatus.textContent = formatUiText('saveLoaded', { label: summary.label })
  })
)

saveRename.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    const { slotId, label } = requestedSlot()
    await handle?.renameSave?.(option.value, slotId, label)
  })
)

saveDuplicate.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    const { slotId, label } = requestedSlot()
    await handle?.duplicateSave?.(option.value, slotId, label)
  })
)

saveDelete.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    await handle?.clearSave?.(option.value)
    saveStatus.textContent = uiText('saveDeleted')
  })
)

saveExport.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    const serialized = await handle?.exportSave?.(option.value)
    if (!serialized) return
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${option.value}.alohayo-save.json`
    anchor.click()
    URL.revokeObjectURL(url)
  })
)

saveImport.addEventListener('click', () =>
  runSaveAction(async () => {
    const { slotId, label } = requestedSlot()
    const summary = await handle?.importSave?.(saveImportData.value, slotId, label)
    if (summary) saveStatus.textContent = formatUiText('saveImported', { label: summary.label })
  })
)

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
setSaveControlsDisabled(true)
