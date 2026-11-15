import type { QueryClient } from '@tanstack/react-query'
import type { TenantOption } from '../core/providers/tenant.js'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { resetIdentityQueries } from '../core/query-reset.js'
import { useLumi } from './context.js'
import { noSubscribe } from './subscribe.js'

// The tenant each query client last fetched for.
const seen = new WeakMap<QueryClient, string | undefined>()
const NO_OPTIONS: readonly TenantOption[] = []

export interface UseTenantResult {
  /** The current tenant's value, undefined before one is chosen. */
  tenant: string | undefined
  /** The option of the current tenant, when the provider lists them. */
  current: TenantOption | undefined
  /** The tenants the reader may switch between. */
  options: readonly TenantOption[]
  /** Switches the tenant; every query is then fetched again for it. */
  setTenant: (value: string) => void
}

/** The current tenant and a way to switch it; inert without a `tenantProvider`. */
export function useTenant(): UseTenantResult {
  const provider = useLumi().tenantProvider
  const subscribe = useCallback((listener: () => void) => provider?.subscribe(listener) ?? (() => {}), [provider])
  const tenant = useSyncExternalStore(provider ? subscribe : noSubscribe, () => provider?.get(), () => provider?.get())
  const options = provider?.options?.() ?? NO_OPTIONS
  const setTenant = useCallback((value: string) => provider?.set(value), [provider])
  return { tenant, current: options.find(option => option.value === tenant), options, setTenant }
}

/**
 * Drops every Lumi query when the tenant changes and fetches the mounted ones
 * again, as signing in does, so one tenant's cache never shows in another;
 * the live connection reopens with the new tenant.
 */
export function useTenantReset(client: QueryClient): void {
  const { tenantProvider: provider, liveProvider } = useLumi()
  useEffect(() => {
    if (!provider)
      return
    // Nested providers share a client: the first to hear the change resets it once.
    const check = (): void => {
      const next = provider.get()
      if (!seen.has(client)) {
        seen.set(client, next)
        return
      }
      if (next === seen.get(client))
        return
      seen.set(client, next)
      void resetIdentityQueries(client)
      liveProvider?.reconnect?.()
    }
    // A switch made while nothing was listening is caught on mount.
    check()
    return provider.subscribe(check)
  }, [client, provider, liveProvider])
}
