import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

test('loads game resources only after start', async ({ page }) => {
  const gameRequests: string[] = []
  page.on('request', (request) => {
    if (/pixi|world_core|embed\/bootstrap|assets\/(embed|engine|map)/.test(request.url()))
      gameRequests.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible()
  await expect(page.getByRole('button', { name: '中文' })).toBeVisible()
  await page.getByRole('button', { name: '中文' }).click()
  await expect(page.getByRole('button', { name: '进入世界' })).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Enter the world' })).toBeVisible()
  expect(gameRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'loading')
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete')
  await expect(canvas).toBeVisible()
  const initialViewportChunks = Number(await canvas.getAttribute('data-initial-viewport-chunks'))
  const initialRenderedChunks = Number(await canvas.getAttribute('data-initial-rendered-chunks'))
  expect(initialViewportChunks).toBeGreaterThan(0)
  expect(initialRenderedChunks).toBeGreaterThanOrEqual(initialViewportChunks)
  await expect(canvas).toHaveAttribute('data-worker-base-layers', 'wasm')
  await expect(canvas).toHaveAttribute('data-worker-render-hints', 'wasm')
  await expect(canvas).toHaveAttribute('data-worker-terrain-texture-hints', 'wasm')
  await expect(canvas).toHaveAttribute('data-worker-hydrology', 'wasm')
  await expect(canvas).toHaveAttribute('data-hydrology-pair-implementation', 'wasm', {
    timeout: 20_000,
  })
  await expect(canvas).toHaveAttribute('data-hydrology-pair-fallback', 'none')
  await expect(canvas).toHaveAttribute('data-worker-contour-geometry', 'wasm')
  await expect(canvas).toHaveAttribute('data-worker-fallbacks', '0')
  await expect(canvas).toHaveAttribute('data-worker-transfer-bytes', /[1-9][0-9]*/)
  await expect(canvas).toHaveAttribute('data-last-chunk-ms', /[0-9.]+/)
  await expect(canvas).toHaveAttribute('data-shoreline-renderer', 'smoothed-contours')
  await expect(canvas).toHaveAttribute('data-shoreline-frontier', 'known-neighbors-only')
  await expect(canvas).toHaveAttribute('data-discovery-fog-renderer', 'gpu-mask-texture')
  await expect(canvas).toHaveAttribute('data-discovery-fog-composite', 'single-bgra-texture')
  await expect(canvas).toHaveAttribute('data-discovery-fog-coverage', 'retained-world-texture')
  await expect(canvas).toHaveAttribute('data-discovery-fog-coordinates', 'world-space')
  await expect(canvas).toHaveAttribute('data-shoreline-distance', 'one-cell-loaded-halo')
  await expect(canvas).toHaveAttribute(
    'data-geomorphology',
    'erosion-sediment-deposition-floodplain'
  )
  await expect(canvas).toHaveAttribute('data-authored-entity-runtime', 'map-lifecycle-v1')
  await expect(canvas).toHaveAttribute('data-authored-entity-active', /[0-9]+/)
  await expect(canvas).toHaveAttribute('data-authored-entity-retained', /[0-9]+/)
  await expect(canvas).toHaveAttribute('data-authored-entity-owners', /[0-9]+/)
  await expect(canvas).toHaveAttribute('data-authored-entity-despawned', '0')
  await expect(canvas).toHaveAttribute('data-authored-entity-conflicts', '0')
  await expect(canvas).toHaveAttribute('data-estimated-draw-calls', /[1-9][0-9]*/)
  expect(gameRequests.length).toBeGreaterThan(0)
  await expect(canvas).toBeVisible()
})

test('keeps the explicit TypeScript worker fallback browser-safe', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_WORKER_CAPABILITIES__ = {
      protocolVersion: 1,
      wasm: { abiVersion: 1, enabled: false, batches: [] },
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })
  await expect(canvas).toHaveAttribute('data-worker-base-layers', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-render-hints', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-terrain-texture-hints', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-hydrology', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-contour-geometry', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-fallbacks', '0')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete')
})

test('falls back when the promoted Wasm artifact is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_ASSET_BASE_URL__ = 'http://127.0.0.1:4173/missing-wasm-artifact/'
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })
  await expect(canvas).toHaveAttribute('data-worker-base-layers', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-render-hints', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-terrain-texture-hints', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-hydrology', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-contour-geometry', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-fallbacks', '5')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete')
})

