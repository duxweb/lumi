import type { Filter, ID, Meta } from '../core/index.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sessionVersion } from '../core/services.js'
import { useLumi } from './context.js'
import { useScopedTarget } from './data-scope.js'
import { useInfiniteList, useMany } from './data.js'

export interface Option {
  label: string
  value: string | number | boolean
  disabled?: boolean
  description?: string
  /** Round avatar image; an empty string shows the label's initials. */
  avatar?: string
  /** Square thumbnail image. */
  image?: string
}

export interface UseSelectOptions {
  /** The resource the options come from. */
  resource: string
  dataProviderName?: string
  meta?: Meta
  /** Conditions every request carries. */
  filters?: Filter[]
  /** The field shown; the first of `label`, `name`, `title`, `id` with a value when left out. */
  labelField?: string
  /** The field used as the value; `id` by default. */
  valueField?: string
  /** A field shown as the option's second line. */
  descriptionField?: string
  /** A field holding the option's avatar image. */
  avatarField?: string
  /** A field holding the option's picture. */
  imageField?: string
  /** The field a search filters with `like`; without it there is no server search. */
  searchField?: string
  /** Fields of `deps` whose values filter the options with `eq`, e.g. the city list by `province`. */
  dependsOn?: string[]
  /** Options loaded per request. */
  pageSize?: number
  /** The chosen value or values; rows not on a loaded page are fetched by id so their labels show. */
  selected?: ID | ID[] | null
  /** Current values of the fields in `dependsOn`. */
  deps?: Record<string, unknown>
  /** A keyword kept by the caller; the options follow it when it changes. */
  search?: string
  /** `false` loads nothing, e.g. until the select opens. */
  enabled?: boolean
  /** Milliseconds a typed keyword waits before it is searched; 300 by default. */
  debounce?: number
}

export interface UseSelectResult {
  /** Rows of every loaded page, in server order. */
  options: Option[]
  /** The rows behind `selected`, fetched by id when they are not among the loaded pages. */
  selectedOptions: Option[]
  /** The first page of the current search is pending or loading. */
  loading: boolean
  /** A further page is loading. */
  loadingMore: boolean
  /** Whether more options remain on the server. */
  hasMore: boolean
  /** How many options match the search, when the server says. */
  total: number | undefined
  /** The keyword being searched. */
  keyword: string
  /** Searches for a keyword, from the first page. */
  search: (keyword: string) => void
  /** Loads the next page. */
  loadMore: () => void
  /** Replaces the dependency values, reloading the options. */
  setDeps: (values: Record<string, unknown>) => void
}

type RowFields = Pick<UseSelectOptions, 'labelField' | 'valueField' | 'descriptionField' | 'avatarField' | 'imageField'>

function resolveOptionText(row: Record<string, unknown>, fields: RowFields): string {
  const field = fields.labelField
  const value = field ? row[field] : row.label ?? row.name ?? row.title ?? row.id
  return String(value ?? '')
}

function optionValue(row: Record<string, unknown>, fields: RowFields): string | number | boolean {
  const value = row[fields.valueField ?? 'id']
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  return String(value ?? '')
}

function optionalText(row: Record<string, unknown>, field: string | undefined): string | undefined {
  if (!field)
    return undefined
  const value = row[field]
  return value === undefined || value === null ? undefined : String(value)
}

/** A record as a select option, by its label, value, description and image fields. */
export function rowToOption(row: Record<string, unknown>, fields: RowFields): Option {
  const option: Option = {
    label: resolveOptionText(row, fields),
    value: optionValue(row, fields),
  }
  const description = optionalText(row, fields.descriptionField)
  const image = optionalText(row, fields.imageField)
  if (description)
    option.description = description
  if (fields.avatarField)
    option.avatar = optionalText(row, fields.avatarField) ?? ''
  if (image)
    option.image = image
  return option
}

function selectedIds(value: ID | ID[] | null | undefined): ID[] {
  if (Array.isArray(value))
    return value
  return value === undefined || value === null || value === '' ? [] : [value]
}

