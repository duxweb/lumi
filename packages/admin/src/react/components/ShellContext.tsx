import type { LumiContext } from '@duxweb/lumi'
import type { SelectionExtra, TableSelection } from '@duxweb/lumi-ui'
import type { PropsWithChildren, ReactElement, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { AdminApp, AdminEventHandler, AdminRoute } from '../../catalog.js'
import type { AdminColorModeValue } from '../colorMode.js'
import type {
  AdminIdentity,
  LumiAdminMenuItem,
  ShellColorModePreference,
  ShellContextValue,
} from '../types.js'
import { executeAuthAction, useChangeLocale, useClient, useIdentity, useLocale, useLumi, useTranslate } from '@duxweb/lumi'
import { LumiSelectionExtras } from '@duxweb/lumi-ui'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { matchPath, useHref, useLocation, useNavigate } from 'react-router'
import { AdminColorModeProvider, readStoredColorMode, useAdminColorMode, writeStoredLocale } from '../colorMode.js'
import { buildModules, groupMenu } from '../menu.js'
import { findAdminRouteMatch, findBestAdminPath } from '../routeMatch.js'
import { AdminDocumentTitle } from './DocumentTitle.js'
import { ShellContextPanelProvider } from './ShellContextPanel.js'

const STORAGE_WARNING_PREFIX = '[lumi-admin] shell storage:'
const TRAILING_SLASHES_RE = /\/+$/
const LUMI_QUERY_KEY = ['lumi'] as const
const PATH_SUFFIX_RE = /[?#]/

interface PersistedTab {
  key: string
  path: string
}

interface ShellPreferences {
  collapsed: boolean
  colorMode: ShellColorModePreference
  assistant?: boolean
}

interface ShellState {
  query: string
  collapsed: boolean
  assistantOpen: boolean
  mobileOpen: boolean
  tabs: PersistedTab[]
  reloads: Record<string, number>
  logoutPending: boolean
  logoutError?: unknown
}

type ShellAction
  = | { type: 'query', value: string }
    | { type: 'toggle-collapsed' }
    | { type: 'toggle-assistant' }
    | { type: 'open-mobile' }
    | { type: 'close-mobile' }
    | { type: 'visit', key: string, path: string, homePath: string }
    | { type: 'tabs', tabs: PersistedTab[] }
    | { type: 'reload', key: string }
    | { type: 'logout-start' }
    | { type: 'logout-success' }
    | { type: 'logout-error', error: unknown }

interface ShellInternalContextValue {
  facade: ShellContextValue
  headerEnd?: ReactNode
  assistant?: ReactNode
  sidebarFooter?: ReactNode
  menuBadges?: Readonly<Record<string, ShellMenuBadge>>
  onEvent?: AdminEventHandler
  reloadKey: (path: string) => number
  setMobileTrigger: (element: HTMLButtonElement | null) => void
}

export interface LumiAdminShellProviderProps extends PropsWithChildren {
  app: AdminApp
  menu: LumiAdminMenuItem[]
  context?: LumiContext
  shellStorageKey?: string
  /** Whether the assistant panel starts open before the reader toggles it; defaults to open. */
  assistantDefaultOpen?: boolean
  routePatterns?: readonly string[]
  authPending?: boolean
  authError?: unknown
  onLogout?: () => Promise<void> | void
  onReloadTab?: (key: string, active: boolean) => void
  /**
   * Host slot for the header's trailing edge — the design puts app-wide chrome
   * there (a notifications bell), and the shell cannot invent the feature
   * behind it. Account controls stay on the rail's avatar menu.
   */
  headerEnd?: ReactNode
  /**
   * Host slot for a panel beside the page, such as an AI assistant. The shell
   * owns its frame, toggle and persisted open state; the host owns everything
   * inside it.
   */
  assistant?: ReactNode
  /** Host slot at the foot of the navigation sidebar, below the menu. */
  sidebarFooter?: ReactNode
  /**
   * Live counts beside menu items, keyed by route name. The manifest is static,
   * so the host supplies what changes with its data.
   */
  menuBadges?: Readonly<Record<string, ShellMenuBadge>>
  /** Receives events emitted by manifest header actions. */
  onEvent?: AdminEventHandler
  /** Called when the user picks another workspace in the sidebar switcher. */
  onWorkspaceChange?: (value: string) => void
}

/** A count beside a menu item; `warning` marks one that needs attention. */
export interface ShellMenuBadge {
  label: string | number
  tone?: 'neutral' | 'warning'
}

const ShellContext = createContext<ShellInternalContextValue | null>(null)

// Hidden routes still provide labels for open pages without becoming menu items.
export const AdminRouteLabelsContext = createContext<readonly Pick<AdminRoute, 'path' | 'menu'>[]>([])

function isColorMode(value: unknown): value is ShellColorModePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function warnStorage(operation: string, error: unknown): void {
  console.warn(`${STORAGE_WARNING_PREFIX} ${operation}`, error)
}

function readJson<T>(kind: 'localStorage' | 'sessionStorage', key: string, validate: (value: unknown) => value is T): T | undefined {
  try {
    const raw = window[kind].getItem(key)
    if (raw === null)
      return undefined
    const value: unknown = JSON.parse(raw)
    if (!validate(value))
      throw new Error(`Invalid persisted value for ${key}`)
    return value
  }
  catch (error) {
    warnStorage(`could not read ${key}; using memory state.`, error)
    return undefined
  }
}

function writeJson(kind: 'localStorage' | 'sessionStorage', key: string, value: unknown): void {
  try {
    window[kind].setItem(key, JSON.stringify(value))
  }
  catch (error) {
    warnStorage(`could not write ${key}; using memory state.`, error)
  }
}

/**
 * Forgets the open tabs kept under a shell storage namespace. The Admin calls
 * it when the reader signs out or the session ends, so the next reader in the
 * same browser tab does not get this one's pages and record addresses.
 */
export function clearShellTabs(storageBase: string): void {
  try {
    window.sessionStorage.removeItem(`${storageBase}:tabs`)
  }
  catch (error) {
    warnStorage(`could not clear ${storageBase}:tabs.`, error)
  }
}

function isPersistedTabs(value: unknown): value is PersistedTab[] {
  return Array.isArray(value) && value.every(tab => typeof tab === 'object'
    && tab !== null
    && Object.keys(tab).every(key => key === 'key' || key === 'path')
    && typeof (tab as PersistedTab).key === 'string'
    && typeof (tab as PersistedTab).path === 'string')
}

function isPreferences(value: unknown): value is ShellPreferences {
  return typeof value === 'object'
    && value !== null
    && Object.keys(value).every(key => key === 'collapsed' || key === 'colorMode' || key === 'assistant')
    && typeof (value as ShellPreferences).collapsed === 'boolean'
    && isColorMode((value as ShellPreferences).colorMode)
    && ['boolean', 'undefined'].includes(typeof (value as ShellPreferences).assistant)
}

function initialState(options: { tabsKey: string, preferencesKey: string, assistantDefaultOpen: boolean }): ShellState {
  const preferences = typeof window === 'undefined'
    ? undefined
    : readJson('localStorage', options.preferencesKey, isPreferences)
  const tabs = typeof window === 'undefined'
    ? undefined
    : readJson('sessionStorage', options.tabsKey, isPersistedTabs)
  return {
    query: '',
    collapsed: preferences?.collapsed ?? false,
    assistantOpen: preferences?.assistant ?? options.assistantDefaultOpen,
    mobileOpen: false,
    tabs: tabs ?? [],
    reloads: {},
    logoutPending: false,
  }
}

function reducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'query':
      return { ...state, query: action.value }
    case 'toggle-collapsed':
      return { ...state, collapsed: !state.collapsed }
    case 'toggle-assistant':
      return { ...state, assistantOpen: !state.assistantOpen }
    case 'open-mobile':
      return { ...state, mobileOpen: true }
    case 'close-mobile':
      return { ...state, mobileOpen: false }
    case 'visit': {
      const withHome = state.tabs.some(tab => tab.key === action.homePath)
        ? state.tabs
        : [{ key: action.homePath, path: action.homePath }, ...state.tabs]
      const exists = withHome.some(tab => tab.key === action.key)
      const tabs = exists
        ? withHome.map(tab => tab.key === action.key ? { ...tab, path: action.path } : tab)
        : [...withHome, { key: action.key, path: action.path }]
      return { ...state, tabs }
    }
    case 'tabs':
      return { ...state, tabs: action.tabs.map(tab => ({ ...tab })) }
    case 'reload':
      return { ...state, reloads: { ...state.reloads, [action.key]: (state.reloads[action.key] ?? 0) + 1 } }
    case 'logout-start':
      return { ...state, logoutPending: true, logoutError: undefined }
    case 'logout-success':
      return { ...state, logoutPending: false, logoutError: undefined }
    case 'logout-error':
      return { ...state, logoutPending: false, logoutError: action.error }
  }
}

