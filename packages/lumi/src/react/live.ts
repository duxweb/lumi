import type { QueryClient } from '@tanstack/react-query'
import type { ID, LiveEvent, LiveMode, LumiContext } from '../core/index.js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { isOneQueryKeyForIds, queryKeyAction, resolveDataTarget, resourceChannel, resourceQueryKey } from '../core/index.js'
import { useLumi } from './context.js'

export interface UseSubscriptionOptions {
  /** The channel to listen on; a resource's is `resources/{resource}`. */
  channel: string
  /** Only these event types; all of them when left out. */
  types?: readonly string[]
  /** Called for each event. */
  onLiveEvent: (event: LiveEvent) => void
  /** `false` does not subscribe. */
  enabled?: boolean
}

/** Listens to a live channel while mounted; inert without a liveProvider. */
export function useSubscription(options: UseSubscriptionOptions): void {
  const live = useLumi().liveProvider
  const handler = useRef(options.onLiveEvent)
  handler.current = options.onLiveEvent
  const types = options.types?.join(',')
  const enabled = options.enabled ?? true
  useEffect(() => {
    if (!live || !enabled)
      return
    return live.subscribe({ channel: options.channel, ...(types ? { types: types.split(',') } : {}), onLiveEvent: event => handler.current(event) })
  }, [live, enabled, options.channel, types])
}

/** Sends an event through the liveProvider, when it can publish. */
export function usePublish(): (event: LiveEvent) => Promise<void> {
  const live = useLumi().liveProvider
  return useCallback(async (event) => {
    await live?.publish?.(event)
  }, [live])
}

// The events each client already refetched for, per resource: every live
// query of a resource hears the same event, and one refetch is enough.
const handled = new WeakMap<QueryClient, WeakMap<LiveEvent, Set<string>>>()

/**
 * Refetches what an event touches: every list-like query of the resource, and
 * only the records it names. A deleted record is not fetched again.
 */
function refetchForEvent(client: QueryClient, lumi: LumiContext, resource: string, dataProviderName: string | undefined, event: LiveEvent): void {
  const target = resolveDataTarget(lumi, { resource, dataProviderName })
  const scope = `${target.dataProviderName ?? 'default'}\u0000${resource}`
  let events = handled.get(client)
  if (!events)
    handled.set(client, events = new WeakMap())
  const seen = events.get(event) ?? new Set<string>()
  if (seen.has(scope))
    return
  seen.add(scope)
  events.set(event, seen)
  const touched = event.payload?.ids
  void client.invalidateQueries({
    queryKey: resourceQueryKey(resource, target.dataProviderName),
    predicate: (query) => {
      // A query whose reader chose `manual` or `off` refreshes only on its own terms.
      const mode = (query.meta as Partial<LiveQueryMeta> | undefined)?.lumiLive
      if (mode === 'manual' || mode === 'off')
        return false
      return !touched?.length || queryKeyAction(query.queryKey) !== 'one' || (event.type !== 'deleted' && isOneQueryKeyForIds(query.queryKey, touched))
    },
  })
}

export interface LiveOptions {
  /** Defaults to the context's `liveMode`, which is `auto` with a liveProvider. */
  liveMode?: LiveMode
  /** Called for each event of the resource, in `auto` and `manual` mode. */
  onLiveEvent?: (event: LiveEvent) => void
}

/** A hook's live options, without undefined entries. */
export function liveOptions(options: LiveOptions): LiveOptions {
  return {
    ...(options.liveMode ? { liveMode: options.liveMode } : {}),
    ...(options.onLiveEvent ? { onLiveEvent: options.onLiveEvent } : {}),
  }
}

/** Query `meta` that tells an `auto` reader's refetch which queries opted out. */
export interface LiveQueryMeta extends Record<string, unknown> {
  lumiLive: LiveMode
}

/**
 * Keeps a resource's queries live (spread the returned meta into the query): in `auto` mode an event on
 * `resources/{resource}` refetches them (lists, records and aggregates
 * together, so a list and its stats stay one snapshot). With `ids`, events
 * naming other records are ignored.
 */
export function useResourceLive(resource: string, dataProviderName: string | undefined, options: LiveOptions & { ids?: readonly ID[], enabled?: boolean } = {}): LiveQueryMeta {
  const lumi = useLumi()
  const client = useQueryClient()
  const mode = options.liveMode ?? lumi.config.liveMode ?? (lumi.liveProvider ? 'auto' : 'off')
  const ids = options.ids?.map(String).join('\u0000')
  useSubscription({
    channel: resourceChannel(resource),
    enabled: mode !== 'off' && (options.enabled ?? true) && Boolean(resource),
    onLiveEvent: (event) => {
      const touched = event.payload?.ids
      if (ids !== undefined && touched?.length && !touched.some(id => ids.split('\u0000').includes(String(id))))
        return
      options.onLiveEvent?.(event)
      if (mode === 'auto')
        refetchForEvent(client, lumi, resource, dataProviderName, event)
    },
  })
  return { lumiLive: mode }
}
