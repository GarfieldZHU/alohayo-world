import {
  formatI18n,
  type GameHandle,
  type LocaleCode,
  type WorldSaveSummary,
  type WorldSaveWorldState,
} from '@alohayo/config'
import {
  decodeCompressedSaveArchive,
  decodeSaveArchive,
  encodeCompressedSaveArchive,
  formatBytes,
  SaveArchiveError,
} from './save-archive'

const saveCopy: Record<LocaleCode, Record<string, string>> = {
  en: {
    saveExportAll: 'Export all',
    saveImportAll: 'Import archive',
    saveStorage: 'Storage · {usage} used of {quota}',
    saveStorageUnknown: 'Storage estimate unavailable',
    saveArchiveReady: 'Archive ready · {count} journey(s)',
    saveArchiveImported: 'Imported {success} journey(s); {rejected} rejected.',
    saveArchiveRejected: 'Archive rejected: {message}',
    saveArchiveTooLarge: 'Archive exceeds the safe browser size limit.',
    saveArchiveCorrupt: 'Archive is damaged or cannot be decompressed.',
    saveQuota:
      'Browser storage is full. Older backups were pruned where possible; free space and try again.',
    saveCardHealthy: 'Healthy · {size}',
    saveCardCorrupt: 'Needs recovery · {code}',
    saveCardSelected: 'Selected journey {label}',
    saveConfirmReplace: 'Replace the existing journey {label}? A bounded backup will be kept.',
    saveConfirmDelete:
      'Delete journey {label}? This removes the active slot but keeps no new backup.',
    saveConfirmRemount:
      'This journey belongs to seed {seed}. Remount the world and load it? Your current runtime will be kept in a temporary recovery slot.',
    saveIncompatible: 'This journey cannot run with the current world content',
    saveRemountFailed:
      'The world could not be remounted. The previous runtime was restored when possible.',
    saveRecoveryLabel: 'Recovery before remount',
    saveCancelled: 'No changes made.',
  },
  'zh-CN': {
    saveExportAll: '导出全部',
    saveImportAll: '导入存档包',
    saveStorage: '存储 · 已用 {usage} / {quota}',
    saveStorageUnknown: '无法获取存储估算',
    saveArchiveReady: '存档包已准备 · {count} 个旅程',
    saveArchiveImported: '已导入 {success} 个旅程；拒绝 {rejected} 个。',
    saveArchiveRejected: '存档包拒绝：{message}',
    saveArchiveTooLarge: '存档包超过浏览器安全大小限制。',
    saveArchiveCorrupt: '存档包已损坏或无法解压。',
    saveQuota: '浏览器存储空间已满。系统会尽可能清理旧备份，请释放空间后重试。',
    saveCardHealthy: '正常 · {size}',
    saveCardCorrupt: '需要恢复 · {code}',
    saveCardSelected: '已选择旅程 {label}',
    saveConfirmReplace: '替换现有旅程 {label}？系统会保留一个有界备份。',
    saveConfirmDelete: '删除旅程 {label}？当前槽位会被移除，且不会新建备份。',
    saveConfirmRemount:
      '该旅程属于种子 {seed}。重新挂载世界并载入它？当前运行状态会先保存到临时恢复槽。',
    saveIncompatible: '该旅程不能在当前世界内容下运行',
    saveRemountFailed: '世界重新挂载失败。若可能，之前的运行状态已恢复。',
    saveRecoveryLabel: '重新挂载前恢复点',
    saveCancelled: '未作任何更改。',
  },
}

export interface SaveManagerOptions {
  getHandle: () => GameHandle | null
  getLocale: () => LocaleCode
  getWorld: () => WorldSaveWorldState | null
  uiText: (key: string) => string
  formatUiText: (key: string, values: Record<string, string | number>) => string
  launch: (savedWorld?: WorldSaveWorldState) => Promise<boolean>
}

export interface SaveManager {
  refresh(): Promise<void>
  setEnabled(enabled: boolean): void
  updateCopy(): void
}

