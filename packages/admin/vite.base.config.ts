import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The prebuilt base: one ES module and one stylesheet with every runtime
// dependency inside, for hosts that never run a bundler. It is an application
// build rather than a library build, so the output is fully minified; rarely
// used code (the full icon set, the chart engine) stays in lazy chunks.
// Built after the package so it carries the compiled Admin stylesheet.
export default defineConfig({
  plugins: [react()],
  // Workspace packages build from source, like the apps; only the compiled
  // UI and Admin stylesheets must exist beforehand.
  resolve: { conditions: ['lumi:source', 'module', 'browser', 'import', 'default'] },
  build: {
    outDir: 'dist/base',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/base.tsx',
      output: {
        entryFileNames: 'lumi-admin.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: asset => asset.names.some(name => name.endsWith('.css')) ? 'lumi-admin.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
})
