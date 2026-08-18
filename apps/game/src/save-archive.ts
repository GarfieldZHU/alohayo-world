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
export const SAVE_ARCHIVE_MAX_COMPRESSED_BYTES = 4 * 1024 * 1024
export const SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024

export type SaveArchiveErrorCode = 'corrupt' | 'compressed-too-large' | 'uncompressed-too-large'

export class SaveArchiveError extends Error {
  constructor(
    readonly code: SaveArchiveErrorCode,
    message: string,
    readonly causeValue?: unknown
  ) {
    super(message)
    this.name = 'SaveArchiveError'
  }
}

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

/** Defers optional thumbnail work until the browser has yielded from gameplay. */
export async function captureSaveArchiveThumbnailAsync(
  canvas: HTMLCanvasElement,
  options: { width?: number; height?: number; mimeType?: SaveArchiveThumbnail['mimeType'] } = {}
) {
  await new Promise<void>((resolve) => {
    const idle = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      }
    ).requestIdleCallback
    if (idle) {
      idle(resolve, { timeout: 250 })
      return
    }
    globalThis.setTimeout(resolve, 0)
  })
  return captureSaveArchiveThumbnail(canvas, options)
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

function fromBase64(value: string, maxBytes = SAVE_ARCHIVE_MAX_COMPRESSED_BYTES) {
  if (value.length > Math.ceil((maxBytes * 4) / 3) + 4) {
    throw new SaveArchiveError(
      'compressed-too-large',
      `save archive payload exceeds ${maxBytes} bytes`
    )
  }
  let binary: string
  try {
    binary = atob(value)
  } catch (error) {
    throw new SaveArchiveError(
      'corrupt',
      'compressed save archive payload is not valid base64',
      error
    )
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  if (bytes.byteLength > maxBytes) {
    throw new SaveArchiveError(
      'compressed-too-large',
      `save archive payload exceeds ${maxBytes} bytes`
    )
  }
  return bytes
}

async function readBoundedBytes(stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new SaveArchiveError('corrupt', 'compressed save archive stream is invalid')
      }
      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel()
        throw new SaveArchiveError(
          'uncompressed-too-large',
          `decompressed save archive exceeds ${maxBytes} bytes`
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

/** Encodes an archive with browser-native gzip when available, retaining a portable fallback. */
export async function encodeCompressedSaveArchive(
  records: SaveArchiveRecord[],
  exportedAt = new Date().toISOString()
): Promise<string> {
  const serialized = encodeSaveArchive(records, exportedAt)
  const serializedBytes = new TextEncoder().encode(serialized)
  if (serializedBytes.byteLength > SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
    throw new SaveArchiveError(
      'uncompressed-too-large',
      `save archive exceeds ${SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES} bytes before compression`
    )
  }
  if (typeof CompressionStream === 'undefined') {
    return JSON.stringify({
      schemaVersion: SAVE_ARCHIVE_COMPRESSED_SCHEMA_VERSION,
      format: 'identity-base64',
      payload: toBase64(new TextEncoder().encode(serialized)),
    } satisfies CompressedSaveArchive)
  }
  const stream = new Blob([serialized]).stream().pipeThrough(new CompressionStream('gzip'))
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
  if (compressed.byteLength > SAVE_ARCHIVE_MAX_COMPRESSED_BYTES) {
    throw new SaveArchiveError(
      'compressed-too-large',
      `compressed save archive exceeds ${SAVE_ARCHIVE_MAX_COMPRESSED_BYTES} bytes`
    )
  }
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
  const bytes = fromBase64(
    candidate.payload,
    candidate.format === 'identity-base64'
      ? SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES
      : SAVE_ARCHIVE_MAX_COMPRESSED_BYTES
  )
  if (candidate.format === 'identity-base64') {
    if (bytes.byteLength > SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
      throw new SaveArchiveError(
        'uncompressed-too-large',
        `decompressed save archive exceeds ${SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES} bytes`
      )
    }
    return decodeSaveArchive(new TextDecoder().decode(bytes))
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip decompression is not available in this browser')
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    const decompressed = await readBoundedBytes(stream, SAVE_ARCHIVE_MAX_UNCOMPRESSED_BYTES)
    return decodeSaveArchive(new TextDecoder().decode(decompressed))
  } catch (error) {
    if (error instanceof SaveArchiveError) throw error
    throw new SaveArchiveError(
      'corrupt',
      'compressed save archive could not be decompressed',
      error
    )
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
