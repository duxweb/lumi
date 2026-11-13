import type { Plugin } from 'vite'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { mediaNames, mediaSvg } from './mock/media.ts'

const MEDIA_PATH_RE = /^\/media\/([a-z-]+)\.svg$/u
const MEDIA_REF_RE = /(["(])\/media\//gu

/**
 * Showcase photos drawn in `mock/media.ts`: served from memory in development,
 * emitted as `media/<name>.svg` in a build. Page JSON in `public/` names them
 * `/media/...`; under a sub-path base (the site's `/demo/`) the emitted copies
 * of that JSON point at `<base>media/...` instead.
 */
function showcaseMedia(): Plugin {
  let base = '/'
  let outDir = 'dist'
  return {
    name: 'lumi-showcase-media',
    configResolved(config) {
      base = config.base
      outDir = config.build.outDir
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0]?.replace(base, '/')
        const name = path ? MEDIA_PATH_RE.exec(path)?.[1] : undefined
        if (!name || !mediaNames.includes(name as never))
          return next()
        response.setHeader('Content-Type', 'image/svg+xml')
        response.end(mediaSvg(name as never))
      })
    },
    generateBundle() {
      for (const name of mediaNames)
        this.emitFile({ type: 'asset', fileName: `media/${name}.svg`, source: mediaSvg(name) })
    },
    async writeBundle() {
      if (base === '/')
        return
      for (const folder of ['pages', 'locales']) {
        const directory = join(outDir, folder)
        for (const file of (await readdir(directory)).filter(entry => entry.endsWith('.json'))) {
          const path = join(directory, file)
          const source = await readFile(path, 'utf8')
          const rebased = source.replace(MEDIA_REF_RE, `$1${base}media/`)
          if (rebased !== source)
            await writeFile(path, rebased)
        }
      }
    },
  }
}

export default defineConfig({
  base: process.env.LUMI_ADMIN_BASE || '/',
  plugins: [react(), showcaseMedia()],
  resolve: {
    conditions: ['lumi:source', 'module', 'browser', 'import', 'default'],
  },
  build: {
    rollupOptions: {
      output: {
        // The full HugeIcons set loads on demand; a stable name keeps it apart
        // from the entry chunk, which shares the `index` module name.
        chunkFileNames: chunk => chunk.facadeModuleId?.includes('@hugeicons/core-free-icons') ? 'assets/icons-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
