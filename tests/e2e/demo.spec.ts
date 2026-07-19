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
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete')
  await expect(canvas).toBeVisible()
  const initialViewportChunks = Number(await canvas.getAttribute('data-initial-viewport-chunks'))
  const initialRenderedChunks = Number(await canvas.getAttribute('data-initial-rendered-chunks'))
  expect(initialViewportChunks).toBeGreaterThan(0)
  expect(initialRenderedChunks).toBeGreaterThanOrEqual(initialViewportChunks)
  await expect(canvas).toHaveAttribute('data-worker-base-layers', 'wasm')
  await expect(canvas).toHaveAttribute('data-worker-hydrology', 'wasm')
  await expect(canvas).toHaveAttribute('data-worker-fallbacks', '0')
  await expect(canvas).toHaveAttribute('data-worker-transfer-bytes', /[1-9][0-9]*/)
  await expect(canvas).toHaveAttribute('data-last-chunk-ms', /[0-9.]+/)
  await expect(canvas).toHaveAttribute('data-shoreline-renderer', 'smoothed-contours')
  await expect(canvas).toHaveAttribute('data-discovery-fog-renderer', 'adaptive-subcell')
  await expect(canvas).toHaveAttribute(
    'data-geomorphology',
    'erosion-sediment-deposition-floodplain'
  )
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
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-worker-base-layers', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-hydrology', 'typescript')
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
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-worker-base-layers', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-hydrology', 'typescript')
  await expect(canvas).toHaveAttribute('data-worker-fallbacks', '2')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete')
})

test('keeps the minimap collapse control interactive and clear of the clock', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 20_000 })
  const collapse = page.getByRole('button', { name: 'Hide' })
  const clock = page.getByLabel('World time')
  const [collapseBox, clockBox] = await Promise.all([collapse.boundingBox(), clock.boundingBox()])
  expect(collapseBox).toBeTruthy()
  expect(clockBox).toBeTruthy()
  expect(collapseBox!.y).toBeGreaterThanOrEqual(clockBox!.y + clockBox!.height)
  const hitTarget = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'),
    {
      x: collapseBox!.x + collapseBox!.width / 2,
      y: collapseBox!.y + collapseBox!.height / 2,
    }
  )
  expect(hitTarget).toBe('Hide')
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
  const expandHitTarget = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'),
    {
      x: expandBox!.x + expandBox!.width / 2,
      y: expandBox!.y + expandBox!.height / 2,
    }
  )
  expect(expandHitTarget).toBe('Show')
  await expand.click()
  await expect(page.getByRole('button', { name: 'Hide' })).toBeVisible()
})

test('manages named local saves and reports bad imports', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Local saves', { exact: true }).click()
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 20_000 })

  await page.getByPlaceholder('Save name').fill('Bridge approach')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Save slots')).toContainText('Bridge approach')

  await page.getByPlaceholder('Save name').fill('Bridge copy')
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByLabel('Save slots')).toContainText('Bridge copy')

  await page.getByLabel('Save slots').selectOption('Bridge-copy')
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByLabel('Save slots')).not.toContainText('Bridge copy')

  await page.getByPlaceholder('Paste exported save JSON').fill('{bad json')
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('status')).toContainText('Save recovery:')
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
    return (window as Window & { __ALOHAYO_WORLD_PERF__?: Record<string, number | null> })
      .__ALOHAYO_WORLD_PERF__
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
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 20_000 })
  await page.waitForTimeout(1500)
  const metrics = await readPerformanceMetrics(page)
  console.info('runtime metrics', metrics)
  return metrics
}

const frameBudget = (renderer: string, hardwareBudget: number, softwareBudget: number) =>
  /swiftshader|llvmpipe|software/i.test(renderer) ? softwareBudget : hardwareBudget

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
})
