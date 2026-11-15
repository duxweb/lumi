import type {
  AuthActionResponse,
  AuthProvider,
  CheckResponse,
  LumiContext,
  LumiJsonLoader,
  RouterProvider,
} from '@duxweb/lumi'
import type { AgentCommand, LumiNotifier, LumiToaster, ThemeConfig } from '@duxweb/lumi-ui'
import type { ActionHandler, Catalog, Spec } from '@json-render/core'
import type { ComponentRegistry } from '@json-render/react'
import type {
  ComponentType,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react'
import type { DataRouter, RouteObject } from 'react-router'
import type {
  AdminApp,
  AdminEventHandler,
  AdminLoginConfig,
  AdminManifest,
  AdminPage,
  AdminPagesSource,
  AdminRoute,
} from '../catalog.js'
import type { AdminPromptMentions } from './agent-mention.js'
import type { LumiAuthBrandProps } from './components/LumiAuthLayout.js'
import type { ShellMenuBadge } from './components/ShellContext.js'
import type { AdminPageModuleLoader } from './modulePage.js'
import type { AdminDrawerLayer, AdminRoutedDrawerRegistry } from './routedDrawer.js'
import type { LumiAdminMenuItem } from './types.js'
import {
  createOverlayController,
  LumiDataProviderScope,
  LumiOverlayProvider,
  LumiProvider,
  LumiSpecPage,
  normalizeResource,
  useLocale,
  useTranslate,
} from '@duxweb/lumi'
import { applyLumiTheme, LumiEmbedProvider, LumiIframe, LumiNotifierViewport, LumiToasterViewport, LumiUiTextProvider, notifier, toaster, useUiText } from '@duxweb/lumi-ui'
import { QueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider as ReactRouterProvider,
  redirect,
  useLocation,
  useMatches,
  useNavigate,
  useParams,
} from 'react-router'
import {
  adminActionDefinitions,
  assertAdminRoutesAvailable,
  createAdminI18nProvider,
  createAdminMenu,
  filterAdminMenuByAccess,
  flattenAdminRoutes,
  resolveAdminSource,
} from '../catalog.js'
import { useAdminHandlers } from './actions.js'
import { AssistantContextProvider, createAssistantContextRegistry } from './assistant-context.js'
import { AdminColorModeProvider, adoptBootstrapColorMode, readStoredColorMode, readStoredLocale, useAdminColorMode } from './colorMode.js'
import { DEFAULT_DOCUMENT_TITLE, formatDocumentTitle } from './components/DocumentTitle.js'
import { LumiAdminForgotPassword, LumiAdminRegister, LumiAdminResetPassword } from './components/LumiAdminAccount.js'
import { LumiAdminLogin } from './components/LumiAdminLogin.js'
import { LumiAdminShell } from './components/LumiAdminShell.js'
import {
  AdminRouteLabelsContext,
  clearShellTabs,
  LumiAdminShellProvider,
  useShellReloadKey,
} from './components/ShellContext.js'
import { createAdminDocuments } from './documents.js'
import { AdminIncludeProvider } from './include.js'
import { AdminManifestAssistant } from './manifest-assistant.js'
import { AdminModulePage, createPageModuleCache, importPageModule } from './modulePage.js'
import { AdminOverlayHost } from './overlay.js'
import { LumiPage } from './pages/LumiPage.js'
import { LumiUnsavedChangesProvider } from './pages/useUnsavedChangesGuard.js'
import { adminCatalog, adminRegistry } from './registry.js'
import { AdminRoutedDrawerProvider } from './routedDrawer.js'
import { findAdminRouteMatch } from './routeMatch.js'
import { createReactRouterProvider } from './router.js'

const LOGIN_ROUTE_NAME = 'login'
const LOGIN_ROUTE_PATH = '/login'
/** The account pages beside sign-in, each offered when the auth provider implements its method. */
const ACCOUNT_ROUTES = { 'register': 'register', 'forgot-password': 'forgotPassword', 'reset-password': 'updatePassword' } as const
type AccountRouteName = keyof typeof ACCOUNT_ROUTES
const accountPath = (name: AccountRouteName): string => `/${name}`
function supportedAccountRoutes(provider: AuthProvider): AccountRouteName[] {
  return (Object.keys(ACCOUNT_ROUTES) as AccountRouteName[]).filter(name => typeof provider[ACCOUNT_ROUTES[name]] === 'function')
}
const FALLBACK_ROUTE_NAME = 'lumi-admin-fallback'
const FALLBACK_ROUTE_PATH = '*'
const TRAILING_SLASH_RE = /\/$/
const URL_SUFFIX_RE = /[?#]/
const ADMIN_ROUTE_HANDLE = 'lumiAdminRoute'
const ABORTED = Symbol('aborted')

/** What the sign-in route needs from above the router: the app and the Shell's storage namespace. */
const AdminLoginContext = createContext<{ app?: AdminApp, storageBase?: string }>({})

export interface CreateAdminOptions {
  context: LumiContext
  manifest: string | AdminManifest
  cacheKey?: string
  manifestAuth?: 'public' | 'protected'
  catalog?: Catalog
  registry?: ComponentRegistry
  handlers?: Record<string, ActionHandler>
  onEvent?: AdminEventHandler
  /** / commands added to the manifest's `app.assistant`. */
  assistantCommands?: AgentCommand[]
  /** @ tabs (and their `sources`) added to the manifest's `app.assistant`. */
  assistantMentions?: AdminPromptMentions
  /** Called when the user picks another workspace in the sidebar switcher (`app.workspaces`). */
  onWorkspaceChange?: (value: string) => void
  manifestLoader?: LumiJsonLoader<AdminManifest>
  specLoader?: LumiJsonLoader<Spec>
  /**
   * Loads page JSON through the backend instead of as files: each page `src`
   * that is not a full URL is sent as `path` to `endpoint` through the data
   * provider, so it is signed and unwrapped like any other request. A
   * `specLoader` you pass loads pages its own way.
   */
  pages?: AdminPagesSource
  /**
   * Key of packed manifests, pages and themes, when the backend masks them
   * with one. A backend may answer `{ "packed": "…" }` instead of readable
   * JSON (see `packDocument` in `@duxweb/lumi/catalog`); it is unpacked either
   * way, and this is only needed when a key was used.
   */
  packKey?: string
  /**
   * Loads a `page.module` route's component; defaults to `import()` and the
   * module's default export. Each URL loads once.
   */
  loadPageModule?: AdminPageModuleLoader
  /** Sites `Iframe` elements and `page.iframe` routes may show; this site always may. Without it any https site may. */
  frameOrigins?: string[]
  theme?: string | ThemeConfig
  themeLoader?: LumiJsonLoader<ThemeConfig>
  routes?: RouteObject[]
  drawers?: AdminRoutedDrawerRegistry
  shell?: ComponentType<PropsWithChildren>
  /**
   * Rendered on the header's trailing edge — the design's notifications bell
   * and anything else app-wide the shell cannot supply the feature for.
   */
  headerEnd?: ReactNode
  /**
   * A panel beside the page, such as an AI assistant. The shell renders its
   * frame and a header toggle; the content is entirely the host's.
   */
  assistant?: ReactNode
  /** Rendered at the foot of the navigation sidebar, below the menu. */
  sidebarFooter?: ReactNode
  /** Live counts beside menu items, keyed by route name. */
  menuBadges?: Readonly<Record<string, ShellMenuBadge>>
  shellStorageKey?: string
  /**
   * Whether the assistant panel starts open for a reader who has not toggled
   * it yet; defaults to open. The reader's own choice is remembered.
   */
  assistantDefaultOpen?: boolean
  createRouter?: (routes: RouteObject[]) => DataRouter
  /** Copy, demo account and links of the sign-in page; see `AdminLoginConfig`. */
  login?: AdminLoginConfig
}

interface AdminSnapshot {
  router?: DataRouter
  manifest?: AdminManifest
  menu: LumiAdminMenuItem[]
  theme?: ThemeConfig
  auth?: CheckResponse & { error?: unknown }
  error?: unknown
  disposed?: boolean
}

export interface LumiAdminReact {
  App: ComponentType
  context: LumiContext
  catalog: Catalog
  registry: ComponentRegistry
  getMenu: () => LumiAdminMenuItem[]
  getRouter: () => DataRouter | undefined
  ready: () => Promise<void>
  refresh: () => Promise<void>
  clear: () => void
  dispose: () => void
}

/** Creates an Admin from a manifest and a Lumi context: routes, menu, account pages, shell and page loading. Render its `App`. */
export function createAdmin(options: CreateAdminOptions): LumiAdminReact {
  if (options.manifestAuth === 'protected' && !options.context.authProvider) {
    throw new Error(
      '[lumi-admin] manifestAuth "protected" requires an authProvider',
    )
  }
  const catalog = options.catalog ?? adminCatalog
  const registry = options.registry ?? adminRegistry
  // Refused here, with the name, rather than by every page when it renders.
  for (const name of Object.keys(options.handlers ?? {})) {
    if (Object.hasOwn(adminActionDefinitions, name))
      throw new Error(`[lumi-admin] "${name}" is a built-in Admin action; a handler cannot replace it`)
  }
  const assistantContext = createAssistantContextRegistry()
  const assistantAdditions = {
    ...(options.assistantCommands ? { commands: options.assistantCommands } : {}),
    ...(options.assistantMentions ? { mentions: options.assistantMentions } : {}),
  }
  // Toasts and notices show in the shell's viewports: the context's own queue
  // when it is a Lumi UI one, otherwise the shared one.
  const isQueue = (value: unknown): boolean => typeof (value as Partial<LumiToaster> | undefined)?.subscribe === 'function' && typeof (value as Partial<LumiToaster> | undefined)?.getSnapshot === 'function'
  const toastQueue = isQueue(options.context.toastProvider) ? options.context.toastProvider as LumiToaster : toaster
  const noticeQueue = isQueue(options.context.notificationProvider) ? options.context.notificationProvider as LumiNotifier : notifier
  const loadPageModule = createPageModuleCache(options.loadPageModule ?? importPageModule)
  const documents = createAdminDocuments(options, catalog)
  const { pageAddress, manifestLoader, specLoader, themeLoader } = documents
  const overlays = createOverlayController()
  const queryClient = new QueryClient()
  const listeners = new Set<() => void>()
  let snapshot: AdminSnapshot = { menu: [] }
  let disposed = false
  let generation = 0
  let loadController: AbortController | undefined
  let loadPromise: Promise<void> | undefined
  let loadIdentity = options.context.session.getSnapshot()
  let warnedOpenAccess = false

  const routerProxy: RouterProvider = {
    go(config) {
      const router = snapshot.router
      if (!router)
        return
      createReactRouterProvider(router).go(config)
    },
    back() {
      void snapshot.router?.navigate(-1)
    },
    parse() {
      const router = snapshot.router
      return router
        ? createReactRouterProvider(router).parse()
        : { pathname: '', query: {}, params: {} }
    },
    getCurrentPath() {
      const location = snapshot.router?.state.location
      return location
        ? `${location.pathname}${location.search}${location.hash}`
        : ''
    },
    subscribe(listener) {
      let disposeRouter = snapshot.router?.subscribe(listener)
      const updateRouter = (): void => {
        disposeRouter?.()
        disposeRouter = snapshot.router?.subscribe(listener)
        listener()
      }
      listeners.add(updateRouter)
      return () => {
        listeners.delete(updateRouter)
        disposeRouter?.()
      }
    },
  }
  const i18nProvider = createAdminI18nProvider(options.context.i18nProvider)
  const context: LumiContext = {
    ...options.context,
    i18nProvider,
    routerProvider: routerProxy,
    config: {
      ...options.context.config,
      i18nProvider,
      routerProvider: routerProxy,
    },
  }

  // Signing out drops the manifest, but the sign-in page that follows still
  // belongs to the same app: its storage, languages and theme seeds stay.
  let lastLoaded: { app: AdminApp, theme?: ThemeConfig } | undefined
  const emit = (next: AdminSnapshot): void => {
    const previousRouter = snapshot.router
    snapshot = next
    if (next.manifest)
      lastLoaded = { app: next.manifest.app, theme: next.theme }
    listeners.forEach(listener => listener())
    if (previousRouter && previousRouter !== next.router)
      void previousRouter.dispose()
  }
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  /**
   * A JSON page on a route: the path's params (`/orders/:id`) reach it as page
   * state at `/route/params`, the way a drawer's record reaches its page at
   * `/drawer`. Another record is another page: its state starts over.
   */
  function SpecRoute({ page }: { page: AdminPage }): ReactElement {
    const handlers = useAdminHandlers(options.handlers)
    const location = useLocation()
    const params = useParams()
    const reloadKey = useShellReloadKey(location.pathname)
    const paramsKey = JSON.stringify(params)
    const initialState = useMemo(() => ({ route: { params: JSON.parse(paramsKey) as Record<string, string> } }), [paramsKey])
    return (
      <LumiPage>
        <LumiSpecPage
          key={paramsKey}
          initialState={initialState}
          spec={page.spec}
          context={context}
          catalog={catalog}
          registry={registry}
          handlers={handlers}
          queryClient={queryClient}
          src={
            page.src
              ? pageAddress(page.src)
              : undefined
          }
          loader={specLoader}
          cacheKey={options.cacheKey}
          reloadKey={reloadKey}
        />
      </LumiPage>
    )
  }

  /**
   * A JSON page opened in a drawer layer: the document loads (and caches) by
   * its address alone; the record and params reach it as page state at
   * `/drawer`, the way props reach a component.
   */
  function DrawerPage({ layer }: { layer: AdminDrawerLayer }): ReactElement {
    const handlers = useAdminHandlers(options.handlers)
    const initialState = useMemo(() => ({ drawer: { id: layer.id ?? null, params: layer.params ?? {} } }), [layer.id, layer.params])
    return (
      <LumiSpecPage
        context={context}
        catalog={catalog}
        registry={registry}
        handlers={handlers}
        queryClient={queryClient}
        src={pageAddress(layer.target)}
        loader={specLoader}
        cacheKey={options.cacheKey}
        initialState={initialState}
        agentTitle={layer.title}
      />
    )
  }
  const renderDrawerPage = (layer: AdminDrawerLayer): ReactNode => <DrawerPage layer={layer} />

  /** A page an `Include` element shows: loaded like any page, its state its own, `params` at `/include/params`. */
  function IncludedPage({ src, params }: { src: string, params: Record<string, unknown> }): ReactElement {
    const handlers = useAdminHandlers(options.handlers)
    const initialState = useMemo(() => ({ include: { params } }), [params])
    return (
      <LumiSpecPage
        context={context}
        catalog={catalog}
        registry={registry}
        handlers={handlers}
        queryClient={queryClient}
        src={pageAddress(src)}
        loader={specLoader}
        cacheKey={options.cacheKey}
        initialState={initialState}
      />
    )
  }
  const renderInclude = (src: string, params: Record<string, unknown>): ReactNode => <IncludedPage src={src} params={params} />

  function AccessBoundary({
    route,
    children,
  }: {
    route: AdminRoute
    children: ReactNode
  }): ReactElement {
    const { t } = useUiText()
    const state = useAccess(context, route)
    if (state === 'checking') {
      return (
        <LumiPage state={{ kind: 'loading', label: t('lumi.admin.checkingAccess', 'Checking page access') }} />
      )
    }
    if (state === 'denied') {
      return (
        <LumiPage
          state={{
            kind: 'permission',
            title: t('lumi.admin.permissionRequired', 'Permission required'),
            reason: t('lumi.admin.permissionReason', 'Your account does not have access to this page.'),
            nextStep: t('lumi.admin.permissionNext', 'Ask an administrator for the required permission or choose another page from navigation.'),
          }}
        />
      )
    }
    return <>{children}</>
  }

  function AuthBoundary({
    auth,
  }: {
    auth: CheckResponse & { error?: unknown }
  }): ReactElement {
    const location = useLocation()
    const currentPath = `${location.pathname}${location.search}${location.hash}`
    if (!auth.authenticated) {
      return (
        <Navigate
          to={appendRedirect(auth.redirectTo ?? LOGIN_ROUTE_PATH, currentPath)}
          replace
        />
      )
    }
    return <Outlet />
  }

  function ManifestAuthBoundary({
    auth,
  }: {
    auth: CheckResponse & { error?: unknown }
  }): ReactElement {
    const matches = useMatches()
    const activeRoute = matches
      .map(match => match.handle)
      .findLast(isAdminRouteHandle)
    return activeRoute?.public ? <Outlet /> : <AuthBoundary auth={auth} />
  }

  const compileRoute = (route: AdminRoute): RouteObject => {
    const children = route.children?.map(compileRoute)
    const Content = route.redirect
      ? () => <Navigate to={route.redirect!} replace />
      : route.page?.iframe
        ? () => (
            <LumiPage width="full" className="lumi-admin-page--embed">
              <LumiIframe src={resolveAdminSource(route.page!.iframe!, options.manifest)} title={route.menu?.label ?? route.name ?? route.page!.iframe!} height="fill" />
            </LumiPage>
          )
        : route.page?.module
          ? () => (
              <LumiPage>
                <AdminModulePage url={resolveAdminSource(route.page!.module!, options.manifest)} load={loadPageModule} />
              </LumiPage>
            )
          : route.page
            ? () => <SpecRoute page={route.page!} />
            : Outlet
    const Guarded = route.access?.resource
      ? () => (
          <AccessBoundary route={route}>
            <Content />
          </AccessBoundary>
        )
      : Content
    return {
      id: route.name,
      path: route.path,
      handle: { [ADMIN_ROUTE_HANDLE]: true, public: route.public === true },
      // A route's data provider holds for its page and every route below it.
      Component: route.dataProvider
        ? () => (
            <LumiDataProviderScope name={route.dataProvider}>
              <Guarded />
            </LumiDataProviderScope>
          )
        : Guarded,
      children,
    }
  }

  const createRouter = (routes: RouteObject[]): DataRouter =>
    (
      options.createRouter
      ?? (routeObjects => createBrowserRouter(routeObjects))
    )(routes)

  /** The brand and copy every account page shares, from `options.login` and the manifest's app. */
  function useAuthBrand(): LumiAuthBrandProps {
    const translate = useTranslate()
    const navigate = useNavigate()
    const { app, storageBase } = useContext(AdminLoginContext)
    const config = options.login
    // Configured copy doubles as its own message key, so a JSON deployment can translate it.
    const text = (value: string | undefined): string | undefined =>
      value === undefined ? undefined : translate(value, undefined, value)
    const appTitle = app?.titleKey ? translate(app.titleKey, undefined, app.title) : app?.title
    // Outside the Shell the tab names the app alone, not the page left behind.
    const documentTitle = app?.documentTitle === false || !appTitle ? undefined : formatDocumentTitle(app?.documentTitle ?? DEFAULT_DOCUMENT_TITLE, { app: appTitle })
    useEffect(() => {
      if (documentTitle)
        document.title = documentTitle
    }, [documentTitle])
    return {
      title: text(config?.title) ?? appTitle,
      logo: app?.logo ? resolveAdminSource(app.logo, options.manifest) : undefined,
      badge: text(config?.badge),
      heroTitle: text(config?.heroTitle),
      heroHighlight: text(config?.heroHighlight),
      heroDescription: text(config?.heroDescription),
      features: config?.features?.map(feature => ({ icon: feature.icon, title: text(feature.title)!, description: text(feature.description) })),
      help: config?.help && { label: text(config.help.label), linkLabel: text(config.help.linkLabel)!, href: config.help.href },
      links: config?.links?.map(link => ({ href: link.href, label: text(link.label)! })),
      copyright: text(config?.copyright),
      locales: app?.locales,
      storageBase,
      navigate: to => void navigate(to),
    }
  }

  /** Signed in, a page goes where the reader was headed, or where the provider says. */
  const enter = async (redirect: string | null, result: AuthActionResponse): Promise<void> => {
    await refresh()
    routerProxy.go({ to: redirect ?? result.redirectTo ?? '/', replace: true })
  }

  function Login(): ReactElement {
    const location = useLocation()
    const translate = useTranslate()
    const brand = useAuthBrand()
    if (!context.authProvider)
      return <Navigate to="/" replace />
    const config = options.login
    const text = (value: string | undefined): string | undefined =>
      value === undefined ? undefined : translate(value, undefined, value)
    const forgotPassword = config?.forgotPassword
    const redirect = new URLSearchParams(location.search).get('redirect')
    // A provider that can reset passwords gets its own page; configuration may still point elsewhere or hide it.
    const forgot = forgotPassword === false
      ? false as const
      : forgotPassword?.href || !context.authProvider.forgotPassword
        ? forgotPassword && { href: forgotPassword.href, message: text(forgotPassword.message) }
        : { href: accountPath('forgot-password') }
    return (
      <LumiAdminLogin
        {...brand}
        subtitle={text(config?.subtitle)}
        demo={config?.demo}
        forgotPassword={forgot}
        register={context.authProvider.register && config?.register !== false ? { href: accountPath('register') } : undefined}
        assignedNote={text(config?.assignedNote)}
        remember={config?.remember}
        onSuccess={result => enter(redirect, result)}
      />
    )
  }

  function Register(): ReactElement {
    const location = useLocation()
    const brand = useAuthBrand()
    const redirect = new URLSearchParams(location.search).get('redirect')
    return (
      <LumiAdminRegister
        {...brand}
        loginHref={LOGIN_ROUTE_PATH}
        onSuccess={async (result) => {
          // A provider that does not sign the new account in sends the reader to sign in.
          if (result.redirectTo && result.redirectTo !== '/') {
            routerProxy.go({ to: result.redirectTo, replace: true })
            return
          }
          await enter(redirect, result)
        }}
      />
    )
  }

  function ForgotPassword(): ReactElement {
    return <LumiAdminForgotPassword {...useAuthBrand()} loginHref={LOGIN_ROUTE_PATH} />
  }

  function ResetPassword(): ReactElement {
    const location = useLocation()
    const brand = useAuthBrand()
    return (
      <LumiAdminResetPassword
        {...brand}
        token={new URLSearchParams(location.search).get('token')}
        loginHref={LOGIN_ROUTE_PATH}
        forgotHref={context.authProvider?.forgotPassword ? accountPath('forgot-password') : LOGIN_ROUTE_PATH}
      />
    )
  }

  const ACCOUNT_PAGES: Record<AccountRouteName, () => ReactElement> = {
    'register': Register,
    'forgot-password': ForgotPassword,
    'reset-password': ResetPassword,
  }

  /** The sign-in route and the account pages the auth provider supports. */
  const authRoutes = (): RouteObject[] => context.authProvider
    ? [
        { id: LOGIN_ROUTE_NAME, path: LOGIN_ROUTE_PATH, element: <Login /> },
        ...supportedAccountRoutes(context.authProvider).map(name => ({ id: name, path: accountPath(name), Component: ACCOUNT_PAGES[name] })),
      ]
    : []

  const createBootstrapRouter = (): DataRouter =>
    createRouter([
      ...authRoutes(),
      {
        id: FALLBACK_ROUTE_NAME,
        path: FALLBACK_ROUTE_PATH,
        Component: NotFound,
      },
    ])

  const createRoutes = (
    manifest: AdminManifest,
    menu: LumiAdminMenuItem[],
    theme: ThemeConfig | undefined,
    auth: CheckResponse & { error?: unknown },
  ): DataRouter => {
    const app = {
      ...manifest.app,
      logo: manifest.app.logo
        ? resolveAdminSource(manifest.app.logo, options.manifest)
        : undefined,
    }
    const manifestRoutes = manifest.routes.map(compileRoute)
    const hostRoutes = auth.authenticated
      ? (options.routes ?? [])
      : protectHostRoutes(
          options.routes ?? [],
          auth.redirectTo ?? LOGIN_ROUTE_PATH,
        )
    const ShellComponent = options.shell ?? LumiAdminShell
    const routeSources = flattenAdminRoutes(manifest.routes).map(
      ({ route, path }) => ({
        path,
        menu: route.menu,
        source: route.page?.src
          ? pageAddress(route.page.src)
          : undefined,
      }),
    )
    const hostRoutePaths = [...collectHostRoutes(options.routes ?? []).paths]

    function ShellRoot(): ReactElement {
      return (
        <AssistantContextProvider registry={assistantContext}>
          <LumiUnsavedChangesProvider>
            <AdminIncludeProvider render={renderInclude}>
              <AdminRoutedDrawerProvider drawers={options.drawers} renderPage={renderDrawerPage}>
                <AdminRouteLabelsContext value={routeSources}>
                  <LumiAdminShellProvider
                    app={app}
                    menu={menu}
                    context={context}
                    headerEnd={options.headerEnd}
                    assistant={options.assistant ?? (app.assistant ? <AdminManifestAssistant config={app.assistant} additions={assistantAdditions} /> : undefined)}
                    sidebarFooter={options.sidebarFooter}
                    menuBadges={options.menuBadges}
                    onEvent={options.onEvent}
                    onWorkspaceChange={options.onWorkspaceChange}
                    shellStorageKey={options.shellStorageKey}
                    assistantDefaultOpen={options.assistantDefaultOpen ?? app.assistant?.defaultOpen}
                    routePatterns={[
                      ...routeSources.map(route => route.path),
                      ...hostRoutePaths,
                    ]}
                    authError={auth.error}
                    onLogout={clear}
                    onReloadTab={(key, active) => {
                      const source = findAdminRouteMatch(routeSources, key)?.source
                      if (source)
                        specLoader.invalidate(source, documents.cacheKey())
                      else if (active)
                        void snapshot.router?.revalidate()
                    }}
                  >
                    <ShellComponent>
                      <Outlet />
                    </ShellComponent>
                  </LumiAdminShellProvider>
                </AdminRouteLabelsContext>
                <AdminOverlayHost />
              </AdminRoutedDrawerProvider>
            </AdminIncludeProvider>
          </LumiUnsavedChangesProvider>
        </AssistantContextProvider>
      )
    }
    const routes: RouteObject[] = [
      {
        Component: context.authProvider
          ? () => <ManifestAuthBoundary auth={auth} />
          : Outlet,
        children: [
          {
            Component: ShellRoot,
            children: [...manifestRoutes, ...hostRoutes],
          },
        ],
      },
      ...authRoutes(),
      {
        id: FALLBACK_ROUTE_NAME,
        path: FALLBACK_ROUTE_PATH,
        Component: NotFound,
      },
    ]
    return createRouter(routes)
  }

  const isActiveLoad = (loadGeneration: number, signal: AbortSignal): boolean =>
    !disposed && loadGeneration === generation && !signal.aborted && loadIdentity === context.session.getSnapshot()

  const routerPath = (router: DataRouter): string => {
    const { pathname, search, hash } = router.state.location
    return `${pathname}${search}${hash}`
  }

  const routerTargetPath = (router: DataRouter): string => {
    const location = router.state.navigation.location ?? router.state.location
    return `${location.pathname}${location.search}${location.hash}`
  }

  const navigateCandidate = async (
    router: DataRouter,
    path: string,
    signal: AbortSignal,
  ): Promise<boolean> => {
    const result = await raceWithAbort(
      router.navigate(path, { replace: true }),
      signal,
    )
    return result !== ABORTED
  }

  const synchronizeCandidate = async (
    router: DataRouter,
    source: DataRouter | undefined,
    signal: AbortSignal,
  ): Promise<boolean> => {
    if (!source)
      return !signal.aborted
    for (;;) {
      const sourcePath = routerTargetPath(source)
      if (
        routerPath(router) !== sourcePath
        && !(await navigateCandidate(router, sourcePath, signal))
      ) {
        return false
      }
      if (signal.aborted)
        return false
      if (routerTargetPath(source) === sourcePath)
        return true
    }
  }

  const redirectCandidate = async (
    router: DataRouter,
    source: DataRouter | undefined,
    redirectTo: string,
    signal: AbortSignal,
  ): Promise<boolean> => {
    for (;;) {
      const sourcePath = source ? routerTargetPath(source) : routerPath(router)
      const target = samePathname(sourcePath, redirectTo)
        ? sourcePath
        : appendRedirect(redirectTo, sourcePath || '/')
      if (
        routerPath(router) !== target
        && !(await navigateCandidate(router, target, signal))
      ) {
        return false
      }
      if (signal.aborted)
        return false
      if (!source || routerTargetPath(source) === sourcePath)
        return true
    }
  }

  /** Drops what was loaded for the reader; `signedOut` also forgets their open tabs, which a plain teardown keeps for the next mount. */
  const invalidateLoadedState = (signedOut = true): void => {
    // Every page the reader opened, drawers and included pages too: the next
    // reader must not get a page the backend served for this one.
    documents.invalidate()
    const shellStorage = options.shellStorageKey ?? (snapshot.manifest ? `lumi:${snapshot.manifest.app.id}:shell` : undefined)
    if (signedOut && shellStorage && typeof window !== 'undefined')
      clearShellTabs(shellStorage)
  }

  const applyUnauthenticated = async (
    redirectTo: string | undefined,
    loadGeneration: number,
    signal: AbortSignal,
  ): Promise<void> => {
    const source = snapshot.router
    const router = createBootstrapRouter()
    let committed = false
    try {
      if (
        !(await redirectCandidate(
          router,
          source,
          redirectTo ?? LOGIN_ROUTE_PATH,
          signal,
        ))
      ) {
        return
      }
      if (!isActiveLoad(loadGeneration, signal))
        return
      invalidateLoadedState()
      emit({ menu: [], router })
      committed = true
    }
    finally {
      if (!committed)
        void router.dispose()
    }
  }

  const applyManifest = async (
    manifest: AdminManifest,
    loadGeneration: number,
    signal: AbortSignal,
    bootstrapAuth?: CheckResponse,
  ): Promise<void> => {
    if (!isActiveLoad(loadGeneration, signal))
      return
    const accountRoutes = context.authProvider ? supportedAccountRoutes(context.authProvider) : []
    const reservedNames = context.authProvider
      ? [LOGIN_ROUTE_NAME, ...accountRoutes, FALLBACK_ROUTE_NAME]
      : [FALLBACK_ROUTE_NAME]
    const reservedPaths = context.authProvider
      ? [LOGIN_ROUTE_PATH, ...accountRoutes.map(accountPath), FALLBACK_ROUTE_PATH]
      : [FALLBACK_ROUTE_PATH]
    const hostRoutes = collectHostRoutes(options.routes ?? [])
    assertAdminRoutesAvailable(manifest, {
      packageName: 'lumi-admin',
      reservedNames,
      reservedPaths,
      hostRouteNames: hostRoutes.names,
      hostRoutePaths: hostRoutes.paths,
    })
    // Without an access provider every route is open; say so once when the
    // manifest expects checks, e.g. after an extension replaced the sign-in
    // but supplied no `accessProviders`.
    if (!context.accessProvider && !warnedOpenAccess && flattenAdminRoutes(manifest.routes).some(({ route }) => route.access)) {
      warnedOpenAccess = true
      console.warn('[lumi-admin] the manifest sets `access` on routes, but there is no access provider: every route and menu item is shown to every reader.')
    }
    let auth: CheckResponse & { error?: unknown } = bootstrapAuth ?? {
      authenticated: true,
    }
    if (!bootstrapAuth && context.authProvider) {
      try {
        const result = await raceWithAbort(
          context.authProvider.check(),
          signal,
        )
        if (result === ABORTED)
          return
        auth = result
      }
      catch (error) {
        auth = {
          authenticated: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }
      }
      if (!isActiveLoad(loadGeneration, signal))
        return
    }
    const menu = await raceWithAbort(
      filterAdminMenuByAccess(context, createAdminMenu(manifest)),
      signal,
    )
    if (menu === ABORTED)
      return
    if (!isActiveLoad(loadGeneration, signal))
      return
    const theme = options.theme
      ? await raceWithAbort(
          themeLoader.load(options.theme, {
            cacheKey: documents.cacheKey(),
            signal,
          }),
          signal,
        )
      : undefined
    if (theme === ABORTED)
      return
    if (!isActiveLoad(loadGeneration, signal))
      return
    const source = snapshot.router
    const router = createRoutes(manifest, menu, theme, auth)
    let committed = false
    try {
      for (;;) {
        if (!(await synchronizeCandidate(router, source, signal)))
          return
        if (!isActiveLoad(loadGeneration, signal))
          return
        if (source && routerPath(router) !== routerTargetPath(source))
          continue
        emit({ manifest, menu, router, theme, auth })
        committed = true
        break
      }
    }
    finally {
      if (!committed)
        void router.dispose()
    }
  }

  const load = async (reload: boolean): Promise<void> => {
    const loadGeneration = ++generation
    loadIdentity = context.session.getSnapshot()
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    try {
      let bootstrapAuth: CheckResponse | undefined
      if ((options.manifestAuth ?? 'public') === 'protected') {
        const check = context.authProvider
          ? await raceWithAbort(context.authProvider.check(), controller.signal)
          : undefined
        if (check === ABORTED)
          return
        if (!isActiveLoad(loadGeneration, controller.signal))
          return
        if (check && !check.authenticated) {
          await applyUnauthenticated(
            check.redirectTo,
            loadGeneration,
            controller.signal,
          )
          return
        }
        bootstrapAuth = check
      }
      const manifest = await raceWithAbort(
        manifestLoader.load(options.manifest, {
          cache: reload ? 'reload' : 'default',
          cacheKey: documents.cacheKey(),
          signal: controller.signal,
        }),
        controller.signal,
      )
      if (manifest === ABORTED)
        return
      await applyManifest(
        manifest,
        loadGeneration,
        controller.signal,
        bootstrapAuth,
      )
    }
    catch (error) {
      if (isActiveLoad(loadGeneration, controller.signal)) {
        if ((options.manifestAuth ?? 'public') === 'protected') {
          invalidateLoadedState()
          emit({ menu: [], error })
        }
        else {
          emit({ ...snapshot, error })
        }
        throw error
      }
    }
    finally {
      if (loadController === controller)
        loadController = undefined
    }
  }
  const track = (promise: Promise<void>): Promise<void> => {
    const tracked = promise.finally(() => {
      if (loadPromise === tracked)
        loadPromise = undefined
    })
    loadPromise = tracked
    signalLoadChange()
    return tracked
  }
  const createLoadChange = (): {
    promise: Promise<void>
    resolve: () => void
  } => {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }
  let loadChange = createLoadChange()
  function signalLoadChange(): void {
    const current = loadChange
    loadChange = createLoadChange()
    current.resolve()
  }
  const ensureRouter = async (): Promise<void> => {
    if (snapshot.manifest)
      return
    if (!loadPromise)
      track(load(false))
    for (;;) {
      const pendingLoad = loadPromise
      if (!pendingLoad)
        return
      await Promise.race([pendingLoad, loadChange.promise])
      if (disposed || snapshot.manifest)
        return
      if (loadPromise === pendingLoad)
        return
    }
  }
  function ready(): Promise<void> {
    if (disposed) {
      return Promise.reject(
        new Error('[lumi-admin] admin instance is disposed'),
      )
    }
    return ensureRouter()
  }
  function refresh(): Promise<void> {
    return disposed
      ? Promise.reject(new Error('[lumi-admin] admin instance is disposed'))
      : track(load(true))
  }
  function clear(): void {
    if (disposed)
      return
    generation += 1
    loadController?.abort()
    loadController = undefined
    loadPromise = undefined
    signalLoadChange()
    invalidateLoadedState()
    emit({
      menu: [],
      router: context.authProvider ? createBootstrapRouter() : undefined,
    })
  }

  function App(): ReactElement {
    const current = useSyncExternalStore(
      subscribe,
      () => snapshot,
      () => snapshot,
    )
    if (current.disposed)
      return <></>
    if (current.error) {
      return (
        <div role="alert">
          {current.error instanceof Error
            ? current.error.message
            : i18nProvider.translate('lumi.admin.loadFailed', undefined, 'Failed to load Admin')}
        </div>
      )
    }
    if (!current.router) {
      void ready().catch(() => undefined)
      return (
        <div
          className="lumi-admin-bootstrap-skeleton"
          aria-label={i18nProvider.translate('lumi.admin.loading', undefined, 'Loading Admin')}
        />
      )
    }
    const app = current.manifest?.app ?? lastLoaded?.app
    const storageBase
      = options.shellStorageKey
        ?? `lumi:${app?.id ?? 'admin-bootstrap'}:shell`
    // A colour mode picked on the sign-in page, before the manifest (and its
    // app id) was known, follows the reader into the app.
    if (app && !options.shellStorageKey && typeof window !== 'undefined')
      adoptBootstrapColorMode(storageBase)
    return (
      <AdminThemeRoot
        key={storageBase}
        router={current.router}
        theme={current.manifest ? current.theme : lastLoaded?.theme}
        app={app}
        storageBase={storageBase}
      />
    )
  }

  function AdminThemeRoot({
    router,
    theme,
    app,
    storageBase,
  }: {
    router: DataRouter
    theme?: ThemeConfig
    app?: AdminApp
    storageBase: string
  }): ReactElement {
    // The saved language applies before the first paint of the app.
    useState(() => {
      const stored = readStoredLocale(storageBase, app?.locales?.map(item => item.value) ?? [])
      if (stored)
        void i18nProvider.changeLocale(stored)
      return stored
    })
    const [initialPreference] = useState(() =>
      readStoredColorMode(storageBase, theme?.mode ?? 'system'),
    )
    const login = useMemo(() => ({ app, storageBase }), [app, storageBase])
    return (
      <AdminColorModeProvider initialPreference={initialPreference} storageBase={storageBase}>
        <AdminLoginContext value={login}>
          <AdminProviders router={router} themeConfig={theme} />
        </AdminLoginContext>
      </AdminColorModeProvider>
    )
  }

  /** UI components take their strings and locale from the app's i18n. */
  function AdminUiText({ children }: { children: ReactNode }): ReactElement {
    const translate = useTranslate()
    const locale = useLocale()
    useEffect(() => {
      document.documentElement.lang = locale
      const direction = i18nProvider.getDirection?.()
      if (direction)
        document.documentElement.dir = direction
    }, [locale])
    return <LumiUiTextProvider translate={translate} locale={locale}>{children}</LumiUiTextProvider>
  }

  function AdminProviders({
    router,
    themeConfig,
  }: {
    router: DataRouter
    themeConfig?: ThemeConfig
  }): ReactElement {
    const colorMode = useAdminColorMode()
    if (!colorMode)
      throw new Error('[lumi-admin] missing Admin color mode root')
    const theme = useMemo<ThemeConfig>(
      () => ({
        ...themeConfig,
        mode: colorMode.resolved,
      }),
      [colorMode.resolved, themeConfig],
    )
    useEffect(() => applyLumiTheme(theme).dispose, [theme])
    return (
      <LumiProvider
        context={context}
        registry={registry}
        handlers={options.handlers}
        queryClient={queryClient}
      >
        <AdminUiText>
          <LumiEmbedProvider origins={options.frameOrigins}>
            <LumiOverlayProvider controller={overlays}>
              <ReactRouterProvider router={router} />
            </LumiOverlayProvider>
          </LumiEmbedProvider>
          <LumiNotifierViewport notifier={noticeQueue} />
          <LumiToasterViewport toaster={toastQueue} />
        </AdminUiText>
      </LumiProvider>
    )
  }

  const unsubscribeIdentity = context.session.subscribe(() => {
    if (loadController && !disposed)
      void refresh().catch(() => {})
  })

  const dispose = (): void => {
    if (disposed)
      return
    disposed = true
    unsubscribeIdentity()
    overlays.dispose()
    queryClient.clear()
    generation += 1
    loadController?.abort()
    loadController = undefined
    loadPromise = undefined
    signalLoadChange()
    invalidateLoadedState(false)
    emit({ menu: [], disposed: true })
    listeners.clear()
  }

  return {
    App,
    context,
    catalog,
    registry,
    getMenu: () => snapshot.menu,
    getRouter: () => snapshot.router,
    ready,
    refresh,
    clear,
    dispose,
  }
}

function isAdminRouteHandle(
  handle: unknown,
): handle is { [ADMIN_ROUTE_HANDLE]: true, public: boolean } {
  return (
    typeof handle === 'object'
    && handle !== null
    && (handle as Record<string, unknown>)[ADMIN_ROUTE_HANDLE] === true
    && typeof (handle as Record<string, unknown>).public === 'boolean'
  )
}

function useAccess(
  context: LumiContext,
  route: AdminRoute,
): 'checking' | 'allowed' | 'denied' {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>(
    'checking',
  )
  useEffect(() => {
    let active = true
    const resource = route.access?.resource
    if (!resource || !context.accessProvider) {
      setState('allowed')
      return
    }
    void context.accessProvider
      .can({ resource: normalizeResource(resource), action: route.access?.action ?? 'list' })
      .then(result => active && setState(result.can ? 'allowed' : 'denied'))
      .catch(() => active && setState('denied'))
    return () => {
      active = false
    }
  }, [context, route])
  return state
}

function NotFound(): ReactElement {
  const translate = useTranslate()
  return (
    <div role="alert">
      {translate('lumi.admin.notFound', undefined, 'Page not found')}
    </div>
  )
}

function appendRedirect(target: string, redirect: string): string {
  const hashIndex = target.indexOf('#')
  const path = hashIndex === -1 ? target : target.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : target.slice(hashIndex)
  return `${path}${path.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(redirect)}${hash}`
}

function samePathname(left: string, right: string): boolean {
  return left.split(URL_SUFFIX_RE, 1)[0] === right.split(URL_SUFFIX_RE, 1)[0]
}

async function raceWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T | typeof ABORTED> {
  const observed = promise.then(
    value => ({ status: 'fulfilled', value }) as const,
    error => ({ status: 'rejected', error }) as const,
  )
  if (signal.aborted)
    return ABORTED
  let abort: (() => void) | undefined
  const aborted = new Promise<typeof ABORTED>((resolve) => {
    abort = () => resolve(ABORTED)
    signal.addEventListener('abort', abort, { once: true })
  })
  try {
    const result = await Promise.race([observed, aborted])
    if (result === ABORTED)
      return ABORTED
    if (result.status === 'rejected')
      throw result.error
    return result.value
  }
  finally {
    if (abort)
      signal.removeEventListener('abort', abort)
  }
}

function collectHostRoutes(
  routes: RouteObject[],
  parent = '/',
): { names: Set<string>, paths: Set<string> } {
  const names = new Set<string>()
  const paths = new Set<string>()
  for (const route of routes) {
    if (route.id)
      names.add(route.id)
    const path = route.path ? joinHostRoutePath(parent, route.path) : parent
    if (route.path)
      paths.add(path)
    if (route.children) {
      const children = collectHostRoutes(route.children, path)
      children.names.forEach(name => names.add(name))
      children.paths.forEach(childPath => paths.add(childPath))
    }
  }
  return { names, paths }
}

function joinHostRoutePath(parent: string, path: string): string {
  if (path.startsWith('/'))
    return path
  return `${parent === '/' ? '' : parent.replace(TRAILING_SLASH_RE, '')}/${path}`
}

function protectHostRoutes(
  routes: RouteObject[],
  loginPath: string,
): RouteObject[] {
  const requireAuthentication = ({
    request,
  }: {
    request: Request
  }): Response => {
    const url = new URL(request.url)
    return redirect(
      appendRedirect(loginPath, `${url.pathname}${url.search}${url.hash}`),
    )
  }
  return routes.map((route): RouteObject => {
    const protectedElement = <Outlet />
    if (route.index) {
      return {
        index: true,
        action: requireAuthentication,
        element: protectedElement,
      }
    }
    return {
      path: route.path,
      caseSensitive: route.caseSensitive,
      action: requireAuthentication,
      element: protectedElement,
      children: route.children
        ? protectHostRoutes(route.children, loginPath)
        : undefined,
    }
  })
}
