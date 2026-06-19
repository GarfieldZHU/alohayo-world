import enCatalog from '../../../i18n/en.json'
import zhCnCatalog from '../../../i18n/zh-CN.json'

export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]

export interface LanguageOption {
  code: LocaleCode
  label: string
}

export interface I18nContentEntry {
  name?: string
  description?: string
}

export interface I18nCatalog {
  locale: LocaleCode
  languageLabel: string
  languageOptions: Record<LocaleCode, string>
  ui: Record<string, string>
  hud: {
    devPrefix: string
    fallbackExplorerName: string
    seed: string
    loaded: string
    discovered: string
    cells: string
    chunk: string
    zoom: string
    fast: string
    surveyingFrontier: string
    tooltip: string
    areaSuffix: string
    status: string
    regions: Record<string, string>
    states: Record<string, string>
  }
  devPanel: Record<string, string>
  actions: Record<string, string>
  content: Record<string, Record<string, I18nContentEntry>>
}

const catalogs: Record<LocaleCode, I18nCatalog> = {
  en: enCatalog as I18nCatalog,
  'zh-CN': zhCnCatalog as I18nCatalog,
}

export const LANGUAGE_OPTIONS: LanguageOption[] = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: catalogs[code].languageOptions[code],
}))

export function normalizeLocale(input?: string | null): LocaleCode {
  if (!input) return 'en'
  const normalized = input.trim().toLowerCase()
  if (
    normalized === 'zh' ||
    normalized === 'zh-cn' ||
    normalized === 'zh-hans' ||
    normalized.startsWith('zh-')
  ) {
    return 'zh-CN'
  }
  return 'en'
}

export function getI18nCatalog(locale?: string | null): I18nCatalog {
  return catalogs[normalizeLocale(locale)]
}

export function formatI18n(template: string, values: Record<string, string | number>): string {
  return template.replaceAll(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

export function translateContentName(
  locale: string | null | undefined,
  section: string,
  id: string,
  fallback: string
): string {
  return getI18nCatalog(locale).content[section]?.[id]?.name ?? fallback
}

export function translateContentDescription(
  locale: string | null | undefined,
  section: string,
  id: string,
  fallback: string
): string {
  return getI18nCatalog(locale).content[section]?.[id]?.description ?? fallback
}
