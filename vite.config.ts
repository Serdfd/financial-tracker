import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'sql.js', 'electron']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                manualChunks: {
                  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                  'charts': ['apexcharts', 'react-apexcharts'],
                  'icons': ['lucide-react'],
                }
              }
            }
          }
        },
        onstart(options) {
          options.reload()
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})