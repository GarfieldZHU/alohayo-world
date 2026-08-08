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
  type WorldSaveWorldState,
} from '@alohayo/config'
import { decodeSaveArchive, encodeSaveArchive, formatBytes } from './save-archive'

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
const saveList = document.querySelector<HTMLElement>('#save-list')!
const saveName = document.querySelector<HTMLInputElement>('#save-name')!
const savePreview = document.querySelector<HTMLElement>('#save-preview')!
const savePreviewSeed = document.querySelector<HTMLElement>('#save-preview-seed')!
const savePreviewPosition = document.querySelector<HTMLElement>('#save-preview-position')!
const savePreviewDiscovery = document.querySelector<HTMLElement>('#save-preview-discovery')!
const savePreviewHealth = document.querySelector<HTMLElement>('#save-preview-health')!
const saveRecovery = document.querySelector<HTMLElement>('#save-recovery')!
const saveBackups = document.querySelector<HTMLSelectElement>('#save-backups')!
const saveRestoreBackup = document.querySelector<HTMLButtonElement>('#save-restore-backup')!
const saveCreate = document.querySelector<HTMLButtonElement>('#save-create')!
const saveLoad = document.querySelector<HTMLButtonElement>('#save-load')!
const saveRename = document.querySelector<HTMLButtonElement>('#save-rename')!
const saveDuplicate = document.querySelector<HTMLButtonElement>('#save-duplicate')!
const saveDelete = document.querySelector<HTMLButtonElement>('#save-delete')!
const saveExport = document.querySelector<HTMLButtonElement>('#save-export')!
const saveExportAll = document.querySelector<HTMLButtonElement>('#save-export-all')!
const saveImportData = document.querySelector<HTMLTextAreaElement>('#save-import-data')!
const saveImport = document.querySelector<HTMLButtonElement>('#save-import')!
const saveImportAll = document.querySelector<HTMLButtonElement>('#save-import-all')!
const saveStorage = document.querySelector<HTMLElement>('#save-storage')!
const saveStatus = document.querySelector<HTMLElement>('#save-status')!
const localeStorageKey = 'alohayo-world:locale'
declare global {
  interface Window {
    __ALOHAYO_WORLD_E2E_WORKER_CAPABILITIES__?: import('@alohayo/config').WorldWorkerCapabilities
    __ALOHAYO_WORLD_E2E_ASSET_BASE_URL__?: string
    __ALOHAYO_WORLD_E2E_UI_OPTIONS__?: boolean | import('@alohayo/config').GameUiOptions
  }
}
let handle: GameHandle | null = null
let saveSummaries: WorldSaveSummary[] = []
let launcherState: 'idle' | 'loading' | 'running' | 'error' = 'idle'
let mountedWorld: WorldSaveWorldState | null = null
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
  saveBackups.ariaLabel = uiText('saveBackups')
  saveRestoreBackup.textContent = uiText('saveRecover')
  saveCreate.textContent = uiText('saveCreate')
  saveLoad.textContent = uiText('saveLoad')
  saveRename.textContent = uiText('saveRename')
  saveDuplicate.textContent = uiText('saveDuplicate')
  saveDelete.textContent = uiText('saveDelete')
  saveExport.textContent = uiText('saveExport')
  saveExportAll.textContent = uiText('saveExportAll')
  saveImport.textContent = uiText('saveImport')
  saveImportAll.textContent = uiText('saveImportAll')
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