export function findLongestMenuItem(items: readonly LumiAdminMenuItem[], pathname: string): LumiAdminMenuItem | undefined {
  return findBestAdminPath(items, pathname)
}

function pathnameOf(path: string): string {
  return path.split(PATH_SUFFIX_RE, 1)[0] ?? path
}

function sanitizeTabs(tabs: readonly PersistedTab[], routePatterns: readonly { path: string }[], homePath: string): PersistedTab[] {
  const keys = new Set<string>()
  return tabs.flatMap((tab) => {
    const routeExists = tab.key === homePath || findAdminRouteMatch(routePatterns, pathnameOf(tab.key)) !== undefined
    if (!routeExists || pathnameOf(tab.path) !== tab.key || keys.has(tab.key))
      return []
    keys.add(tab.key)
    return [{ key: tab.key, path: tab.path }]
  })
}

function sameTabs(left: readonly PersistedTab[], right: readonly PersistedTab[]): boolean {
  return left.length === right.length && left.every((tab, index) => tab.key === right[index]?.key && tab.path === right[index]?.path)
}

/** Lets a page hide the assistant while it is mounted; see `useHideShellAssistant`. */
const AssistantHideContext = createContext<(() => () => void) | null>(null)
/** Holds the shell's state (menu, tabs, preferences, workspace) for the shell components and `useShell`. */
export function LumiAdminShellProvider(props: LumiAdminShellProviderProps): ReactElement {
  const colorMode = useAdminColorMode()
  if (colorMode)
    return <LumiAdminShellProviderContent {...props} colorMode={colorMode} />

  const storageBase = props.shellStorageKey ?? `lumi:${props.app.id}:shell`
  const initialPreference = typeof window === 'undefined' ? 'system' : readStoredColorMode(storageBase, 'system')
  return (
    <AdminColorModeProvider initialPreference={initialPreference}>
      <LumiAdminShellProviderWithColorMode {...props} />
    </AdminColorModeProvider>
  )
}