test('keeps the minimap collapse control interactive and clear of the clock', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })
  const collapse = page.getByRole('button', { name: 'Hide' })
  const clock = page.getByLabel('World time')
  const [collapseBox, clockBox] = await Promise.all([collapse.boundingBox(), clock.boundingBox()])
  expect(collapseBox).toBeTruthy()
  expect(clockBox).toBeTruthy()
  expect(collapseBox!.y).toBeGreaterThanOrEqual(clockBox!.y + clockBox!.height)
  await collapse.click()
  const expand = page.getByRole('button', { name: 'Show' })
  await expect(expand).toBeVisible()
  const [expandBox, collapsedClockBox] = await Promise.all([
    expand.boundingBox(),
    clock.boundingBox(),
  ])
  expect(expandBox).toBeTruthy()
  expect(collapsedClockBox).toBeTruthy()
  expect(expandBox!.x).toBeGreaterThanOrEqual(collapsedClockBox!.x + collapsedClockBox!.width)
  await expand.click()
  await expect(page.getByRole('button', { name: 'Hide' })).toBeVisible()
})

test('manages named local saves and reports bad imports', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })

  await page.getByPlaceholder('Save name').fill('Bridge approach')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Save slots')).toContainText('Bridge approach')
  await expect(page.locator('.save-card').filter({ hasText: 'Bridge approach' })).toBeVisible()
  await expect(page.locator('.save-card').filter({ hasText: 'Bridge approach' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.locator('#save-storage')).toBeVisible()
  await expect(page.getByText(/World · alohayo/)).toBeVisible()
  await expect(page.locator('#save-preview-discovery')).toHaveText(/cells · .* chunks/)

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Previous save versions')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Recover previous' })).toBeEnabled()
  await page.getByRole('button', { name: 'Recover previous' }).click()
  await expect(page.locator('#save-status')).toContainText('Recovered Bridge approach')

  await page.getByPlaceholder('Save name').fill('Bridge copy')
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByLabel('Save slots')).toContainText('Bridge copy')

  await page.getByLabel('Save slots').selectOption('Bridge-copy')
  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByLabel('Save slots')).not.toContainText('Bridge copy')

  await page.getByPlaceholder('Paste exported save JSON').fill('{bad json')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('#save-status')).toContainText('Save recovery:')
})

test('round-trips a compressed archive and rejects corrupted payloads', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })

  await page.getByPlaceholder('Save name').fill('Archive crossing')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.save-card').filter({ hasText: 'Archive crossing' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('alohayo-journeys.alohayo-archive.gz.json')
  const archivePath = await download.path()
  expect(archivePath).toBeTruthy()
  const archive = await readFile(archivePath!, 'utf8')

  page.once('dialog', async (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('.save-card').filter({ hasText: 'Archive crossing' })).toHaveCount(0)

  page.on('dialog', async (dialog) => dialog.accept())
  await page.getByPlaceholder('Paste exported save JSON').fill(archive)
  await page.getByRole('button', { name: 'Import archive' }).click()
  await expect(page.locator('#save-status')).toHaveText(
    /Imported [1-9][0-9]* journey\(s\); 0 rejected\./
  )
  await expect(page.locator('.save-card').filter({ hasText: 'Archive crossing' })).toBeVisible()

  const corrupted = JSON.parse(archive) as { payload?: string }
  corrupted.payload = `${corrupted.payload?.slice(0, -4) ?? ''}AAAA`
  await page.getByPlaceholder('Paste exported save JSON').fill(JSON.stringify(corrupted))
  await page.getByRole('button', { name: 'Import archive' }).click()
  await expect(page.locator('#save-status')).toContainText(
    'Archive is damaged or cannot be decompressed.'
  )
})

test('imports a compressed archive from the narrow save surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })

  await page.getByPlaceholder('Save name').fill('Narrow archive')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all' }).click()
  const download = await downloadPromise
  const archivePath = await download.path()
  expect(archivePath).toBeTruthy()
  const archive = await readFile(archivePath!, 'utf8')

  page.once('dialog', async (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  page.on('dialog', async (dialog) => dialog.accept())
  await page.getByPlaceholder('Paste exported save JSON').fill(archive)
  await page.getByRole('button', { name: 'Import archive' }).click()
  await expect(page.locator('#save-status')).toHaveText(
    /Imported [1-9][0-9]* journey\(s\); 0 rejected\./
  )
  await expect(page.locator('.save-card').filter({ hasText: 'Narrow archive' })).toBeVisible()
})

test('confirms a cross-seed journey remount and keeps a recovery slot', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByLabel('World seed').fill('first-journey')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })

  await page.getByPlaceholder('Save name').fill('First journey')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.save-card').filter({ hasText: 'First journey' })).toBeVisible()

  await page.getByLabel('World seed').fill('second-journey')
  await page.getByRole('button', { name: 'Resurvey' }).click()
  await expect(page.locator('canvas[aria-label="Alohayo World map"]')).toHaveAttribute(
    'data-initial-presentation',
    'complete',
    { timeout: 90_000 }
  )
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })
  const card = page.locator('.save-card').filter({ hasText: 'First journey' })
  await card.click()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('first-journey')
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Load', exact: true }).click()
  await expect(page.getByLabel('World seed')).toHaveValue('first-journey')
  await expect(page.locator('.save-card').filter({ hasText: 'First journey' })).toBeVisible()
})

