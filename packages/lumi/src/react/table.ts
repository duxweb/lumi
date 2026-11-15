import type { UseQueryResult } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import type { Filter, RequestMethod, Sorter } from '../core/index.js'
import type { LiveOptions } from './live.js'
import { useStateStore } from '@json-render/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react'
import { aggregateQueryKey, executeRequest } from '../core/index.js'
import { useLumi } from './context.js'
import { useScopedTarget } from './data-scope.js'
import { useList } from './data.js'
import { liveOptions } from './live.js'
import { noSubscribe } from './subscribe.js'

export type TableAggregate = Record<string, number | string | readonly number[]>

export interface UseTableAggregateOptions {
  url: string
  method?: RequestMethod
  totalKey?: string
}

export interface UseTableOptions extends LiveOptions {
  /** The resource listed. */
  resource: string
  /** Where page, page size and sorters live in page state, so JSON elements can read them; a private path when left out. */
  statePath?: string
  /** The first page size, 10 by default; the table keeps page and size in its state from there. */
  pagination?: { pageSize?: number }
  /** Conditions of the list; a change returns to the first page. */
  filters?: Filter[]
  dataProviderName?: string
  meta?: Record<string, unknown>
  /** An endpoint answering totals for the same filters: `{ url, method?, totalKey? }`. */
  aggregate?: UseTableAggregateOptions
  /**
   * Keeps page, page size and sort in the address's query (`page`,
   * `pageSize`, `sort=field:asc,field2:desc`), so a reload, a shared link and
   * back/forward restore them. A string prefixes the parameter names, for
   * several synced tables on one page. Needs the context's routerProvider.
   */
  syncWithLocation?: boolean | string
}

export interface UseTableReturn<T = any> {
  /** The current page, counted from 1. */
  page: number
  /** Moves to another page. */
  setPage: Dispatch<SetStateAction<number>>
  /** Records per page. */
  pageSize: number
  /** Changes the page size. */
  setPageSize: Dispatch<SetStateAction<number>>
  /** The current sort, one entry per column. */
  sorters: Sorter[]
  /** Changes the sort. */
  setSorters: Dispatch<SetStateAction<Sorter[]>>
  /** The `useList` result behind the rows, for loading and error states. */
  query: ReturnType<typeof useList<T>>
  /** The records of the current page. */
  rows: T[]
  /** How many records match, across all pages. */
  total: number
  /** The aggregate request, when `aggregate` is set. */
  aggregateQuery?: UseQueryResult<{ data: TableAggregate }, Error>
  /** The aggregate's values, once they have loaded for the rows on screen. */
  aggregate?: TableAggregate
}

const SORT_ORDERS = new Set(['asc', 'desc'])

interface LocationTableState { page?: number, pageSize?: number, sorters?: Sorter[] }

function single(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first !== '' ? first : undefined
}

function positive(value: unknown): number | undefined {
  const number = Number(single(value))
  return Number.isInteger(number) && number > 0 ? number : undefined
}

/** `field:asc,other:desc`; entries that do not parse are dropped. */
function parseSort(value: unknown): Sorter[] | undefined {
  const text = single(value)
  if (!text)
    return undefined
  return text.split(',').flatMap((entry) => {
    const at = entry.lastIndexOf(':')
    const field = at === -1 ? entry : entry.slice(0, at)
    const order = at === -1 ? 'asc' : entry.slice(at + 1)
    return field && SORT_ORDERS.has(order) ? [{ field, order: order as Sorter['order'] }] : []
  })
}

function formatSort(sorters: readonly Sorter[]): string {
  return sorters.map(sorter => `${sorter.field}:${sorter.order}`).join(',')
}

function sameSorters(a: readonly Sorter[], b: readonly Sorter[]): boolean {
  return formatSort(a) === formatSort(b)
}

interface LocationSyncOptions {
  router: ReturnType<typeof useLumi>['routerProvider']
  store: ReturnType<typeof useStateStore>
  path: string
  names: { page: string, pageSize: string, sort: string }
  fromLocation: LocationTableState
  location: string
  page: number
  pageSize: number
  sorters: Sorter[]
  defaultPageSize: number
}

