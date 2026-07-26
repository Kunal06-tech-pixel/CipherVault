import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'es2022', sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        background: resolve(import.meta.dirname, 'src/background.ts'),
        content: resolve(import.meta.dirname, 'src/content.ts'),
      },
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]' },
    },
  },
})
