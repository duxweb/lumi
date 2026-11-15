import type { QueryClient } from '@tanstack/query-core'
import type { LumiContext } from './context.js'
import type { OptimisticChange } from './optimistic.js'
import type { MutationResult } from './services.js'
import type { ID, Meta, MutationMode } from './types.js'
import { resolveDataTarget } from './context.js'
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
  /** Overrides the standard DataProvider operation when a host needs a custom write. */
  request?: () => Promise<T>
}

/** Parameter mapping and bulk fallbacks are shared by hooks and JSON actions. */
async function dispatchWrite(context: LumiContext, options: WriteOptions): Promise<object> {
  const { dataProvider: provider, resource } = resolveDataTarget(context, options)
  const { operation, values: variables, meta } = options
  const ids = [...(options.ids ?? [])]
  const common = { resource, variables, meta }
  if (operation === 'create')
    return provider.create(common)
  if (operation === 'createMany') {
    if (!Array.isArray(variables))
      throw new Error('[lumi] createMany requires an array of values.')
    return provider.createMany
      ? provider.createMany({ ...common, variables })
      : { data: await Promise.all(variables.map(value => provider.create({ ...common, variables: value }).then(result => result.data))) }
  }
  if (operation === 'updateMany') {
    return provider.updateMany
      ? provider.updateMany({ ...common, ids })
      : { data: await Promise.all(ids.map(id => provider.update({ ...common, id }).then(result => result.data))) }
  }
  if (operation === 'deleteMany') {
    return provider.deleteMany
      ? provider.deleteMany({ ...common, ids })
      : { data: await Promise.all(ids.map(id => provider.deleteOne({ ...common, id }).then(result => result.data))) }
  }
  const id = ids[0]
  if (id === undefined)
    throw new Error(`[lumi] ${operation} requires an id.`)
  return operation === 'delete' ? provider.deleteOne({ ...common, id }) : provider.update({ ...common, id })
}

/**
 * The one write path the hooks and the JSON handlers share: it decides the
 * mutation mode, the optimistic change, the records to drop from the cache
 * and the audit event, then sends the request through executeMutation.
 */
export function executeWrite<T extends object>(context: LumiContext, client: QueryClient, options: WriteOptions<T>): Promise<MutationResult<T>> {
  const { operation, resource, dataProviderName, ids, values, meta } = options
  const deletes = operation === 'delete' || operation === 'deleteMany'
  const request = options.request ?? (() => dispatchWrite(context, options) as Promise<T>)
  const send = (): Promise<MutationResult<T>> => executeMutation(context, client, request, {
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
