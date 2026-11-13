import type { CustomParams } from './providers/data'
import type { ID, Meta } from './types'
import { normalizeResource } from './path.js'

export type LumiQueryAction = 'list' | 'many' | 'aggregate' | 'infiniteList' | 'one' | 'custom' | 'select' | 'auditLog'
export type LumiQueryKey = readonly unknown[]

export interface LumiQueryKeyParams {
  dataProviderName?: string
  resource?: string
  action: LumiQueryAction
  params?: unknown
}

export type CustomQueryParams = Omit<CustomParams, 'signal'>

/** A custom request's params without their undefined entries, so equal requests share one cache key. */
export function normalizeCustomParams(params: CustomQueryParams): CustomQueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as CustomQueryParams
}

/** A Lumi query key: `['lumi', dataProviderName, resource, action, params]`. */
export function createQueryKey(params: LumiQueryKeyParams): LumiQueryKey {
  return [...resourceQueryKey(params.resource ?? '', params.dataProviderName), params.action, params.params ?? {}]
}

/** The prefix of every Lumi query key. */
export function lumiQueryKey(): LumiQueryKey {
  return ['lumi']
}

/** The prefix of one data provider's queries; `default` when unnamed. */
export function dataProviderQueryKey(dataProviderName?: string): LumiQueryKey {
  return [...lumiQueryKey(), dataProviderName ?? 'default']
}

/** The prefix of one resource's queries, which a write to it invalidates. */
export function resourceQueryKey(resource: string, dataProviderName?: string): LumiQueryKey {
  return [...dataProviderQueryKey(dataProviderName), normalizeResource(resource)]
}

/** A resource's audit log, under the resource so its writes refresh it too. */
export function auditLogQueryKey(resource: string, dataProviderName?: string, params?: Record<string, unknown>): LumiQueryKey {
  // Without params it is the prefix every audit log query of the resource shares.
  return params ? createQueryKey({ dataProviderName, resource, action: 'auditLog', params }) : [...resourceQueryKey(resource, dataProviderName), 'auditLog']
}

/** The action a Lumi query key was made for (`list`, `one`, ...), as createQueryKey places it. */
export function queryKeyAction(queryKey: readonly unknown[]): unknown {
  return queryKey[3]
}

/** The key of a list query, by its pagination, filters, sorters and meta. */
export function listQueryKey(resource: string, params: unknown, dataProviderName?: string): LumiQueryKey {
  return createQueryKey({ dataProviderName, resource, action: 'list', params })
}

/** The key of a list's aggregate query. */
export function aggregateQueryKey(resource: string, params: unknown, dataProviderName?: string): LumiQueryKey {
  return createQueryKey({ dataProviderName, resource, action: 'aggregate', params })
}

/** The key of one record's query. */
export function oneQueryKey(resource: string, id: ID | undefined, meta?: Meta, dataProviderName?: string): LumiQueryKey {
  return createQueryKey({ dataProviderName, resource, action: 'one', params: { id, meta } })
}

/** The key of a custom request, by every one of its params. */
export function customQueryKey(params: CustomQueryParams, dataProviderName?: string): LumiQueryKey {
  return createQueryKey({ dataProviderName, action: 'custom', params: normalizeCustomParams(params) })
}

/** Whether a key is the record query of one of `ids`, comparing ids as text. */
export function isOneQueryKeyForIds(queryKey: LumiQueryKey, ids: readonly ID[]): boolean {
  const params = queryKey[4]
  return queryKeyAction(queryKey) === 'one'
    && typeof params === 'object'
    && params !== null
    && 'id' in params
    // A route parameter is a string where the server's id may be a number.
    && ids.some(id => String(id) === String(params.id))
}