const downloadText = (filename: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const setSaveControlsDisabled = (disabled: boolean) => {
  for (const control of [
    saveCreate,
    saveLoad,
    saveRename,
    saveDuplicate,
    saveDelete,
    saveExport,
    saveExportAll,
    saveImport,
    saveImportAll,
  ]) {
    control.disabled = disabled
  }
  saveBackups.disabled = disabled
  saveRestoreBackup.disabled =
    disabled || !Array.from(saveBackups.options).some((option) => !option.disabled)
}

const renderSaveOptions = (summaries: WorldSaveSummary[]) => {
  saveSummaries = summaries
  const previous = saveSlots.dataset.nextSelection || saveSlots.value
  delete saveSlots.dataset.nextSelection
  saveSlots.replaceChildren()
  saveList.replaceChildren()
  for (const summary of summaries) {
    const option = document.createElement('option')
    option.value = summary.slotId
    option.dataset.label = summary.label
    option.textContent = `${summary.health === 'corrupt' ? '⚠ ' : ''}${summary.label} · ${summary.seed}`
    saveSlots.appendChild(option)

    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'save-card'
    card.dataset.health = summary.health
    card.dataset.slotId = summary.slotId
    card.setAttribute('role', 'option')
    card.setAttribute('aria-selected', summary.slotId === previous ? 'true' : 'false')
    const savedAt = summary.savedAt
      ? new Date(summary.savedAt).toLocaleString(locale)
      : uiText('saveUnknown')
    const health =
      summary.health === 'healthy'
        ? formatUiText('saveCardHealthy', { size: formatBytes(summary.sizeBytes) })
        : formatUiText('saveCardCorrupt', { code: summary.errorCode ?? 'corrupt' })
    let seedHash = 0
    for (const character of summary.seed) seedHash = (seedHash * 31 + character.charCodeAt(0)) | 0
    const thumb = document.createElement('span')
    thumb.className = 'save-card__thumb'
    thumb.style.setProperty('--save-hue', String(Math.abs(seedHash) % 360))
    thumb.textContent = '✦'
    thumb.setAttribute('aria-hidden', 'true')
    const title = document.createElement('span')
    title.className = 'save-card__title'
    title.textContent = summary.label
    const kind = document.createElement('span')
    kind.className = 'save-card__kind'
    kind.textContent = summary.kind
    const meta = document.createElement('span')
    meta.className = 'save-card__meta'
    meta.textContent = `${summary.seed} · ${formatUiText('savePreviewPosition', {
      x: Math.round(summary.explorerX),
      y: Math.round(summary.explorerY),
    })} · ${savedAt}`
    const status = document.createElement('span')
    status.className = 'save-card__status'
    status.textContent = `${health} · ${formatUiText('savePreviewDiscovery', {
      cells: summary.discoveredCells,
      chunks: summary.discoveredChunks,
    })}`
    card.append(thumb, title, kind, meta, status)
    card.addEventListener('click', () => {
      saveSlots.value = summary.slotId
      for (const candidate of saveList.querySelectorAll<HTMLElement>('.save-card')) {
        candidate.setAttribute('aria-selected', candidate === card ? 'true' : 'false')
      }
      saveStatus.textContent = formatUiText('saveCardSelected', { label: summary.label })
      void renderSavePreview()
    })
    saveList.appendChild(card)
  }
  if (summaries.some((summary) => summary.slotId === previous)) saveSlots.value = previous
  saveStatus.textContent = summaries.length
    ? formatUiText('saveReady', { count: summaries.length })
    : uiText('saveEmpty')
}

const refreshSaveStorage = async () => {
  try {
    const estimate = await navigator.storage?.estimate?.()
    if (!estimate || typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') {
      saveStorage.textContent = uiText('saveStorageUnknown')
      return
    }
    saveStorage.textContent = formatUiText('saveStorage', {
      usage: formatBytes(estimate.usage),
      quota: formatBytes(estimate.quota),
    })
  } catch {
    saveStorage.textContent = uiText('saveStorageUnknown')
  }
}

const renderSavePreview = async () => {
  const summary = saveSummaries.find((candidate) => candidate.slotId === saveSlots.value)
  const preview = await import('./save-preview')
  await preview.default(summary, handle, locale, uiText, formatUiText, [
    savePreview,
    savePreviewSeed,
    savePreviewPosition,
    savePreviewDiscovery,
    savePreviewHealth,
    saveRecovery,
    saveBackups,
    saveRestoreBackup,
  ])
}

const refreshSaves = async () => {
  if (!handle?.listSaves) {
    renderSaveOptions([])
    return
  }
  renderSaveOptions(await handle.listSaves())
  await renderSavePreview()
  await refreshSaveStorage()
}

const runSaveAction = async (action: () => Promise<void>) => {
  setSaveControlsDisabled(true)
  const statusBeforeAction = saveStatus.textContent
  delete saveStatus.dataset.state
  try {
    await action()
    const actionStatus = saveStatus.textContent
    const hasActionStatus = actionStatus !== statusBeforeAction
    await refreshSaves()
    if (hasActionStatus) saveStatus.textContent = actionStatus
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const friendlyMessage = /quota|storage.*full/i.test(message) ? uiText('saveQuota') : message
    saveStatus.textContent = formatUiText('saveError', { message: friendlyMessage })
    saveStatus.dataset.state = 'error'
  } finally {
    setSaveControlsDisabled(!handle)
  }
}

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
    await refreshSaves()
    setSaveControlsDisabled(false)
    return true
  } catch (error) {
    container.textContent =
      error instanceof Error ? error.message : uiText('gameStartErrorStandalone')
    launcherState = 'error'
    submitButton.textContent = uiText('retry')
    setSaveControlsDisabled(true)
    return false
  } finally {
    submitButton.disabled = false
  }
}

