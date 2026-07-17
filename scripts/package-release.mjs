import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
const embed = new URL('../dist/embed/', import.meta.url)
mkdirSync(embed, { recursive: true })

const cssSource = new URL('../dist/assets/style.css', import.meta.url)
if (existsSync(cssSource)) cpSync(cssSource, new URL('bootstrap.css', embed))

writeFileSync(
  new URL('manifest.json', embed),
  JSON.stringify(
    {
      name: 'Alohayo World',
      version: '0.1.2',
      entry: 'bootstrap.js',
      api: ['mountGame', 'pause', 'resume', 'destroy'],
    },
    null,
    2
  )
)

writeFileSync(new URL('.nojekyll', dist), '')
