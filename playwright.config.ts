import { defineConfig } from '@playwright/test'

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

export default defineConfig({
  testDir: 'tests/e2e',
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
