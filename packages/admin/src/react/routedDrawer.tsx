import type { Size } from '@duxweb/lumi-ui'
import type { ComponentType, PropsWithChildren, ReactElement, ReactNode } from 'react'
import { LumiDialog as Dialog, LumiDrawer as Drawer } from '@duxweb/lumi-ui'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LumiUnsavedChangesScope, useUnsavedChangesCoordinator } from './pages/useUnsavedChangesGuard.js'

export interface AdminRoutedDrawerDefinition {
  title: string
  component: ComponentType
  description?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
  size?: Size
}

export type AdminRoutedDrawerRegistry = Record<string, AdminRoutedDrawerDefinition>

/** How a drawer opens: its record, its own title and look, and values for a JSON page. */
export interface AdminDrawerOpenOptions {
  /** The record it shows; a JSON page reads it at `/drawer/id`. */
  id?: string | number
  /** Values a JSON page reads at `/drawer/params`. They travel in the address, so keep them small. */
  params?: Record<string, unknown>
  /** Heading; a registered drawer defaults to its own. */
  title?: string
  /** `drawer` (default) slides in from the side; `modal` is a centred dialog. */
  mode?: 'drawer' | 'modal'
  size?: Size
}

/** One open layer: a registered drawer's name or a JSON page's address, with how it opened. */
export interface AdminDrawerLayer extends AdminDrawerOpenOptions {
  target: string
}

export interface AdminDrawerController {
  /** The target of this layer (inside a drawer) or of the top layer (elsewhere). */
  activeKey?: string
  recordId?: string
  /** Every open layer, bottom first. */
  layers: AdminDrawerLayer[]
  /**
   * Opens a registered drawer by name or a JSON page by address (`/pages/x.json`).
   * From the page it replaces whatever is open; from inside a drawer it opens
   * on top of that drawer.
   */
  open: (target: string, options?: string | number | AdminDrawerOpenOptions) => void
  /** Closes this layer (inside a drawer) or the top layer (elsewhere), and any above it. */
  close: () => void
}

export interface AdminDrawerChrome {
  /**
   * Identity of this chrome snapshot. Change it when the footer or title
   * should refresh; the host stores the nodes from that render.
   */
  revision: string
  title?: string
  description?: string
  footerStart?: ReactNode
  footerEnd?: ReactNode
}

/** Renders a JSON page layer; createAdmin supplies it with its catalog, registry and loader. */
export type AdminDrawerPageRenderer = (layer: AdminDrawerLayer) => ReactNode

/** Deeper stacks replace the top layer instead of growing. */
export const MAX_DRAWER_LAYERS = 3