test('keeps healthy journeys visible beside an injected corrupt record', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })

  await page.getByPlaceholder('Save name').fill('Healthy crossing')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.save-card').filter({ hasText: 'Healthy crossing' })).toBeVisible()
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('alohayo-world')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('world-saves', 'readwrite')
      transaction.objectStore('world-saves').put({
        slotId: 'corrupt-browser-fixture',
        label: 'Corrupt browser fixture',
        kind: 'manual',
        snapshot: { schemaVersion: 1, explorer: null },
      })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })

  await page.reload()
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })
  await expect(page.locator('.save-card').filter({ hasText: 'Healthy crossing' })).toBeVisible()
  await expect(page.locator('.save-card[data-health="corrupt"]')).toContainText(
    'Corrupt browser fixture'
  )
})

test('supports keyboard selection and narrow save cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 45_000 })

  await page.getByPlaceholder('Save name').fill('Narrow crossing')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const card = page.locator('.save-card').filter({ hasText: 'Narrow crossing' })
  await expect(card).toBeVisible()
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(card).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#save-list')).toBeVisible()
})

test('rehydrates topology aliases before streamed chunks after a browser restart', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete', {
    timeout: 20_000,
  })
  await expect(canvas).toHaveAttribute('data-hydrology-pair-elapsed-ms', /\d/)
  const initialHydrologyIdentity = await page.evaluate(() => {
    const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
    const segment = handle
      ?.getRiverGraph?.()
      .segments.find(
        (candidate) =>
          candidate.targetKind !== 'frontier' &&
          candidate.sourceKind !== 'frontier' &&
          (Math.floor(candidate.source.x / 64) !== Math.floor(candidate.target.x / 64) ||
            Math.floor(candidate.source.y / 64) !== Math.floor(candidate.target.y / 64))
      )
    if (!handle?.queryHydrologyCell || !segment) return null
    const source = handle.queryHydrologyCell(segment.source.x, segment.source.y)
    const target = handle.queryHydrologyCell(segment.target.x, segment.target.y)
    if (!source || !target) return null
    return {
      source: segment.source,
      target: segment.target,
      sourceWatershedId: source.watershedId,
      targetWatershedId: target.watershedId,
      graphIdentityId: segment.identityId,
    }
  })
  if (!initialHydrologyIdentity)
    throw new Error('initial cross-chunk hydrology graph is unavailable')
  expect(initialHydrologyIdentity.sourceWatershedId).toBe(
    initialHydrologyIdentity.targetWatershedId
  )
  expect(initialHydrologyIdentity.graphIdentityId).toBe(initialHydrologyIdentity.sourceWatershedId)
  await expect
    .poll(async () => Number((await canvas.getAttribute('data-topology-aliases')) ?? 0))
    .toBeGreaterThan(0)

  await page.keyboard.press('ArrowRight')
  const readSavedAliases = () =>
    page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('alohayo-world')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
      return new Promise<number>((resolve, reject) => {
        const transaction = database.transaction('world-saves', 'readonly')
        const request = transaction.objectStore('world-saves').get('autosave')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result?.snapshot?.topology?.aliases?.length ?? 0)
      })
    })
  await expect.poll(readSavedAliases, { timeout: 10_000 }).toBeGreaterThan(0)
  const savedAliases = await readSavedAliases()
  const readSavedDrainageLedger = () =>
    page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('alohayo-world')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
      return new Promise<{ resolverVersion: string; aliases: number } | null>((resolve, reject) => {
        const transaction = database.transaction('world-saves', 'readonly')
        const request = transaction.objectStore('world-saves').get('autosave')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const drainage = request.result?.snapshot?.drainage
          resolve(
            drainage
              ? { resolverVersion: drainage.resolverVersion, aliases: drainage.aliases.length }
              : null
          )
        }
      })
    })
  await expect.poll(readSavedDrainageLedger, { timeout: 10_000 }).not.toBeNull()
  const savedDrainageLedger = await readSavedDrainageLedger()
  expect(savedDrainageLedger?.resolverVersion).toBe('1')

  await page.reload()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const restoredCanvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(restoredCanvas).toHaveAttribute(
    'data-topology-restored-aliases',
    String(savedAliases),
    { timeout: 20_000 }
  )
  await expect(restoredCanvas).toHaveAttribute(
    'data-hydrology-restored-aliases',
    String(savedDrainageLedger?.aliases ?? 0),
    { timeout: 20_000 }
  )
  await expect(restoredCanvas).toHaveAttribute('data-hydrology-pair-elapsed-ms', /\d/)
  await expect
    .poll(
      () =>
        page.evaluate(({ source, target }) => {
          const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
          const sourceWatershedId = handle?.queryHydrologyCell?.(source.x, source.y)?.watershedId
          const targetWatershedId = handle?.queryHydrologyCell?.(target.x, target.y)?.watershedId
          const segment = handle
            ?.getRiverGraph?.()
            .segments.find(
              (candidate) =>
                candidate.source.x === source.x &&
                candidate.source.y === source.y &&
                candidate.target.x === target.x &&
                candidate.target.y === target.y
            )
          return {
            sourceWatershedId: sourceWatershedId ?? null,
            targetWatershedId: targetWatershedId ?? null,
            graphIdentityId: segment?.identityId ?? null,
          }
        }, initialHydrologyIdentity),
      { timeout: 20_000 }
    )
    .toEqual({
      sourceWatershedId: initialHydrologyIdentity.sourceWatershedId,
      targetWatershedId: initialHydrologyIdentity.targetWatershedId,
      graphIdentityId: initialHydrologyIdentity.graphIdentityId,
    })
})

