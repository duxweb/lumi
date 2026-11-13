import type { HttpClient } from '../http.js'
import type { LiveEvent, LiveProvider, LiveSubscribeParams } from '../providers/live'
import { parseAgentStream } from '../agent/stream.js'

export interface SseLiveProviderOptions {
  /** The event stream endpoint; it sends `data: { channel, type, payload }` frames. */
  url: string
  /**
   * Opens and posts through this client, so the auth provider signs each
   * connection (read again on every reconnect) with the locale and tenant.
   */
  http?: HttpClient
  /** Extra headers for each connection, e.g. the token and the tenant; read again on every reconnect. */
  headers?: () => Record<string, string>
  credentials?: RequestCredentials
  fetcher?: typeof fetch
  /** Where `publish` posts an event; without it the provider only listens. */
  publishUrl?: string
  /** First wait before reconnecting, doubled up to 30 seconds. */
  retryDelay?: number
}

export interface SseLiveProvider extends LiveProvider {
  /** Closes and opens the stream again, e.g. once the tenant or the token changed. */
  reconnect: () => void
  close: () => void
}

const MAX_RETRY = 30_000
/** A connection that stayed open this long was a working one, whatever it carried. */
const STABLE_MS = 10_000

function isLiveEvent(value: unknown): value is LiveEvent {
  return typeof value === 'object' && value !== null && typeof (value as LiveEvent).channel === 'string' && typeof (value as LiveEvent).type === 'string'
}

/**
 * Realtime over one server-sent event stream read with fetch, so it carries
 * the same headers as data requests (EventSource cannot). The stream opens
 * with the first subscription, closes with the last, and reconnects with
 * backoff after a drop.
 */
export function createSseLiveProvider(options: SseLiveProviderOptions): SseLiveProvider {
  const f = (url: string, init: RequestInit): Promise<Response> => (options.http ? options.http.fetch(url, init) : (options.fetcher ?? fetch)(url, init))
  const subscriptions = new Set<LiveSubscribeParams>()
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let delay = options.retryDelay ?? 1000

  const dispatch = (event: LiveEvent): void => {
    for (const subscription of [...subscriptions]) {
      if (subscription.channel !== event.channel || (subscription.types?.length && !subscription.types.includes(event.type)))
        continue
      // One listener's failure is its own: the others still hear the event and the stream stays open.
      try {
        subscription.onLiveEvent(event)
      }
      catch (error) {
        console.warn(`[lumi] A live listener on "${event.channel}" failed.`, error)
      }
    }
  }

  const open = (): void => {
    clearTimeout(timer)
    controller?.abort()
    if (!subscriptions.size)
      return
    const own = new AbortController()
    controller = own
    void (async () => {
      try {
        const response = await f(options.url, { headers: { Accept: 'text/event-stream', ...options.headers?.() }, ...(options.credentials ? { credentials: options.credentials } : {}), signal: own.signal })
        if (!response.ok || !response.body)
          throw new Error(`live stream answered ${response.status}`)
        // The backoff starts over only once the connection proved itself: it
        // delivered an event or stayed open. One that opens and drops at once
        // keeps backing off instead of reconnecting forever at the first delay.
        const opened = Date.now()
        const proven = (): void => {
          delay = options.retryDelay ?? 1000
        }
        try {
          for await (const frame of parseAgentStream(response.body, own.signal)) {
            if (isLiveEvent(frame)) {
              proven()
              dispatch(frame)
            }
          }
        }
        finally {
          if (Date.now() - opened >= STABLE_MS)
            proven()
        }
      }
      catch {}
      // Dropped or refused: try again later, unless closed or replaced meanwhile.
      if (controller === own && !own.signal.aborted && subscriptions.size) {
        timer = setTimeout(open, delay)
        delay = Math.min(delay * 2, MAX_RETRY)
      }
    })()
  }

  const close = (): void => {
    clearTimeout(timer)
    controller?.abort()
    controller = null
  }

  return {
    subscribe(params) {
      subscriptions.add(params)
      if (!controller)
        open()
      return () => {
        subscriptions.delete(params)
        if (!subscriptions.size)
          close()
      }
    },
    async publish(event) {
      if (!options.publishUrl)
        return
      const response = await f(options.publishUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...options.headers?.() }, ...(options.credentials ? { credentials: options.credentials } : {}), body: JSON.stringify(event) })
      if (!response.ok)
        throw new Error(`[lumi] The live event was refused: ${response.status}`)
    },
    reconnect: () => {
      if (subscriptions.size)
        open()
    },
    close,
  }
}
