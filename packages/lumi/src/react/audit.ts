import type { UseQueryResult } from '@tanstack/react-query'
import type { AuditLogEntry, ID, Meta, Pagination } from '../core/index.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { auditLogQueryKey, executeRequest } from '../core/index.js'
import { useLumi } from './context.js'
import { useScopedTarget } from './data-scope.js'

export interface UseAuditLogListOptions {
  resource: string
  /** One record's history; the whole resource's without it. */
  id?: ID
  pagination?: Pagination
  meta?: Meta
  dataProviderName?: string
  enabled?: boolean
}

/**
 * The audit log of a resource or record, newest first, from the audit log
 * provider. It refreshes after every write to the resource. Without a
 * provider that lists, it stays empty and idle.
 */
export function useAuditLogList(input: UseAuditLogListOptions): UseQueryResult<{ data: AuditLogEntry[], total?: number }, Error> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const client = useQueryClient()
  const get = lumi.auditLogProvider?.get
  const params = { id: options.id, pagination: options.pagination, meta: options.meta }
  return useQuery({
    queryKey: auditLogQueryKey(options.resource, options.dataProviderName, params),
    enabled: Boolean(get) && options.enabled !== false,
    queryFn: ({ signal }) => executeRequest(lumi, () => get!({ resource: options.resource, ...params, signal }), client),
  })
}
