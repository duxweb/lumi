import type { ID } from '../types'
import { normalizeResource } from '../path.js'

/**
 * Realtime changes pushed by the backend. A resource's changes arrive on its
 * channel, `resources/{resource}`, so lists and records refetch when another
 * reader (or a job, or an agent's backend tool) changes them.
 */
export interface LiveEvent {
  channel: string
  /** `created`, `updated`, `deleted`, or a type of the backend's own. */
  type: string
  payload?: { ids?: ID[], [key: string]: unknown }
  date?: string
}

/** One subscription: a channel, optionally narrowed to some event types. */
export interface LiveSubscribeParams {
  channel: string
  /** Only these event types; all of them when left out. */
  types?: readonly string[]
  onLiveEvent: (event: LiveEvent) => void
}

/**
 * Receives the changes the backend pushes. Lumi subscribes each mounted list
 * and record to its resource's channel and refetches what an event touches.
 */
export interface LiveProvider {
  /** Returns the function that ends the subscription. */
  subscribe: (params: LiveSubscribeParams) => () => void
  /** Sends an event to the backend, for providers that can. */
  publish?: (event: LiveEvent) => void | Promise<void>
  /** Opens the connection again, e.g. with the new tenant's headers; called when the tenant changes. */
  reconnect?: () => void
}

/**
 * `auto` refetches what an event touches, `manual` only calls `onLiveEvent`,
 * `off` does not subscribe. An `auto` reader's refetch leaves the queries of
 * `manual` and `off` readers on the same resource alone.
 */
export type LiveMode = 'auto' | 'manual' | 'off'

/** A resource's live channel: `resources/{resource}`. */
export function resourceChannel(resource: string): string {
  return `resources/${normalizeResource(resource)}`
}
