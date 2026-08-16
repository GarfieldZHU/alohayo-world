import { defineConfig } from '@playwright/test'

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

export default defineConfig({
  testDir: 'tests/e2e',
  // SwiftShader and the streamed Wasm worker contend heavily on the two-core CI runner.
  // Serial CI execution keeps lifecycle and frame-pacing evidence deterministic; local runs
  // retain Playwright's default parallelism.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: 'REQUIRE_WASM=1 yarn build:e2e && yarn preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
})
