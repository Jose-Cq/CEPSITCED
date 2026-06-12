import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    fs: {
      allow: [
        '.',
        '../backend'
      ]
    }
  },
  resolve: {
    alias: {
      '@backend/utils': path.resolve(__dirname, '../backend/src/utils'),
      '@backend': path.resolve(__dirname, '../backend'),
    }
  }
})