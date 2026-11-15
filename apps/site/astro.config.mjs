import process from 'node:process'
import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import { normalizeBase, withBase } from './paths.mjs'

const base = normalizeBase(process.env.LUMI_SITE_BASE)
const demoPath = `${base}demo/`

// Rebase Markdown links, images and reference definitions without touching
// fenced code examples, which describe paths in the reader's application.
function remarkSiteLinks() {
  return function visit(node) {
    if (['link', 'image', 'definition'].includes(node.type))
      node.url = withBase(node.url, base)
    for (const child of node.children ?? [])
      visit(child)
  }
}

/**
 * A static host answers `/demo/` with `public/demo/index.html`; the dev server
 * only serves files by their full name, and would answer the 404 page instead.
 */
const demoIndex = {
  name: 'lumi-site-demo-index',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === demoPath || request.url?.startsWith(`${demoPath}?`))
        request.url = `${demoPath}index.html${request.url.slice(demoPath.length)}`
      next()
    })
  },
}

export default defineConfig({
  site: process.env.LUMI_SITE_URL,
  base,
  devToolbar: { enabled: false },
  integrations: [react(), mdx()],
  markdown: {
    // MDX articles with code fences render through the remark pipeline.
    processor: unified({ remarkPlugins: [remarkSiteLinks] }),
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