function LumiAdminShellProviderWithColorMode(props: LumiAdminShellProviderProps): ReactElement {
  const colorMode = useAdminColorMode()
  if (!colorMode)
    throw new Error('[lumi-admin] missing Admin color mode root')
  return <LumiAdminShellProviderContent {...props} colorMode={colorMode} />
}

function LumiAdminShellProviderContent(props: LumiAdminShellProviderProps & { colorMode: AdminColorModeValue }): ReactElement {
  const inheritedContext = useLumi()
  const context = props.context ?? inheritedContext
  const { colorMode } = props
  const translate = useTranslate()
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const identity = useIdentity<AdminIdentity>()
  const queryClient = useClient()
  const location = useLocation()
  const navigateRouter = useNavigate()
  // The router's basename: `/` at the root, `/admin` for a panel below it.
  const basename = useHref('/')
  const routeLabels = useContext(AdminRouteLabelsContext)
  const layout = props.app.layout ?? 'dual'
  const title = props.app.titleKey ? translate(props.app.titleKey, undefined, props.app.title) : props.app.title ?? translate('lumi.admin.title', undefined, 'Lumi Admin')
  const subtitle = props.app.subtitleKey ? translate(props.app.subtitleKey, undefined, props.app.subtitle) : props.app.subtitle
  const search = props.app.search ?? 'sidebar'
  const workspaceOptions = props.app.workspaces ?? []
  // With a Lumi tenant provider the workspace is the tenant every request
  // carries; the Shell only shows and switches it. A stored tenant missing
  // from the menu falls back to `app.workspace` or the first entry, set before
  // any page queries so nothing is fetched for the wrong one: layout effects
  // run before the pages' queries subscribe and fetch in passive effects.
  const tenants = context.tenantProvider
  const fallbackWorkspace = props.app.workspace ?? workspaceOptions[0]?.value
  const [localWorkspace, setLocalWorkspace] = useState(fallbackWorkspace)
  const workspaceValues = workspaceOptions.map(option => option.value).join('\n')
  useLayoutEffect(() => {
    const stored = tenants?.get()
    if (tenants && workspaceValues && fallbackWorkspace && !workspaceValues.split('\n').includes(stored ?? ''))
      tenants.set(fallbackWorkspace)
  }, [tenants, workspaceValues, fallbackWorkspace])
  const subscribeTenant = useCallback((listener: () => void) => tenants?.subscribe(listener) ?? (() => {}), [tenants])
  const tenantValue = useSyncExternalStore(subscribeTenant, () => tenants?.get(), () => tenants?.get())
  const workspaceValue = tenants && workspaceOptions.length ? tenantValue : localWorkspace
  const currentWorkspace = workspaceOptions.find(option => option.value === workspaceValue) ?? workspaceOptions[0]
  const onWorkspaceChange = props.onWorkspaceChange
  const selectWorkspace = useCallback((value: string) => {
    setLocalWorkspace(value)
    tenants?.set(value)
    onWorkspaceChange?.(value)
  }, [onWorkspaceChange, tenants])
  const storageBase = props.shellStorageKey ?? `lumi:${props.app.id}:shell`
  const tabsKey = `${storageBase}:tabs`
  const preferencesKey = `${storageBase}:preferences`
  const [state, dispatch] = useReducer(reducer, { tabsKey, preferencesKey, assistantDefaultOpen: props.assistantDefaultOpen ?? true }, initialState)
  const menu = useMemo(() => {
    // Items without a group or module share one, named in the reader's language.
    const workspace = { name: 'workspace', label: translate('lumi.admin.workspace', undefined, 'Workspace'), icon: 'layout-grid' }
    return props.menu.map(item => ({
      ...item,
      label: item.labelKey ? translate(item.labelKey, undefined, item.label) : item.label,
      group: item.group ? { ...item.group, label: item.group.labelKey ? translate(item.group.labelKey, undefined, item.group.label) : item.group.label } : workspace,
      module: item.module ? { ...item.module, label: item.module.labelKey ? translate(item.module.labelKey, undefined, item.module.label) : item.module.label } : workspace,
    }))
  }, [props.menu, translate, locale])
  const groups = useMemo(() => groupMenu(menu), [menu])
  const modules = useMemo(() => buildModules(menu), [menu])
  const allItems = useMemo(() => groups.flatMap(group => group.items), [groups])
  const routePatterns = useMemo(
    () => (props.routePatterns ?? allItems.map(item => item.path)).map(path => ({ path })),
    [allItems, props.routePatterns],
  )
  const activeItem = findLongestMenuItem(allItems, location.pathname)
  const activeModule = activeItem
    ? modules.find(module => module.groups.some(group => group.items.some(item => item.path === activeItem.path)))
    : undefined
  const activeGroup = activeItem
    ? (activeModule?.groups.find(group => group.items.some(item => item.path === activeItem.path))
      ?? groups.find(group => group.items.some(item => item.path === activeItem.path)))
    : undefined
  const homePath = allItems[0]?.path ?? '/'
  const sanitizedTabs = useMemo(() => sanitizeTabs(state.tabs, routePatterns, homePath), [homePath, routePatterns, state.tabs])
  const mobileTrigger = useRef<HTMLButtonElement | null>(null)
  const mobileFocusTarget = useRef<'main' | 'trigger' | undefined>(undefined)
  const logoutPending = useRef(false)

  // Closing the open tab leaves its page first: the tab goes once the reader
  // is on the next one, so "keep editing" on unsaved changes keeps the tab too.
  const closing = useRef<{ pathname: string, tabs: PersistedTab[] } | undefined>(undefined)
  const leaveThenClose = useCallback((tabs: PersistedTab[], target: PersistedTab): void => {
    closing.current = { pathname: pathnameOf(target.path), tabs }
    void navigateRouter(target.path)
  }, [navigateRouter])
  useEffect(() => {
    const pending = closing.current
    closing.current = undefined
    if (pending?.pathname === location.pathname)
      dispatch({ type: 'tabs', tabs: pending.tabs })
  }, [location.pathname])

  useEffect(() => {
    if (props.app.tabs === false)
      return
    const fullPath = `${location.pathname}${location.search}${location.hash}`
    dispatch({ type: 'visit', key: location.pathname, path: fullPath, homePath })
  }, [homePath, location.hash, location.pathname, location.search, props.app.tabs])

  useEffect(() => {
    if (!sameTabs(state.tabs, sanitizedTabs))
      dispatch({ type: 'tabs', tabs: sanitizedTabs })
    if (typeof window !== 'undefined')
      writeJson('sessionStorage', tabsKey, sanitizedTabs)
  }, [sanitizedTabs, state.tabs, tabsKey])

  const assistantConfigured = props.assistant !== undefined && props.assistant !== null
  // A page that is itself a conversation hides the assistant while it is mounted.
  const [assistantHides, setAssistantHides] = useState(0)
  const hideAssistant = useCallback(() => {
    setAssistantHides(count => count + 1)
    return () => setAssistantHides(count => count - 1)
  }, [])
  const assistantAvailable = assistantConfigured && assistantHides === 0
  useEffect(() => {
    if (typeof window !== 'undefined') {
      writeJson('localStorage', preferencesKey, {
        collapsed: state.collapsed,
        colorMode: colorMode.preference,
        ...(assistantConfigured ? { assistant: state.assistantOpen } : {}),
      } satisfies ShellPreferences)
    }
  }, [assistantConfigured, colorMode.preference, preferencesKey, state.assistantOpen, state.collapsed])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
      return
    const breakpoint = window.matchMedia(layout === 'dual' ? '(min-width: 1200px)' : '(min-width: 768px)')
    const closeAcrossBreakpoint = (): void => {
      if (!breakpoint.matches)
        return
      mobileFocusTarget.current = undefined
      dispatch({ type: 'close-mobile' })
    }
    closeAcrossBreakpoint()
    breakpoint.addEventListener('change', closeAcrossBreakpoint)
    return () => breakpoint.removeEventListener('change', closeAcrossBreakpoint)
  }, [layout])

  useEffect(() => {
    if (state.mobileOpen || !mobileFocusTarget.current)
      return
    const target = mobileFocusTarget.current
    mobileFocusTarget.current = undefined
    if (target === 'main')
      document.querySelector<HTMLElement>('[data-lumi-shell-main]')?.focus()
    else
      mobileTrigger.current?.focus()
  }, [state.mobileOpen])

  const setQuery = useCallback((value: string): void => dispatch({ type: 'query', value }), [])
  const toggleCollapsed = useCallback((): void => dispatch({ type: 'toggle-collapsed' }), [])
  const toggleAssistant = useCallback((): void => dispatch({ type: 'toggle-assistant' }), [])
  const openMobile = useCallback((): void => {
    mobileFocusTarget.current = 'trigger'
    dispatch({ type: 'open-mobile' })
  }, [])
  const closeMobile = useCallback((): void => {
    mobileFocusTarget.current = 'trigger'
    dispatch({ type: 'close-mobile' })
  }, [])
  const go = useCallback((path: string): void => {
    if (state.mobileOpen) {
      mobileFocusTarget.current = 'main'
      dispatch({ type: 'close-mobile' })
    }
    void navigateRouter(path)
  }, [navigateRouter, state.mobileOpen])

  // The agent bridge reads where the reader is and the pages the menu offers,
  // and opens them through the Shell, so nothing is declared per route.
  const agentRoutes = useRef({ items: allItems, active: activeItem, pathname: location.pathname, go, workspace: currentWorkspace })
  agentRoutes.current = { items: allItems, active: activeItem, pathname: location.pathname, go, workspace: currentWorkspace }
  const bridge = context.agentBridge
  useEffect(() => bridge?.registerNavigation({
    current: () => {
      const { active, pathname } = agentRoutes.current
      return { path: pathname, ...(active ? { title: String(active.label) } : {}) }
    },
    routes: () => agentRoutes.current.items.map(item => ({ path: item.path, title: String(item.label), ...(item.group?.label ? { group: String(item.group.label) } : {}) })),
    navigate: path => agentRoutes.current.go(path),
    workspace: () => {
      const { workspace } = agentRoutes.current
      return workspace ? { value: workspace.value, label: String(workspace.label) } : undefined
    },
  }), [bridge])

  // Selected table rows can go into the assistant's conversation: every
  // selection bar below gets the command while an assistant panel is there.
  const assistantOpenRef = useRef(state.assistantOpen)
  assistantOpenRef.current = state.assistantOpen
  const referenceRows = useCallback((selection: TableSelection): void => {
    if (!bridge)
      return
    const { active, pathname } = agentRoutes.current
    bridge.reference(selection.keys.map((key, index) => {
      const row = selection.rows[index]
      return {
        id: `row:${pathname}:${String(key)}`,
        label: row ? recordLabel(row, key) : `#${String(key)}`,
        kind: 'record',
        ...(active ? { description: String(active.label) } : {}),
        ...(row ? { data: row } : {}),
      }
    }))
    if (!assistantOpenRef.current)
      dispatch({ type: 'toggle-assistant' })
  }, [bridge])

  // Library links (Button `href`, Card `href`, Markdown) are plain anchors so a
  // Spec can carry them. A same-origin left click inside the Shell routes
  // client-side instead of reloading the app; new-tab, modified, download and
  // external clicks keep the browser default, and a handler that already
  // called preventDefault wins. The listener sits on the Shell's React tree,
  // not the document, so portaled overlays count while links of a host page
  // that embeds the Shell (a site header beside a live demo) stay untouched.
  // Below a basename a link may be written either way: `/admin/users` (the
  // address itself) loses the basename the router adds back, and `/users`
  // (the route) is taken as it is.
  const routeLinkClick = useCallback((event: ReactMouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download'))
      return
    const url = new URL(anchor.href)
    if (url.origin !== window.location.origin)
      return
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search)
      return
    event.preventDefault()
    const root = basename === '/' ? '' : basename.replace(TRAILING_SLASHES_RE, '')
    const inside = root !== '' && (url.pathname === root || url.pathname.startsWith(`${root}/`))
    const pathname = inside ? url.pathname.slice(root.length) || '/' : url.pathname
    go(`${pathname}${url.search}${url.hash}`)
  }, [basename, go])

  const closeTabs = useCallback((next: PersistedTab[], closedActiveKey?: string): void => {
    if (closedActiveKey !== location.pathname) {
      dispatch({ type: 'tabs', tabs: next })
      return
    }
    leaveThenClose(next, next.findLast(tab => tab.key !== closedActiveKey) ?? { key: homePath, path: homePath })
  }, [homePath, leaveThenClose, location.pathname])

  const logout = useCallback(async (): Promise<void> => {
    if (!context.authProvider)
      return
    if (logoutPending.current)
      return
    logoutPending.current = true
    dispatch({ type: 'logout-start' })
    try {
      const result = await executeAuthAction(context, queryClient, 'logout')
      if (result?.success === false)
        throw result.error ?? new Error('Logout failed')
      await props.onLogout?.()
      await context.routerProvider?.go({ to: result?.redirectTo ?? '/login', replace: true })
      dispatch({ type: 'logout-success' })
    }
    catch (error) {
      dispatch({ type: 'logout-error', error })
    }
    finally {
      logoutPending.current = false
    }
  }, [context, queryClient, props.onLogout])

  // A path's name, as its tab and the browser title show it: the route's or
  // menu item's label, followed by the route parameters it was opened with.
  const labelFor = (path: string): string => {
    const item = findLongestMenuItem(allItems, path)
    const route = findAdminRouteMatch(routeLabels, path)
    const source = route?.menu ?? item
    const label = source
      ? source.labelKey ? translate(source.labelKey, undefined, source.label) : source.label
      : (path === '/' ? translate('lumi.admin.dashboard', undefined, 'Dashboard') : path.slice(1))
    const params = route ? Object.values(matchPath(route.path, path)?.params ?? {}).filter(Boolean) : []
    return params.length > 0 ? `${label} · ${params.join(' / ')}` : label
  }
  const tabItems = sanitizedTabs.map(tab => ({
    ...tab,
    label: labelFor(tab.key),
    closable: tab.key !== homePath,
  }))

  const facade = useMemo<ShellContextValue>(() => ({
    app: { id: props.app.id, title, subtitle, logo: props.app.logo, layout, header: props.app.header, search },
    workspace: { options: workspaceOptions, current: currentWorkspace, select: selectWorkspace },
    menu,
    groups,
    modules,
    active: {
      pathname: location.pathname,
      item: activeItem,
      group: activeGroup,
      module: activeModule,
      breadcrumbs: [
        activeModule ? { key: `module:${activeModule.name}`, label: activeModule.label, path: activeModule.groups[0]?.items[0]?.path } : undefined,
        activeGroup ? { key: `group:${activeGroup.name}`, label: activeGroup.label, path: activeGroup.items[0]?.path } : undefined,
        activeItem ? { key: `item:${activeItem.name}`, label: activeItem.label, path: activeItem.path } : undefined,
      ].filter(breadcrumb => breadcrumb !== undefined),
    },
    navigation: {
      query: state.query,
      collapsed: state.collapsed,
      mobileOpen: state.mobileOpen,
      setQuery,
      toggleCollapsed,
      openMobile,
      closeMobile,
      navigate: go,
    },
    assistant: {
      available: assistantAvailable,
      open: assistantAvailable && state.assistantOpen,
      toggle: toggleAssistant,
    },
    tabs: {
      enabled: props.app.tabs !== false,
      items: tabItems,
      activeKey: props.app.tabs === false ? undefined : location.pathname,
      activate: (key) => {
        const tab = sanitizedTabs.find(item => item.key === key)
        if (tab)
          go(tab.path)
      },
      close: (key) => {
        if (key === homePath)
          return
        const index = sanitizedTabs.findIndex(item => item.key === key)
        if (index < 0)
          return
        const next = sanitizedTabs.filter(item => item.key !== key)
        if (key === location.pathname)
          leaveThenClose(next, next[Math.max(0, index - 1)] ?? next.at(-1) ?? { key: homePath, path: homePath })
        else
          dispatch({ type: 'tabs', tabs: next })
      },
      closeOthers: (key) => {
        const next = sanitizedTabs.filter(tab => tab.key === homePath || tab.key === key)
        closeTabs(next, next.some(tab => tab.key === location.pathname) ? undefined : location.pathname)
      },
      closeAll: () => closeTabs(sanitizedTabs.filter(tab => tab.key === homePath), location.pathname === homePath ? undefined : location.pathname),
      reload: (key) => {
        if (!sanitizedTabs.some(tab => tab.key === key))
          return
        const active = key === location.pathname
        props.onReloadTab?.(key, active)
        void queryClient.invalidateQueries({ queryKey: LUMI_QUERY_KEY, refetchType: active ? 'active' : 'none' })
        if (active)
          dispatch({ type: 'reload', key })
      },
    },
    identity: { value: identity.data ?? undefined, pending: identity.isPending, error: identity.error ?? undefined },
    colorMode,
    locale: {
      value: locale,
      options: props.app.locales ?? [],
      set: (next: string) => {
        writeStoredLocale(storageBase, next)
        void changeLocale(next)
      },
    },
    auth: {
      available: context.authProvider !== undefined,
      pending: (props.authPending ?? false) || state.logoutPending,
      error: state.logoutError ?? props.authError,
      logout,
    },
  }), [
    activeGroup,
    activeItem,
    activeModule,
    assistantAvailable,
    closeMobile,
    changeLocale,
    closeTabs,
    currentWorkspace,
    search,
    selectWorkspace,
    workspaceOptions,
    colorMode,
    go,
    groups,
    homePath,
    identity.data,
    identity.error,
    identity.isPending,
    layout,
    location.pathname,
    logout,
    modules,
    navigateRouter,
    openMobile,
    props.app,
    props.authError,
    props.authPending,
    props.menu,
    props.onReloadTab,
    queryClient,
    sanitizedTabs,
    setQuery,
    state.assistantOpen,
    state.collapsed,
    state.logoutError,
    state.logoutPending,
    state.mobileOpen,
    state.query,
    subtitle,
    tabItems,
    title,
    toggleAssistant,
    toggleCollapsed,
    translate,
  ])

  const value = useMemo<ShellInternalContextValue>(() => ({
    facade,
    headerEnd: props.headerEnd,
    assistant: props.assistant,
    sidebarFooter: props.sidebarFooter,
    menuBadges: props.menuBadges,
    onEvent: props.onEvent,
    reloadKey: path => state.reloads[path] ?? 0,
    setMobileTrigger: (element) => {
      mobileTrigger.current = element
    },
  }), [facade, props.assistant, props.headerEnd, props.menuBadges, props.onEvent, props.sidebarFooter, state.reloads])

  const referenceLabel = translate('lumi.agent.referenceRows', undefined, 'Reference in chat')
  const selectionExtras = useMemo<readonly SelectionExtra[]>(
    () => bridge && assistantAvailable ? [{ value: 'agent-reference', label: referenceLabel, icon: 'bubble-chat', onSelect: referenceRows }] : [],
    [assistantAvailable, bridge, referenceLabel, referenceRows],
  )

  return (
    <ShellContext.Provider value={value}>
      <AssistantHideContext.Provider value={hideAssistant}>
        <LumiSelectionExtras extras={selectionExtras}>
          <AdminDocumentTitle page={labelFor(location.pathname)} app={title} template={props.app.documentTitle}>
            <ShellContextPanelProvider>
              <div style={{ display: 'contents' }} onClick={routeLinkClick}>{props.children}</div>
            </ShellContextPanelProvider>
          </AdminDocumentTitle>
        </LumiSelectionExtras>
      </AssistantHideContext.Provider>
    </ShellContext.Provider>
  )
}

