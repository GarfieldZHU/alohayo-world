import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import {
  formatI18n,
  getI18nCatalog,
  normalizeLocale,
  translateContentName,
} from '../packages/config/src'

describe('i18n catalogs', () => {
  it('normalizes supported locales', () => {
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('zh')).toBe('zh-CN')
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN')
    expect(normalizeLocale('fr')).toBe('en')
  })

  it('formats translated templates', () => {
    expect(formatI18n('Hello {name}', { name: 'world' })).toBe('Hello world')
  })

  it('loads Chinese launcher strings and content labels', () => {
    const catalog = getI18nCatalog('zh-CN')
    expect(catalog.ui.enterWorld).toBe('进入世界')
    expect(translateContentName('zh-CN', 'biomes', 'core:forest', 'Forest')).toBe('森林')
  })

  it('keeps the standalone fallback and locale release labels in sync', () => {
    const label = `Alohayo World / v${packageJson.version}`
    const html = readFileSync(new URL('../apps/game/index.html', import.meta.url), 'utf8')

    expect(getI18nCatalog('en').ui.eyebrow).toBe(label)
    expect(getI18nCatalog('zh-CN').ui.eyebrow).toBe(label)
    expect(html).toContain(`>${label}</p>`)
  })
})