/**
 * Two-way sync between the table's store values and the address. A change of
 * address (back, forward, a link) moves the store; a change in the store
 * replaces the query in place, keeping the other parameters.
 */
function useLocationSync({ router, store, path, names, fromLocation, location, page, pageSize, sorters, defaultPageSize }: LocationSyncOptions): void {
  const written = useRef<string | undefined>(undefined)
  // Values sent to the router and not yet seen back: a router that navigates
  // asynchronously reports them later, after the reader may have moved on.
  const pending = useRef(new Set<string>())
  // The address moved without us: its values (or the defaults) win.
  useEffect(() => {
    if (!router || location === written.current)
      return
    const next = { page: fromLocation.page ?? 1, pageSize: fromLocation.pageSize ?? defaultPageSize, sorters: fromLocation.sorters ?? [] }
    const arrived = `${next.page}|${next.pageSize}|${formatSort(next.sorters)}`
    if (pending.current.delete(arrived)) {
      written.current = location
      return
    }
    pending.current.clear()
    if (written.current === undefined && fromLocation.page === undefined && fromLocation.pageSize === undefined && fromLocation.sorters === undefined)
      return
    if (store.get(`${path}/page`) !== next.page)
      store.set(`${path}/page`, next.page)
    if (store.get(`${path}/pageSize`) !== next.pageSize)
      store.set(`${path}/pageSize`, next.pageSize)
    if (!sameSorters((store.get(`${path}/sorters`) ?? []) as Sorter[], next.sorters))
      store.set(`${path}/sorters`, next.sorters)
    written.current = location
  }, [router, location])
  // The store moved: write it to the address, leaving defaults out.
  const sort = formatSort(sorters)
  useEffect(() => {
    if (!router)
      return
    const current = router.parse()
    // Every other parameter goes back as it was read, repeated keys included.
    const query: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(current.query ?? {})) {
      if (key !== names.page && key !== names.pageSize && key !== names.sort)
        query[key] = value
    }
    if (page !== 1)
      query[names.page] = String(page)
    if (pageSize !== defaultPageSize)
      query[names.pageSize] = String(pageSize)
    if (sort)
      query[names.sort] = sort
    const same = single(current.query?.[names.page]) === query[names.page]
      && single(current.query?.[names.pageSize]) === query[names.pageSize]
      && single(current.query?.[names.sort]) === query[names.sort]
    if (same) {
      written.current = router.getCurrentPath()
      return
    }
    const before = router.getCurrentPath()
    router.go({ query, replace: true })
    written.current = router.getCurrentPath()
    // Not there yet: the router navigates asynchronously.
    if (written.current === before)
      pending.current.add(`${page}|${pageSize}|${sort}`)
  }, [router, page, pageSize, sort])
}

