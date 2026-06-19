import { describe, expect, it } from 'vitest'
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
})