const hasSaveSlot = (slotId: string) => saveSummaries.some((summary) => summary.slotId === slotId)

const confirmReplace = (label: string) =>
  window.confirm(formatUiText('saveConfirmReplace', { label }))

const loadSelectedJourney = async (slotId: string) => {
  if (!handle?.loadSave) return
  const compatibility = await handle.inspectSave?.(slotId)
  if (!compatibility || compatibility.kind === 'current') {
    const summary = await handle.loadSave(slotId)
    if (summary) saveStatus.textContent = formatUiText('saveLoaded', { label: summary.label })
    return
  }
  if (compatibility.kind === 'incompatible') {
    throw new Error(`${uiText('saveIncompatible')} (${compatibility.reasons.join(', ')})`)
  }
  if (
    !window.confirm(formatUiText('saveConfirmRemount', { seed: compatibility.savedWorld.seed }))
  ) {
    saveStatus.textContent = uiText('saveCancelled')
    return
  }

  const previousWorld = mountedWorld
  const recoverySlot = `recovery-${Date.now()}`
  if (handle.save) await handle.save(recoverySlot, uiText('saveRecoveryLabel'))
  const remounted = await launch(compatibility.savedWorld)
  if (!remounted || !handle?.loadSave) {
    if (previousWorld) await launch(previousWorld)
    throw new Error(uiText('saveRemountFailed'))
  }
  try {
    const summary = await handle.loadSave(slotId)
    await handle.clearSave?.(recoverySlot)
    if (summary) saveStatus.textContent = formatUiText('saveLoaded', { label: summary.label })
  } catch (error) {
    if (previousWorld) {
      await launch(previousWorld)
      try {
        await handle?.loadSave?.(recoverySlot)
        await handle?.clearSave?.(recoverySlot)
      } catch {
        // Keep the recovery slot visible if the rollback runtime cannot restore it.
      }
    }
    throw error
  }
}

saveCreate.addEventListener('click', () =>
  runSaveAction(async () => {
    const { slotId, label } = requestedSlot()
    if (hasSaveSlot(slotId) && !confirmReplace(label)) return
    const summary = await handle?.save?.(slotId, label)
    if (summary) {
      saveSlots.dataset.nextSelection = summary.slotId
      saveStatus.textContent = formatUiText('saveSuccess', { label: summary.label })
    }
  })
)

saveLoad.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    await loadSelectedJourney(option.value)
  })
)

