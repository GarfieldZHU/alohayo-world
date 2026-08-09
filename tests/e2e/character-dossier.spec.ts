import { expect, test } from '@playwright/test'

const launch = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    window.__ALOHAYO_WORLD_E2E_UI_OPTIONS__ = true
    window.localStorage.setItem('alohayo-world:minimap-collapsed', 'true')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the world' }).click()
  await expect(page.getByRole('button', { name: 'Resurvey' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Begin journey' }).click()
  await expect(page.locator('canvas[data-initial-presentation="complete"]')).toBeVisible({
    timeout: 30_000,
  })
}

test('opens independent character panels without taking over the map', async ({
  page,
}, testInfo) => {
  await launch(page)
  const canvas = page.locator('canvas[aria-label="Alohayo World map"]')
  const dossier = page.locator('[data-character-dossier="true"]')
  await expect(dossier).toBeHidden()

  const before = await canvas.boundingBox()
  await page.keyboard.press('c')
  await expect(dossier).toBeVisible()
  await expect(dossier.locator('[data-character-panel="overview"]')).toBeVisible()
  await expect(dossier.locator('[data-character-panel="abilities"]')).toBeHidden()
  await expect(dossier.getByText('C dossier · Esc close')).toBeVisible()
  const after = await canvas.boundingBox()
  expect(after?.width).toBe(before?.width)
  const dossierBox = await dossier.boundingBox()
  const viewport = page.viewportSize()
  expect(dossierBox?.width).toBeGreaterThan(440)
  expect(dossierBox?.x ?? 0).toBeGreaterThan((viewport?.width ?? 0) * 0.4)
  expect((dossierBox?.x ?? 0) + (dossierBox?.width ?? 0)).toBeGreaterThan(
    (viewport?.width ?? 0) * 0.75
  )
  expect((dossierBox?.y ?? 0) + (dossierBox?.height ?? 0)).toBeLessThanOrEqual(
    viewport?.height ?? 0
  )
  await expect(dossier).not.toContainText('Field dossier')
  await expect(dossier.locator('.aw-character-dossier__panel')).toHaveCSS('animation-name', 'none')
  await page.screenshot({
    path: testInfo.outputPath('character-dossier-overview.png'),
    fullPage: false,
  })

  const overview = dossier.locator('[data-character-panel="overview"]')
  await overview.getByRole('button', { name: 'Collapse panel' }).click()
  await expect(overview).toHaveAttribute('data-collapsed', 'true')
  await overview.getByRole('button', { name: 'Expand panel' }).click()
  await overview.getByRole('button', { name: 'Close panel' }).click()
  await expect(overview).toBeHidden()
  await dossier.getByRole('button', { name: '1' }).click()
  await expect(overview).toBeVisible()

  await page.keyboard.press('2')
  const abilities = dossier.locator('[data-character-panel="abilities"]')
  await expect(abilities).toBeVisible()
  const abilitiesBox = await abilities.boundingBox()
  expect(abilitiesBox?.width).toBeGreaterThan(440)
  expect(abilitiesBox?.height).toBeGreaterThan(300)
  await expect(abilities).toHaveCSS('animation-name', 'none')
  await expect(abilities.locator('.aw-character-dossier__panel-content')).toBeVisible()
  await expect(abilities.locator('.aw-character-dossier__ability-group')).toHaveCount(4)
  await expect(
    abilities.locator('.aw-character-dossier__meter').first().locator('span')
  ).toHaveCount(20)
  const points = dossier.locator('[data-character-preview-points]')
  await expect(points).toHaveAttribute('data-character-preview-points', '4')
  await page.screenshot({
    path: testInfo.outputPath('character-dossier-abilities.png'),
    fullPage: false,
  })
  const increase = abilities.getByRole('button', { name: /Increase/ }).first()
  await increase.click()
  await expect(points).toHaveAttribute('data-character-preview-points', '3')
  await expect(increase).toBeFocused()
  await abilities.getByRole('button', { name: 'Reset' }).click()
  await expect(points).toHaveAttribute('data-character-preview-points', '4')

  await page.keyboard.press('3')
  await expect(dossier.locator('[data-character-panel="equipment"]')).toBeVisible()
  const equipment = dossier.locator('[data-character-panel="equipment"]')
  await expect(equipment.getByRole('heading', { name: 'Generated loadout' })).toBeVisible()
  await expect(equipment.getByRole('heading', { name: 'Field item catalog' })).toBeVisible()
  await expect(equipment.locator('.aw-character-dossier__item-card')).toHaveCount(16)
  const equipmentSelect = equipment.getByRole('combobox').first()
  await expect(equipmentSelect).toBeVisible()
  await equipmentSelect.selectOption({ index: 1 })
  await expect(canvas).toHaveAttribute('data-character-equipment-preview', 'true')
  await page.screenshot({
    path: testInfo.outputPath('character-dossier-items.png'),
    fullPage: false,
  })
  await equipmentSelect.focus()
  await page.keyboard.press('Escape')
  await expect(equipment).toBeHidden()
  await expect(page.locator('[data-game-ui-surface="menu"]')).toBeHidden()
  await page.keyboard.press('3')
  await expect(equipment).toBeVisible()
  await page.keyboard.press('4')
  await expect(dossier.locator('[data-character-panel="skills"]')).toBeVisible()
  await page.keyboard.press('5')
  await expect(dossier.locator('[data-character-panel="systems"]')).toBeVisible()
  await expect(dossier.getByText('Traversal rules unavailable')).toBeVisible()

  await page.keyboard.press('m')
  await expect(page.locator('[data-game-ui-surface="menu"]')).toBeVisible()
  await expect(dossier).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-game-ui-surface="menu"]')).toBeHidden()
})

test('uses a compact bottom sheet on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await launch(page)
  const dossier = page.locator('[data-character-dossier="true"]')
  await page.keyboard.press('c')
  await expect(dossier).toBeVisible()
  await expect(
    dossier.locator('[data-character-panel="overview"] .aw-character-dossier__panel-content')
  ).toBeVisible()
  const box = await dossier.boundingBox()
  expect(box?.width).toBeGreaterThan(320)
  expect(box?.height).toBeGreaterThan(350)
  expect(box?.height).toBeLessThanOrEqual(420)
  await page.locator('#game').screenshot({
    path: testInfo.outputPath('character-dossier-mobile.png'),
  })
})