const downloadText = (filename: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function createSaveManager(options: SaveManagerOptions): SaveManager {
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
  let summaries: WorldSaveSummary[] = []
  const text = (key: string) => saveCopy[options.getLocale()]?.[key] ?? options.uiText(key)
  const format = (key: string, values: Record<string, string | number>) =>
    formatI18n(text(key), values)

  const selectedSave = () => saveSlots.options[saveSlots.selectedIndex]
  const requestedSlot = () => {
    const locale = options.getLocale()
    const label = saveName.value.trim() || `Manual ${new Date().toLocaleString(locale)}`
    const slotId = label
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
    return { label, slotId: slotId || `manual-${Date.now()}` }
  }
  const hasSaveSlot = (slotId: string) => summaries.some((summary) => summary.slotId === slotId)
  const confirmReplace = (label: string) => window.confirm(format('saveConfirmReplace', { label }))

  const setEnabled = (enabled: boolean) => {
    const disabled = !enabled
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
    ])
      control.disabled = disabled
    saveBackups.disabled = disabled
    saveRestoreBackup.disabled =
      disabled || !Array.from(saveBackups.options).some((option) => !option.disabled)
  }

  const renderSavePreview = async () => {
    const summary = summaries.find((candidate) => candidate.slotId === saveSlots.value)
    const preview = await import('./save-preview')
    await preview.default(
      summary,
      options.getHandle(),
      options.getLocale(),
      options.uiText,
      options.formatUiText,
      [
        savePreview,
        savePreviewSeed,
        savePreviewPosition,
        savePreviewDiscovery,
        savePreviewHealth,
        saveRecovery,
        saveBackups,
        saveRestoreBackup,
      ]
    )
  }

  const renderOptions = (next: WorldSaveSummary[]) => {
    summaries = next
    const previous = saveSlots.dataset.nextSelection || saveSlots.value
    delete saveSlots.dataset.nextSelection
    saveSlots.replaceChildren()
    saveList.replaceChildren()
    for (const summary of next) {
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
        ? new Date(summary.savedAt).toLocaleString(options.getLocale())
        : text('saveUnknown')
      const health =
        summary.health === 'healthy'
          ? format('saveCardHealthy', { size: formatBytes(summary.sizeBytes) })
          : format('saveCardCorrupt', { code: summary.errorCode ?? 'corrupt' })
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
      meta.textContent = `${summary.seed} · ${format('savePreviewPosition', {
        x: Math.round(summary.explorerX),
        y: Math.round(summary.explorerY),
      })} · ${savedAt}`
      const status = document.createElement('span')
      status.className = 'save-card__status'
      status.textContent = `${health} · ${format('savePreviewDiscovery', {
        cells: summary.discoveredCells,
        chunks: summary.discoveredChunks,
      })}`
      card.append(thumb, title, kind, meta, status)
      card.addEventListener('click', () => {
        saveSlots.value = summary.slotId
        for (const candidate of saveList.querySelectorAll<HTMLElement>('.save-card'))
          candidate.setAttribute('aria-selected', candidate === card ? 'true' : 'false')
        saveStatus.textContent = format('saveCardSelected', { label: summary.label })
        void renderSavePreview()
      })
      saveList.appendChild(card)
    }
    if (next.some((summary) => summary.slotId === previous)) saveSlots.value = previous
    saveStatus.textContent = next.length
      ? format('saveReady', { count: next.length })
      : text('saveEmpty')
  }

  const refreshStorage = async () => {
    try {
      const estimate = await navigator.storage?.estimate?.()
      if (!estimate || typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') {
        saveStorage.textContent = text('saveStorageUnknown')
        return
      }
      saveStorage.textContent = format('saveStorage', {
        usage: formatBytes(estimate.usage),
        quota: formatBytes(estimate.quota),
      })
    } catch {
      saveStorage.textContent = text('saveStorageUnknown')
    }
  }

  const refresh = async () => {
    const handle = options.getHandle()
    if (!handle?.listSaves) {
      renderOptions([])
      setEnabled(false)
      return
    }
    renderOptions(await handle.listSaves())
    await renderSavePreview()
    await refreshStorage()
    setEnabled(true)
  }

  const run = async (action: () => Promise<void>) => {
    setEnabled(false)
    const before = saveStatus.textContent
    delete saveStatus.dataset.state
    try {
      await action()
      const actionStatus = saveStatus.textContent
      await refresh()
      if (actionStatus !== before) saveStatus.textContent = actionStatus
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const friendly = /quota|storage.*full/i.test(message)
        ? text('saveQuota')
        : error instanceof SaveArchiveError &&
            (error.code === 'compressed-too-large' || error.code === 'uncompressed-too-large')
          ? text('saveArchiveTooLarge')
          : error instanceof SaveArchiveError && error.code === 'corrupt'
            ? text('saveArchiveCorrupt')
            : message
      saveStatus.textContent = format('saveError', { message: friendly })
      saveStatus.dataset.state = 'error'
    } finally {
      setEnabled(Boolean(options.getHandle()))
    }
  }

  const loadSelectedJourney = async (slotId: string) => {
    const handle = options.getHandle()
    if (!handle?.loadSave) return
    const compatibility = await handle.inspectSave?.(slotId)
    if (!compatibility || compatibility.kind === 'current') {
      const summary = await handle.loadSave(slotId)
      if (summary) saveStatus.textContent = format('saveLoaded', { label: summary.label })
      return
    }
    if (compatibility.kind === 'incompatible')
      throw new Error(`${text('saveIncompatible')} (${compatibility.reasons.join(', ')})`)
    if (!window.confirm(format('saveConfirmRemount', { seed: compatibility.savedWorld.seed }))) {
      saveStatus.textContent = text('saveCancelled')
      return
    }
    const previousWorld = options.getWorld()
    const recoverySlot = `recovery-${Date.now()}`
    if (handle.save) await handle.save(recoverySlot, text('saveRecoveryLabel'))
    const remounted = await options.launch(compatibility.savedWorld)
    if (!remounted || !options.getHandle()?.loadSave) {
      if (previousWorld) await options.launch(previousWorld)
      throw new Error(text('saveRemountFailed'))
    }
    try {
      const summary = await options.getHandle()!.loadSave!(slotId)
      await options.getHandle()?.clearSave?.(recoverySlot)
      if (summary) saveStatus.textContent = format('saveLoaded', { label: summary.label })
    } catch (error) {
      if (previousWorld) {
        await options.launch(previousWorld)
        try {
          await options.getHandle()?.loadSave?.(recoverySlot)
          await options.getHandle()?.clearSave?.(recoverySlot)
        } catch {
          // Keep the recovery slot visible if the rollback runtime cannot restore it.
        }
      }
      throw error
    }
  }

  saveCreate.addEventListener('click', () =>
    run(async () => {
      const { slotId, label } = requestedSlot()
      if (hasSaveSlot(slotId) && !confirmReplace(label)) return
      const summary = await options.getHandle()?.save?.(slotId, label)
      if (summary) {
        saveSlots.dataset.nextSelection = summary.slotId
        saveStatus.textContent = format('saveSuccess', { label: summary.label })
      }
    })
  )
  saveLoad.addEventListener('click', () =>
    run(async () => {
      const option = selectedSave()
      if (option) await loadSelectedJourney(option.value)
    })
  )
  saveRename.addEventListener('click', () =>
    run(async () => {
      const option = selectedSave()
      if (!option) return
      const { slotId, label } = requestedSlot()
      if (slotId !== option.value && hasSaveSlot(slotId) && !confirmReplace(label)) return
      await options.getHandle()?.renameSave?.(option.value, slotId, label)
    })
  )
  saveDuplicate.addEventListener('click', () =>
    run(async () => {
      const option = selectedSave()
      if (!option) return
      const { slotId, label } = requestedSlot()
      if (hasSaveSlot(slotId) && !confirmReplace(label)) return
      const summary = await options.getHandle()?.duplicateSave?.(option.value, slotId, label)
      if (summary) saveSlots.dataset.nextSelection = summary.slotId
    })
  )
  saveDelete.addEventListener('click', () =>
    run(async () => {
      const option = selectedSave()
      if (
        !option ||
        !window.confirm(
          format('saveConfirmDelete', {
            label: option.dataset.label ?? option.textContent ?? '',
          })
        )
      )
        return
      await options.getHandle()?.clearSave?.(option.value)
      saveStatus.textContent = text('saveDeleted')
    })
  )
  saveExport.addEventListener('click', () =>
    run(async () => {
      const option = selectedSave()
      const serialized = option ? await options.getHandle()?.exportSave?.(option.value) : null
      if (option && serialized) downloadText(`${option.value}.alohayo-save.json`, serialized)
    })
  )
  saveExportAll.addEventListener('click', () =>
    run(async () => {
      const records = []
      const rejected: string[] = []
      for (const summary of summaries) {
        if (summary.health !== 'healthy') {
          rejected.push(summary.label)
          continue
        }
        try {
          const serialized = await options.getHandle()?.exportSave?.(summary.slotId)
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
        saveStatus.textContent = format('saveArchiveRejected', {
          message: rejected.length ? rejected.join(', ') : text('saveEmpty'),
        })
        return
      }
      downloadText(
        'alohayo-journeys.alohayo-archive.gz.json',
        await encodeCompressedSaveArchive(records)
      )
      saveStatus.textContent = format('saveArchiveReady', { count: records.length })
      if (rejected.length) saveStatus.textContent += ` · ${rejected.join(', ')}`
    })
  )
  saveImport.addEventListener('click', () =>
    run(async () => {
      const { slotId, label } = requestedSlot()
      if (hasSaveSlot(slotId) && !confirmReplace(label)) return
      const summary = await options.getHandle()?.importSave?.(saveImportData.value, slotId, label)
      if (summary) {
        saveSlots.dataset.nextSelection = summary.slotId
        saveStatus.textContent = format('saveImported', { label: summary.label })
      }
    })
  )
  saveImportAll.addEventListener('click', () =>
    run(async () => {
      let decoded: Awaited<ReturnType<typeof decodeCompressedSaveArchive>>
      let compressedError: unknown
      try {
        decoded = await decodeCompressedSaveArchive(saveImportData.value)
      } catch (error) {
        compressedError = error
        try {
          decoded = decodeSaveArchive(saveImportData.value)
        } catch {
          throw compressedError
        }
      }
      const { archive, rejected } = decoded
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
          errors.push(`${record.label}: ${text('saveCancelled')}`)
          continue
        }
        try {
          const summary = await options
            .getHandle()
            ?.importSave?.(JSON.stringify(record.snapshot), record.slotId, record.label)
          if (summary) success += 1
          else errors.push(`${record.label}: import unavailable`)
        } catch (error) {
          errors.push(`${record.label}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      saveStatus.textContent = format('saveArchiveImported', {
        success,
        rejected: errors.length,
      })
      if (errors.length) saveStatus.textContent += ` ${errors.join(' · ')}`
    })
  )
  saveSlots.addEventListener('change', () => void renderSavePreview())
  saveRestoreBackup.addEventListener('click', () =>
    run(async () => {
      const option = selectedSave()
      const backupId = saveBackups.value
      if (!option || !backupId) return
      const summary = await options.getHandle()?.restoreSaveBackup?.(option.value, backupId)
      if (summary) saveStatus.textContent = format('saveRecovered', { label: summary.label })
    })
  )

  const updateCopy = () => {
    saveTitle.textContent = options.uiText('saveTitle')
    saveDescription.textContent = options.uiText('saveDescription')
    saveSlots.ariaLabel = options.uiText('saveSlots')
    saveName.placeholder = options.uiText('saveName')
    saveBackups.ariaLabel = options.uiText('saveBackups')
    saveRestoreBackup.textContent = options.uiText('saveRecover')
    saveCreate.textContent = options.uiText('saveCreate')
    saveLoad.textContent = options.uiText('saveLoad')
    saveRename.textContent = options.uiText('saveRename')
    saveDuplicate.textContent = options.uiText('saveDuplicate')
    saveDelete.textContent = options.uiText('saveDelete')
    saveExport.textContent = options.uiText('saveExport')
    saveExportAll.textContent = text('saveExportAll')
    saveImport.textContent = options.uiText('saveImport')
    saveImportAll.textContent = text('saveImportAll')
    saveImportData.placeholder = options.uiText('saveImportPlaceholder')
  }

  updateCopy()
  setEnabled(false)
  return { refresh, setEnabled, updateCopy }
}
