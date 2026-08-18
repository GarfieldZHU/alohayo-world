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

  await page.reload()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const restoredCanvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(restoredCanvas).toHaveAttribute(
    'data-topology-restored-aliases',
    String(savedAliases),
    { timeout: 20_000 }
  )
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