const DRAWER_QUERY_KEY = 'drawer'
const RECORD_QUERY_KEY = 'record'
const PARAMS_QUERY_KEY = 'drawerParams'
const TITLE_QUERY_KEY = 'drawerTitle'
const MODE_QUERY_KEY = 'drawerMode'
const SIZE_QUERY_KEY = 'drawerSize'
const DRAWER_BASE_STATE_KEY = 'lumiDrawerBase'
const SIZES = new Set<string>(['sm', 'md', 'lg'])
const SCHEME_RE = /^[a-z][a-z\d+.-]*:/i
const JSON_FILE_RE = /\.json(?:$|[?#])/i
// Spaces and control characters: a URL parser trims or drops them, so
// ` https://…` or `/\t/host` would read as another site once resolved.
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const BLANK_OR_CONTROL_RE = /[\u0000-\u0020\u007F]/
const AdminDrawerContext = createContext<AdminDrawerController | null>(null)
const AdminDrawerChromeSetContext = createContext<((chrome: AdminDrawerChrome | undefined) => void) | null>(null)

/**
 * A JSON page address a drawer may open: a path on this site (`/pages/x.json`)
 * or one relative to the manifest (`pages/x.json`). Another origin, a
 * protocol-relative or a scripted URL is refused, because the address arrives
 * from the location bar where anyone can write a link.
 */
export function isDrawerPageSource(target: string): boolean {
  return target.length > 0
    && !BLANK_OR_CONTROL_RE.test(target)
    && !target.startsWith('//')
    && !target.includes('\\')
    && !SCHEME_RE.test(target)
    && (target.startsWith('/') || target.startsWith('./') || JSON_FILE_RE.test(target))
}

/** The layers a location's query describes; each key repeats once per layer, empty where a layer has none. */
export function readDrawerLayers(search: string): AdminDrawerLayer[] {
  const query = new URLSearchParams(search)
  const all = (key: string): string[] => query.getAll(key)
  const at = (key: string, index: number): string | undefined => all(key)[index] || undefined
  return all(DRAWER_QUERY_KEY).filter(Boolean).slice(0, MAX_DRAWER_LAYERS).map((target, index) => {
    const raw = at(PARAMS_QUERY_KEY, index)
    let params: Record<string, unknown> | undefined
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : undefined
      params = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
    }
    catch {}
    const mode = at(MODE_QUERY_KEY, index)
    const size = at(SIZE_QUERY_KEY, index)
    const record = at(RECORD_QUERY_KEY, index)
    const title = at(TITLE_QUERY_KEY, index)
    return {
      target,
      ...(record !== undefined ? { id: record } : {}),
      ...(params ? { params } : {}),
      ...(title ? { title } : {}),
      ...(mode === 'modal' || mode === 'drawer' ? { mode } : {}),
      ...(size && SIZES.has(size) ? { size: size as Size } : {}),
    }
  })
}

/** The query with `layers` written over any drawer keys it had. */
export function writeDrawerLayers(search: string, layers: AdminDrawerLayer[]): URLSearchParams {
  const query = new URLSearchParams(search)
  const columns: Array<[string, (layer: AdminDrawerLayer) => string | undefined]> = [
    [DRAWER_QUERY_KEY, layer => layer.target],
    [RECORD_QUERY_KEY, layer => (layer.id === undefined ? undefined : String(layer.id))],
    [PARAMS_QUERY_KEY, layer => (layer.params && Object.keys(layer.params).length ? JSON.stringify(layer.params) : undefined)],
    [TITLE_QUERY_KEY, layer => layer.title],
    [MODE_QUERY_KEY, layer => layer.mode],
    [SIZE_QUERY_KEY, layer => layer.size],
  ]
  for (const [key, read] of columns) {
    query.delete(key)
    const values = layers.map(layer => read(layer) ?? '')
    // A key appears only when some layer has it; then once per layer, in order.
    if (values.some(Boolean))
      values.forEach(value => query.append(key, value))
  }
  return query
}

function locationPath(location: { pathname: string, search: string, hash: string }): string {
  return `${location.pathname}${location.search}${location.hash}`
}

function locationState(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function openOptions(value: string | number | AdminDrawerOpenOptions | undefined): AdminDrawerOpenOptions {
  return typeof value === 'object' ? value : value === undefined ? {} : { id: value }
}

/** The guard scope of one layer, so closing a layer asks only about its own unsaved changes. */
export function drawerLayerScope(index: number): `routed-drawer:${number}` {
  return `routed-drawer:${index}`
}

/** Keeps the open drawer layers in the address (`?drawer=…&record=…`) and renders registered drawers and drawer pages. */
export function AdminRoutedDrawerProvider({ drawers, renderPage, children }: PropsWithChildren<{ drawers?: AdminRoutedDrawerRegistry, renderPage?: AdminDrawerPageRenderer }>): ReactElement {
  const registry = drawers ?? {}
  const location = useLocation()
  const navigate = useNavigate()
  const guard = useUnsavedChangesCoordinator()
  const layers = useMemo(() => readDrawerLayers(location.search), [location.search])
  const known = (layer: AdminDrawerLayer): boolean =>
    Object.hasOwn(registry, layer.target) || (Boolean(renderPage) && isDrawerPageSource(layer.target))
  const [chrome, setChrome] = useState<Record<number, AdminDrawerChrome | undefined>>({})
  // One stable setter per layer: a drawer's chrome effect depends on it.
  const chromeSetters = useRef(new Map<number, (value: AdminDrawerChrome | undefined) => void>())
  const chromeSetter = (index: number): ((value: AdminDrawerChrome | undefined) => void) => {
    let setter = chromeSetters.current.get(index)
    if (!setter) {
      setter = value => setChrome(current => ({ ...current, [index]: value }))
      chromeSetters.current.set(index, setter)
    }
    return setter
  }

  const show = useCallback((next: AdminDrawerLayer[], replace: boolean): void => {
    const query = writeDrawerLayers(location.search, next)
    const state = locationState(location.state)
    const base = state[DRAWER_BASE_STATE_KEY]
    // The first layer opened from the page is a history entry, so Back closes it.
    const pushes = !replace && layers.length === 0 && next.length > 0
    const nextState = pushes && typeof base !== 'string' ? { ...state, [DRAWER_BASE_STATE_KEY]: locationPath(location) } : state
    void navigate(`${location.pathname}${query.size > 0 ? `?${query.toString()}` : ''}${location.hash}`, { replace: !pushes, state: nextState })
  }, [layers.length, location, navigate])

  /** Closes layer `index` and every layer above it, asking about unsaved changes from the top down. */
  const closeFrom = useCallback((index: number): void => {
    const finish = (): void => {
      const base = locationState(location.state)[DRAWER_BASE_STATE_KEY]
      if (index === 0 && typeof base === 'string')
        void navigate(-1)
      else
        show(layers.slice(0, index), true)
    }
    const ask = (layer: number): void => {
      if (layer < index) {
        finish()
        return
      }
      guard.requestScope(drawerLayerScope(layer), () => ask(layer - 1), true)
    }
    ask(layers.length - 1)
  }, [guard, layers, location.state, navigate, show])

  /** Opens `target` above layer `depth - 1`, dropping what was above it. */
  const openAt = useCallback((depth: number, target: string, given?: string | number | AdminDrawerOpenOptions): void => {
    const layer: AdminDrawerLayer = { target, ...openOptions(given) }
    if (!known(layer)) {
      throw new Error(Object.hasOwn(registry, target) || isDrawerPageSource(target)
        ? `[lumi-admin] drawer "${target}" needs a JSON page renderer`
        : `[lumi-admin] routed drawer "${target}" is not registered and is not a page address`)
    }
    const kept = layers.slice(0, Math.min(depth, MAX_DRAWER_LAYERS - 1))
    const next = [...kept, layer]
    if (JSON.stringify(writeDrawerLayers('', next).toString()) === JSON.stringify(writeDrawerLayers('', layers).toString()))
      return
    show(next, layers.length > 0)
  }, [layers, registry, renderPage, show])

  // A shared link may name a drawer this app does not have; drop it and those above it.
  const firstUnknown = layers.findIndex(layer => !known(layer))
  useEffect(() => {
    if (firstUnknown < 0)
      return
    console.warn(`[lumi-admin] ignoring unknown routed drawer "${layers[firstUnknown]!.target}"`)
    show(layers.slice(0, firstUnknown), true)
  }, [firstUnknown, layers, show])
  const visible = firstUnknown < 0 ? layers : layers.slice(0, firstUnknown)

  // Controllers change only with the layers: a drawer effect may depend on one
  // (close after save), and a new object each render would close it again.
  const actions = useRef({ openAt, closeFrom })
  actions.current = { openAt, closeFrom }
  const controllers = useMemo(() => Array.from({ length: visible.length + 1 }, (_, depth): AdminDrawerController => {
    const own = depth > 0 ? visible[depth - 1] : visible.at(-1)
    return {
      activeKey: own?.target,
      recordId: own?.id === undefined ? undefined : String(own.id),
      layers: visible,
      open: (target, options) => actions.current.openAt(depth, target, options),
      close: () => {
        const index = depth > 0 ? depth - 1 : visible.length - 1
        if (index >= 0)
          actions.current.closeFrom(index)
      },
    }
  }), [visible])

  const pageController = controllers[0]!
  return (
    <AdminDrawerContext.Provider value={pageController}>
      {children}
      {visible.map((layer, index) => (
        <DrawerLayer
          // The target is part of the key, so another page in the same layer starts afresh.
          key={`${index}:${layer.target}:${layer.id ?? ''}`}
          layer={layer}
          index={index}
          definition={registry[layer.target]}
          renderPage={renderPage}
          chrome={chrome[index]}
          setChrome={chromeSetter(index)}
          controller={controllers[index + 1]!}
        />
      ))}
    </AdminDrawerContext.Provider>
  )
}

function DrawerLayer({ layer, index, definition, renderPage, chrome, setChrome, controller }: {
  layer: AdminDrawerLayer
  index: number
  definition: AdminRoutedDrawerDefinition | undefined
  renderPage: AdminDrawerPageRenderer | undefined
  chrome: AdminDrawerChrome | undefined
  setChrome: (chrome: AdminDrawerChrome | undefined) => void
  controller: AdminDrawerController
}): ReactElement {
  const Content = definition?.component
  const body = (
    <AdminDrawerContext.Provider value={controller}>
      <AdminDrawerChromeSetContext.Provider value={setChrome}>
        <LumiUnsavedChangesScope scope={drawerLayerScope(index)}>
          {Content ? <Content /> : renderPage?.(layer)}
        </LumiUnsavedChangesScope>
      </AdminDrawerChromeSetContext.Provider>
    </AdminDrawerContext.Provider>
  )
  const title = chrome?.title ?? layer.title ?? definition?.title ?? ''
  const description = chrome?.description ?? definition?.description
  const onOpenChange = (value: boolean): void => {
    if (!value)
      controller.close()
  }
  if (layer.mode === 'modal') {
    return (
      <Dialog
        open
        title={title}
        description={description}
        size={layer.size}
        footerStart={chrome?.footerStart}
        footerEnd={chrome?.footerEnd}
        onOpenChange={onOpenChange}
      >
        {body}
      </Dialog>
    )
  }
  return (
    <Drawer
      open
      title={title}
      description={description}
      side={definition?.side}
      size={layer.size ?? definition?.size}
      footerStart={chrome?.footerStart}
      footerEnd={chrome?.footerEnd}
      onOpenChange={onOpenChange}
    >
      {body}
    </Drawer>
  )
}

/** The routed drawer controller: `open(target, options?)`, `close()`, the open layers and this layer's key and record. */
export function useAdminDrawer(): AdminDrawerController {
  const controller = useContext(AdminDrawerContext)
  if (!controller)
    throw new Error('[lumi-admin] useAdminDrawer requires createAdmin({ drawers })')
  return controller
}

/**
 * Shell chrome reads this: a manifest header action may name a drawer the
 * host never registered, and the shell must render anyway.
 */
export function useAdminDrawerOptional(): AdminDrawerController | null {
  return useContext(AdminDrawerContext)
}

/** Lets a routed drawer's content set its title and footer. */
export function useAdminDrawerChrome(chrome: AdminDrawerChrome): void {
  const setChrome = useContext(AdminDrawerChromeSetContext)
  if (!setChrome)
    throw new Error('[lumi-admin] useAdminDrawerChrome requires a routed drawer')
  const chromeRef = useRef(chrome)
  chromeRef.current = chrome
  useLayoutEffect(() => {
    setChrome(chromeRef.current)
    return () => setChrome(undefined)
  }, [chrome.revision, setChrome])
}