test('exposes bounded hydrology queries and retained hydrology graph to downstream systems', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete', {
    timeout: 45_000,
  })
  await expect(canvas).toHaveAttribute('data-hydrology-graph-coverage', 'retained-chunks')
  await expect(canvas).toHaveAttribute('data-hydrology-accumulation-propagation-ms', /\d/)
  await expect(canvas).toHaveAttribute('data-hydrology-pair-elapsed-ms', /\d/)
  const result = await page.evaluate(() => {
    const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Alohayo World map"]'
    )
    let cell = null
    if (handle?.queryHydrologyCell) {
      for (let y = -256; y <= 256 && !cell; y += 8) {
        for (let x = -256; x <= 256; x += 8) {
          cell = handle.queryHydrologyCell(x, y)
          if (cell) break
        }
      }
    }
    const graph = handle?.getRiverGraph?.() ?? null
    const seamSegment =
      graph?.segments.find(
        (segment) =>
          segment.targetKind !== 'frontier' &&
          segment.sourceKind !== 'frontier' &&
          (Math.floor(segment.source.x / 64) !== Math.floor(segment.target.x / 64) ||
            Math.floor(segment.source.y / 64) !== Math.floor(segment.target.y / 64))
      ) ?? null
    const seamSource = seamSegment
      ? (handle?.queryHydrologyCell?.(seamSegment.source.x, seamSegment.source.y) ?? null)
      : null
    const seamTarget = seamSegment
      ? (handle?.queryHydrologyCell?.(seamSegment.target.x, seamSegment.target.y) ?? null)
      : null
    const seamEvidence = seamSegment
      ? {
          exactDownstream:
            seamSource?.downstream?.x === seamSegment.target.x &&
            seamSource?.downstream?.y === seamSegment.target.y &&
            seamSource.downstreamLoaded === true,
          accumulationMatches: seamTarget?.flowAccumulation === seamSegment.accumulation,
          targetReceivesAtLeastSource:
            (seamTarget?.flowAccumulation ?? 0) >= (seamSource?.flowAccumulation ?? 0),
          watershedIdentityMatches:
            seamSource?.watershedId === seamTarget?.watershedId &&
            seamSource?.watershedId === seamSegment.identityId,
          sourceWatershedId: seamSource?.watershedId ?? null,
          targetWatershedId: seamTarget?.watershedId ?? null,
          graphIdentityId: seamSegment.identityId,
          source: seamSegment.source,
          target: seamSegment.target,
        }
      : null
    const loadedCrossChunkSegments =
      graph?.segments.filter(
        (segment) =>
          segment.targetKind !== 'frontier' &&
          segment.sourceKind !== 'frontier' &&
          (Math.floor(segment.source.x / 64) !== Math.floor(segment.target.x / 64) ||
            Math.floor(segment.source.y / 64) !== Math.floor(segment.target.y / 64))
      ) ?? []
    const crossChunkLinkEvidence = loadedCrossChunkSegments.map((segment) => {
      const source = handle?.queryHydrologyCell?.(segment.source.x, segment.source.y)
      const target = handle?.queryHydrologyCell?.(segment.target.x, segment.target.y)
      return {
        exactDownstream:
          source?.downstream?.x === segment.target.x &&
          source?.downstream?.y === segment.target.y &&
          source.downstreamLoaded === true,
        accumulationMatches: target?.flowAccumulation === segment.accumulation,
        targetReceivesAtLeastSource:
          (target?.flowAccumulation ?? 0) >= (source?.flowAccumulation ?? 0),
        watershedIdentityMatches:
          source?.watershedId === target?.watershedId && source?.watershedId === segment.identityId,
      }
    })
    const loadedBorderOutlets =
      graph?.segments.filter((segment) => {
        if (segment.targetKind !== 'outlet') return false
        const chunkX = Math.floor(segment.target.x / 64)
        const chunkY = Math.floor(segment.target.y / 64)
        const localX = segment.target.x - chunkX * 64
        const localY = segment.target.y - chunkY * 64
        return localX === 0 || localX === 63 || localY === 0 || localY === 63
      }) ?? []
    const graphBuildCount = canvas?.dataset.hydrologyGraphBuildCount ?? null
    const repeatedGraph = handle?.getRiverGraph?.() ?? null
    return {
      cell,
      unknownCell: handle ? handle.queryHydrologyCell?.(100_000, 100_000) : 'missing-handle',
      fractionalCell: handle ? handle.queryHydrologyCell?.(0.5, 0.5) : 'missing-handle',
      graph,
      loadedCrossChunkLinks: loadedCrossChunkSegments.length,
      crossChunkLinkEvidence,
      loadedBorderOutlets,
      seamEvidence,
      graphCacheStable: graph === repeatedGraph,
      graphBuildCountStable: graphBuildCount === canvas?.dataset.hydrologyGraphBuildCount,
      graphFrozen:
        Object.isFrozen(graph) &&
        Object.isFrozen(graph?.segments) &&
        graph?.segments.every(
          (segment) =>
            Object.isFrozen(segment) &&
            Object.isFrozen(segment.source) &&
            Object.isFrozen(segment.target)
        ),
      graphBuildMs: canvas?.dataset.hydrologyGraphBuildMs ?? null,
      graphSegmentCount: canvas?.dataset.hydrologyGraphSegmentCount ?? null,
      accumulationPropagationMs: canvas?.dataset.hydrologyAccumulationPropagationMs ?? null,
      accumulationCorrectedCells: canvas?.dataset.hydrologyAccumulationCorrectedCells ?? null,
      accumulationVisitedCells: canvas?.dataset.hydrologyAccumulationVisitedCells ?? null,
      accumulationChangedCells: canvas?.dataset.hydrologyAccumulationChangedCells ?? null,
      riverGraphRenderer: canvas?.dataset.riverGraphRenderer ?? null,
      riverGraphRenderRevision: canvas?.dataset.riverGraphRenderRevision ?? null,
      riverGraphRenderSegments: canvas?.dataset.riverGraphRenderSegments ?? null,
      riverMovementMaskSource: canvas?.dataset.riverMovementMaskSource ?? null,
      riverMovementMaskRevision: canvas?.dataset.riverMovementMaskRevision ?? null,
      riverBridgeMaskSource: canvas?.dataset.riverBridgeMaskSource ?? null,
      riverBridgeMaskRevision: canvas?.dataset.riverBridgeMaskRevision ?? null,
      canSubscribe: typeof handle?.subscribeHydrology === 'function',
    }
  })
  expect(result.cell).toMatchObject({
    flowDirection: expect.any(Number),
    flowAccumulation: expect.any(Number),
    watershedId: expect.stringMatching(/^watershed:/),
    water: expect.any(Boolean),
  })
  expect(result.cell?.downstream === null || typeof result.cell?.downstream?.x === 'number').toBe(
    true
  )
  expect(
    result.cell?.downstreamLoaded === null || typeof result.cell?.downstreamLoaded === 'boolean'
  ).toBe(true)
  expect(result.unknownCell).toBeNull()
  expect(result.fractionalCell).toBeNull()
  expect(result.graph).toMatchObject({
    schemaVersion: 2,
    completeness: 'retained-chunks',
    truncated: expect.any(Boolean),
    revision: expect.any(Number),
    segments: expect.any(Array),
  })
  expect(result.graph?.segments.length).toBeGreaterThan(0)
  expect(result.loadedCrossChunkLinks).toBeGreaterThan(0)
  expect(result.crossChunkLinkEvidence).toHaveLength(result.loadedCrossChunkLinks)
  expect(
    result.crossChunkLinkEvidence.every(
      (evidence) =>
        evidence.exactDownstream &&
        evidence.accumulationMatches &&
        evidence.targetReceivesAtLeastSource &&
        evidence.watershedIdentityMatches
    )
  ).toBe(true)
  expect(result.loadedBorderOutlets).toEqual([])
  expect(result.seamEvidence).toMatchObject({
    exactDownstream: true,
    accumulationMatches: true,
    targetReceivesAtLeastSource: true,
    watershedIdentityMatches: true,
  })
  expect(result.graphCacheStable).toBe(true)
  expect(result.graphBuildCountStable).toBe(true)
  expect(result.graphFrozen).toBe(true)
  expect(Number(result.graphBuildMs)).toBeGreaterThanOrEqual(0)
  expect(Number(result.graphSegmentCount)).toBe(result.graph?.segments.length)
  expect(Number(result.accumulationPropagationMs)).toBeGreaterThanOrEqual(0)
  expect(Number(result.accumulationPropagationMs)).toBeLessThan(100)
  expect(Number(result.accumulationCorrectedCells)).toBeGreaterThanOrEqual(0)
  expect(Number(result.accumulationVisitedCells)).toBeGreaterThanOrEqual(0)
  expect(Number(result.accumulationVisitedCells)).toBeGreaterThan(0)
  expect(Number(result.accumulationChangedCells)).toBeGreaterThanOrEqual(0)
  expect(result.riverGraphRenderer).toBe('retained-d8-graph')
  expect(Number(result.riverGraphRenderRevision)).toBe(result.graph?.revision)
  expect(Number(result.riverGraphRenderSegments)).toBeGreaterThan(0)
  expect(result.riverMovementMaskSource).toBe('retained-d8-graph')
  expect(Number(result.riverMovementMaskRevision)).toBe(result.graph?.revision)
  expect(result.riverBridgeMaskSource).toBe('road-overlap-retained-d8-graph')
  expect(Number(result.riverBridgeMaskRevision)).toBe(result.graph?.revision)
  expect(result.canSubscribe).toBe(true)
  await page.evaluate(() => window.__ALOHAYO_WORLD_E2E_HANDLE__?.setDevMode?.(true))
  const canvasBounds = await canvas.boundingBox()
  if (!canvasBounds) throw new Error('streamed world canvas is not visible')
  await page.evaluate(
    ({ clientX, clientY }) => {
      document
        .querySelector<HTMLCanvasElement>('canvas[aria-label="Alohayo World map"]')
        ?.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }))
    },
    {
      clientX: canvasBounds.x + canvasBounds.width / 2,
      clientY: canvasBounds.y + canvasBounds.height / 2,
    }
  )
  await expect(canvas).toHaveAttribute('data-hydrology-inspection-cell', /^-?\d+,-?\d+$/)
  const finalHydrologyEvent = await page.evaluate(async () => {
    const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
    if (!handle?.subscribeHydrology) return null
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Alohayo World map"]'
    )
    const events: Array<{ revision: number; type: string; chunks: unknown[] }> = []
    const unsubscribe = handle.subscribeHydrology((event) => events.push(event))
    await handle.destroy()
    const destroyedGraph = handle.getRiverGraph?.() ?? null
    const inspectionCleared =
      !canvas?.dataset.hydrologyInspectionCell && !canvas?.dataset.hydrologyInspectionRevision
    unsubscribe()
    return { event: events.at(-1) ?? null, destroyedGraph, inspectionCleared }
  })
  expect(finalHydrologyEvent?.event).toMatchObject({
    revision: expect.any(Number),
    type: 'chunk-evicted',
    chunks: expect.any(Array),
  })
  expect(finalHydrologyEvent?.destroyedGraph).toMatchObject({
    completeness: 'retained-chunks',
    segments: [],
  })
  expect(finalHydrologyEvent?.inspectionCleared).toBe(true)
})

