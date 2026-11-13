import type { AccessProvider, AuthProvider, DataProvider, HttpClient, HttpClientOptions, I18nTranslations, LumiConfig, TenantProvider } from '@duxweb/lumi'
import type { Root } from 'react-dom/client'
import type { AdminBaseConfig, AdminPanelSetup } from '../base-config.js'
import type { AdminManifest, AdminRoute } from '../config.js'
import type { CreateAdminOptions, LumiAdminReact } from './createAdmin.js'
import { createDataAuditLogProvider, createHttpClient, createI18nProvider, createLumi, createSimpleAuthProvider, createSimpleDataProvider, createSseLiveProvider, createTenantProvider, joinUrl } from '@duxweb/lumi'
import { notifier, toaster } from '@duxweb/lumi-ui'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { adminBaseConfigSchema, adminConfigItems, selectAdminPanel } from '../base-config.js'
import { createAdmin } from './createAdmin.js'

/**
 * Everything JSON cannot carry, supplied by a compiled host or by a page script
 * (`window.LumiAdminSetup`): callbacks, components and providers. A provider
 * set here replaces the one built from the config: an auth provider signs in
 * against a backend that does not speak the simple convention, and every
 * request (data, uploads, agent, live) carries its credentials. `upload` and
 * `agent` options merge over the defaults.
 */
export type MountAdminExtensions = Omit<CreateAdminOptions, 'context' | 'manifest' | 'theme' | 'login' | 'createRouter' | 'cacheKey' | 'manifestAuth' | 'shellStorageKey' | 'pages' | 'frameOrigins'>
  & Pick<LumiConfig, 'i18nProvider' | 'tenantProvider' | 'liveProvider' | 'auditLogProvider' | 'toastProvider' | 'notificationProvider' | 'validator' | 'upload' | 'agent' | 'env'>
  & {
    /**
     * Data providers by `data` name, reached with `dataProviderName`;
     * `default` stands for the mounted panel's own backend.
     * Build them on the `http` the extension context hands over, so they carry
     * the reader's credentials, locale and tenant.
     *
     * An entry may instead give only `{ onRequest, onResponse }`: the provider
     * the config already builds for that name keeps its address and gains the
     * hooks. On the panel's backend they reach every request to it, sign-in,
     * uploads, the agent, the event stream and served pages included.
     */
    dataProviders?: Record<string, DataProvider | AdminRequestHooks>
    /** Auth providers by `auth` name, replacing the simple convention for the panels that use it. */
    authProviders?: Record<string, AuthProvider>
    /** Access providers by `access` name, replacing the permission-string rule. */
    accessProviders?: Record<string, AccessProvider>
  }

/** Request hooks for a backend the config already names; see `HttpClientOptions`. */
export type AdminRequestHooks = Pick<HttpClientOptions, 'onRequest' | 'onResponse'>

function isDataProvider(value: DataProvider | AdminRequestHooks): value is DataProvider {
  return typeof (value as DataProvider).getList === 'function'
}

/** What an extension is built with beside the runtime. */
export interface AdminExtensionContext {
  /** The resolved config; `data`, `auth`, `access` and `panels` keep the shape they were written in, one object or a list. */
  config: AdminBaseConfig
  /**
   * The panel being mounted, with the auth and access it uses. `panel.data`
   * lists every backend by name whichever way `data` was written, e.g. to
   * read one's address.
   */
  panel: AdminPanelSetup
  /**
   * The app's request client at the panel's backend, signed by the auth provider the
   * Admin ends up with. `http.extend({ baseUrl })` reaches another backend;
   * `auth: false` sends no app credentials there.
   */
  http: HttpClient
}

export interface MountedAdmin extends LumiAdminReact {
  /** The validated config, with URLs resolved. */
  config: AdminBaseConfig
  /** The mounted panel. */
  panel: AdminPanelSetup
  /** The app's request client, signed by its auth provider. */
  http: HttpClient
  unmount: () => void
}

const TRAILING_SLASH_RE = /\/$/
const ABSOLUTE_OR_ROOTED_RE = /^(?:[a-z][a-z\d+.-]*:|\/)/i

