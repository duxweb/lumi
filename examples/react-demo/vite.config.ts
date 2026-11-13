import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['lumi:source', 'module', 'browser', 'import', 'default'],
  },
})
