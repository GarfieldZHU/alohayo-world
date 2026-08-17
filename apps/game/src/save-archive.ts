import type { WorldSaveSummary } from '@alohayo/config'

/**
 * A small, forward-compatible envelope for moving more than one local journey
 * at a time. The snapshots stay as JSON values so this module never needs to
 * understand render buffers or chunk payloads; the engine remains the source
 * of truth when each record is imported.
 */
export const SAVE_ARCHIVE_SCHEMA_VERSION = 1 as const
export const SAVE_ARCHIVE_MAX_RECORDS = 64
export const SAVE_ARCHIVE_COMPRESSED_SCHEMA_VERSION = 1 as const
export const SAVE_ARCHIVE_MAX_THUMBNAIL_BYTES = 192 * 1024

export interface SaveArchiveThumbnail {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
  dataUrl: string
}

export interface SaveArchiveRecord {
  slotId: string
  label: string
  kind: WorldSaveSummary['kind']
  savedAt: string
  snapshot: unknown
  thumbnail?: SaveArchiveThumbnail
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
    const thumbnail = record.thumbnail
    if (thumbnail !== undefined && !isValidThumbnail(thumbnail)) {
      rejected.push(`record ${index + 1}: thumbnail is invalid or exceeds its budget`)
      continue
    }
    records.push({
      slotId: record.slotId.trim().slice(0, 64),
      label: record.label.trim().slice(0, 128),
      kind: record.kind as SaveArchiveRecord['kind'],
      savedAt: record.savedAt,
      snapshot: record.snapshot,
      ...(thumbnail ? { thumbnail } : {}),
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

function isValidThumbnail(value: unknown): value is SaveArchiveThumbnail {
  if (!value || typeof value !== 'object') return false
  const thumbnail = value as Partial<SaveArchiveThumbnail>
  return (
    ['image/png', 'image/jpeg', 'image/webp'].includes(thumbnail.mimeType ?? '') &&
    Number.isInteger(thumbnail.width) &&
    thumbnail.width! > 0 &&
    thumbnail.width! <= 512 &&
    Number.isInteger(thumbnail.height) &&
    thumbnail.height! > 0 &&
    thumbnail.height! <= 512 &&
    typeof thumbnail.dataUrl === 'string' &&
    thumbnail.dataUrl.startsWith('data:') &&
    new TextEncoder().encode(thumbnail.dataUrl).byteLength <= SAVE_ARCHIVE_MAX_THUMBNAIL_BYTES
  )
}

export function captureSaveArchiveThumbnail(
  canvas: HTMLCanvasElement,
  options: { width?: number; height?: number; mimeType?: SaveArchiveThumbnail['mimeType'] } = {}
): SaveArchiveThumbnail | undefined {
  const width = Math.min(512, Math.max(1, Math.floor(options.width ?? 256)))
  const height = Math.min(512, Math.max(1, Math.floor(options.height ?? 144)))
  const thumbnailCanvas = document.createElement('canvas')
  thumbnailCanvas.width = width
  thumbnailCanvas.height = height
  const context = thumbnailCanvas.getContext('2d')
  if (!context) return undefined
  context.drawImage(canvas, 0, 0, width, height)
  const mimeType = options.mimeType ?? 'image/webp'
  const dataUrl = thumbnailCanvas.toDataURL(mimeType, 0.72)
  const thumbnail = { mimeType, width, height, dataUrl }
  return isValidThumbnail(thumbnail) ? thumbnail : undefined
}

interface CompressedSaveArchive {
  schemaVersion: typeof SAVE_ARCHIVE_COMPRESSED_SCHEMA_VERSION
  format: 'gzip-base64' | 'identity-base64'
  payload: string
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Encodes an archive with browser-native gzip when available, retaining a portable fallback. */
export async function encodeCompressedSaveArchive(
  records: SaveArchiveRecord[],
  exportedAt = new Date().toISOString()
): Promise<string> {
  const serialized = encodeSaveArchive(records, exportedAt)
  if (typeof CompressionStream === 'undefined') {
    return JSON.stringify({
      schemaVersion: SAVE_ARCHIVE_COMPRESSED_SCHEMA_VERSION,
      format: 'identity-base64',
      payload: toBase64(new TextEncoder().encode(serialized)),
    } satisfies CompressedSaveArchive)
  }
  const stream = new Blob([serialized]).stream().pipeThrough(new CompressionStream('gzip'))
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
  return JSON.stringify({
    schemaVersion: SAVE_ARCHIVE_COMPRESSED_SCHEMA_VERSION,
    format: 'gzip-base64',
    payload: toBase64(compressed),
  } satisfies CompressedSaveArchive)
}

export async function decodeCompressedSaveArchive(serialized: string): Promise<ParsedSaveArchive> {
  let envelope: unknown
  try {
    envelope = JSON.parse(serialized)
  } catch {
    throw new Error('compressed save archive is not valid JSON')
  }
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('compressed save archive is invalid')
  }
  const candidate = envelope as Partial<CompressedSaveArchive>
  if (
    candidate.schemaVersion !== SAVE_ARCHIVE_COMPRESSED_SCHEMA_VERSION ||
    !['gzip-base64', 'identity-base64'].includes(candidate.format ?? '') ||
    typeof candidate.payload !== 'string'
  ) {
    throw new Error('compressed save archive schema is not supported')
  }
  const bytes = fromBase64(candidate.payload)
  if (candidate.format === 'identity-base64') {
    return decodeSaveArchive(new TextDecoder().decode(bytes))
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip decompression is not available in this browser')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return decodeSaveArchive(await new Response(stream).text())
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
