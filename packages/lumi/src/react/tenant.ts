import type { QueryClient } from '@tanstack/react-query'
import type { TenantOption } from '../core/providers/tenant.js'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { lumiQueryKey } from '../core/query.js'
import { useLumi } from './context.js'
import { noSubscribe } from './subscribe.js'

// The tenant each query client last fetched for.
const seen = new WeakMap<QueryClient, string | undefined>()
const NO_OPTIONS: readonly TenantOption[] = []
const resets = new WeakMap<QueryClient, number>()

/** How many times this client's Lumi queries were reset for a new tenant; lists drop their kept rows across one. */
export function queryResets(client: QueryClient): number {
  return resets.get(client) ?? 0
}

const LUMI_QUERIES = { queryKey: lumiQueryKey() }

/**
 * Clears every Lumi query in the same call that switched the tenant, before
 * React renders again, so no frame shows the old tenant's rows under the new
 * one; the mounted queries then fetch for the new tenant.
 */
function resetTenantQueries(client: QueryClient): void {
  resets.set(client, queryResets(client) + 1)
  void client.cancelQueries(LUMI_QUERIES)
  client.removeQueries({ ...LUMI_QUERIES, predicate: query => query.getObserversCount() === 0 })
  // `resetQueries` returns its state to the initial one synchronously, then refetches.
  void client.resetQueries(LUMI_QUERIES)
}

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
      resetTenantQueries(client)
      liveProvider?.reconnect?.()
    }
    // A switch made while nothing was listening is caught on mount.
    check()
    return provider.subscribe(check)
  }, [client, provider, liveProvider])
}
