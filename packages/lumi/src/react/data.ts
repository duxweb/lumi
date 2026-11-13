import type {
  InfiniteData,
  QueryClient,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query'
import type {
  CreateParams,
  CustomParams,
  DataProvider,
  DeleteManyParams,
  DeleteParams,
  Filter,
  GetListResult,
  GetManyParams,
  GetOneParams,
  ID,
  ManyResult,
  Meta,
  MutationMode,
  Pagination,
  SingleResult,
  Sorter,
  UpdateManyParams,
  UpdateParams,
  WriteOptions,
} from '../core/index.js'
import type { LiveOptions } from './live.js'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { toastError } from '../core/feedback.js'
import {
  dataProviderQueryKey,
  executeMutation,
  executeRequest,
  executeWrite,
  lumiQueryKey,
  resolveDataTarget,
} from '../core/index.js'
import { readMany } from '../core/providers/data.js'
import { useLumi } from './context.js'
import { useDataProviderName, useScopedTarget } from './data-scope.js'
import { invalidateResourceQueries } from './invalidation.js'
import { liveOptions, useResourceLive } from './live.js'
import {
  createQueryKey,
  customQueryKey,
  listQueryKey,
  normalizeCustomParams,
  oneQueryKey,
} from './query.js'
import { queryResets } from './tenant.js'

export interface BaseDataOptions {
  dataProviderName?: string
  meta?: Meta
}

export interface UseListOptions extends BaseDataOptions, LiveOptions {
  resource: string
  /** `{ page, pageSize }`, pages counted from 1; `false` asks for every record. */
  pagination?: Pagination | false
  filters?: Filter[]
  sorters?: Sorter[]
  enabled?: boolean
}

export interface UseOneOptions extends BaseDataOptions, LiveOptions {
  resource: string
  /** The record to read; nothing is sent while it is undefined. */
  id: ID | undefined
  enabled?: boolean
}

export interface UseManyOptions extends BaseDataOptions, LiveOptions {
  resource: string
  /** The records to read. */
  ids: ID[]
  enabled?: boolean
}

export interface UseInfiniteListOptions extends Omit<
  UseListOptions,
  'pagination'
> {
  pagination?: { pageSize?: number }
}

export interface UseCustomOptions
  extends BaseDataOptions, Omit<CustomParams, 'meta' | 'signal'> {
  enabled?: boolean
}

export interface MutationOptions<
  TData = unknown,
  TVariables = unknown,
> extends BaseDataOptions {
  /** The resource written to; its lists, records and aggregates refetch after a success. */
  resource: string
  /**
   * Updates and deletes only: `optimistic` shows the change at once and rolls
   * it back on failure; `undoable` also waits `undoableTimeout` with an Undo
   * notice before sending (Undo rejects with MutationUndoneError, unreported).
   * Defaults to the context's `mutationMode`, else `pessimistic`.
   */
  mutationMode?: MutationMode
  /** Milliseconds an `undoable` write waits for Undo before it is sent; 5000 by default. */
  undoableTimeout?: number
  /** Called with the saved data once the write succeeded. */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>
  /** Replaces the default report: without it a failure is shown as a danger toast. */
  onError?: (error: Error, variables: TVariables) => void | Promise<void>
}

interface MutationTargetSnapshot {
  resource?: string
  dataProviderName?: string
  meta?: Meta
}

const MUTATION_TARGET_META = 'lumiDataTarget'

function getMutationTarget(
  meta: Record<string, unknown> | undefined,
): MutationTargetSnapshot {
  const target = meta?.[MUTATION_TARGET_META]
  if (!target || typeof target !== 'object')
    throw new Error('[lumi] mutation target is missing')
  return target as MutationTargetSnapshot
}

function resolveResource(
  lumi: ReturnType<typeof useLumi>,
  resource: string,
  dataProviderName?: string,
): { dp: DataProvider, path: string } {
  const target = resolveDataTarget(lumi, { resource, dataProviderName })
  return {
    dp: target.dataProvider,
    path: target.resource,
  }
}

/** The TanStack `QueryClient` Lumi caches in, for direct cache work. */
export function useClient(): QueryClient {
  return useQueryClient()
}

/** Returns `invalidate({ resource?, dataProviderName? })`: refetches a resource's queries, a whole data provider's without `resource`, or every Lumi query without either; like the `invalidate` action. */
export function useInvalidate(): (params: {
  resource?: string
  dataProviderName?: string
}) => Promise<void> {
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const scoped = useDataProviderName()
  return useCallback(
    async (input) => {
      // Unnamed, like the other hooks, it means the scope's provider.
      const params = { ...input, dataProviderName: input.dataProviderName ?? scoped }
      if (params.resource === undefined) {
        if (params.dataProviderName)
          lumi.getDataProvider(params.dataProviderName)
        await queryClient.invalidateQueries({
          queryKey: params.dataProviderName
            ? dataProviderQueryKey(params.dataProviderName)
            : lumiQueryKey(),
        })
        return
      }
      await invalidateResourceQueries(
        queryClient,
        lumi,
        params.resource,
        params.dataProviderName,
      )
    },
    [lumi, queryClient, scoped],
  )
}

/** Reads one page of a resource through `getList`. While the next page or filter loads, the rows of the previous one stay on screen. */
export function useList<T = any>(
  input: UseListOptions,
): UseQueryResult<GetListResult<T>, Error> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const live = useResourceLive(options.resource, options.dataProviderName, { ...liveOptions(options), enabled: options.enabled })
  const queryClient = useQueryClient()
  const keyParams = {
    pagination: options.pagination,
    filters: options.filters,
    sorters: options.sorters,
    meta: options.meta,
  }
  // The tenant reset count at which rows last arrived from the server.
  const loadedAt = useRef(queryResets(queryClient))

  const result = useQuery<GetListResult<T>, Error>({
    meta: live,
    queryKey: listQueryKey(
      options.resource,
      keyParams,
      options.dataProviderName,
    ),
    enabled: options.enabled ?? true,
    retry: false,
    // A new page, filter or sort keeps the current rows on screen until the
    // next ones arrive, instead of blanking the list to its empty state.
    // Never across a tenant switch: those rows belong to the other tenant.
    placeholderData: (previous: GetListResult<T> | undefined) => (loadedAt.current === queryResets(queryClient) ? previous : undefined),
    queryFn: ({ signal }) => {
      const { dp, path } = resolveResource(
        lumi,
        options.resource,
        options.dataProviderName,
      )
      return executeRequest(lumi, () =>
        dp.getList<T>({
          resource: path,
          pagination: options.pagination,
          filters: options.filters,
          sorters: options.sorters,
          meta: options.meta,
          signal,
        }), queryClient)
    },
  })
  if (result.isSuccess && !result.isPlaceholderData)
    loadedAt.current = queryResets(queryClient)
  return result
}

