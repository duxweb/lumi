import type { ActionBinding, ActionHandler } from '@json-render/core'
import type { JSONUIProviderProps } from '@json-render/react'
import type { MutableRefObject, PropsWithChildren, ReactElement } from 'react'
import type { ActionState } from '../core/actions.js'
import type { LumiContext } from '../core/index.js'
import { registerActionObserver } from '@json-render/core'
import { JSONUIProvider, useActions, useStateStore } from '@json-render/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { lumiActionDefinitions } from '../catalog/index.js'
import { createLumiHandlers } from '../core/actions.js'
import { toastError } from '../core/feedback.js'
import { createTranslateDirective } from '../core/translate-directive.js'
import { browserTransferHost } from './browser-files.js'
import { useDataProviderName } from './data-scope.js'
import { subscribeToProvider } from './subscribe.js'
import { useTenantReset } from './tenant.js'

/** Built-in actions whose params take `dataProviderName`, read from their Catalog schemas. */
const SCOPED_ACTIONS = new Set(Object.entries(lumiActionDefinitions)
  .filter(([, definition]) => 'dataProviderName' in ((definition.params as { shape?: object }).shape ?? {}))
  .map(([name]) => name))

/** The React context carrying the `LumiContext`; read it with `useLumi`. */
export const LumiContextReact = createContext<LumiContext | null>(null)
export interface LumiServicesProviderProps extends PropsWithChildren {
  context: LumiContext
  queryClient?: QueryClient
}

/** Supplies the Lumi context and the query client alone: for hooks without page state, or beside a native json-render provider with its own handlers. */
export function LumiServicesProvider({
  context,
  queryClient,
  children,
}: LumiServicesProviderProps): ReactElement {
  const [defaultClient] = useState(() => new QueryClient())
  const client = queryClient ?? defaultClient
  return (
    <QueryClientProvider client={client}>
      <LumiContextReact.Provider value={context}>
        <TenantReset client={client} />
        {children}
      </LumiContextReact.Provider>
    </QueryClientProvider>
  )
}

export interface LumiProviderProps extends JSONUIProviderProps {
  context: LumiContext
  queryClient?: QueryClient
}

