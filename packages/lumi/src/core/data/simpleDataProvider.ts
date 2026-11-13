import type { HttpClient, HttpClientOptions } from '../http.js'
import type {
  CreateParams,
  CustomParams,
  DataProvider,
  DeleteManyParams,
  DeleteParams,
  GetListParams,
  GetManyParams,
  GetOneParams,
  UpdateManyParams,
  UpdateParams,
} from '../providers/data'
import type { Filter, Sorter } from '../types'
import { createHttpClient } from '../http.js'

const TRAILING_SLASH_RE = /\/+$/
const EDGE_SLASHES_RE = /^\/+|\/+$/g

export interface SimpleDataProviderOptions {
  /** API root URL, e.g. https://api.example.com */
  apiUrl: string
  /**
   * The client requests go through, carrying the auth provider's credentials,
   * the locale and the tenant. Without one requests carry none of them.
   */
  http?: HttpClient
  /** Custom response unwrapping; defaults to the Lumi convention: data = body.data ?? body, total = body.meta.total */
  unwrap?: (body: any) => { data: any, total?: number, raw?: unknown }
  /**
   * Reads a failed answer's body into `{ message, code?, errors?: [{ path, message }] }`;
   * defaults to the Lumi convention. Field errors appear under the form's fields.
   */
  parseError?: HttpClientOptions['parseError']
  /**
   * Changes every request to this backend just before it leaves: extra or
   * rewritten headers, a signature over the method, URL and body. See
   * `HttpClientOptions.onRequest`.
   */
  onRequest?: HttpClientOptions['onRequest']
  /** Checks or rewrites every answer from this backend, e.g. verifies its signature. */
  onResponse?: HttpClientOptions['onResponse']
}

type QueryEntries = Array<[string, unknown]>

// Operators go in brackets, `field[operator]`; `eq` stays as the plain field.
// Entries preserve repeated constraints on the same field and array values.
function flattenFilters(filters?: Filter[]): QueryEntries {
  return (filters ?? []).map(filter => [
    filter.operator === 'eq' ? filter.field : `${filter.field}[${filter.operator}]`,
    filter.value,
  ])
}

// One `sort` entry, fields in order, a leading `-` for descending: `sort=-createdAt,name`.
function flattenSorters(sorters?: Sorter[]): QueryEntries {
  return sorters?.length ? [['sort', sorters.map(sorter => `${sorter.order === 'desc' ? '-' : ''}${sorter.field}`).join(',')]] : []
}

function metaEntries(meta?: Record<string, unknown>): QueryEntries {
  return Object.entries(meta ?? {})
}

const ONLY_DOTS_RE = /^\.+$/

function encodeId(id: string | number): string {
  const text = String(id)
  // An empty id would address the whole collection, and `.` or `..` another path.
  if (text === '' || ONLY_DOTS_RE.test(text))
    throw new Error(`[lumi] ${JSON.stringify(id)} is not a record id`)
  return encodeURIComponent(text)
}

/**
 * Default REST DataProvider — follows the Lumi REST conventions (framework-agnostic, fetch-based):
 * - List    GET    {apiUrl}/{resource}?page&pageSize&status=paid&total[gte]=100&sort=-createdAt,name
 * - Detail  GET    {apiUrl}/{resource}/{id}
 * - Create  POST   {apiUrl}/{resource} (there is no bulk create: hooks and imports send one request per record)
 * - Update  PUT    {apiUrl}/{resource}/{id}
 * - Delete  DELETE {apiUrl}/{resource}/{id}
 * - Credentials, locale and tenant come from `http`
 * - Response  { message?, data, meta:{ total } }, data is auto-unwrapped
 * - Errors    non-2xx { message, code?, errors?: [{ path, message, code? }] }
 */
