import { describe, expect, it } from 'vitest'
import {
  SAVE_ARCHIVE_MAX_RECORDS,
  SAVE_ARCHIVE_MAX_COMPRESSED_BYTES,
  decodeCompressedSaveArchive,
  decodeSaveArchive,
  encodeCompressedSaveArchive,
  encodeSaveArchive,
  formatBytes,
  SaveArchiveError,
} from '../apps/game/src/save-archive'

const record = {
  slotId: 'journey-one',
  label: 'First crossing',
  kind: 'manual' as const,
  savedAt: '2026-08-08T00:00:00.000Z',
  snapshot: { schemaVersion: 1, world: { seed: 'alohayo' } },
}

describe('save journey archives', () => {
  it('round-trips a bounded multi-slot archive', () => {
    const serialized = encodeSaveArchive([record])
    const parsed = decodeSaveArchive(serialized)
    expect(parsed.rejected).toEqual([])
    expect(parsed.archive.records).toEqual([record])
  })

  it('keeps valid records when one archive entry is malformed', () => {
    const parsed = decodeSaveArchive(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: '',
        records: [record, { slotId: '', snapshot: null }],
      })
    )
    expect(parsed.archive.records).toHaveLength(1)
    expect(parsed.rejected).toEqual(['record 2: missing slot metadata or snapshot'])
  })

  it('caps archive size before it becomes a quota or frame-pacing problem', () => {
    const records = Array.from({ length: SAVE_ARCHIVE_MAX_RECORDS + 10 }, (_, index) => ({
      ...record,
      slotId: `slot-${index}`,
    }))
    const parsed = decodeSaveArchive(JSON.stringify({ schemaVersion: 1, exportedAt: '', records }))
    expect(parsed.archive.records).toHaveLength(SAVE_ARCHIVE_MAX_RECORDS)
    expect(parsed.rejected).toEqual([
      `${records.length - SAVE_ARCHIVE_MAX_RECORDS} record(s) exceed the archive limit`,
    ])
  })

  it('formats storage and serialized-size telemetry for narrow UIs', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })

  it('round-trips a compressed archive and preserves bounded thumbnails', async () => {
    const thumbnail = {
      mimeType: 'image/png' as const,
      width: 32,
      height: 18,
      dataUrl: 'data:image/png;base64,AAAA',
    }
    const serialized = await encodeCompressedSaveArchive([{ ...record, thumbnail }])
    const parsed = await decodeCompressedSaveArchive(serialized)
    expect(parsed.rejected).toEqual([])
    expect(parsed.archive.records[0]?.thumbnail).toEqual(thumbnail)
  })

  it('rejects an oversized thumbnail without discarding neighboring journeys', () => {
    const parsed = decodeSaveArchive(
      JSON.stringify({
        schemaVersion: 1,
        records: [
          record,
          {
            ...record,
            slotId: 'oversized',
            thumbnail: {
              mimeType: 'image/png',
              width: 512,
              height: 512,
              dataUrl: `data:image/png;base64,${'A'.repeat(300_000)}`,
            },
          },
        ],
      })
    )
    expect(parsed.archive.records.map((entry) => entry.slotId)).toEqual(['journey-one'])
    expect(parsed.rejected).toEqual(['record 2: thumbnail is invalid or exceeds its budget'])
  })

  it('rejects an oversized compressed payload before base64 allocation', async () => {
    const payload = 'A'.repeat(Math.ceil((SAVE_ARCHIVE_MAX_COMPRESSED_BYTES * 4) / 3) + 8)
    await expect(
      decodeCompressedSaveArchive(
        JSON.stringify({ schemaVersion: 1, format: 'gzip-base64', payload })
      )
    ).rejects.toMatchObject({ code: 'compressed-too-large' } satisfies Partial<SaveArchiveError>)
  })

  it('classifies a damaged gzip archive without leaking decompressor errors', async () => {
    await expect(
      decodeCompressedSaveArchive(
        JSON.stringify({ schemaVersion: 1, format: 'gzip-base64', payload: 'AAAA' })
      )
    ).rejects.toMatchObject({ code: 'corrupt' } satisfies Partial<SaveArchiveError>)
  })
})
