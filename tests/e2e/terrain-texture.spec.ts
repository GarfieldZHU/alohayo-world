import { expect, test } from '@playwright/test'

const launch = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 30_000 })
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toHaveAttribute('data-initial-presentation', 'complete', {
    timeout: 30_000,
  })
  await expect(canvas).toHaveAttribute('data-worker-terrain-texture-hints', 'wasm')
  await page.locator('canvas[aria-label="Alohayo World map"]').hover()
  await page.mouse.wheel(0, -1500)
  await page.waitForTimeout(250)
}

test('captures the desktop terrain texture overlay face', async ({ page }) => {
  await launch(page)
  await page.locator('#game').screenshot({
    path: 'docs/evidence/issue-64-terrain-texture-overlay-desktop.png',
  })
})

test('captures the mobile terrain texture overlay face', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await launch(page)
  await page.locator('#game').screenshot({
    path: 'docs/evidence/issue-64-terrain-texture-overlay-mobile.png',
  })
})
