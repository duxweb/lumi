import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

const DEMO_INDEX_RE = /^\/demo\/(?:\?.*)?$/

/**
 * A static host answers `/demo/` with `public/demo/index.html`; the dev server
 * only serves files by their full name, and would answer the 404 page instead.
 */
const demoIndex = {
  name: 'lumi-site-demo-index',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url && DEMO_INDEX_RE.test(request.url))
        request.url = `/demo/index.html${request.url.slice('/demo/'.length)}`
      next()
    })
  },
}

export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [react(), mdx()],
  markdown: {
    // MDX articles with code fences render through the remark pipeline.
    processor: unified(),
    // Both themes are emitted; site.css picks one from data-theme.
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
  vite: {
    plugins: [demoIndex],
    resolve: {
      conditions: ['lumi:source', 'module', 'browser', 'import', 'default'],
    },
  },
})
