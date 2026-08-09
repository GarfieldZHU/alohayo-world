import { expect, test } from '@playwright/test'

const launch = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 30_000 })
}

test('moves from splash to a light HUD and keyboard-safe menu', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ = true
    window.localStorage.setItem('alohayo-world:minimap-collapsed', 'true')
  })
  await launch(page)
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  const splash = page.locator('[data-game-ui-surface="splash"]')
  await expect(splash).toBeVisible()
  const splashCard = splash.locator('.aw-game-ui__splash-card')
  await expect(splashCard).toHaveCSS('border-radius', '8px')
  await expect(splash.getByRole('button', { name: 'Begin journey' })).toHaveCSS(
    'min-height',
    '58px'
  )
  await expect(splash.locator('.aw-game-ui__splash-meta')).toContainText('LOCAL WORLD')
  await expect(splash.locator('.aw-game-ui__splash-controls')).toContainText('Field controls')
  await expect(
    splash.getByRole('button', { name: 'Begin journey' }).locator('.aw-game-ui__button-detail')
  ).toBeVisible()
  await page.locator('#game').screenshot({ path: testInfo.outputPath('splash-desktop.png') })
  const minimap = page.locator('[data-alohayo-world-minimap="true"]')
  await expect(minimap).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Alohayo World' })).toBeVisible()
  await expect(canvas).toHaveAttribute('data-game-ui-enabled', 'true')

  const beforeSplash = await canvas.getAttribute('data-explorer-x')
  await page.keyboard.down('d')
  await page.waitForTimeout(1100)
  await page.keyboard.up('d')
  await expect(canvas).toHaveAttribute('data-explorer-x', beforeSplash!)

  await page.getByRole('button', { name: /Begin journey|Continue journey/ }).click()
  await expect(splash).toBeHidden()
  const hud = page.locator('[data-game-ui-surface="hud"]')
  await expect(hud).toBeVisible()
  await expect(hud.locator('.aw-game-ui__identity')).toHaveCSS('border-radius', '14px')
  await expect(hud.locator('.aw-game-ui__controls-hint')).toHaveCSS('border-radius', '999px')
  await expect(minimap).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hide', exact: true })).toBeVisible()
  await expect(hud.getByText('Journal', { exact: true })).toBeVisible()
  await expect(page.locator('[data-alohayo-world-minimap-compass="true"]')).toBeHidden()
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
  const gameBox = await page.locator('#game').boundingBox()
  const menuFrameBox = await menu.locator('.aw-game-ui__menu-frame').boundingBox()
  expect(menuFrameBox?.height).toBeLessThan(gameBox?.height ?? 0)
  await expect(menu.locator('.aw-journal__tabs')).toHaveCSS('overflow-y', 'hidden')
  await expect(menu.locator('.aw-journal__content')).toHaveCSS('overflow-y', 'auto')
  await expect(minimap).toBeHidden()
  await expect(page.getByRole('tab')).toHaveCount(6)
  await expect(menu.locator('.aw-journal__tab-glyph').first()).toHaveCSS('border-radius', '0px')
  await expect(menu.getByRole('button', { name: 'Save progress' })).toBeVisible()
  await menu.getByRole('button', { name: 'Save progress' }).click()
  await expect(menu.locator('[data-journal-save-state="saved"]')).toBeVisible()
  await page.keyboard.press('3')
  await expect(menu.getByRole('heading', { name: 'Terrain manual' })).toBeVisible()
  const contentScroll = await menu.locator('.aw-journal__content').evaluate((element) => {
    const node = element as HTMLElement
    node.scrollTop = node.scrollHeight
    return {
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      scrollTop: node.scrollTop,
    }
  })
  expect(contentScroll.scrollHeight).toBeGreaterThan(contentScroll.clientHeight)
  expect(contentScroll.scrollTop).toBeGreaterThan(0)
  await expect(menu.locator('.aw-journal__tabs')).toHaveJSProperty('scrollTop', 0)
  await page.keyboard.press('4')
  await expect(menu.getByText('Encounter ledger not active', { exact: true })).toBeVisible()
  const wildlifeCard = menu.locator('[data-journal-entry-kind="wildlife"]').first()
  await expect(wildlifeCard).toBeVisible()
  await wildlifeCard.hover()
  await expect(wildlifeCard).not.toHaveCSS('transform', 'none')
  await page.getByRole('tab', { name: 'Field map' }).click()
  await expect(menu.getByText('World seed', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('journal-desktop-field-map.png') })

  const beforeMenu = await canvas.getAttribute('data-explorer-x')
  await page.keyboard.down('d')
  await page.waitForTimeout(1100)
  await page.keyboard.up('d')
  await expect(canvas).toHaveAttribute('data-explorer-x', beforeMenu!)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('keeps the journal readable as a mobile tabbed surface', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ = true
  })
  await page.setViewportSize({ width: 390, height: 720 })
  await launch(page)
  await page.locator('#game').screenshot({ path: testInfo.outputPath('splash-mobile.png') })
  await page.getByRole('button', { name: /Begin journey|Continue journey/ }).click()
  await page.keyboard.press('m')
  const menu = page.locator('[data-game-ui-surface="menu"]')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.aw-journal__tabs')).toHaveCSS('flex-direction', 'row')
  await expect(menu.locator('.aw-journal__tabs')).toHaveCSS('overflow-y', 'hidden')
  await page.keyboard.press('5')
  await expect(menu.getByRole('heading', { name: 'Field map' })).toBeVisible()
  await expect(menu.getByText('World seed', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('journal-mobile-field-map.png') })
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('opens splash settings from the M shortcut', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ = true
  })
  await launch(page)
  await page.keyboard.press('m')
  const menu = page.locator('[data-game-ui-surface="menu"]')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true')
})
