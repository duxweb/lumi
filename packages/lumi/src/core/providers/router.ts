import type { ID } from '../types'

export interface GoConfig {
  /** The path to open; the current one when left out. */
  to?: string
  /** Query parameters of the address. */
  query?: Record<string, unknown>
  /** The fragment after `#`. */
  hash?: string
  /** Replaces the history entry instead of adding one. */
  replace?: boolean
}

export interface ParsedLocation {
  /** The resource the address belongs to, when the router knows it. */
  resource?: string
  /** The action of the address, e.g. `edit`, when the router knows it. */
  action?: string
  /** The record of the address, when the router knows it. */
  id?: ID
  /** The path's params, e.g. `{ id: "12" }` for `/orders/:id`. */
  params: Record<string, unknown>
  /** The query parameters. */
  query?: Record<string, unknown>
  /** The path without query or fragment. */
  pathname: string
}

/** Router provider: the navigation the host app does, e.g. through react-router. */
export interface RouterProvider {
  /** Opens an address. */
  go: (config: GoConfig) => void
  /** Goes back one history entry. */
  back: () => void
  /** The current address, taken apart. */
  parse: () => ParsedLocation
  /** The current path with its query. */
  getCurrentPath: () => string
  /** Notifies when the address changes. */
  subscribe?: (listener: () => void) => () => void
}