function remoteFilters(source: UseSelectOptions, keyword: string, deps: Record<string, unknown>): Filter[] {
  const filters: Filter[] = [...source.filters ?? []]
  if (source.searchField && keyword)
    filters.push({ field: source.searchField, operator: 'like', value: keyword })
  for (const field of source.dependsOn ?? []) {
    const value = deps[field]
    if (value !== undefined && value !== null && value !== '')
      filters.push({ field, operator: 'eq', value })
  }
  return filters
}

/** Options of a remote select: loaded page by page from a resource, searched on the server, narrowed by other fields, with the selected rows fetched by id when they are not on a loaded page. */
export function useSelect(input: UseSelectOptions): UseSelectResult {
  const options = useScopedTarget(input)
  const source = options
  const [keyword, setKeyword] = useState(options.search ?? '')
  const [pending, setPending] = useState(false)
  const [internalDeps, setInternalDeps] = useState<Record<string, unknown>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const known = useRef({ target: '', options: new Map<string, Option>() })
  const enabled = options.enabled ?? true
  const deps = options.deps ?? internalDeps
  const { labelField, valueField, descriptionField, avatarField, imageField } = source
  const lumi = useLumi()
  // Labels learnt for one tenant or session are not another's.
  const target = `${lumi.tenantProvider?.get() ?? ''}:${sessionVersion(lumi)}:${source.dataProviderName ?? ''}:${source.resource}:${valueField ?? 'id'}`
  if (known.current.target !== target)
    known.current = { target, options: new Map() }

  useEffect(() => {
    setKeyword(options.search ?? '')
  }, [options.search])

  useEffect(() => () => {
    if (timer.current)
      clearTimeout(timer.current)
  }, [])

  const list = useInfiniteList<Record<string, unknown>>({
    resource: source.resource,
    dataProviderName: source.dataProviderName,
    meta: source.meta as Meta | undefined,
    pagination: { pageSize: source.pageSize ?? 20 },
    filters: remoteFilters(source, keyword, deps),
    enabled,
  })

  const listOptions = useMemo(() => {
    const fields = { labelField, valueField, descriptionField, avatarField, imageField }
    const byValue = new Map<string, Option>()
    for (const page of list.data?.pages ?? []) {
      for (const row of page.data) {
        const option = rowToOption(row, fields)
        byValue.set(String(option.value), option)
      }
    }
    for (const [key, option] of byValue)
      known.current.options.set(key, option)
    return [...byValue.values()]
  }, [list.data, labelField, valueField, descriptionField, avatarField, imageField])

  // Only ids with no known label are fetched, so picking a loaded row costs no request.
  const ids = selectedIds(options.selected)
  const missing = ids.filter(id => !known.current.options.has(String(id)))
  const many = useMany<Record<string, unknown>>({
    resource: source.resource,
    ids: missing,
    dataProviderName: source.dataProviderName,
    meta: source.meta as Meta | undefined,
    enabled: missing.length > 0 && enabled,
  })
  useMemo(() => {
    const fields = { labelField, valueField, descriptionField, avatarField, imageField }
    for (const row of many.data?.data ?? []) {
      const option = rowToOption(row, fields)
      known.current.options.set(String(option.value), option)
    }
  }, [many.data, labelField, valueField, descriptionField, avatarField, imageField])
  const selectedOptions = ids.flatMap((id) => {
    const option = known.current.options.get(String(id))
    return option ? [option] : []
  })

  const hasMore = Boolean(list.hasNextPage)
  return {
    options: listOptions,
    selectedOptions,
    loading: enabled && (pending || (list.isFetching && !list.isFetchingNextPage) || many.isFetching),
    loadingMore: list.isFetchingNextPage,
    hasMore,
    total: list.data?.pages.at(-1)?.total,
    keyword,
    search(value) {
      if (timer.current)
        clearTimeout(timer.current)
      if (value === keyword) {
        setPending(false)
        return
      }
      setPending(true)
      timer.current = setTimeout(() => {
        setPending(false)
        setKeyword(value)
      }, options.debounce ?? 300)
    },
    loadMore() {
      if (hasMore && !list.isFetching)
        void list.fetchNextPage()
    },
    setDeps(values) {
      setInternalDeps(values)
    },
  }
}