/** Reads a resource page after page for "load more" lists: `fetchNextPage()` loads the next, `data.pages` holds those loaded. */
export function useInfiniteList<T = any>(
  input: UseInfiniteListOptions,
): UseInfiniteQueryResult<InfiniteData<GetListResult<T>>, Error> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const live = useResourceLive(options.resource, options.dataProviderName, { ...liveOptions(options), enabled: options.enabled })
  const queryClient = useQueryClient()
  const pageSize = options.pagination?.pageSize ?? 10

  return useInfiniteQuery({
    meta: live,
    queryKey: createQueryKey({
      dataProviderName: options.dataProviderName,
      resource: options.resource,
      action: 'infiniteList',
      params: {
        pageSize,
        filters: options.filters,
        sorters: options.sorters,
        meta: options.meta,
      },
    }),
    initialPageParam: 1,
    enabled: options.enabled ?? true,
    retry: false,
    queryFn: ({ pageParam, signal }) => {
      const { dp, path } = resolveResource(
        lumi,
        options.resource,
        options.dataProviderName,
      )
      return executeRequest(lumi, () =>
        dp.getList<T>({
          resource: path,
          pagination: { page: Number(pageParam), pageSize },
          filters: options.filters,
          sorters: options.sorters,
          meta: options.meta,
          signal,
        }), queryClient)
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded < lastPage.total ? pages.length + 1 : undefined
    },
  })
}

/** Reads one record through `getOne`; sends nothing while `id` is undefined. */
export function useOne<T = any>(
  input: UseOneOptions,
): UseQueryResult<SingleResult<T>, Error> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const live = useResourceLive(options.resource, options.dataProviderName, { ...liveOptions(options), ...(options.id !== undefined ? { ids: [options.id] } : {}), enabled: (options.enabled ?? true) && options.id !== undefined })
  const queryClient = useQueryClient()

  return useQuery({
    meta: live,
    queryKey: oneQueryKey(
      options.resource,
      options.id,
      options.meta,
      options.dataProviderName,
    ),
    enabled: options.id !== undefined && (options.enabled ?? true),
    retry: false,
    queryFn: ({ signal }) => {
      if (options.id === undefined)
        throw new Error('[lumi] useOne requires an id')
      const { dp, path } = resolveResource(
        lumi,
        options.resource,
        options.dataProviderName,
      )
      return executeRequest(lumi, () =>
        dp.getOne<T>({
          resource: path,
          id: options.id!,
          meta: options.meta,
          signal,
        }), queryClient)
    },
  })
}

