import type { ActionBinding, Catalog, Spec } from '@json-render/core'
import type { PropsWithChildren, ReactElement } from 'react'
import type { LumiContext } from '../core/context.js'
import type { I18nTranslations } from '../core/providers/i18n.js'
import type { LumiJsonLoader, LumiLoadOptions } from '../loader.js'
import type { LumiProviderProps } from './context.js'
import { createDirectiveRegistry, createStateStore, resolveActionParam } from '@json-render/core'
import { Renderer, useActions, useStateStore } from '@json-render/react'
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { withPageTranslations } from '../core/providers/i18n.js'
import { createTranslateDirective } from '../core/translate-directive.js'
import { createSpecLoader, LumiLoadError } from '../loader.js'
import { LumiProvider, useLumi } from './context.js'

const LumiSpecContext = createContext<Spec | undefined>(undefined)

/** Names the Spec being rendered below; LumiSpecPage provides it for the page it loaded. */
export function LumiSpecSource({ spec, children }: PropsWithChildren<{ spec: Spec }>): ReactElement {
  return <LumiSpecContext value={spec}>{children}</LumiSpecContext>
}

/**
 * The Spec rendered by the nearest LumiSpecPage or LumiSpecSource, for components
 * that show part of the document itself, such as an example's source.
 */
export function useLumiSpec(): Spec | undefined {
  return useContext(LumiSpecContext)
}

const FLASH_MS = 2400
const CONTROLS = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="link"]'
// The agent's own conversation is never what it points at.
const AGENT_SURFACES = '[data-agent-surface], [data-slot="chat-thread"], [data-slot="prompt-input"]'

/** Flashes the visible control named `label` (its text or aria-label) and scrolls to it. */
function flashControl(label: string): boolean {
  const wanted = label.trim().toLowerCase()
  const matches = [...document.querySelectorAll<HTMLElement>(CONTROLS)].filter(node =>
    !node.closest(AGENT_SURFACES) && (node.getAttribute('aria-label') ?? node.textContent ?? '').trim().toLowerCase() === wanted)
  const target = matches.find(node => node.getClientRects().length > 0) ?? matches[0]
  if (!target)
    return false
  target.scrollIntoView?.({ block: 'nearest' })
  // Restart the animation when it is already flashing.
  target.removeAttribute('data-agent-flash')
  void target.offsetWidth
  target.setAttribute('data-agent-flash', '')
  setTimeout(() => target.removeAttribute('data-agent-flash'), FLASH_MS)
  return true
}

/**
 * Puts the page in front of the agent bridge while it is mounted: its
 * elements, bound paths and events come from the Spec, its values from the
 * page state, and an event fires the element's own `on` actions.
 */
function AgentPage({ spec, title }: { spec: Spec, title?: string | undefined }): null {
  const lumi = useLumi()
  const id = useId()
  const { getSnapshot, set } = useStateStore()
  const { execute } = useActions()
  const latest = useRef({ getSnapshot, set, execute })
  latest.current = { getSnapshot, set, execute }
  const bridge = lumi.agentBridge
  const i18n = lumi.i18nProvider
  useEffect(() => bridge?.registerPage({
    id,
    ...(title ? { title } : {}),
    spec: spec as Parameters<typeof bridge.registerPage>[0]['spec'],
    getState: () => latest.current.getSnapshot(),
    setState: (path, value) => latest.current.set(path, value),
    async trigger(element, event) {
      // `$t` in parameters resolves as the renderer resolves it, against the live locale.
      const directives = createDirectiveRegistry([createTranslateDirective((key, params, fallback) => i18n?.translate(key, params, fallback) ?? fallback ?? key)])
      const binding = spec.elements[element]?.on?.[event]
      for (const entry of (Array.isArray(binding) ? binding : binding ? [binding] : []) as ActionBinding[]) {
        // Parameters resolve against the state as it is when the event fires, as the renderer does.
        const params = entry.params
          ? Object.fromEntries(Object.entries(entry.params).map(([name, value]) => [name, resolveActionParam(value, { stateModel: latest.current.getSnapshot(), directives })]))
          : undefined
        await latest.current.execute({ ...entry, ...(params ? { params } : {}) } as ActionBinding)
      }
    },
    // Tables listen for `lumi:highlight` (LUMI_HIGHLIGHT_EVENT in Lumi UI); Lumi does not depend on UI.
    focused: () => {
      // A named form field outside the agent's own composer.
      const active = document.activeElement
      return (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) && active.name && !active.closest('[data-slot="prompt-input"]')
        ? active.name
        : undefined
    },
    flash: flashControl,
    highlight: keys => window.dispatchEvent(new CustomEvent('lumi:highlight', { detail: { keys } })),
    ...(i18n ? { translate: (key: string, fallback: string, params?: Record<string, unknown>) => i18n.translate(key, params, fallback) } : {}),
  }), [bridge, id, spec, title, i18n])
  return null
}