test('preserves watershed and river identity through streamed chunk eviction and reload', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ = true
    window.localStorage.setItem('alohayo-world:dev-minimap', 'true')
    window.localStorage.setItem('alohayo-world:minimap-collapsed', 'false')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete', {
    timeout: 45_000,
  })
  await page.getByRole('button', { name: /Begin journey|Continue journey/ }).click()
  const seamIdentity = await page.evaluate(() => {
    const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
    const segment = handle
      ?.getRiverGraph?.()
      .segments.find(
        (candidate) =>
          candidate.targetKind !== 'frontier' &&
          candidate.sourceKind !== 'frontier' &&
          (Math.floor(candidate.source.x / 64) !== Math.floor(candidate.target.x / 64) ||
            Math.floor(candidate.source.y / 64) !== Math.floor(candidate.target.y / 64))
      )
    if (!handle?.queryHydrologyCell || !segment) return null
    const source = handle.queryHydrologyCell(segment.source.x, segment.source.y)
    const target = handle.queryHydrologyCell(segment.target.x, segment.target.y)
    if (!source || !target) return null
    return {
      source: segment.source,
      target: segment.target,
      identityId: segment.identityId,
      sourceWatershedId: source.watershedId,
      targetWatershedId: target.watershedId,
    }
  })
  if (!seamIdentity) throw new Error('initial loaded cross-chunk river segment is unavailable')
  expect(seamIdentity.sourceWatershedId).toBe(seamIdentity.identityId)
  expect(seamIdentity.targetWatershedId).toBe(seamIdentity.identityId)

  await page.evaluate(() => window.__ALOHAYO_WORLD_E2E_HANDLE__?.setDevMode?.(true))
  await expect(canvas).toHaveAttribute('data-dev-mode', 'true')
  const canvasBounds = await canvas.boundingBox()
  if (!canvasBounds) throw new Error('streamed world canvas is not visible')
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width / 2,
    canvasBounds.y + canvasBounds.height / 2
  )
  await expect(canvas).toHaveAttribute('data-hydrology-inspection-cell', /^-?\d+,-?\d+$/)
  const initialInspection = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Alohayo World map"]'
    )
    const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
    const [cellX, cellY] = (canvas?.dataset.hydrologyInspectionCell ?? '').split(',').map(Number)
    const query = handle?.queryHydrologyCell?.(cellX!, cellY!)
    return {
      flow: canvas?.dataset.hydrologyInspectionFlow ?? null,
      watershed: canvas?.dataset.hydrologyInspectionWatershed ?? null,
      state: canvas?.dataset.hydrologyInspectionState ?? null,
      revision: canvas?.dataset.hydrologyInspectionRevision ?? null,
      query,
    }
  })
  expect(initialInspection.flow).toBe(String(initialInspection.query?.flowAccumulation))
  expect(initialInspection.watershed).toBe(initialInspection.query?.watershedId)
  expect(initialInspection.state).toBe(initialInspection.query?.state)
  expect(initialInspection.revision).toBe(await canvas.getAttribute('data-hydrology-revision'))
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Alohayo World map"]'
    )
    window.__ALOHAYO_WORLD_E2E_HANDLE__?.subscribeHydrology?.((event) => {
      if (!canvas) return
      canvas.dataset.inspectionEventRevision = String(event.revision)
      canvas.dataset.inspectionObservedRevision = canvas.dataset.hydrologyInspectionRevision ?? ''
    })
  })
  await page.getByLabel('Fly').check()
  const teleport = async (x: number, y: number) => {
    await page.locator('#game input[placeholder="x"]').fill(String(x))
    await page.locator('#game input[placeholder="y"]').fill(String(y))
    await page.getByRole('button', { name: 'Teleport' }).click()
    await expect(canvas).toHaveAttribute('data-explorer-x', (x + 0.5).toFixed(3), {
      timeout: 45_000,
    })
  }

  await teleport(seamIdentity.source.x, seamIdentity.source.y)
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-minimap-river-segments')))
    .toBeGreaterThan(0)
  await page.evaluate(() => window.__ALOHAYO_WORLD_E2E_HANDLE__?.setDevMode?.(false))
  await expect(canvas).toHaveAttribute('data-game-ui-minimap', 'true')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-minimap-river-segments')))
    .toBeGreaterThan(0)
  await page.screenshot({ path: 'docs/evidence/issue-38-river-minimap-desktop.png' })
  await page.evaluate(() => window.__ALOHAYO_WORLD_E2E_HANDLE__?.setDevMode?.(true))
  await page.getByLabel('Fly').check()

  await teleport(1024, 1024)
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          'canvas[aria-label="Alohayo World map"]'
        )
        const eventRevision = canvas?.dataset.inspectionEventRevision
        const observedRevision = canvas?.dataset.inspectionObservedRevision
        return eventRevision !== undefined && eventRevision === observedRevision
      })
    )
    .toBe(true)
  const revisionAfterTeleport = Number(await canvas.getAttribute('data-hydrology-revision'))
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-hydrology-revision')), {
      timeout: 30_000,
    })
    .toBeGreaterThan(revisionAfterTeleport)
  await expect
    .poll(
      async () => {
        const hydrologyRevision = await canvas.getAttribute('data-hydrology-revision')
        const minimapRevision = await canvas.getAttribute('data-minimap-river-revision')
        return minimapRevision === hydrologyRevision
      },
      { timeout: 30_000 }
    )
    .toBe(true)
  await expect
    .poll(
      () =>
        page.evaluate(({ source, target }) => {
          const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
          return {
            sourceLoaded: handle?.queryHydrologyCell?.(source.x, source.y) !== null,
            targetLoaded: handle?.queryHydrologyCell?.(target.x, target.y) !== null,
          }
        }, seamIdentity),
      { timeout: 30_000 }
    )
    .toEqual({ sourceLoaded: false, targetLoaded: false })
  expect(Number(await canvas.getAttribute('data-loaded-chunks'))).toBeLessThan(50)

  await teleport(seamIdentity.source.x, seamIdentity.source.y)
  await expect
    .poll(
      () =>
        page.evaluate(({ source, target, identityId }) => {
          const handle = window.__ALOHAYO_WORLD_E2E_HANDLE__
          const sourceCell = handle?.queryHydrologyCell?.(source.x, source.y)
          const targetCell = handle?.queryHydrologyCell?.(target.x, target.y)
          const segment = handle
            ?.getRiverGraph?.()
            .segments.find(
              (candidate) =>
                candidate.source.x === source.x &&
                candidate.source.y === source.y &&
                candidate.target.x === target.x &&
                candidate.target.y === target.y
            )
          return {
            sourceWatershedId: sourceCell?.watershedId ?? null,
            targetWatershedId: targetCell?.watershedId ?? null,
            graphIdentityId: segment?.identityId ?? null,
            exactDownstream:
              sourceCell?.downstream?.x === target.x && sourceCell.downstream.y === target.y,
            originalIdentity: identityId,
          }
        }, seamIdentity),
      { timeout: 45_000 }
    )
    .toEqual({
      sourceWatershedId: seamIdentity.identityId,
      targetWatershedId: seamIdentity.identityId,
      graphIdentityId: seamIdentity.identityId,
      exactDownstream: true,
      originalIdentity: seamIdentity.identityId,
    })
})