/** Reads several records by id: one `getMany` call when the provider has it, else one `getOne` per id. */
export function useMany<T = any>(
  input: UseManyOptions,
): UseQueryResult<ManyResult<T>, Error> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const live = useResourceLive(options.resource, options.dataProviderName, { ...liveOptions(options), ids: options.ids, enabled: options.enabled })
  const queryClient = useQueryClient()

  return useQuery({
    meta: live,
    queryKey: createQueryKey({
      dataProviderName: options.dataProviderName,
      resource: options.resource,
      action: 'many',
      params: { ids: options.ids, meta: options.meta },
    }),
    enabled: options.ids.length > 0 && (options.enabled ?? true),
    retry: false,
    queryFn: async ({ signal }) => {
      const { dp, path } = resolveResource(
        lumi,
        options.resource,
        options.dataProviderName,
      )
      return executeRequest(lumi, () => readMany<T>(dp, { resource: path, ids: options.ids, meta: options.meta, signal }), queryClient)
    },
  })
}

/** Reads from an endpoint outside the resource conventions through the provider's `custom`; cached by every parameter. */
export function useCustom<T = any>(
  input: UseCustomOptions,
): UseQueryResult<SingleResult<T>, Error> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const {
    enabled: _enabled,
    dataProviderName: _dataProviderName,
    ...requestOptions
  } = options
  const params = normalizeCustomParams(requestOptions)

  return useQuery({
    queryKey: customQueryKey(params, options.dataProviderName),
    enabled: options.enabled ?? true,
    retry: false,
    queryFn: ({ signal }) => {
      const dp = lumi.getDataProvider(options.dataProviderName)
      if (!dp.custom)
        throw new Error('[lumi] dataProvider.custom is not implemented')
      return executeRequest(lumi, () => dp.custom!<T>({ ...params, signal }), queryClient)
    },
  })
}

function useDataMutation<TData extends object, TVariables>(
  options: MutationOptions<TData, TVariables>,
  mutationFn: (
    dp: DataProvider,
    path: string,
    variables: TVariables,
    meta?: Meta,
  ) => Promise<TData>,
  write: (variables: TVariables) => Pick<WriteOptions<TData>, 'operation' | 'ids' | 'values'>,
): UseMutationResult<TData, Error, TVariables> {
  options = useScopedTarget(options)
  const lumi = useLumi()
  const queryClient = useQueryClient()

  return useMutation({
    meta: {
      [MUTATION_TARGET_META]: {
        resource: options.resource,
        dataProviderName: options.dataProviderName,
        meta: options.meta,
      } satisfies MutationTargetSnapshot,
    },
    mutationFn: async (variables: TVariables, context) => {
      const target = getMutationTarget(context.meta)
      const { dp, path } = resolveResource(
        lumi,
        target.resource!,
        target.dataProviderName,
      )
      return executeWrite(lumi, queryClient, {
        ...write(variables),
        resource: target.resource!,
        dataProviderName: target.dataProviderName,
        meta: target.meta,
        mutationMode: options.mutationMode,
        undoableTimeout: options.undoableTimeout,
        request: () => mutationFn(dp, path, variables, target.meta),
      })
    },
    onSuccess: async (data, variables) => {
      await options.onSuccess?.(data, variables)
    },
    onError: async (error, variables) => {
      if (options.onError)
        await options.onError(error, variables)
      else
        toastError(lumi, error)
    },
  })
}

/** Creates a record through `create`, then refetches the resource's queries. Returns a mutation: `mutate(values)`. */
export function useCreate<T = any, V = any>(
  options: MutationOptions<SingleResult<T>, V>,
): UseMutationResult<SingleResult<T>, Error, V> {
  return useDataMutation(options, (dp, path, variables, meta) =>
    dp.create<T, V>({ resource: path, variables, meta }), variables => ({ operation: 'create', values: variables }))
}

/** Creates several records: one `createMany` call when the provider has it, else one `create` per record. */
export function useCreateMany<T = any, V = any>(
  options: MutationOptions<ManyResult<T>, V[]>,
): UseMutationResult<ManyResult<T>, Error, V[]> {
  return useDataMutation(options, (dp, path, variables, meta) =>
    dp.createMany
      ? dp.createMany<T, V>({ resource: path, variables, meta })
      : Promise.all(
          variables.map(item =>
            dp
              .create<T, V>({ resource: path, variables: item, meta })
              .then(result => result.data),
          ),
        ).then(data => ({ data })), variables => ({ operation: 'createMany', values: variables }))
}

export interface UpdateVariables<V = any> extends Pick<
  UpdateParams<V>,
  'id' | 'variables'
> {}

