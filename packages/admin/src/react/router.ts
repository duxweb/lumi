import type { RouterProvider } from '@duxweb/lumi'
import type { DataRouter } from 'react-router'

/** A query as a search string: an array repeats its key, null and undefined are left out. */
function querySearch(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null)
        params.append(key, String(item))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

function queryObject(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search)
  const result: Record<string, unknown> = {}
  params.forEach((value, key) => {
    const current = result[key]
    result[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value]
  })
  return result
}

/** A Lumi router provider over a react-router data router. */
export function createReactRouterProvider(router: DataRouter): RouterProvider {
  return {
    go(config) {
      const target = splitPath(config.to ?? router.state.location.pathname)
      void router.navigate({
        pathname: target.pathname,
        search: config.query ? querySearch(config.query) : target.search,
        hash: config.hash ?? target.hash,
      }, { replace: config.replace })
    },
    back() {
      void router.navigate(-1)
    },
    parse() {
      const location = router.state.location
      return { pathname: location.pathname, query: queryObject(location.search), params: { ...router.state.matches.at(-1)?.params } }
    },
    getCurrentPath() {
      const { pathname, search, hash } = router.state.location
      return `${pathname}${search}${hash}`
    },
    subscribe(listener) {
      return router.subscribe(listener)
    },
  }
}

function splitPath(path: string): { pathname: string, search?: string, hash?: string } {
  const hashIndex = path.indexOf('#')
  const hash = hashIndex === -1 ? undefined : path.slice(hashIndex)
  const pathAndSearch = hashIndex === -1 ? path : path.slice(0, hashIndex)
  const searchIndex = pathAndSearch.indexOf('?')
  return {
    pathname: searchIndex === -1 ? pathAndSearch : pathAndSearch.slice(0, searchIndex),
    search: searchIndex === -1 ? undefined : pathAndSearch.slice(searchIndex),
    hash,
  }
}
