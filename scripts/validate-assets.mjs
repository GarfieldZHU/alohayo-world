import { readdirSync, readFileSync, statSync } from 'node:fs'

const root = new URL('../assets/', import.meta.url)
const registry = JSON.parse(readFileSync(new URL('ATTRIBUTION.json', root)))
const registered = new Set(registry.assets.map((asset) => asset.path))
const files = readdirSync(root).filter((name) => name !== 'ATTRIBUTION.json')
const errors = []

for (const file of files) {
  if (!registered.has(file)) errors.push(`unregistered asset: ${file}`)
  if (statSync(new URL(file, root)).size > 2_000_000) errors.push(`asset exceeds 2 MB: ${file}`)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`validated ${files.length} original/CC0 assets`)
