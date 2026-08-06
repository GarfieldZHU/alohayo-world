import { expect, test } from '@playwright/test'

const launch = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 30_000 })
}

test('moves from splash to a light HUD and keyboard-safe menu', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ = true
    window.localStorage.setItem('alohayo-world:minimap-collapsed', 'true')
  })
  await launch(page)
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  const splash = page.locator('[data-game-ui-surface="splash"]')
  await expect(splash).toBeVisible()
  const splashCard = splash.locator('.aw-game-ui__splash-card')
  await expect(splashCard).toHaveCSS('border-radius', '22px')
  await expect(splash.getByRole('button', { name: 'Begin journey' })).toHaveCSS(
    'border-radius',
    '999px'
  )
  const minimap = page.locator('[data-alohayo-world-minimap="true"]')
  await expect(minimap).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Alohayo World' })).toBeVisible()
  await expect(canvas).toHaveAttribute('data-game-ui-enabled', 'true')

  const beforeSplash = await canvas.getAttribute('data-explorer-x')
  await page.keyboard.down('d')
  await page.waitForTimeout(1100)
  await page.keyboard.up('d')
  await expect(canvas).toHaveAttribute('data-explorer-x', beforeSplash!)

  await page.getByRole('button', { name: 'Begin journey' }).click()
  await expect(splash).toBeHidden()
  const hud = page.locator('[data-game-ui-surface="hud"]')
  await expect(hud).toBeVisible()
  await expect(hud.locator('.aw-game-ui__identity')).toHaveCSS('border-radius', '14px')
  await expect(hud.locator('.aw-game-ui__controls-hint')).toHaveCSS('border-radius', '999px')
  await expect(minimap).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hide', exact: true })).toBeVisible()
  await expect(hud.getByText('Journal', { exact: true })).toBeVisible()
  await page.keyboard.press('n')
  await expect(minimap).toBeHidden()
  await page.keyboard.press('n')
  await expect(minimap).toBeVisible()
  await page.keyboard.press('h')
  await expect(hud).toBeHidden()
  await expect(minimap).toBeHidden()
  await page.keyboard.press('h')
  await expect(hud).toBeVisible()
  await expect(minimap).toBeVisible()
  await page.keyboard.press('m')
  const menu = page.locator('[data-game-ui-surface="menu"]')
  await expect(menu).toBeVisible()
  await expect(minimap).toBeHidden()
  await expect(page.getByRole('tab')).toHaveCount(6)
  await page.getByRole('tab', { name: 'World map' }).click()
  await expect(menu.getByText('World seed', { exact: true })).toBeVisible()

  const beforeMenu = await canvas.getAttribute('data-explorer-x')
  await page.keyboard.down('d')
  await page.waitForTimeout(1100)
  await page.keyboard.up('d')
  await expect(canvas).toHaveAttribute('data-explorer-x', beforeMenu!)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})
