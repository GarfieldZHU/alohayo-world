import { readdirSync, readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'

const wikiRoot = new URL('../docs/wiki/', import.meta.url)
const pages = readdirSync(wikiRoot)
  .filter((name) => name.endsWith('.md'))
  .sort()
const pageNames = new Set(pages.map((name) => basename(name, extname(name))))
const englishPages = pages.filter((name) => !name.endsWith('-zh-CN.md') && !name.startsWith('_'))
const errors = []

for (const file of englishPages) {
  const page = basename(file, '.md')
  const chineseFile = `${page}-zh-CN.md`
  const english = readFileSync(new URL(file, wikiRoot), 'utf8')
  const englishVersion = english.match(/Wiki page version:\*\* EN (\d+\.\d+\.\d+)/)?.[1]

  if (!englishVersion) errors.push(`${file}: missing English Wiki page version`)
  if (!english.includes('Product baseline:** v')) {
    errors.push(`${file}: missing product baseline`)
  }
  if (!pages.includes(chineseFile)) {
    errors.push(`${file}: missing paired ${chineseFile}`)
    continue
  }

  const chinese = readFileSync(new URL(chineseFile, wikiRoot), 'utf8')
  const chineseVersion = chinese.match(/Wiki 页面版本：\*\* zh-CN (\d+\.\d+\.\d+)/)?.[1]
  const translatedFrom = chinese.match(/英文源版本：\*\* EN (\d+\.\d+\.\d+)/)?.[1]
  if (!chineseVersion) errors.push(`${chineseFile}: missing Chinese Wiki page version`)
  if (!translatedFrom) errors.push(`${chineseFile}: missing translated-from EN version`)
  if (!chinese.includes('产品基线：** v')) {
    errors.push(`${chineseFile}: missing product baseline`)
  }
  if (englishVersion && translatedFrom !== englishVersion) {
    errors.push(
      `${chineseFile}: translated from EN ${translatedFrom || '<missing>'}, current English is ${englishVersion}`
    )
  }
}

for (const file of pages) {
  const source = readFileSync(new URL(file, wikiRoot), 'utf8')
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^(https?:|mailto:)/.test(target) || target.includes('/')) continue
    const normalized = target.endsWith('.md') ? target.slice(0, -3) : target
    if (!pageNames.has(normalized)) errors.push(`${file}: broken Wiki link ${target}`)
  }
}

const biomes = JSON.parse(readFileSync(new URL('../content/core/biomes.json', import.meta.url)))
const englishCatalog = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url)))
const chineseCatalog = JSON.parse(readFileSync(new URL('../i18n/zh-CN.json', import.meta.url)))
const terrainEnglish = readFileSync(new URL('World-and-Terrain.md', wikiRoot), 'utf8')
const terrainChinese = readFileSync(new URL('World-and-Terrain-zh-CN.md', wikiRoot), 'utf8')
for (const biome of biomes) {
  const englishName = englishCatalog.content?.biomes?.[biome.id]?.name
  const chineseName = chineseCatalog.content?.biomes?.[biome.id]?.name
  if (!terrainEnglish.includes(`\`${biome.id}\``) || !terrainChinese.includes(`\`${biome.id}\``)) {
    errors.push(`terrain Wiki pages missing stable ID ${biome.id}`)
  }
  if (!englishName || !terrainEnglish.includes(englishName)) {
    errors.push(`English terrain Wiki missing localized name for ${biome.id}`)
  }
  if (!chineseName || !terrainChinese.includes(chineseName)) {
    errors.push(`Chinese terrain Wiki missing localized name for ${biome.id}`)
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exit(1)
}

console.log(
  `validated ${englishPages.length} bilingual Wiki page pairs, ${pages.length} Markdown files, and ${biomes.length} localized terrains`
)
