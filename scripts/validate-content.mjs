import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../content/core/manifest.json', import.meta.url)))
const world = JSON.parse(readFileSync(new URL('../content/core/world.json', import.meta.url)))
const biomes = JSON.parse(readFileSync(new URL('../content/core/biomes.json', import.meta.url)))
const errors = []

if (manifest.schemaVersion !== 1 || manifest.id !== 'core') errors.push('invalid core manifest')
if (world.schemaVersion !== 1 || world.chunkSize <= 0 || world.width <= 0 || world.height <= 0) {
  errors.push('invalid world definition')
}
if (!Array.isArray(biomes) || biomes.length < 8) errors.push('at least eight biomes are required')
if (new Set(biomes.map((biome) => biome.id)).size !== biomes.length)
  errors.push('duplicate biome id')
if (new Set(biomes.map((biome) => biome.code)).size !== biomes.length) {
  errors.push('duplicate biome code')
}
for (const biome of biomes) {
  if (!/^#[0-9a-f]{6}$/i.test(biome.color) || !/^#[0-9a-f]{6}$/i.test(biome.accent)) {
    errors.push(`invalid color for ${biome.id}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`validated ${biomes.length} biomes and world ${world.id}`)
