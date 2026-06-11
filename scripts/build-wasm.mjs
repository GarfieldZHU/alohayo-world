import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const output = new URL('../dist/embed/wasm/', import.meta.url)
mkdirSync(output, { recursive: true })

const version = spawnSync('wasm-pack', ['--version'], { stdio: 'ignore' })
if (version.status !== 0) {
  writeFileSync(
    new URL('README.txt', output),
    'Wasm build unavailable; deterministic TS fallback active.\n'
  )
  console.log('wasm-pack not installed; using deterministic TypeScript fallback')
  process.exit(0)
}

const result = spawnSync(
  'wasm-pack',
  ['build', 'crates/world-core', '--target', 'web', '--out-dir', '../../dist/embed/wasm'],
  { stdio: 'inherit' }
)
process.exit(result.status ?? 1)
