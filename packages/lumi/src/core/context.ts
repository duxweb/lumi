import type { AgentBridge } from './agent/bridge.js'
import type { AgentHeaders } from './agent/http.js'
import type { HttpClient } from './http.js'
import type { AccessProvider } from './providers/access'
import type { AuditLogProvider } from './providers/audit'
import type { AuthProvider } from './providers/auth'
import type { DataProvider } from './providers/data'
import type { I18nProvider } from './providers/i18n'
import type { LiveMode, LiveProvider } from './providers/live'
import type { NotificationProvider, ToastProvider } from './providers/notification'
import type { RouterProvider } from './providers/router'
import type { TenantProvider } from './providers/tenant'
import type { MutationMode } from './types.js'
import type { UploadOptions } from './upload.js'
import type { Validator } from './validation'
import { createAgentBridge } from './agent/bridge.js'
import { createHttpClient } from './http.js'
import { isAbsoluteUrl, joinUrl, normalizeResource } from './path.js'
import { defaultValidator } from './validation'

export interface LumiConfig {
  /** Pass one for a single data source; pass { default: ..., other: ... } for multiple */
  dataProvider?: DataProvider | Record<string, DataProvider>
  /** The app's one sign-in session; it also signs every request `http` sends. */
  authProvider?: AuthProvider
  /**
   * The client uploads and the agent send through when their data provider
   * has none. Defaults to one signed by `authProvider` that sends the locale
   * and tenant; data providers built on it share those credentials.
   */
  http?: HttpClient
  accessProvider?: AccessProvider
  i18nProvider?: I18nProvider
  routerProvider?: RouterProvider
  /** The tenant (workspace) requests belong to; queries refetch when it changes. */
  tenantProvider?: TenantProvider
  /** Pushes backend changes; with it, queries refetch what an event touches. */
  liveProvider?: LiveProvider
  /** Records each accepted write and lists the record history; optional. */
  auditLogProvider?: AuditLogProvider
  /** The default for every query; `auto` when a liveProvider is set. */
  liveMode?: LiveMode
  /** The default for updates and deletes; `pessimistic` waits for the server. Forms always wait. */
  mutationMode?: MutationMode
  /** Milliseconds an undoable write waits for Undo; defaults to 5000. */
  undoableTimeout?: number
  /** Draws `toast` feedback and automatic error reports; without one they are no-ops. */
  toastProvider?: ToastProvider
  /** Draws `notify` notices; without one the action is a no-op. */
  notificationProvider?: NotificationProvider
  env?: Record<string, string | number | boolean | null>
  upload?: UploadOptions
  /** Agent chat requests: the default endpoint, the data source and extra headers. */
  agent?: AgentConfig
  validator?: Validator
}

export interface AgentConfig {
  /** Defaults to `/agent/chat`; relative paths resolve against the DataProvider API URL. */
  endpoint?: string
  /** Extra headers; credentials come from the auth provider through the data provider's HttpClient. */
  headers?: AgentHeaders
  dataProviderName?: string
  /** Actions an element event may run without asking in `ask` mode; defaults to those that only move the view or page state. */
  safeActions?: string[]
  /** The approval mode before the reader picks one. */
  approvalMode?: 'ask' | 'auto'
}

export interface LumiContext {
  /** The data provider registered under `name`, `default` when left out; throws for a name that is not registered. */
  getDataProvider: (name?: string) => DataProvider
  /** The request client, signed by `authProvider`. */
  readonly http: HttpClient
  /** The sign-in session. */
  readonly authProvider?: AuthProvider
  /** Permission checks. */
  readonly accessProvider?: AccessProvider
  /** Translation, the locale and formats. */
  readonly i18nProvider?: I18nProvider
  /** Navigation and the current address. */
  readonly routerProvider?: RouterProvider
  /** The current tenant. */
  readonly tenantProvider?: TenantProvider
  /** Changes pushed by the backend. */
  readonly liveProvider?: LiveProvider
  /** The log of writes. */
  readonly auditLogProvider?: AuditLogProvider
  /** Draws toasts. */
  readonly toastProvider?: ToastProvider
  /** Draws notification cards. */
  readonly notificationProvider?: NotificationProvider
  /** Checks form values against `rules`. */
  readonly validator: Validator
  /** The config `createLumi` was given. */
  readonly config: Readonly<LumiConfig>
  /** What the agent sees of the running pages and the client tools it acts through. */
  readonly agentBridge?: AgentBridge
}

