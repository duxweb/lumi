import type { ID, Meta, Pagination } from '../types'
import type { DataProvider } from './data'

/** What a write did, as the app reports it after the server accepted it. */
export interface AuditLogEvent {
  /** `create`, `update`, `delete`, the `*Many` forms, `import`, or an app's own name. */
  action: string
  /** The resource written to. */
  resource: string
  /** The record ids the write touched, when known. */
  ids?: ID[]
  /** The values sent; for an import, its counts. */
  data?: unknown
  /** The write's own `meta`. */
  meta?: Meta
}

/** A recorded event, as the log lists it. */
export interface AuditLogEntry extends AuditLogEvent {
  id: ID
  /** ISO time the server recorded it. */
  createdAt?: string
  /** Who did it, as the server knows them. */
  author?: { id?: ID, name?: string, avatar?: string }
  /** A name a reader gave the entry, such as a release note. */
  name?: string
}

export interface AuditLogListParams {
  /** The resource whose history is listed. */
  resource: string
  /** Entries of one record only. */
  id?: ID
  pagination?: Pagination
  meta?: Meta
  signal?: AbortSignal
}

/**
 * Records writes and lists them. Optional: without one nothing is recorded,
 * and a backend that keeps its own log only needs `get`.
 */
export interface AuditLogProvider {
  /** Records one accepted write. */
  create?: (event: AuditLogEvent) => Promise<unknown> | void
  /** Lists the entries of a resource, or of one record with `id`. */
  get?: (params: AuditLogListParams) => Promise<{ data: AuditLogEntry[], total?: number }>
  /** Names an entry, e.g. with a release note. */
  update?: (params: { id: ID, name: string }) => Promise<unknown>
}

export interface DataAuditLogProviderOptions {
  /** The provider holding the log, or a function returning it when each call is made. */
  dataProvider: DataProvider | (() => DataProvider)
  /** The log's own resource on the backend. */
  resource?: string
}

/**
 * A log kept as one more resource of the DataProvider: events are created in
 * it, and listed with `resource` and `recordId` filters, newest first. A
 * write to one record also carries that record as `recordId`, so its history
 * is one plain filter; bulk writes keep their `ids` only.
 */
export function createDataAuditLogProvider({ dataProvider: source, resource = 'audit-logs' }: DataAuditLogProviderOptions): AuditLogProvider {
  const provider = (): DataProvider => typeof source === 'function' ? source() : source
  return {
    create: event => provider().create({ resource, variables: event.ids?.length === 1 ? { ...event, recordId: String(event.ids[0]) } : event }),
    get: async ({ resource: target, id, pagination, meta, signal }) => {
      const result = await provider().getList<AuditLogEntry>({
        resource,
        pagination: pagination ?? { page: 1, pageSize: 20 },
        filters: [
          { field: 'resource', operator: 'eq', value: target },
          ...(id === undefined ? [] : [{ field: 'recordId', operator: 'eq' as const, value: String(id) }]),
        ],
        sorters: [{ field: 'createdAt', order: 'desc' }],
        meta,
        signal,
      })
      return { data: result.data, total: result.total }
    },
    update: ({ id, name }) => provider().update({ resource, id, variables: { name } }),
  }
}
