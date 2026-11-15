import type { QueryClient, QueryKey } from '@tanstack/query-core'
import type { LumiContext } from './context.js'
import type { ID, MutationMode } from './types.js'
import { resolveDataTarget } from './context.js'
import { isPlainRecord } from './path.js'
import { queryKeyAction, resourceQueryKey } from './query.js'
import { sessionVersion } from './services.js'
import { translateText } from './text.js'

export type OptimisticChange
  = | { kind: 'update', ids: readonly ID[], values: Record<string, unknown> }
    | { kind: 'delete', ids: readonly ID[] }

/** Raised when the reader pressed Undo: nothing was sent, and nothing is reported. */
export class MutationUndoneError extends Error {
  constructor() {
    super('The change was undone before it was sent.')
    this.name = 'MutationUndoneError'
  }
}

export const DEFAULT_UNDOABLE_TIMEOUT = 5000
// Aggregates refetch once the server answers; audit log entries are not the records.
const UNPATCHED = new Set(['aggregate', 'auditLog'])

type Row = Record<string, unknown>

/** The cached value with the change applied: list rows, infinite pages and single records. */
function applyToData(data: unknown, change: OptimisticChange): unknown {
  if (!isPlainRecord(data))
    return data
  const ids = change.ids.map(String)
  const matches = (row: unknown): boolean => isPlainRecord(row) && ids.includes(String(row.id))
  if (Array.isArray(data.pages))
    return { ...data, pages: data.pages.map(page => applyToData(page, change)) }
  if (Array.isArray(data.data)) {
    const rows = change.kind === 'delete'
      ? data.data.filter(row => !matches(row))
      : data.data.map(row => matches(row) ? { ...(row as Row), ...change.values } : row)
    const removed = data.data.length - rows.length
    return { ...data, data: rows, ...(removed && typeof data.total === 'number' ? { total: Math.max(0, data.total - removed) } : {}) }
  }
  if (change.kind === 'update' && matches(data.data))
    return { ...data, data: { ...(data.data as Row), ...change.values } }
  return data
}

/**
 * Applies the change to every cached query of the resource except its
 * aggregates and audit log. Returns the undo, which puts the saved data back
 * and refetches the resource, so changes that landed meanwhile — another
 * write, a refetch — are not lost under the old copy.
 */
export function applyOptimisticChange(client: QueryClient, context: LumiContext, target: { resource: string, dataProviderName?: string }, change: OptimisticChange): () => void {
  const version = sessionVersion(context)
  const resolved = resolveDataTarget(context, target)
  const queryKey = resourceQueryKey(resolved.resource, resolved.dataProviderName)
  // A fetch already under way would land over the change.
  void client.cancelQueries({ queryKey })
  const saved: Array<[QueryKey, unknown]> = client.getQueriesData({ queryKey, predicate: query => !UNPATCHED.has(queryKeyAction(query.queryKey) as string) })
  for (const [key, data] of saved)
    client.setQueryData(key, applyToData(data, change))
  return () => {
    if (version !== sessionVersion(context))
      return
    for (const [key, data] of saved)
      client.setQueryData(key, data)
    void client.invalidateQueries({ queryKey })
  }
}

export interface RunMutationOptions<T> {
  mode?: MutationMode
  undoableTimeout?: number
  target: { resource: string, dataProviderName?: string }
  change: OptimisticChange
  /** Sends the write; for undoable mode only once the wait is over. */
  request: () => Promise<T>
}

let undoSequence = 0

/**
 * Runs a write in its mutation mode. Undoable needs a notification provider
 * to offer Undo; without one it behaves as optimistic. The same function
 * serves the data hooks and the JSON `update` and `delete` actions.
 */
export async function runMutationMode<T>(context: LumiContext, client: QueryClient, options: RunMutationOptions<T>): Promise<T> {
  const mode = options.mode ?? 'pessimistic'
  if (mode === 'pessimistic')
    return options.request()
  const restore = applyOptimisticChange(client, context, options.target, options.change)
  const notices = context.notificationProvider
  if (mode === 'undoable' && notices) {
    // The write belongs to the tenant and session it was made in; switching
    // either during the wait drops it rather than send it to the new one.
    const session = sessionVersion(context)
    const timeout = options.undoableTimeout ?? DEFAULT_UNDOABLE_TIMEOUT
    const count = options.change.ids.length
    const key = `lumi-undo-${++undoSequence}`
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        notices.close?.(key)
        if (sessionVersion(context) !== session) {
          restore()
          reject(new MutationUndoneError())
          return
        }
        resolve()
      }, timeout)
      notices.open({
        key,
        tone: 'neutral',
        title: options.change.kind === 'delete'
          ? translateText(context, 'lumi.mutation.deleted', '{count} deleted', { count })
          : translateText(context, 'lumi.mutation.updated', '{count} updated', { count }),
        description: translateText(context, 'lumi.mutation.undoHint', 'Undo within {seconds} seconds.', { seconds: Math.round(timeout / 1000) }),
        duration: timeout,
        actions: [{
          label: translateText(context, 'lumi.mutation.undo', 'Undo'),
          onPress: () => {
            clearTimeout(timer)
            restore()
            reject(new MutationUndoneError())
          },
        }],
      })
    })
  }
  try {
    return await options.request()
  }
  catch (error) {
    restore()
    throw error
  }
}
