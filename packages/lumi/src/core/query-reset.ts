import type { QueryClient } from '@tanstack/query-core'

interface QueryResetState { version: number, listeners: Set<() => void> }
const resets = new WeakMap<QueryClient, QueryResetState>()
function resetState(client: QueryClient): QueryResetState {
  let state = resets.get(client)
  if (!state) {
    state = { version: 0, listeners: new Set() }
    resets.set(client, state)
  }
  return state
}

/** Query observers must drop placeholder rows across both account and tenant changes. */
export function queryResets(client: QueryClient): number {
  return resetState(client).version
}

/** A QueryObserver can memoize placeholder data without notifying its consumer. */
export function subscribeQueryResets(client: QueryClient, listener: () => void): () => void {
  const { listeners } = resetState(client)
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Clears mounted data synchronously, then refetches it when requested. */
export async function resetIdentityQueries(client: QueryClient, refetch = true): Promise<void> {
  const state = resetState(client)
  state.version++
  const filters = { queryKey: ['lumi'] }
  const cancelled = client.cancelQueries(filters)
  client.removeQueries({ ...filters, predicate: query => query.getObserversCount() === 0 })
  let refreshed: Promise<void> | undefined
  if (refetch) {
    refreshed = client.resetQueries(filters)
  }
  else {
    for (const query of client.getQueryCache().findAll(filters)) query.reset()
  }
  for (const listener of state.listeners) listener()
  await Promise.all([cancelled, refreshed])
}
