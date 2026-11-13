import type { QueryClient } from '@tanstack/query-core'
import type { LumiContext } from './context.js'
import type { OptimisticChange } from './optimistic.js'
import type { MutationResult } from './services.js'
import type { ID, Meta, MutationMode } from './types.js'
import { runMutationMode } from './optimistic.js'
import { isPlainRecord } from './path.js'
import { executeMutation } from './services.js'

export type WriteOperation = 'create' | 'createMany' | 'update' | 'updateMany' | 'delete' | 'deleteMany'

export interface WriteOptions<T = unknown> {
  operation: WriteOperation
  resource: string
  dataProviderName?: string | undefined
  /** The records written; known for updates and deletes. */
  ids?: readonly ID[] | undefined
  /** The values sent, recorded in the audit log and patched into the cache. */
  values?: unknown
  meta?: Meta | undefined
  /** Falls back to `config.mutationMode`; only updates and deletes with ids use it. */
  mutationMode?: MutationMode | undefined
  undoableTimeout?: number | undefined
  /** Sends the write to the DataProvider. */
  request: () => Promise<T>
}

/**
 * The one write path the hooks and the JSON handlers share: it decides the
 * mutation mode, the optimistic change, the records to drop from the cache
 * and the audit event, then sends the request through executeMutation.
 */
export function executeWrite<T extends object>(context: LumiContext, client: QueryClient, options: WriteOptions<T>): Promise<MutationResult<T>> {
  const { operation, resource, dataProviderName, ids, values, meta } = options
  const deletes = operation === 'delete' || operation === 'deleteMany'
  const send = (): Promise<MutationResult<T>> => executeMutation(context, client, options.request, {
    resource,
    ...(dataProviderName ? { dataProviderName } : {}),
    deletedIds: deletes ? ids : undefined,
    audit: {
      action: operation,
      ...(ids ? { ids: [...ids] } : {}),
      ...(deletes ? {} : { data: values }),
      ...(meta ? { meta } : {}),
    },
  })
  if (operation === 'create' || operation === 'createMany' || !ids)
    return send()
  const change: OptimisticChange = deletes ? { kind: 'delete', ids } : { kind: 'update', ids, values: isPlainRecord(values) ? values : {} }
  return runMutationMode(context, client, {
    mode: options.mutationMode ?? context.config.mutationMode,
    undoableTimeout: options.undoableTimeout ?? context.config.undoableTimeout,
    target: { resource, ...(dataProviderName ? { dataProviderName } : {}) },
    change,
    request: send,
  })
}
