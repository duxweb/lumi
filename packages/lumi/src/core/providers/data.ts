import type { HttpClient } from '../http'
import type { Filter, ID, Meta, Pagination, Sorter } from '../types'

export interface GetListParams {
  resource: string
  pagination?: Pagination | false
  sorters?: Sorter[]
  filters?: Filter[]
  meta?: Meta
  signal?: AbortSignal
}

export interface GetListResult<T = any> {
  /** The records of the page. */
  data: T[]
  /** How many records match, across all pages. */
  total: number
  /** The backend's whole answer. */
  raw?: unknown
}

export interface GetOneParams {
  resource: string
  id: ID
  meta?: Meta
  signal?: AbortSignal
}

export interface GetManyParams {
  resource: string
  ids: ID[]
  meta?: Meta
  signal?: AbortSignal
}

export interface CreateParams<V = any> {
  resource: string
  variables: V
  meta?: Meta
  signal?: AbortSignal
}

export interface CreateManyParams<V = any> {
  resource: string
  variables: V[]
  meta?: Meta
  signal?: AbortSignal
}

export interface UpdateParams<V = any> {
  resource: string
  id: ID
  variables: V
  meta?: Meta
  signal?: AbortSignal
}

export interface UpdateManyParams<V = any> {
  resource: string
  ids: ID[]
  variables: V
  meta?: Meta
  signal?: AbortSignal
}

export interface DeleteParams<V = any> {
  resource: string
  id: ID
  variables?: V
  meta?: Meta
  signal?: AbortSignal
}

export interface DeleteManyParams<V = any> {
  resource: string
  ids: ID[]
  variables?: V
  meta?: Meta
  signal?: AbortSignal
}

export const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type RequestMethod = typeof REQUEST_METHODS[number]

/** Whether a value is one of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. */
export function isRequestMethod(value: unknown): value is RequestMethod {
  return typeof value === 'string' && (REQUEST_METHODS as readonly string[]).includes(value)
}

export interface CustomParams {
  /** The endpoint, relative to the API root. */
  url: string
  /** `GET` by default. */
  method?: RequestMethod
  /** The request body; not allowed with `GET`. */
  payload?: unknown
  /** Query parameters. */
  query?: Record<string, unknown>
  filters?: Filter[]
  sorters?: Sorter[]
  headers?: Record<string, string>
  meta?: Meta
  signal?: AbortSignal
}

export interface SingleResult<T = any> {
  /** The record. */
  data: T
  /** The backend's whole answer. */
  raw?: unknown
}

export interface ManyResult<T = any> {
  /** The records. */
  data: T[]
  /** The backend's whole answer. */
  raw?: unknown
}

/**
 * Data + request provider (Lumi REST conventions, framework-agnostic).
 * All data access goes through this interface; it can be swapped for any REST / GraphQL / Mock implementation.
 */
export interface DataProvider {
  /** One page of a resource, filtered and sorted, or all of it with `pagination: false`; `total` counts every match. */
  getList: <T = any>(params: GetListParams) => Promise<GetListResult<T>>
  /** One record by id. */
  getOne: <T = any>(params: GetOneParams) => Promise<SingleResult<T>>
  /** Several records by id in one request; without it each id is read with `getOne`. */
  getMany?: <T = any>(params: GetManyParams) => Promise<ManyResult<T>>
  /** Creates a record from `variables` and answers the saved one. */
  create: <T = any, V = any>(params: CreateParams<V>) => Promise<SingleResult<T>>
  /** Creates several records in one request; without it they are created one by one. */
  createMany?: <T = any, V = any>(params: CreateManyParams<V>) => Promise<ManyResult<T>>
  /** Updates the record `id` with `variables` and answers the saved one. */
  update: <T = any, V = any>(params: UpdateParams<V>) => Promise<SingleResult<T>>
  /** Applies the same `variables` to several records; without it they are updated one by one. */
  updateMany?: <T = any, V = any>(params: UpdateManyParams<V>) => Promise<ManyResult<T>>
  /** Deletes the record `id`. */
  deleteOne: <T = any, V = any>(params: DeleteParams<V>) => Promise<SingleResult<T>>
  /** Deletes several records; without it they are deleted one by one. */
  deleteMany?: <T = any, V = any>(params: DeleteManyParams<V>) => Promise<ManyResult<T>>
  /** A request outside the resource conventions; the `request` action, `useCustom` and `useCustomMutation` need it. */
  custom?: <T = any>(params: CustomParams) => Promise<SingleResult<T>>
  /** The API root, for callers that build full addresses such as uploads. */
  getApiUrl?: () => string
  /** The client it sends through; uploads and the agent reuse its credentials. */
  http?: HttpClient
}

/**
 * Reads several records: through `getMany` when the provider has it, else one
 * `getOne` per id. Hooks and the JSON `Query` share it.
 */
export async function readMany<T = any>(provider: DataProvider, params: GetManyParams): Promise<ManyResult<T>> {
  if (provider.getMany)
    return provider.getMany<T>(params)
  const { ids, ...rest } = params
  const data = await Promise.all(ids.map(id => provider.getOne<T>({ ...rest, id }).then(result => result.data)))
  return { data }
}
