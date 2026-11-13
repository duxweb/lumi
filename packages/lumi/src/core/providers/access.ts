export interface CanParams {
  /** The resource asked about, e.g. `orders` or `system/users`. */
  resource: string
  /** The action, e.g. `list`, `show`, `create`, `edit`, `delete`, or a name of the app's own. */
  action: string
  /** Extra conditions for a check on one record, e.g. `{ id: 12 }`. */
  params?: Record<string, unknown>
}

export interface CanResponse {
  /** Whether the reader may. */
  can: boolean
  /** Why not, for the page to show. */
  reason?: string
}

/** Permission / visibility provider */
export interface AccessProvider {
  /** Answers whether the current reader may do `action` on `resource`. */
  can: (params: CanParams) => Promise<CanResponse>
}