const LABEL_FIELDS = ['title', 'name', 'label', 'no', 'number', 'orderNo', 'code', 'sku', 'email']

/** A readable name for a referenced row: its title-like field, else its key. */
function recordLabel(row: Record<string, unknown>, key: string | number): string {
  const field = LABEL_FIELDS.find(name => typeof row[name] === 'string' || typeof row[name] === 'number')
  return field ? String(row[field]) : `#${String(key)}`
}

/** The shell's state and actions; throws outside `LumiAdminShellProvider`. */
export function useShell(): ShellContextValue {
  const context = useContext(ShellContext)
  if (!context)
    throw new Error('[lumi-admin] useShell must be used within LumiAdminShellProvider')
  return context.facade
}

export function useShellHeaderEnd(): ReactNode {
  return useContext(ShellContext)?.headerEnd
}

/** Hides the shell's assistant panel and its toggle while the calling page is mounted, e.g. a page that is itself a conversation. */
export function useHideShellAssistant(): void {
  const hide = useContext(AssistantHideContext)
  useEffect(() => hide?.(), [hide])
}

export function useShellAssistant(): ReactNode {
  return useContext(ShellContext)?.assistant
}

export function useShellSidebarFooter(): ReactNode {
  return useContext(ShellContext)?.sidebarFooter
}

export function useShellMenuBadge(name: string): ShellMenuBadge | undefined {
  return useContext(ShellContext)?.menuBadges?.[name]
}

export function useShellEventEmitter(): AdminEventHandler | undefined {
  return useContext(ShellContext)?.onEvent
}

export function useShellReloadKey(path: string): number {
  const context = useContext(ShellContext)
  if (!context)
    throw new Error('[lumi-admin] schema routes require LumiAdminShellProvider')
  return context.reloadKey(path)
}

export function useShellMobileTrigger(): (element: HTMLButtonElement | null) => void {
  const context = useContext(ShellContext)
  if (!context)
    throw new Error('[lumi-admin] shell layout requires LumiAdminShellProvider')
  return context.setMobileTrigger
}