/**
 * An inline manifest's page, module and logo paths, resolved against the
 * config file like the rest of it. With a `pages` endpoint a page `src` stays
 * as written: it is the `path` the endpoint receives.
 */
function rebaseManifest(manifest: AdminManifest, at: (url: string) => string, servedPages: boolean): AdminManifest {
  const keep = (url: string): string => (ABSOLUTE_OR_ROOTED_RE.test(url) ? url : at(url))
  const route = (item: AdminRoute): AdminRoute => ({
    ...item,
    ...(item.page?.src && !servedPages ? { page: { src: keep(item.page.src) } } : {}),
    ...(item.page?.module ? { page: { module: keep(item.page.module) } } : {}),
    ...(item.page?.iframe ? { page: { iframe: keep(item.page.iframe) } } : {}),
    ...(item.children ? { children: item.children.map(route) } : {}),
  })
  return {
    ...manifest,
    app: {
      ...manifest.app,
      ...(manifest.app.logo ? { logo: keep(manifest.app.logo) } : {}),
      ...(manifest.app.workspaces ? { workspaces: manifest.app.workspaces.map(item => (item.logo ? { ...item, logo: keep(item.logo) } : item)) } : {}),
    },
    routes: manifest.routes.map(route),
  }
}

async function loadJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok)
    throw new Error(`[lumi] ${label} ${url} answered ${response.status}`)
  return await response.json() as T
}

/**
 * Reads the config: an object, or the URL of one, checked against the schema.
 * A config read from a URL resolves its own relative URLs against that file,
 * so a deployment below a subpath keeps working on every route. `overrides`
 * apply before validation, for what a compiled host supplies in code (for
 * example a manifest built from TypeScript).
 */
export async function resolveAdminBaseConfig(source: string | unknown, overrides: Partial<AdminBaseConfig> | ((loaded: Record<string, any>) => unknown) = {}): Promise<AdminBaseConfig> {
  const loaded = typeof source === 'string' ? await loadJson<unknown>(source, 'config') : source
  const raw = typeof loaded !== 'object' || loaded === null
    ? loaded
    : typeof overrides === 'function' ? overrides({ ...loaded }) : { ...loaded, ...overrides }
  const parsed = adminBaseConfigSchema.safeParse(raw)
  if (!parsed.success)
    throw new Error(`[lumi] invalid Admin config: ${parsed.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')}`)
  if (typeof source !== 'string')
    return parsed.data
  const base = new URL(source, globalThis.location?.href)
  const at = (url: string): string => new URL(url, base).href
  // An API root keeps the form it was written in: `new URL` would append a
  // slash to a bare origin, and paths joined onto it would double it.
  const apiRoot = (url: string): string => (url.endsWith('/') ? at(url) : at(url).replace(TRAILING_SLASH_RE, ''))
  const config = parsed.data
  const each = <T extends object>(value: T | T[], map: (item: T) => T): T | T[] => (Array.isArray(value) ? value.map(map) : map(value))
  return {
    ...config,
    data: each<any>(config.data, item => ({ ...item, url: apiRoot(item.url) })),
    panels: each<any>(config.panels, panel => ({
      ...panel,
      manifest: typeof panel.manifest === 'string' ? at(panel.manifest) : rebaseManifest(panel.manifest, at, Boolean(panel.pages)),
      ...(typeof panel.theme === 'string' ? { theme: at(panel.theme) } : {}),
    })),
    ...(typeof config.theme === 'string' ? { theme: at(config.theme) } : {}),
    modules: config.modules?.map(at),
    i18n: config.i18n && {
      ...config.i18n,
      translations: config.i18n.translations && Object.fromEntries(Object.entries(config.i18n.translations).map(([locale, table]) => [locale, typeof table === 'string' ? at(table) : table])),
    },
  }
}

/** Loads every locale's shared translations, inline or by URL, in parallel. */
async function loadTranslations(config: AdminBaseConfig): Promise<I18nTranslations> {
  const entries = Object.entries(config.i18n?.translations ?? {})
  const tables = await Promise.all(entries.map(([locale, source]) => typeof source === 'string' ? loadJson<Record<string, string>>(source, `translations for ${locale}`) : source))
  return Object.fromEntries(entries.map(([locale], index) => [locale, tables[index]!]))
}

