import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.LUMI_FOUNDATION_BASE || '/',
  plugins: [react()],
  resolve: { conditions: ['lumi:source', 'module', 'browser', 'import', 'default'] },
})
