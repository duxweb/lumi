/**
 * The tenant (workspace, team, store) the reader works in. Data requests
 * carry it, and every cached query is dropped and fetched again when it
 * changes, so one tenant's data never shows in another. Framework-free: the
 * React root subscribes to it.
 */
export interface TenantOption {
  /** What requests carry, e.g. in `X-Tenant`. */
  value: string
  /** The name shown. */
  label: string
  /** A second line in the switcher. */
  description?: string
  /** Image address shown beside the name. */
  logo?: string
}

/**
 * Holds the current tenant. The request client reads it for every request,
 * and Lumi listens to it to drop cached data when it changes.
 */
export interface TenantProvider {
  /** The current tenant's value, or undefined before one is chosen. */
  get: () => string | undefined
  /** Switches to another tenant. */
  set: (value: string) => void
  /** Notifies when the tenant changes; Lumi drops its cached data on it. */
  subscribe: (listener: () => void) => () => void
  /** The tenants the reader may switch between, when the provider knows them. */
  options?: () => readonly TenantOption[]
}

export interface CreateTenantProviderOptions {
  /** The tenant before the reader picks one; defaults to the first option. */
  initial?: string
  options?: readonly TenantOption[]
  /** Keeps the choice between visits under this local storage key. */
  storageKey?: string
}

interface TenantStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function storage(): TenantStorage | undefined {
  try {
    return (globalThis as { localStorage?: TenantStorage }).localStorage
  }
  catch {
    return undefined
  }
}

/**
 * A tenant provider kept in memory, or in local storage with `storageKey`. A
 * stored tenant that is no longer among `options` is ignored.
 */
export function createTenantProvider(options: CreateTenantProviderOptions = {}): TenantProvider {
  const listeners = new Set<() => void>()
  const known = (value: string | null | undefined): value is string =>
    typeof value === 'string' && value !== '' && (!options.options?.length || options.options.some(option => option.value === value))
  let stored: string | null | undefined
  if (options.storageKey) {
    try {
      stored = storage()?.getItem(options.storageKey)
    }
    catch {}
  }
  let current = known(stored) ? stored : known(options.initial) ? options.initial : options.options?.[0]?.value
  return {
    get: () => current,
    set(value) {
      if (value === current || !known(value))
        return
      current = value
      if (options.storageKey) {
        try {
          storage()?.setItem(options.storageKey, value)
        }
        catch {}
      }
      for (const listener of listeners)
        listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ...(options.options ? { options: () => options.options! } : {}),
  }
}
