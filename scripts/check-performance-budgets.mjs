import { readFileSync, statSync } from 'node:fs'

const distRoot = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', distRoot)))

const budgets = [
  {
    label: 'launcher app.js',
    path: 'app.js',
    maxBytes: 8_000,
  },
  {
    label: 'embed bootstrap',
    path: 'embed/bootstrap.js',
    maxBytes: 1_000,
  },
  {
    label: 'engine chunk',
    path: Object.values(manifest)
      .map((entry) => entry.file)
      .find((file) => /^assets\/index-.*\.js$/.test(file)),
    maxBytes: 390_000,
  },
  {
    label: 'i18n chunk',
    path: Object.values(manifest)
      .map((entry) => entry.file)
      .find((file) => /^assets\/i18n-.*\.js$/.test(file)),
    maxBytes: 30_000,
  },
]

const failures = []
for (const budget of budgets) {
  if (!budget.path) {
    failures.push(`missing build artifact for ${budget.label}`)
    continue
  }
  const bytes = statSync(new URL(budget.path, distRoot)).size
  if (bytes > budget.maxBytes) {
    failures.push(
      `${budget.label} is ${bytes} bytes, exceeding the budget of ${budget.maxBytes} bytes`
    )
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(
  budgets
    .filter((budget) => budget.path)
    .map((budget) => `${budget.label} <= ${budget.maxBytes} bytes`)
    .join('\n')
)