const readPerformanceMetrics = (page: Page) =>
  page.evaluate(() => {
    return (
      window as Window & {
        __ALOHAYO_WORLD_PERF__?: Record<string, number | string | null>
      }
    ).__ALOHAYO_WORLD_PERF__
  })

const readRenderer = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Alohayo World map"]'
    )
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
    if (!gl) return 'canvas'
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'webgl'
  })

const waitForRuntimeSample = async (page: Page) => {
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete', {
    timeout: 45_000,
  })
  await expect(canvas).toBeVisible()
  // The runtime tracker resets after the first presentation. Allow the streamed worker and
  // SwiftShader to settle before sampling so the budget describes the steady-state surface.
  await page.waitForTimeout(4000)
  const metrics = await readPerformanceMetrics(page)
  console.info('runtime metrics', metrics)
  return metrics
}

const frameBudget = (renderer: string, hardwareBudget: number, softwareBudget: number) =>
  /swiftshader|llvmpipe|software/i.test(renderer) ? softwareBudget : hardwareBudget

const expectFramePacingMetrics = (metrics: Record<string, number | string | null> | undefined) => {
  expect(Number(metrics?.p50FrameMs)).toBeGreaterThan(0)
  expect(Number(metrics?.p95FrameMs)).toBeGreaterThanOrEqual(Number(metrics?.p50FrameMs))
  expect(Number(metrics?.p99FrameMs)).toBeGreaterThanOrEqual(Number(metrics?.p95FrameMs))
  expect(Number(metrics?.onePercentLowFps)).toBeGreaterThan(0)
  expect(Number(metrics?.droppedFrameCount)).toBeGreaterThanOrEqual(0)
  expect(metrics?.qualityTier).toMatch(/^(high|balanced|safe)$/)
  expect(Number(metrics?.qualityResolutionScale)).toBeGreaterThan(0)
}