saveRename.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    const { slotId, label } = requestedSlot()
    if (slotId !== option.value && hasSaveSlot(slotId) && !confirmReplace(label)) return
    await handle?.renameSave?.(option.value, slotId, label)
  })
)

saveDuplicate.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    const { slotId, label } = requestedSlot()
    if (hasSaveSlot(slotId) && !confirmReplace(label)) return
    const summary = await handle?.duplicateSave?.(option.value, slotId, label)
    if (summary) saveSlots.dataset.nextSelection = summary.slotId
  })
)

saveDelete.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    if (!option) return
    if (
      !window.confirm(
        formatUiText('saveConfirmDelete', {
          label: option.dataset.label ?? option.textContent ?? '',
        })
      )
    )
      return
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
    downloadText(`${option.value}.alohayo-save.json`, serialized)
  })
)

saveExportAll.addEventListener('click', () =>
  runSaveAction(async () => {
    const records = []
    const rejected: string[] = []
    for (const summary of saveSummaries) {
      if (summary.health !== 'healthy') {
        rejected.push(summary.label)
        continue
      }
      try {
        const serialized = await handle?.exportSave?.(summary.slotId)
        if (!serialized) throw new Error('snapshot is unavailable')
        records.push({
          slotId: summary.slotId,
          label: summary.label,
          kind: summary.kind,
          savedAt: summary.savedAt,
          snapshot: JSON.parse(serialized) as unknown,
        })
      } catch {
        rejected.push(summary.label)
      }
    }
    if (!records.length) {
      saveStatus.textContent = formatUiText('saveArchiveRejected', {
        message: rejected.length ? rejected.join(', ') : uiText('saveEmpty'),
      })
      return
    }
    downloadText('alohayo-journeys.alohayo-archive.json', encodeSaveArchive(records))
    saveStatus.textContent = formatUiText('saveArchiveReady', { count: records.length })
    if (rejected.length) saveStatus.textContent += ` · ${rejected.join(', ')}`
  })
)

saveImport.addEventListener('click', () =>
  runSaveAction(async () => {
    const { slotId, label } = requestedSlot()
    if (hasSaveSlot(slotId) && !confirmReplace(label)) return
    const summary = await handle?.importSave?.(saveImportData.value, slotId, label)
    if (summary) {
      saveSlots.dataset.nextSelection = summary.slotId
      saveStatus.textContent = formatUiText('saveImported', { label: summary.label })
    }
  })
)

saveImportAll.addEventListener('click', () =>
  runSaveAction(async () => {
    const { archive, rejected } = decodeSaveArchive(saveImportData.value)
    const errors = [...rejected]
    const seen = new Set<string>()
    let success = 0
    for (const record of archive.records) {
      if (seen.has(record.slotId)) {
        errors.push(`${record.label}: duplicate slot`)
        continue
      }
      seen.add(record.slotId)
      if (hasSaveSlot(record.slotId) && !confirmReplace(record.label)) {
        errors.push(`${record.label}: ${uiText('saveCancelled')}`)
        continue
      }
      try {
        const summary = await handle?.importSave?.(
          JSON.stringify(record.snapshot),
          record.slotId,
          record.label
        )
        if (summary) success += 1
        else errors.push(`${record.label}: import unavailable`)
      } catch (error) {
        errors.push(`${record.label}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    saveStatus.textContent = formatUiText('saveArchiveImported', {
      success,
      rejected: errors.length,
    })
    if (errors.length) saveStatus.textContent += ` ${errors.join(' · ')}`
  })
)

saveSlots.addEventListener('change', () => {
  void renderSavePreview()
})

saveRestoreBackup.addEventListener('click', () =>
  runSaveAction(async () => {
    const option = selectedSave()
    const backupId = saveBackups.value
    if (!option || !backupId) return
    const summary = await handle?.restoreSaveBackup?.(option.value, backupId)
    if (summary) saveStatus.textContent = formatUiText('saveRecovered', { label: summary.label })
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