function isDataProvider(v: DataProvider | Record<string, DataProvider>): v is DataProvider {
  return typeof (v as DataProvider).getList === 'function'
}

/**
 * Framework-agnostic context factory: holds providers with no reactivity.
 * Framework entrypoints layer reactivity and components on top.
 */
export function createLumi(config: LumiConfig = {}): LumiContext {
  const getDataProvider = (name = 'default'): DataProvider => {
    const dp = config.dataProvider
    if (!dp)
      throw new Error('[lumi] DataProvider is not configured.')
    if (isDataProvider(dp)) {
      if (name !== 'default')
        throw new Error(`[lumi] dataProvider "${name}" not registered`)
      return dp
    }
    const found = Object.hasOwn(dp, name) ? dp[name] : undefined
    if (!found)
      throw new Error(`[lumi] dataProvider "${name}" not registered`)
    return found
  }

  const http = config.http ?? createHttpClient({
    authProvider: () => config.authProvider,
    getLocale: () => config.i18nProvider?.getLocale(),
    getTenant: () => config.tenantProvider?.get(),
  })

  return {
    getDataProvider,
    http,
    authProvider: config.authProvider,
    accessProvider: config.accessProvider,
    i18nProvider: config.i18nProvider,
    routerProvider: config.routerProvider,
    tenantProvider: config.tenantProvider,
    liveProvider: config.liveProvider,
    auditLogProvider: config.auditLogProvider,
    toastProvider: config.toastProvider,
    notificationProvider: config.notificationProvider,
    validator: config.validator ?? defaultValidator,
    config,
    agentBridge: createAgentBridge({
      navigation: () => {
        const router = config.routerProvider
        return router
          ? { current: () => ({ path: router.getCurrentPath() }), routes: () => [], navigate: path => router.go({ to: path }) }
          : undefined
      },
      translate: (key, fallback, params) => config.i18nProvider?.translate(key, params, fallback) ?? fallback,
      storageKey: 'lumi:agent:approval-mode',
      ...(config.agent?.safeActions ? { safeActions: config.agent.safeActions } : {}),
      ...(config.agent?.approvalMode ? { approvalMode: config.agent.approvalMode } : {}),
    }),
  }
}

/**
 * The client that reaches a data provider's backend: the provider's own, else
 * the app's with that backend's API root trusted, so a hand-written provider
 * on another origin still gets the reader's credentials for its uploads,
 * exports and agent requests.
 */
export function dataProviderHttp(context: LumiContext, dataProviderName?: string): HttpClient {
  let provider: DataProvider | undefined
  try {
    provider = context.getDataProvider(dataProviderName)
  }
  catch {}
  if (provider?.http)
    return provider.http
  const apiUrl = provider?.getApiUrl?.()
  return apiUrl ? context.http.extend({ trustedOrigins: [apiUrl] }) : context.http
}

/** `url` as `dataProviderHttp`'s client takes it: as written for a provider's own client, else under the provider's API root. */
export function dataProviderPath(context: LumiContext, dataProviderName: string | undefined, url: string): string {
  let provider: DataProvider | undefined
  try {
    provider = context.getDataProvider(dataProviderName)
  }
  catch {}
  const apiUrl = provider?.getApiUrl?.()
  return provider?.http || !apiUrl || isAbsoluteUrl(url) ? url : joinUrl(apiUrl, url)
}

export interface DataTarget {
  resource: string
  dataProviderName?: string
}

export interface ResolvedDataTarget extends DataTarget {
  dataProvider: DataProvider
}

/** A resource with its edge slashes dropped, and the data provider it names; throws for an empty resource or an unregistered provider. */
export function resolveDataTarget(context: LumiContext, target: DataTarget): ResolvedDataTarget {
  const resource = normalizeResource(target.resource)
  if (!resource)
    throw new Error('[lumi] resource must not be empty')
  return {
    resource,
    dataProviderName: target.dataProviderName,
    dataProvider: context.getDataProvider(target.dataProviderName),
  }
}