/** The native json-render provider plus Lumi: registers the data actions and the `$t` directive, supplies the query client and reports failed actions. */
export function LumiProvider({
  context,
  queryClient,
  ...native
}: LumiProviderProps): ReactElement {
  const [defaultClient] = useState(() => new QueryClient())
  const client = queryClient ?? defaultClient
  const state = useRef<ActionState | null>(null)
  const activeContext = useRef(context)
  useInsertionEffect(() => {
    activeContext.current = context
  }, [context])
  const store = useMemo<ActionState>(() => {
    const current = (): ActionState => {
      if (!state.current)
        throw new Error('[lumi] The page state is not mounted.')
      return state.current
    }
    return {
      get: path => current().get(path),
      set: (path, value) => current().set(path, value),
      update: updates => current().update(updates),
      get getSnapshot() {
        return current().getSnapshot
      },
    }
  }, [])
  const execute = useRef<((binding: ActionBinding) => Promise<void>) | null>(null)
  // Errors thrown by this provider's handlers. The observer sees every
  // provider's actions, so it reports only these.
  const raised = useRef(new WeakSet<object>())
  const scopedProvider = useDataProviderName()
  const handlers = useMemo(() => {
    const created = createLumiHandlers(context, client, store, {
      isActive: () =>
        state.current !== null && activeContext.current === context,
      execute: async binding => execute.current?.(binding),
      files: browserTransferHost,
    })
    // Data actions without a provider of their own use the enclosing scope's.
    const builtins = scopedProvider
      ? Object.fromEntries(Object.entries(created).map(([name, handler]) => [name, SCOPED_ACTIONS.has(name)
          ? ((params: Record<string, unknown>) => handler(params && params.dataProviderName === undefined ? { ...params, dataProviderName: scopedProvider } : params)) as ActionHandler
          : handler]))
      : created
    for (const name of Object.keys(native.handlers ?? {})) {
      if (Object.hasOwn(builtins, name)) {
        throw new Error(
          `[lumi] Duplicate handler: ${name}. Use LumiServicesProvider with the native provider to replace defaults.`,
        )
      }
    }
    const track = (handler: ActionHandler): ActionHandler => async (params) => {
      try {
        return await handler(params)
      }
      catch (cause) {
        const error = typeof cause === 'object' && cause !== null ? cause : new Error(String(cause))
        raised.current.add(error)
        throw error
      }
    }
    return Object.fromEntries(Object.entries({ ...builtins, ...native.handlers }).map(([name, handler]) => [name, track(handler)]))
  }, [context, client, store, native.handlers, scopedProvider])
  // The native ActionProvider keeps the handlers it was first given. These
  // stay the same functions for the provider's life and call what the latest
  // render built, so a new context (a reloaded page's translations, another
  // data scope) does not leave the page with handlers bound to the old one.
  const liveHandlers = useRef(handlers)
  useInsertionEffect(() => {
    liveHandlers.current = handlers
  }, [handlers])
  const handlerNames = Object.keys(handlers).join('\n')
  const stableHandlers = useMemo(() => Object.fromEntries(handlerNames.split('\n').filter(Boolean).map(name => [name, ((params: Record<string, unknown>) => {
    const handler = liveHandlers.current[name]
    if (!handler)
      throw new Error(`[lumi] The "${name}" action is no longer registered.`)
    return handler(params)
  }) as ActionHandler])), [handlerNames])
  // A failure that no `onError` handled reaches the settle event; it is shown
  // as a toast, so a failing request or save never passes silently.
  useEffect(() => registerActionObserver({
    onSettle: (event) => {
      const error = event.error
      if (event.ok || typeof error !== 'object' || error === null || !raised.current.has(error))
        return
      raised.current.delete(error)
      toastError(activeContext.current, error)
    },
  }), [])
  // `$t` resolves against the active locale; a new directive list on a locale
  // change re-renders every element that reads it.
  const i18n = context.i18nProvider
  const subscribe = useCallback((listener: () => void) => subscribeToProvider(i18n, listener), [i18n])
  const locale = useSyncExternalStore(subscribe, () => i18n?.getLocale() ?? '', () => i18n?.getLocale() ?? '')
  const directives = useMemo(() => {
    const translate = createTranslateDirective((key, params, fallback) =>
      i18n?.translate(key, params, fallback) ?? fallback ?? key)
    const supplied = native.directives ?? []
    return supplied.some(directive => directive.name === '$t') ? supplied : [translate, ...supplied]
    // The locale is the reason to rebuild: the translator reads it live.
  }, [i18n, locale, native.directives])
  return (
    <LumiServicesProvider context={context} queryClient={client}>
      <JSONUIProvider {...native} handlers={stableHandlers} directives={directives}>
        <StateBridge stateRef={state} executeRef={execute}>{native.children}</StateBridge>
      </JSONUIProvider>
    </LumiServicesProvider>
  )
}

/** Refetches everything once the tenant changes; see useTenantReset. */
function TenantReset({ client }: { client: QueryClient }): null {
  useTenantReset(client)
  return null
}

/** The `LumiContext` of the nearest Lumi provider: the data providers, the request client and every other service. */
export function useLumi(): LumiContext {
  const context = useContext(LumiContextReact)
  if (!context) {
    throw new Error(
      '[lumi] Data services require LumiServicesProvider or LumiProvider.',
    )
  }
  return context
}

function StateBridge({
  stateRef,
  executeRef,
  children,
}: PropsWithChildren<{
  stateRef: MutableRefObject<ActionState | null>
  executeRef: MutableRefObject<((binding: ActionBinding) => Promise<void>) | null>
}>): ReactElement {
  const state = useStateStore()
  const { execute } = useActions()
  useInsertionEffect(() => {
    stateRef.current = state
    return () => {
      stateRef.current = null
    }
  }, [state, stateRef])
  useInsertionEffect(() => {
    executeRef.current = execute
    return () => {
      executeRef.current = null
    }
  }, [execute, executeRef])
  return <>{children}</>
}