test('tracks broad desktop runtime performance budgets', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toBeVisible()
  const metrics = await waitForRuntimeSample(page)
  const renderer = await readRenderer(page)
  console.info('renderer', renderer)

  expect(metrics).toBeTruthy()
  expect(Number(metrics?.avgFrameMs)).toBeLessThan(frameBudget(renderer, 35, 120))
  expect(Number(metrics?.lastChunkGenerationMs)).toBeLessThan(150)
  expect(Number(metrics?.estimatedDrawCalls)).toBeLessThan(220)
  expect(Number(metrics?.maxLongTaskMs)).toBeLessThan(220)
  expectFramePacingMetrics(metrics)
})

test('tracks broad mobile runtime performance budgets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toBeVisible()
  const metrics = await waitForRuntimeSample(page)
  const renderer = await readRenderer(page)
  console.info('renderer', renderer)

  expect(metrics).toBeTruthy()
  expect(Number(metrics?.avgFrameMs)).toBeLessThan(frameBudget(renderer, 45, 70))
  expect(Number(metrics?.lastChunkGenerationMs)).toBeLessThan(150)
  expect(Number(metrics?.estimatedDrawCalls)).toBeLessThan(220)
  expect(Number(metrics?.maxLongTaskMs)).toBeLessThan(200)
  expectFramePacingMetrics(metrics)
})
