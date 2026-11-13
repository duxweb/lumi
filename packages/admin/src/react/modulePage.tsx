import type { ComponentType, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router'

/** What a JavaScript page receives: the route's path params and its query. */
export interface AdminModulePageProps {
  params: Record<string, string | undefined>
  query: Record<string, string>
}

/** Turns a `page.module` URL into the component the route renders. */
export type AdminPageModuleLoader = (url: string) => Promise<ComponentType<AdminModulePageProps>>

/**
 * The default loader: `import()` the URL and render its default export. The
 * module must render with the app's own React, so this suits modules built
 * with the host; the prebuilt base hands its runtime to the default export
 * instead (see the modules guide).
 */
export const importPageModule: AdminPageModuleLoader = async (url) => {
  const loaded = await import(/* @vite-ignore */ url) as { default?: unknown }
  if (typeof loaded.default !== 'function')
    throw new Error(`[lumi-admin] page module ${url} has no default export component`)
  return loaded.default as ComponentType<AdminModulePageProps>
}

/** Loads each URL once; a failed load is forgotten so the next visit tries again. */
export function createPageModuleCache(load: AdminPageModuleLoader): AdminPageModuleLoader {
  const loaded = new Map<string, Promise<ComponentType<AdminModulePageProps>>>()
  return (url) => {
    let pending = loaded.get(url)
    if (!pending) {
      pending = load(url)
      pending.catch(() => loaded.delete(url))
      loaded.set(url, pending)
    }
    return pending
  }
}

/** A route whose page is a JavaScript module: loads it, then renders it with the route's params and query. */
export function AdminModulePage({ url, load }: { url: string, load: AdminPageModuleLoader }): ReactElement {
  const params = useParams()
  const { search } = useLocation()
  const [loaded, setLoaded] = useState<{ url: string, Page?: ComponentType<AdminModulePageProps>, error?: unknown }>()
  useEffect(() => {
    let active = true
    load(url).then(
      Page => active && setLoaded({ url, Page }),
      (error: unknown) => active && setLoaded({ url, error }),
    )
    return () => {
      active = false
    }
  }, [load, url])
  if (!loaded || loaded.url !== url)
    return <div role="status">Loading page…</div>
  if (!loaded.Page)
    return <div role="alert">{loaded.error instanceof Error ? loaded.error.message : 'Could not load page.'}</div>
  const { Page } = loaded
  return <Page params={params} query={Object.fromEntries(new URLSearchParams(search))} />
}