export interface LumiSpecPageProps extends Omit<
  LumiProviderProps,
  'children' | 'initialState'
> {
  catalog: Catalog
  spec?: Spec
  src?: string
  loader?: LumiJsonLoader<Spec>
  cacheKey?: string
  reloadKey?: unknown
  loadOptions?: LumiLoadOptions
  /** Shows the page to the agent bridge; defaults to true. Set false for previews and examples. */
  agent?: boolean
  /** The page's name for the agent, e.g. its menu title. */
  agentTitle?: string
  /**
   * Top-level state entries set over the Spec's own `state` when the page
   * mounts, e.g. `{ drawer: { id: 12 } }` for a page opened in a drawer. The
   * document stays the same for every caller and is cached once.
   */
  initialState?: Record<string, unknown>
}
/** Loads a page Spec by `src` (or takes `spec`), validates it against the Catalog and renders it inside a `LumiProvider`. */
export function LumiSpecPage({
  catalog,
  spec,
  src,
  loader: suppliedLoader,
  cacheKey,
  reloadKey,
  loadOptions,
  agent = true,
  agentTitle,
  initialState,
  ...provider
}: LumiSpecPageProps): ReactElement | null {
  const loader = useMemo(
    () =>
      suppliedLoader
      ?? createSpecLoader(catalog, {
        directives: provider.directives,
        baseURL: typeof location === 'undefined' ? undefined : location.href,
      }),
    [suppliedLoader, catalog, provider.directives],
  )
  const [loaded, setLoaded] = useState<{
    source: unknown
    spec?: Spec
    error?: unknown
  }>()
  const previousReload = useRef(reloadKey)
  useEffect(() => {
    const reloading = previousReload.current !== reloadKey
    previousReload.current = reloadKey
    const controller = new AbortController()
    const source = src ?? spec
    if (!source) {
      setLoaded({ source, error: new Error('[lumi] Provide spec or src.') })
      return
    }
    void loader
      .load(source, {
        ...loadOptions,
        cache: reloading ? 'reload' : loadOptions?.cache,
        cacheKey,
        signal: controller.signal,
      })
      .then((value) => {
        if (!controller.signal.aborted)
          setLoaded({ source, spec: value })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoaded({ source, error })
      })
    return () => controller.abort()
  }, [src, spec, loader, cacheKey, reloadKey, loadOptions])
  const source = src ?? spec
  if (!loaded || loaded.source !== source)
    return <div role="status">Loading page…</div>
  if (loaded.error) {
    return (
      <div role="alert">
        {loaded.error instanceof Error
          ? loaded.error.message
          : 'Could not load page.'}
        {/* A rejected backend Spec names the failing paths, as lumi-check does. */}
        {loaded.error instanceof LumiLoadError && loaded.error.diagnostics?.length
          ? (
              <ul>
                {loaded.error.diagnostics.slice(0, 10).map(issue => (
                  <li key={`${issue.path}:${issue.code}`}>
                    <code>{issue.path || '/'}</code>
                    {' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )
          : null}
      </div>
    )
  }
  if (!loaded.spec)
    return null
  return <SpecContent {...provider} spec={loaded.spec} agent={agent} agentTitle={agentTitle} initialState={initialState} />
}
function SpecContent({
  spec,
  agent,
  agentTitle,
  initialState,
  ...provider
}: Omit<LumiProviderProps, 'children' | 'initialState'> & {
  spec: Spec
  agent: boolean
  agentTitle?: string | undefined
  initialState?: Record<string, unknown> | undefined
}): ReactElement | null {
  const [store] = useState(() => createStateStore(initialState ? { ...spec.state, ...initialState } : spec.state))
  // A page's own `translations` win over the shared ones, for this page only.
  const given = (spec as { translations?: I18nTranslations }).translations
  // A reloaded document is a new object; the same text keeps the same context,
  // so the memo is keyed by content rather than by the document's identity.
  const translationsKey = given ? JSON.stringify(given) : ''
  const translations = useMemo(() => given, [translationsKey])
  const shared = provider.context
  const context = useMemo<LumiContext>(() => {
    if (!translations || !shared.i18nProvider)
      return shared
    const i18nProvider = withPageTranslations(shared.i18nProvider, translations)
    return { ...shared, i18nProvider, config: { ...shared.config, i18nProvider } }
  }, [shared, translations])
  return (
    <LumiSpecSource spec={spec}>
      <LumiProvider {...provider} context={context} store={provider.store ?? store}>
        {agent && <AgentPage spec={spec} title={agentTitle} />}
        <Renderer spec={spec} registry={provider.registry} />
      </LumiProvider>
    </LumiSpecSource>
  )
}
