import type { TenantProvider } from './providers/tenant.js'

/** Shared by a context and its translated or routed views. */
export interface LumiSession {
  getSnapshot: () => number
  subscribe: (listener: () => void) => () => void
  /** A cache namespace for this runtime identity, never containing credentials. */
  cacheKey: (prefix?: string) => string
  /** Advances after an accepted account change. Tenant changes advance it too. */
  advance: () => void
}

// One counter per provider, independent of React mounts. A -> B -> A must
// invalidate work started in A too. The listener retains no app contexts.
const tenants = new WeakMap<TenantProvider, { version: number }>()
let sequence = 0

export function createSession(tenant?: TenantProvider): LumiSession {
  const id = ++sequence
  let changes = tenant && tenants.get(tenant)
  if (tenant && !changes) {
    const state = { version: 0 }
    let previous = tenant.get()
    tenant.subscribe(() => {
      const next = tenant.get()
      if (next !== previous) {
        previous = next
        state.version++
      }
    })
    tenants.set(tenant, state)
    changes = state
  }
  let version = 0
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => version + (changes?.version ?? 0),
    cacheKey: prefix => JSON.stringify([id, version + (changes?.version ?? 0), prefix ?? '']),
    subscribe(listener) {
      listeners.add(listener)
      const unsubscribe = tenant?.subscribe(listener)
      return () => {
        listeners.delete(listener)
        unsubscribe?.()
      }
    },
    advance() {
      version++
      for (const listener of listeners) listener()
    },
  }
}
