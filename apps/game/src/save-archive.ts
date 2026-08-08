import type { WorldSaveSummary } from '@alohayo/config'

/**
 * A small, forward-compatible envelope for moving more than one local journey
 * at a time. The snapshots stay as JSON values so this module never needs to
 * understand render buffers or chunk payloads; the engine remains the source
 * of truth when each record is imported.
 */
export const SAVE_ARCHIVE_SCHEMA_VERSION = 1 as const
export const SAVE_ARCHIVE_MAX_RECORDS = 64

export interface SaveArchiveRecord {
  slotId: string
  label: string
  kind: WorldSaveSummary['kind']
  savedAt: string
  snapshot: unknown
}

export interface SaveArchive {
  schemaVersion: typeof SAVE_ARCHIVE_SCHEMA_VERSION
  exportedAt: string
  records: SaveArchiveRecord[]
}

export interface ParsedSaveArchive {
  archive: SaveArchive
  rejected: string[]
}

export function encodeSaveArchive(
  records: SaveArchiveRecord[],
  exportedAt = new Date().toISOString()
) {
  const archive: SaveArchive = {
    schemaVersion: SAVE_ARCHIVE_SCHEMA_VERSION,
    exportedAt,
    records: records.slice(0, SAVE_ARCHIVE_MAX_RECORDS),
  }
  return JSON.stringify(archive, null, 2)
}

/**
 * Parse an archive without failing the whole import for one malformed entry.
 * Snapshot validation is deliberately deferred to `handle.importSave`, which
 * lets the UI report healthy and rejected records independently.
 */
export function decodeSaveArchive(serialized: string): ParsedSaveArchive {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('save archive is not valid JSON')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('save archive must be an object')
  }
  const candidate = parsed as Partial<SaveArchive> & { records?: unknown }
  if (
    candidate.schemaVersion !== SAVE_ARCHIVE_SCHEMA_VERSION ||
    !Array.isArray(candidate.records)
  ) {
    throw new Error(`save archive schema ${String(candidate.schemaVersion)} is not supported`)
  }

  const rejected: string[] = []
  const records: SaveArchiveRecord[] = []
  if (candidate.records.length > SAVE_ARCHIVE_MAX_RECORDS) {
    rejected.push(
      `${candidate.records.length - SAVE_ARCHIVE_MAX_RECORDS} record(s) exceed the archive limit`
    )
  }
  for (const [index, value] of candidate.records.entries()) {
    if (!value || typeof value !== 'object') {
      rejected.push(`record ${index + 1}: entry is not an object`)
      continue
    }
    const record = value as Partial<SaveArchiveRecord>
    if (
      typeof record.slotId !== 'string' ||
      !record.slotId.trim() ||
      typeof record.label !== 'string' ||
      !record.label.trim() ||
      !['autosave', 'manual', 'imported'].includes(record.kind ?? '') ||
      typeof record.savedAt !== 'string' ||
      !record.snapshot ||
      typeof record.snapshot !== 'object'
    ) {
      rejected.push(`record ${index + 1}: missing slot metadata or snapshot`)
      continue
    }
    records.push({
      slotId: record.slotId.trim().slice(0, 64),
      label: record.label.trim().slice(0, 128),
      kind: record.kind as SaveArchiveRecord['kind'],
      savedAt: record.savedAt,
      snapshot: record.snapshot,
    })
  }

  return {
    archive: {
      schemaVersion: SAVE_ARCHIVE_SCHEMA_VERSION,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      records: records.slice(0, SAVE_ARCHIVE_MAX_RECORDS),
    },
    rejected,
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