/** The state of a list page: page, page size, sorters, the rows of the current page and an optional aggregate. The JSON `ListPage` is built on it. */
export function useTable<T = any>(input: UseTableOptions): UseTableReturn<T> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const store = useStateStore()
  const instance = useId()
  const path = options.statePath ?? `/__lumi/tables/${encodeURIComponent(instance + options.resource + (options.dataProviderName ?? ''))}`
  const defaultPageSize = options.pagination?.pageSize ?? 10
  const router = options.syncWithLocation ? lumi.routerProvider : undefined
  const prefix = typeof options.syncWithLocation === 'string' ? options.syncWithLocation : ''
  const names = { page: `${prefix}page`, pageSize: `${prefix}pageSize`, sort: `${prefix}sort` }
  const location = useSyncExternalStore(router?.subscribe ?? noSubscribe, () => router?.getCurrentPath() ?? '', () => '')
  const fromLocation = useMemo<LocationTableState>(() => {
    const query = router?.parse().query ?? {}
    return { page: positive(query[names.page]), pageSize: positive(query[names.pageSize]), sorters: parseSort(query[names.sort]) }
  }, [router, location, names.page, names.pageSize, names.sort])
  // Until the store has its own values the address supplies them, so the
  // first render already asks for the page the link names.
  const filterSignature = JSON.stringify(options.filters ?? [])
  const previousFilters = useRef(filterSignature)
  const page = previousFilters.current !== filterSignature ? 1 : (store.get(`${path}/page`) ?? fromLocation.page ?? 1) as number
  const pageSize = (store.get(`${path}/pageSize`) ?? fromLocation.pageSize ?? defaultPageSize) as number
  const sorters = (store.get(`${path}/sorters`) ?? fromLocation.sorters ?? []) as Sorter[]
  useLocationSync({ router, store, path, names, fromLocation, location, page, pageSize, sorters, defaultPageSize })
  const setter = <V>(key: string, fallback: V): Dispatch<SetStateAction<V>> => next => store.set(`${path}/${key}`, typeof next === 'function' ? (next as (current: V) => V)((store.get(`${path}/${key}`) ?? fallback) as V) : next)
  const setPage = setter('page', 1)
  const setPageSize = setter('pageSize', defaultPageSize)
  const setSorters = setter<Sorter[]>('sorters', [])
  useEffect(() => {
    if (previousFilters.current !== filterSignature) {
      previousFilters.current = filterSignature
      store.set(`${path}/page`, 1)
    }
  }, [filterSignature, path, store.set])
  const filterSnapshot = useMemo(() => structuredClone(options.filters ?? []), [filterSignature])
  const query = useList<T>({
    resource: options.resource,
    pagination: { page, pageSize },
    filters: filterSnapshot,
    sorters,
    dataProviderName: options.dataProviderName,
    meta: options.meta,
    // Rows and aggregate refetch together when the resource changes; see useList.
    ...liveOptions(options),
  })
  const aggregateQuery = useQuery<{ data: TableAggregate }, Error>({
    queryKey: aggregateQueryKey(options.resource, { filters: filterSnapshot, meta: options.meta, url: options.aggregate?.url, method: options.aggregate?.method }, options.dataProviderName),
    enabled: Boolean(options.aggregate),
    retry: false,
    queryFn: async ({ signal }) => {
      const dataProvider = lumi.getDataProvider(options.dataProviderName)
      if (!dataProvider.custom)
        throw new Error('[lumi] dataProvider.custom is required for table aggregate queries')
      return executeRequest(lumi, () => dataProvider.custom!<TableAggregate>({ url: options.aggregate!.url, method: options.aggregate!.method, filters: filterSnapshot, meta: options.meta, signal }), queryClient)
    },
  })
  // Rows, total and aggregate are one snapshot: while either query is still
  // answering for new params, the last snapshot they agreed on stays on screen,
  // so a filter change neither blanks the list nor mixes old stats with new rows.
  // An aggregate that failed has answered too: the rows go on without it,
  // rather than staying on the last snapshot for as long as it keeps failing.
  const aggregateFailed = aggregateQuery.isError
  const settled = query.isSuccess && !query.isPlaceholderData && !query.isFetching
    && (!options.aggregate || (!aggregateQuery.isFetching && (aggregateFailed || (aggregateQuery.isSuccess && !aggregateQuery.isPlaceholderData))))
  const snapshot = useRef<{ rows: T[], total: number, aggregate?: TableAggregate }>(undefined)
  // A reset (tenant switch, sign-out) empties the query; the old snapshot
  // belongs to the previous tenant or session and must not stay on screen.
  if (query.data === undefined)
    snapshot.current = undefined
  if (settled) {
    const total = query.data.total ?? 0
    snapshot.current = {
      rows: query.data.data,
      total,
      aggregate: options.aggregate && aggregateQuery.data && !aggregateFailed
        ? { ...aggregateQuery.data.data, ...(options.aggregate.totalKey ? { [options.aggregate.totalKey]: total } : {}) }
        : undefined,
    }
  }
  const shown = snapshot.current
  const rows = shown?.rows ?? query.data?.data ?? []
  const total = shown?.total ?? query.data?.total ?? 0
  const aggregate = shown?.aggregate

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    sorters,
    setSorters,
    query,
    rows,
    total,
    aggregateQuery: options.aggregate ? aggregateQuery : undefined,
    aggregate,
  }
}
