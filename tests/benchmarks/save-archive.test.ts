import { expect, it } from 'vitest'
import {
  decodeCompressedSaveArchive,
  encodeCompressedSaveArchive,
} from '../../apps/game/src/save-archive'

it('keeps archive compression bounded for representative multi-slot exports', async () => {
  const records = Array.from({ length: 8 }, (_, index) => ({
    slotId: `journey-${index}`,
    label: `Journey ${index}`,
    kind: 'manual' as const,
    savedAt: `2026-08-18T00:0${index}:00.000Z`,
    snapshot: {
      schemaVersion: 1,
      world: { seed: `seed-${index}`, chunkSize: 64 },
      discovery: {
        discoveredChunkKeys: Array.from({ length: 64 }, (_, cell) => `${cell},${index}`),
      },
    },
  }))
  const started = performance.now()
  const encoded = await encodeCompressedSaveArchive(records, '2026-08-18T00:00:00.000Z')
  const decoded = await decodeCompressedSaveArchive(encoded)
  const elapsedMs = performance.now() - started

  expect(decoded.archive.records).toHaveLength(records.length)
  expect(new TextEncoder().encode(encoded).byteLength).toBeLessThan(64 * 1024)
  expect(elapsedMs).toBeLessThan(500)
})