export function createSimpleDataProvider(options: SimpleDataProviderOptions): DataProvider {
  const http = (options.http ?? createHttpClient()).extend({
    baseUrl: options.apiUrl.replace(TRAILING_SLASH_RE, ''),
    ...(options.parseError ? { parseError: options.parseError } : {}),
    ...(options.onRequest ? { onRequest: options.onRequest } : {}),
    ...(options.onResponse ? { onResponse: options.onResponse } : {}),
  })
  const unwrap = options.unwrap ?? ((body: any) => ({
    data: body?.data === undefined ? body : body.data,
    total: body?.meta?.total ?? 0,
    raw: body,
  }))

  const request = (
    method: string,
    path: string,
    query: QueryEntries,
    opts: { body?: unknown, headers?: Record<string, string>, signal?: AbortSignal } = {},
  ): Promise<any> => http.request(path.replace(EDGE_SLASHES_RE, ''), { method, query, ...opts })

  const provider: DataProvider = {
    getApiUrl: () => http.baseUrl,
    http,

    async getList<T = any>({ resource, pagination, filters, sorters, meta, signal }: GetListParams) {
      const query: QueryEntries = [
        ...flattenFilters(filters),
        ...flattenSorters(sorters),
        ...metaEntries(meta),
      ]
      if (pagination) {
        query.push(['page', pagination.page], ['pageSize', pagination.pageSize])
      }
      const body = await request('GET', resource, query, { signal })
      const r = unwrap(body)
      return { data: r.data as T[], total: r.total ?? 0, raw: r.raw }
    },

    async getOne<T = any>({ resource, id, meta, signal }: GetOneParams) {
      const body = await request('GET', `${resource}/${encodeId(id)}`, metaEntries(meta), { signal })
      return { data: unwrap(body).data as T, raw: body }
    },

    async getMany<T = any>({ resource, ids, meta, signal }: GetManyParams) {
      // No ids is no records; the request would otherwise list the whole resource.
      if (!ids.length)
        return { data: [] as T[] }
      const body = await request('GET', resource, [['ids', ids], ...metaEntries(meta)], { signal })
      return { data: unwrap(body).data as T[], raw: body }
    },

    async create<T = any>({ resource, variables, meta, signal }: CreateParams) {
      const body = await request('POST', resource, metaEntries(meta), { body: variables, signal })
      return { data: unwrap(body).data as T, raw: body }
    },

    async update<T = any>({ resource, id, variables, meta, signal }: UpdateParams) {
      const body = await request('PUT', `${resource}/${encodeId(id)}`, metaEntries(meta), { body: variables, signal })
      return { data: unwrap(body).data as T, raw: body }
    },

    async updateMany<T = any, V = any>({ resource, ids, variables, meta, signal }: UpdateManyParams<V>) {
      const data: T[] = []
      const raw: unknown[] = []
      for (const id of ids) {
        const result = await provider.update<T, V>({ resource, id, variables, meta, signal })
        data.push(result.data)
        raw.push(result.raw)
      }
      return { data, raw }
    },

    async deleteOne<T = any>({ resource, id, variables, meta, signal }: DeleteParams) {
      const body = await request('DELETE', `${resource}/${encodeId(id)}`, metaEntries(meta), { body: variables, signal })
      return { data: unwrap(body).data as T, raw: body }
    },

    async deleteMany<T = any, V = any>({ resource, ids, variables, meta, signal }: DeleteManyParams<V>) {
      const data: T[] = []
      const raw: unknown[] = []
      for (const id of ids) {
        const result = await provider.deleteOne<T, V>({ resource, id, variables, meta, signal })
        data.push(result.data)
        raw.push(result.raw)
      }
      return { data, raw }
    },

    async custom<T = any>({ url, method = 'GET', payload, query, filters, sorters, headers, meta, signal }: CustomParams) {
      if (method === 'GET' && payload !== undefined)
        throw new Error('[lumi] GET custom request cannot include a payload; use query instead')
      const q: QueryEntries = [
        ...Object.entries(query ?? {}),
        ...flattenFilters(filters),
        ...flattenSorters(sorters),
        ...metaEntries(meta),
      ]
      const body = await request(method, url, q, { body: payload, headers, signal })
      return { data: unwrap(body).data as T, raw: body }
    },
  }

  return provider
}
