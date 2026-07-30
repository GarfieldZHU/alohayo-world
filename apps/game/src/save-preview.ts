import type {
  GameHandle,
  LocaleCode,
  WorldSaveBackupSummary,
  WorldSaveSummary,
} from '@alohayo/config'

type SavePreviewElements = [
  preview: HTMLElement,
  seed: HTMLElement,
  position: HTMLElement,
  discovery: HTMLElement,
  health: HTMLElement,
  recovery: HTMLElement,
  backups: HTMLSelectElement,
  restoreBackup: HTMLButtonElement,
]

export default async function renderSavePreview(
  summary: WorldSaveSummary | undefined,
  handle: GameHandle | null,
  locale: LocaleCode,
  uiText: (key: string) => string,
  formatUiText: (key: string, values: Record<string, string | number>) => string,
  elements: SavePreviewElements
) {
  const [preview, seed, position, discovery, health, recovery, backupsSelect, restoreBackup] =
    elements
  preview.hidden = !summary
  if (!summary) {
    recovery.hidden = true
    backupsSelect.replaceChildren()
    return
  }
  seed.textContent = formatUiText('savePreviewSeed', { seed: summary.seed })
  position.textContent = formatUiText('savePreviewPosition', {
    x: Math.round(summary.explorerX),
    y: Math.round(summary.explorerY),
  })
  discovery.textContent = formatUiText('savePreviewDiscovery', {
    cells: summary.discoveredCells,
    chunks: summary.discoveredChunks,
  })
  health.textContent =
    summary.health === 'healthy'
      ? formatUiText('savePreviewHealthy', {
          backups: summary.backupCount,
          size: Math.max(1, Math.round(summary.sizeBytes / 1024)),
        })
      : formatUiText('savePreviewCorrupt', { code: summary.errorCode ?? 'corrupt' })
  preview.dataset.health = summary.health

  let backups: WorldSaveBackupSummary[] = []
  try {
    backups = (await handle?.listSaveBackups?.(summary.slotId)) ?? []
  } catch {
    backups = []
  }
  backupsSelect.replaceChildren()
  for (const backup of backups) {
    const option = document.createElement('option')
    option.value = backup.backupId
    option.disabled = backup.health === 'corrupt'
    const date = backup.savedAt
      ? new Date(backup.savedAt).toLocaleString(locale)
      : uiText('saveUnknown')
    option.textContent = `${date} · ${backup.seed} · ${backup.discoveredCells}`
    backupsSelect.appendChild(option)
  }
  recovery.hidden = backups.length === 0
  restoreBackup.disabled = !backups.some((backup) => backup.health === 'healthy')
}