/** Updates a record through `update`, then refetches the resource's queries: `mutate({ id, variables })`. */
export function useUpdate<T = any, V = any>(
  options: MutationOptions<SingleResult<T>, UpdateVariables<V>>,
): UseMutationResult<SingleResult<T>, Error, UpdateVariables<V>> {
  return useDataMutation(options, (dp, path, variables, meta) =>
    dp.update<T, V>({
      resource: path,
      id: variables.id,
      variables: variables.variables,
      meta,
    }), variables => ({ operation: 'update', ids: [variables.id], values: variables.variables }))
}

export interface UpdateManyVariables<V = any> extends Pick<
  UpdateManyParams<V>,
  'ids' | 'variables'
> {}

/** Applies the same values to several records: `updateMany` when the provider has it, else one `update` per id. */
export function useUpdateMany<T = any, V = any>(
  options: MutationOptions<ManyResult<T>, UpdateManyVariables<V>>,
): UseMutationResult<ManyResult<T>, Error, UpdateManyVariables<V>> {
  return useDataMutation(options, (dp, path, variables, meta) =>
    dp.updateMany
      ? dp.updateMany<T, V>({
          resource: path,
          ids: variables.ids,
          variables: variables.variables,
          meta,
        })
      : Promise.all(
          variables.ids.map(id =>
            dp
              .update<T, V>({
                resource: path,
                id,
                variables: variables.variables,
                meta,
              })
              .then(result => result.data),
          ),
        ).then(data => ({ data })), variables => ({ operation: 'updateMany', ids: variables.ids, values: variables.variables }))
}

export type DeleteVariables<V = any> = Pick<
  DeleteParams<V>,
  'id' | 'variables'
>

/** Deletes a record through `deleteOne`, then refetches the resource's queries: `mutate({ id })`. */
export function useDelete<T = any, V = any>(
  options: MutationOptions<SingleResult<T>, DeleteVariables<V>>,
): UseMutationResult<SingleResult<T>, Error, DeleteVariables<V>> {
  return useDataMutation(
    options,
    (dp, path, variables, meta) =>
      dp.deleteOne<T, V>({
        resource: path,
        id: variables.id,
        variables: variables.variables,
        meta,
      }),
    variables => ({ operation: 'delete', ids: [variables.id] }),
  )
}

export type DeleteManyVariables<V = any> = Pick<
  DeleteManyParams<V>,
  'ids' | 'variables'
>

/** Deletes several records: `deleteMany` when the provider has it, else one `deleteOne` per id. */
export function useDeleteMany<T = any, V = any>(
  options: MutationOptions<ManyResult<T>, DeleteManyVariables<V>>,
): UseMutationResult<ManyResult<T>, Error, DeleteManyVariables<V>> {
  return useDataMutation(
    options,
    (dp, path, variables, meta) =>
      dp.deleteMany
        ? dp.deleteMany<T, V>({
            resource: path,
            ids: variables.ids,
            variables: variables.variables,
            meta,
          })
        : Promise.all(
            variables.ids.map(id =>
              dp
                .deleteOne<T, V>({
                  resource: path,
                  id,
                  variables: variables.variables,
                  meta,
                })
                .then(result => result.data),
            ),
          ).then(data => ({ data })),
    variables => ({ operation: 'deleteMany', ids: variables.ids }),
  )
}

/** Writes through the provider's `custom`: `build` turns the mutation's variables into the request, and `resource`, when given, is refetched after it succeeds. */
export function useCustomMutation<T = any, V = any>(
  options: Omit<MutationOptions<SingleResult<T>, V>, 'resource'> & {
    resource?: string
    build: (variables: V) => Omit<CustomParams, 'signal'>
  },
): UseMutationResult<SingleResult<T>, Error, V> {
  options = useScopedTarget(options)
  const lumi = useLumi()
  const queryClient = useQueryClient()

  return useMutation({
    meta: {
      [MUTATION_TARGET_META]: {
        resource: options.resource,
        dataProviderName: options.dataProviderName,
        meta: options.meta,
      } satisfies MutationTargetSnapshot,
    },
    mutationFn: async (variables: V, context) => {
      const target = getMutationTarget(context.meta)
      const dp = lumi.getDataProvider(target.dataProviderName)
      if (!dp.custom)
        throw new Error('[lumi] dataProvider.custom is not implemented')
      const request = options.build(variables)
      return executeMutation(
        lumi,
        queryClient,
        () =>
          dp.custom!<T>({
            ...request,
            meta: request.meta ?? target.meta,
          }),
        target,
      )
    },
    onSuccess: async (data, variables) => {
      await options.onSuccess?.(data, variables)
    },
    onError: async (error, variables) => {
      if (options.onError)
        await options.onError(error, variables)
      else
        toastError(lumi, error)
    },
  })
}

export type {
  CreateParams,
  DeleteParams,
  GetManyParams,
  GetOneParams,
  UpdateParams,
}
