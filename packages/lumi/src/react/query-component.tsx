import type { BaseComponentProps } from '@json-render/react'
import type { ReactNode } from 'react'
import type { QueryProps } from '../catalog/index.js'
import type { Filter } from '../core/index.js'
import { useStateStore } from '@json-render/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { queryPropsSchema } from '../catalog/index.js'
import {
  createQueryKey,
  customQueryKey,
  executeRequest,
  listQueryKey,
  oneQueryKey,
} from '../core/index.js'
import { normalizeResource } from '../core/path.js'
import { readMany } from '../core/providers/data.js'
import { useLumi } from './context.js'
import { useDataProviderName } from './data-scope.js'
import { useResourceLive } from './live.js'

const writers = new WeakMap<() => unknown, Map<string, object>>()

export function Query({
  props,
  children,
}: BaseComponentProps<QueryProps>): ReactNode {
  const options = queryPropsSchema.parse(props)
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const { set, getSnapshot } = useStateStore()
  const owner = useRef({})
  const { meta, operation, enabled } = options
  const resource = normalizeResource(options.resource)
  const dataProviderName = useDataProviderName(options.dataProviderName)
  const live = useResourceLive(resource, dataProviderName, {
    ...(options.liveMode ? { liveMode: options.liveMode } : {}),
    // A custom call is not a resource read; it keeps to the live mode it is given.
    ...(operation === 'custom' && !options.liveMode ? { liveMode: 'off' as const } : {}),
    ...(operation === 'one' && options.id !== undefined ? { ids: [options.id] } : operation === 'many' && options.ids ? { ids: options.ids } : {}),
    enabled: enabled !== false,
  })
  const params = {
    pagination: options.pagination,
    filters: options.filters,
    sorters: options.sorters,
    meta,
  }
  const custom = { url: options.url ?? resource, query: options.query, meta }
  const key
    = operation === 'list'
      ? listQueryKey(resource, params, dataProviderName)
      : operation === 'one'
        ? oneQueryKey(resource, options.id, meta, dataProviderName)
        : operation === 'custom'
          ? customQueryKey(custom, dataProviderName)
          : createQueryKey({
              resource,
              dataProviderName,
              action: 'many',
              params: { ids: options.ids, meta },
            })
  const result = useQuery({
    meta: live,
    queryKey: key,
    enabled:
      enabled !== false && (operation !== 'one' || options.id !== undefined),
    retry: false,
    queryFn: async ({ signal }) => {
      const provider = lumi.getDataProvider(dataProviderName)
      return executeRequest(lumi, async () => {
        if (operation === 'one') {
          if (options.id === undefined)
            throw new Error('[lumi] Query one requires id.')
          return await provider.getOne({
            resource,
            id: options.id,
            meta,
            signal,
          })
        }
        if (operation === 'many')
          return await readMany(provider, { resource, ids: options.ids ?? [], meta, signal })
        if (operation === 'custom') {
          if (!provider.custom)
            throw new Error('[lumi] DataProvider.custom is not configured.')
          return await provider.custom({ ...custom, signal })
        }
        return await provider.getList({
          resource,
          ...params,
          filters: options.filters as Filter[] | undefined,
          signal,
        })
      }, queryClient)
    },
  })
  useEffect(() => {
    let paths = writers.get(getSnapshot)
    if (!paths) {
      paths = new Map()
      writers.set(getSnapshot, paths)
    }
    if (paths.has(options.resultPath)) {
      throw new Error(
        `[lumi] Query resultPath already has a writer: ${options.resultPath}`,
      )
    }
    paths.set(options.resultPath, owner.current)
    return () => {
      paths.delete(options.resultPath)
    }
  }, [getSnapshot, options.resultPath])
  useEffect(() => {
    set(options.resultPath, {
      data: result.data?.data ?? (operation === 'list' || operation === 'many' ? [] : null),
      total: result.data && 'total' in result.data ? result.data.total : null,
      loading: result.isFetching,
      error: result.error ? { message: result.error.message } : null,
    })
  }, [set, options.resultPath, operation, result.data, result.isFetching, result.error])
  return children
}