/** Which panel to mount, for a page that serves one panel only. */
export interface MountAdminOptions {
  /** The panel's name; otherwise the one whose path holds the address, else the default. */
  panel?: string
}

/**
 * Boots a complete Admin from JSON: the panel the address (or `options.panel`)
 * picks, with its backend, sign-in and permission rule, translations and formats
 * from `i18n`, menus and pages from its manifest. The same call backs the
 * prebuilt base script and a compiled host that adds its own extensions.
 */
export async function mountAdmin(
  source: string | AdminBaseConfig,
  extensions: MountAdminExtensions | ((context: AdminExtensionContext) => MountAdminExtensions | Promise<MountAdminExtensions>) = {},
  options: MountAdminOptions = {},
): Promise<MountedAdmin> {
  const config = await resolveAdminBaseConfig(source)
  if (config.modules?.length)
    console.warn('[lumi-admin] config.modules are loaded by the prebuilt base; a compiled host imports them and passes their extensions')
  const node = document.querySelector(config.el ?? '#app')
  if (!node)
    throw new Error(`[lumi] mount node ${config.el ?? '#app'} not found`)
  const setup = selectAdminPanel(config, location.pathname, options.panel)
  const { panel, defaultData } = setup
  // An address outside every panel opens the default one at its own path.
  const inside = location.pathname === setup.basename || location.pathname.startsWith(`${setup.basename}/`)
  if (setup.basename && !inside)
    history.replaceState(history.state, '', setup.basename)
  const many = adminConfigItems(config.panels).length > 1
  const cacheKey = many ? `${config.cacheKey ?? 'admin'}:${panel.name}` : config.cacheKey
  const translations = await loadTranslations(config)
  // The client exists before the extensions, which build data providers on
  // it; it reads the auth, tenant and locale they settle on per request.
  const bound: { auth?: AuthProvider, tenant?: TenantProvider, locale?: () => string | undefined, hooks?: AdminRequestHooks } = {}
  const http = createHttpClient({
    baseUrl: defaultData.url,
    onRequest: request => bound.hooks?.onRequest?.(request),
    onResponse: (response, request) => bound.hooks?.onResponse?.(response, request),
    authProvider: () => bound.auth,
    getLocale: () => bound.locale?.(),
    getTenant: () => bound.tenant?.get(),
  })
  const signIn = setup.auth
  const signInData = signIn.data ? setup.data.find(item => item.name === signIn.data)! : defaultData
  const { separator, format } = setup.access
  const simple = createSimpleAuthProvider({
    apiUrl: signInData.url,
    http,
    // Each sign-in keeps its own token, so two sessions never overwrite each other.
    tokenKey: signIn.tokenKey ?? (signIn.name === 'default' ? undefined : `lumi_${signIn.name}_token`),
    endpoints: signIn.endpoints ?? {},
    ...(signIn.mode ? { mode: signIn.mode } : {}),
    ...(signIn.csrf ? { csrf: signIn.csrf } : {}),
    ...(separator || format ? { permission: { ...(separator ? { separator } : {}), ...(format ? { format } : {}) } } : {}),
    loginPath: '/login',
  })
  const resolved = typeof extensions === 'function' ? await extensions({ config, panel: setup, http }) : extensions
  const { dataProviders, authProviders, accessProviders, i18nProvider, tenantProvider, liveProvider, auditLogProvider, toastProvider, notificationProvider, validator, upload, agent, env, ...adminExtensions } = resolved
  const authProvider = authProviders?.[signIn.name]
  const accessProvider = accessProviders?.[setup.access.name]
  // A replaced auth provider owns the session, and the simple convention's
  // permission list no longer describes it.
  bound.auth = authProvider ?? simple.authProvider
  // The sidebar's workspace is the tenant every request carries; the Shell
  // checks the stored one against the manifest's `app.workspaces`.
  bound.tenant = tenantProvider ?? createTenantProvider({ storageKey: `lumi:${cacheKey ?? 'admin'}:tenant` })
  // One event stream for the panel's backend, signed like data requests; Lumi
  // reopens it for the new tenant once the reader switches.
  const ownLive = !liveProvider && defaultData.live ? createSseLiveProvider({ url: joinUrl(defaultData.url, defaultData.live), http }) : undefined
  const live = liveProvider ?? ownLive
  const given = dataProviders ?? {}
  const hooks = (name: string): AdminRequestHooks | undefined => {
    const entry = Object.hasOwn(given, name) ? given[name] : undefined
    return entry && !isDataProvider(entry) ? entry : undefined
  }
  const providers = Object.fromEntries(Object.entries(given).filter((entry): entry is [string, DataProvider] => isDataProvider(entry[1])))
  for (const name of Object.keys(given)) {
    if (hooks(name) && name !== 'default' && !setup.data.some(item => item.name === name))
      throw new Error(`[lumi] dataProviders.${name} gives request hooks, but data has no "${name}" to add them to.`)
  }
  // The panel's own hooks sign everything at its backend, sign-in included.
  bound.hooks = hooks(defaultData.name) ?? hooks('default')
  // Another backend gets only its own hooks, never the panel's.
  const rest = (item: AdminPanelSetup['defaultData']): DataProvider => {
    const own = item === defaultData ? undefined : hooks(item.name)
    const client = item === defaultData
      ? (item.auth === false ? http.extend({ auth: false }) : http)
      : http.extend({ ...(item.auth === false ? { auth: false } : {}), onRequest: own?.onRequest, onResponse: own?.onResponse })
    return createSimpleDataProvider({ apiUrl: item.url, http: client })
  }
  const built: Record<string, DataProvider> = Object.fromEntries(setup.data.map(item => [item.name, providers[item.name] ?? rest(item)]))
  const context = createLumi({
    // `default` is the panel's backend; every backend is also reachable by its name.
    dataProvider: {
      ...built,
      ...providers,
      default: providers.default ?? built[defaultData.name]!,
    },
    http,
    authProvider: bound.auth,
    ...(authProvider ? (accessProvider ? { accessProvider } : {}) : { accessProvider: accessProvider ?? simple.accessProvider }),
    tenantProvider: bound.tenant,
    ...(live ? { liveProvider: live } : {}),
    // Accepted writes are recorded in the log resource, which the server stamps with who and when.
    ...(auditLogProvider
      ? { auditLogProvider }
      : panel.auditLog ? { auditLogProvider: createDataAuditLogProvider({ dataProvider: () => context.getDataProvider(), resource: panel.auditLog }) } : {}),
    // Toasts and notices land in the shell's viewports unless the host draws its own.
    toastProvider: toastProvider ?? toaster,
    notificationProvider: notificationProvider ?? notifier,
    i18nProvider: i18nProvider ?? createI18nProvider({
      locale: config.i18n?.locale ?? 'en-US',
      fallbackLocale: config.i18n?.fallbackLocale ?? 'en-US',
      translations,
      format: config.i18n?.format,
    }),
    ...(validator ? { validator } : {}),
    ...(upload ? { upload } : {}),
    ...(agent ? { agent } : {}),
    ...(env ? { env } : {}),
  })
  bound.locale = () => context.i18nProvider?.getLocale()
  const admin = createAdmin({
    ...adminExtensions,
    menuBadges: { ...panel.menuBadges, ...adminExtensions.menuBadges },
    cacheKey,
    manifestAuth: panel.manifestAuth,
    // Panels sharing a manifest `app.id` still keep their own tabs and preferences.
    shellStorageKey: panel.shellStorageKey ?? (many ? `lumi:${cacheKey}:shell` : undefined),
    pages: panel.pages,
    frameOrigins: config.frameOrigins,
    packKey: config.packKey,
    context,
    manifest: panel.manifest,
    theme: panel.theme ?? config.theme,
    login: panel.login,
    createRouter: setup.basename ? routes => createBrowserRouter(routes, { basename: setup.basename }) : undefined,
  })
  const root: Root = createRoot(node)
  root.render(<admin.App />)
  return {
    ...admin,
    config,
    panel: setup,
    http,
    unmount: () => {
      root.unmount()
      admin.dispose()
      ownLive?.close()
    },
  }
}
