import type { LumiContext, LumiJsonLoader } from '@duxweb/lumi'
import type { ThemeConfig } from '@duxweb/lumi-ui'
import type { Catalog, Spec } from '@json-render/core'
import type { AdminManifest, AdminPagesSource } from '../catalog.js'
import { createJsonLoader, createSpecLoader, validateConfig } from '@duxweb/lumi'
import { themeConfigSchema } from '@duxweb/lumi-ui/catalog'
import { createManifestLoader, resolveAdminSource } from '../catalog.js'

const PAGE_SCHEME = 'lumi-page:'
const SCHEME_RE = /^[a-z][a-z\d+.-]*:/i

interface DocumentOptions {
  context: LumiContext
  manifest: string | AdminManifest
  cacheKey?: string
  pages?: AdminPagesSource
  packKey?: string
  manifestLoader?: LumiJsonLoader<AdminManifest>
  specLoader?: LumiJsonLoader<Spec>
  themeLoader?: LumiJsonLoader<ThemeConfig>
  theme?: string | ThemeConfig
}

/** Transport and cache policy shared by routes, drawers, includes and bootstrap. */
export function createAdminDocuments(options: DocumentOptions, catalog: Catalog): {
  manifestLoader: LumiJsonLoader<AdminManifest>
  specLoader: LumiJsonLoader<Spec>
  themeLoader: LumiJsonLoader<ThemeConfig>
  cacheKey: () => string
  pageAddress: (src: string) => string
  invalidate: () => void
} {
  const loaderOptions = {
    baseURL: typeof location === 'undefined' ? undefined : location.href,
    fetcher: pageFetch(options.context, options.pages, signedLoaderFetch(options.context)),
    ...(options.packKey ? { packKey: options.packKey } : {}),
  }
  const manifestLoader = options.manifestLoader ?? createManifestLoader(catalog, loaderOptions)
  const specLoader = options.specLoader ?? createSpecLoader(catalog, loaderOptions)
  const themeLoader = options.themeLoader ?? createJsonLoader<ThemeConfig>(value => validateConfig(value, themeConfigSchema), loaderOptions)
  return {
    manifestLoader,
    specLoader,
    themeLoader,
    cacheKey: () => options.context.session.cacheKey(options.cacheKey),
    pageAddress: (src: string): string => options.pages && isProxiedPage(src) ? `${PAGE_SCHEME}${src}` : resolveAdminSource(src, options.manifest),
    invalidate() {
      specLoader.invalidate()
      if (typeof options.manifest === 'string')
        manifestLoader.invalidate(options.manifest)
      if (typeof options.theme === 'string')
        themeLoader.invalidate(options.theme)
    },
  }
}

/** A page `src` the backend serves in proxy mode: anything but a full or protocol-relative URL. */
function isProxiedPage(src: string): boolean {
  return !SCHEME_RE.test(src) && !src.startsWith('//')
}

/**
 * The loader's fetch: a proxied page asks `pages.endpoint` for its `path`
 * through the default data provider and answers with the unwrapped document;
 * everything else goes to `fallback`.
 */
function pageFetch(context: LumiContext, pages: AdminPagesSource | undefined, fallback: typeof fetch): typeof fetch {
  if (!pages)
    return fallback
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (!url.startsWith(PAGE_SCHEME))
      return fallback(input, init)
    const provider = context.getDataProvider()
    if (!provider.custom)
      throw new Error('[lumi-admin] `pages` needs a data provider with `custom`')
    const method = pages.method ?? 'POST'
    const values = { ...pages.data, path: url.slice(PAGE_SCHEME.length) }
    const signal = init?.signal ?? undefined
    try {
      const result = await provider.custom({ url: pages.endpoint, method, ...(method === 'GET' ? { query: values } : { payload: values }), ...(signal ? { signal } : {}) })
      return new Response(JSON.stringify(result.data), { headers: { 'Content-Type': 'application/json' } })
    }
    catch (error) {
      const status = (error as { status?: unknown }).status
      // A refused page reads as the HTTP failure it was, not as a network error.
      if (!signal?.aborted && typeof status === 'number' && status >= 400 && status < 600)
        return new Response(null, { status })
      throw error
    }
  }) as typeof fetch
}

/**
 * Manifests, pages and themes a backend serves per reader (menus by role,
 * pages by tenant) need the reader's credentials. Requests to the page's own
 * origin or the API's go through the app's signed client; any other origin
 * gets a plain fetch, so a token never reaches a CDN or a third party.
 */
function signedLoaderFetch(context: LumiContext): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const here = typeof location === 'undefined' ? 'http://lumi.invalid/' : location.href
    const url = new URL(String(input instanceof Request ? input.url : input), here)
    const page = typeof location === 'undefined' ? undefined : location.origin
    // A rooted API (`/api`) is this site's: resolved against the page, never
    // against the address being fetched, or every site would count as the API.
    const api = context.http.baseUrl ? new URL(context.http.url(''), here).origin : page
    if (url.origin !== page && url.origin !== api)
      return globalThis.fetch(input, init)
    return context.http.fetch(url.href, init)
  }) as typeof fetch
}
