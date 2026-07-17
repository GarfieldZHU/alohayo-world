import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    // Performance promotion tests compare TypeScript and Wasm in-process. Running
    // heavy generator files beside them makes scheduler contention dominate the
    // relative measurements on shared CI runners.
    fileParallelism: false,
  },
})
