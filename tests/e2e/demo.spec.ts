import { expect, test } from '@playwright/test'

test('loads game resources only after start', async ({ page }) => {
  const gameRequests: string[] = []
  page.on('request', (request) => {
    if (/pixi|world\.worker|bootstrap/.test(request.url())) gameRequests.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Enter the world' })).toBeVisible()
  expect(gameRequests).toHaveLength(0)
  await page.getByRole('button', { name: 'Enter the world' }).click()
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  await expect(canvas).toBeVisible()
  await canvas.hover()
  await page.mouse.wheel(0, -900)
  await expect(canvas).toBeVisible()
})
