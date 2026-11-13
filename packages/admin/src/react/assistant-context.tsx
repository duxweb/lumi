import type { AgentContextItem } from '@duxweb/lumi-ui'
import type { BaseComponentProps } from '@json-render/react'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useId, useMemo, useSyncExternalStore } from 'react'

/**
 * What pages and modules tell the assistant about: the selected rows, the
 * record being edited. Each registration is kept under its own key until it
 * is removed; the snapshot lists every item once, the latest by id winning.
 */
export interface AssistantContextRegistry {
  set: (key: string, items: readonly AgentContextItem[]) => void
  remove: (key: string) => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => readonly AgentContextItem[]
}

const EMPTY: readonly AgentContextItem[] = []

/** The store of what pages share with the assistant through `AssistantContext` elements and `useAssistantContext`. */
export function createAssistantContextRegistry(): AssistantContextRegistry {
  const entries = new Map<string, readonly AgentContextItem[]>()
  const listeners = new Set<() => void>()
  let snapshot = EMPTY
  const publish = (): void => {
    const byId = new Map<string, AgentContextItem>()
    for (const items of entries.values()) {
      for (const item of items)
        byId.set(item.id, item)
    }
    snapshot = byId.size ? [...byId.values()] : EMPTY
    for (const listener of listeners)
      listener()
  }
  return {
    set: (key, items) => {
      entries.set(key, items)
      publish()
    },
    remove: (key) => {
      if (entries.delete(key))
        publish()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
  }
}

const AssistantContextRegistryContext = createContext<AssistantContextRegistry>(createAssistantContextRegistry())

/** One registry per Admin app; createAdmin provides it, and without it a shared one is used. */
export function AssistantContextProvider({ registry, children }: { registry: AssistantContextRegistry, children: ReactNode }): ReactNode {
  return <AssistantContextRegistryContext value={registry}>{children}</AssistantContextRegistryContext>
}

/** A stable signature, so items rebuilt on every render do not re-register. */
function signature(items: readonly AgentContextItem[] | undefined): string {
  return JSON.stringify(items ?? [])
}

/**
 * Tells the assistant about `items` while the calling component is mounted:
 * they are offered as context the reader can remove before sending. Pass
 * nothing (or an empty list) when there is nothing to share.
 */
export function useAssistantContext(items: readonly AgentContextItem[] | undefined): void {
  const registry = useContext(AssistantContextRegistryContext)
  const key = useId()
  const stable = signature(items)
  useEffect(() => {
    const parsed = JSON.parse(stable) as AgentContextItem[]
    if (parsed.length)
      registry.set(key, parsed)
    else
      registry.remove(key)
  }, [registry, key, stable])
  useEffect(() => () => registry.remove(key), [registry, key])
}

/** Everything registered for the assistant right now. */
export function useAssistantContextItems(): readonly AgentContextItem[] {
  const registry = useContext(AssistantContextRegistryContext)
  return useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot)
}

/** The JSON `AssistantContext` element: registers its `items` and renders nothing. */
export function AssistantContextElement({ props }: BaseComponentProps<{ items?: AgentContextItem[] }>): ReactNode {
  const items = useMemo(() => props.items ?? [], [props.items])
  useAssistantContext(items)
  return null
}
