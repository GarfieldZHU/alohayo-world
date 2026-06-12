import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  resolve: {
    alias: {
      '@alohayo/config': fileURLToPath(
        new URL('../../packages/config/src/index.ts', import.meta.url)
      ),
      '@alohayo/map': fileURLToPath(new URL('../../packages/map/src/index.ts', import.meta.url)),
      '@alohayo/character': fileURLToPath(
        new URL('../../packages/character/src/index.ts', import.meta.url)
      ),
      '@alohayo/engine': fileURLToPath(
        new URL('../../packages/engine/src/index.ts', import.meta.url)
      ),
      '@alohayo/embed': fileURLToPath(
        new URL('../../packages/embed/src/index.ts', import.meta.url)
      ),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        'embed/bootstrap': fileURLToPath(new URL('./src/embed.ts', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
