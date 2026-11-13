import type { HttpClient } from '../http.js'
import type { AccessProvider } from '../providers/access'
import type { AuthProvider } from '../providers/auth'
import { createHttpClient } from '../http.js'
import { normalizeResource } from '../path.js'

/** Where the bearer token lives between page loads. */
export interface TokenStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface SimpleAuthEndpoints {
  /** POST with the login form; answers `{ data: { token?, user, permissions } }` (no token in cookie mode). */
  login?: string
  /** POST signed with the session; failures are ignored. */
  logout?: string
  /** GET signed with the session; answers `{ data: { user, permissions } }`. */
  me?: string
  /**
   * POST with the sign-up form. Answering like `login` signs the new account
   * in; answering without a session sends the reader to sign in. Leave it out
   * where accounts are assigned, and no sign-up is offered.
   */
  register?: string
  /** POST with `{ email }` to start a password reset. Leave it out to offer none. */
  forgotPassword?: string
  /** POST with `{ token, password }` from the reset link. */
  updatePassword?: string
  /**
   * POST after a 401 to renew the session; answers `{ data: { token } }` in
   * bearer mode, sets the cookie in cookie mode. Leave it out to sign the
   * reader out on the first 401.
   */
  refresh?: string
}

/** Where a cookie session's anti-forgery token is read from and sent in. */
export interface SimpleAuthCsrf {
  /** The cookie the server sets, e.g. `XSRF-TOKEN`. */
  cookie: string
  /** The header it is echoed in on writes, e.g. `X-XSRF-TOKEN`. */
  header: string
}

export interface SimpleAuthProviderOptions {
  /** API root the endpoints are relative to. */
  apiUrl: string
  /**
   * `bearer` (default) keeps the token login returns and sends it as
   * `Authorization: Bearer …`. `cookie` keeps nothing: the server's session
   * cookie travels with `credentials: 'include'` and `me` tells who is in.
   */
  mode?: 'bearer' | 'cookie'
  /** Cookie mode: the anti-forgery cookie echoed in a header on writes. */
  csrf?: SimpleAuthCsrf
  /** Bearer mode: storage key for the token. */
  tokenKey?: string
  endpoints?: SimpleAuthEndpoints
  /** Where a signed-out reader is sent. */
  loginPath?: string
  /** Bearer mode: defaults to `globalThis.localStorage`; pass one for SSR or tests. */
  storage?: TokenStorage
  /** The client its own requests go through (for the locale, tenant or a test fetcher); one is created otherwise. */
  http?: HttpClient
  /** Cookie mode: where `csrf.cookie` is read; defaults to `document.cookie`. */
  readCookie?: (name: string) => string | undefined
  /** How a `{ resource, action }` check reads the permission strings login returns. */
  permission?: SimplePermissionFormat
}

/**
 * Permission strings in the backend's own shape. A check builds
 * `format` (`{resource}{separator}{action}` by default), with each `/` of the
 * resource replaced by the separator: `system/users` + `delete` is
 * `system:users:delete`, or `system.users.delete` with `.`. A granted segment
 * `*` matches any one segment, and a trailing `*` everything below it, so
 * `system:*` covers `system:users:delete` and `*` grants all.
 */
export interface SimplePermissionFormat {
  /** Defaults to `:`. */
  separator?: ':' | '.'
  /** With `{resource}`, `{action}` and `{separator}`; `{action}{separator}{resource}` reads `delete:system:users`. */
  format?: string
}

/** Whether a granted permission string covers the required segments. */
function grants(granted: readonly string[], required: readonly string[]): boolean {
  for (let index = 0; index < granted.length; index++) {
    const part = granted[index]!
    if (part === '*' && index === granted.length - 1)
      return true
    if (index >= required.length)
      return false
    if (part !== '*' && part !== required[index])
      return false
  }
  return granted.length === required.length
}

/** Stands for the action in a format, where a field check accepts any. */
const ANY_ACTION = '\u0000'

/**
 * Whether a granted permission is one on the resource, whatever its action:
 * `template` is the format's segments with `ANY_ACTION` where the action goes.
 */
function grantsResource(granted: readonly string[], template: readonly string[]): boolean {
  const same = (part: string | undefined, wanted: string): boolean => part === '*' || part === wanted
  // `a:*` covers everything below `a`.
  if (granted.at(-1) === '*')
    return granted.slice(0, -1).every((part, index) => index >= template.length || template[index] === ANY_ACTION || same(part, template[index]!))
  const at = template.indexOf(ANY_ACTION)
  const before = at < 0 ? template : template.slice(0, at)
  const after = at < 0 ? [] : template.slice(at + 1)
  // The action may be several segments (`field:price`) or left out.
  return granted.length >= before.length + after.length
    && before.every((wanted, index) => same(granted[index], wanted))
    && after.every((wanted, index) => same(granted[granted.length - after.length + index], wanted))
}

/**
 * The access check of the simple convention, on its own for providers that
 * keep their own permission list: `can(permissions, { resource, action })`.
 */
export function createPermissionMatcher(options: SimplePermissionFormat = {}): (permissions: readonly string[], params: { resource: string, action: string }) => boolean {
  const separator = options.separator ?? ':'
  const format = options.format ?? '{resource}{separator}{action}'
  const split = (value: string): string[] => value.split(separator).filter(Boolean)
  return (permissions, { resource, action }) => {
    const name = normalizeResource(resource).split('/').filter(Boolean).join(separator)
    const parsed = permissions.map(split)
    const segments = (value: string): string[] => split(format.replaceAll('{separator}', separator).replaceAll('{resource}', name).replaceAll('{action}', value))
    // A field check (`field:price`) passes with any permission on the resource,
    // wherever the format puts the resource.
    if (action.startsWith('field:'))
      return parsed.some(entry => grantsResource(entry, segments(ANY_ACTION)))
    return parsed.some(entry => grants(entry, segments(action)))
  }
}

export interface SimpleAuthSession<User = unknown> {
  user: User | null
  permissions: string[]
}

export interface SimpleAuth {
  authProvider: AuthProvider
  accessProvider: AccessProvider
  getSession: () => SimpleAuthSession
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function memoryStorage(): TokenStorage {
  const map = new Map<string, string>()
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: key => void map.delete(key) }
}

function documentCookie(name: string): string | undefined {
  const source = (globalThis as { document?: { cookie?: string } }).document?.cookie ?? ''
  for (const part of source.split(';')) {
    const index = part.indexOf('=')
    if (index > 0 && part.slice(0, index).trim() === name)
      return decodeURIComponent(part.slice(index + 1).trim())
  }
  return undefined
}

interface SessionBody { data?: SimpleAuthSession & { token?: string }, message?: string }

/**
 * The session conventions a JSON backend most often speaks. Bearer mode:
 * login returns a token plus the user and permission list, `me` restores
 * them. Cookie mode: the server keeps the session in a cookie and `me` says
 * who is signed in. Permissions read as `resource:action` (`orders:*`, `*:*`).
 * One session feeds both the auth and access providers, so a JSON-configured
 * base needs no code for it; its own requests go through an HttpClient it
 * signs itself. Session requests (login, logout, refresh) carry whatever
 * session there is and never trigger a refresh.
 */
export function createSimpleAuthProvider(options: SimpleAuthProviderOptions): SimpleAuth {
  const mode = options.mode ?? 'bearer'
  const endpoints = { login: '/login', logout: '/logout', me: '/me', ...options.endpoints }
  const tokenKey = options.tokenKey ?? 'lumi_token'
  const loginPath = options.loginPath ?? '/login'
  const storage = options.storage ?? (globalThis as { localStorage?: TokenStorage }).localStorage ?? memoryStorage()
  const readCookie = options.readCookie ?? documentCookie
  const session: SimpleAuthSession = { user: null, permissions: [] }
  const token = (): string | null => (mode === 'bearer' ? storage.getItem(tokenKey) : null)
  // A cookie session is invisible to the page: `me` is asked whether one exists.
  const hasSession = (): boolean => (mode === 'bearer' ? Boolean(token()) : true)
  // Counts every change of hands (sign-in, sign-out, a refused session), so
  // the answer to a request an earlier session started is never applied to
  // the one that replaced it.
  let generation = 0
  const clear = (): void => {
    generation += 1
    if (mode === 'bearer')
      storage.removeItem(tokenKey)
    session.user = null
    session.permissions = []
  }
  const adopt = (data: { token?: string, user?: unknown, permissions?: unknown } | undefined): boolean => {
    if (mode === 'bearer') {
      if (!data?.token)
        return false
      storage.setItem(tokenKey, data.token)
    }
    generation += 1
    session.user = data?.user ?? null
    session.permissions = Array.isArray(data?.permissions) ? data.permissions.filter((item): item is string => typeof item === 'string') : []
    return true
  }

  const authorizeRequest: NonNullable<AuthProvider['authorizeRequest']> = ({ method }) => {
    if (mode === 'bearer') {
      const current = token()
      return current ? { headers: { Authorization: `Bearer ${current}` } } : undefined
    }
    const csrf = options.csrf && !SAFE_METHODS.has(method.toUpperCase()) ? readCookie(options.csrf.cookie) : undefined
    return { credentials: 'include', ...(csrf ? { headers: { [options.csrf!.header]: csrf } } : {}) }
  }

  const base = (options.http ?? createHttpClient()).extend({ baseUrl: options.apiUrl })
  // Session requests carry whatever session there is (a cookie must travel so
  // the server can set or rotate it) but never refresh: a 401 there is final.
  const sessionHttp = base.extend({ auth: true, authProvider: { authorizeRequest } })
  // `me` may refresh, so a page load with an expired token renews it.
  let meHttp: HttpClient = sessionHttp

  // One `me` request at a time per session; a new session asks again.
  let asking: { generation: number, request: Promise<SessionBody> } | undefined
  const me = (): Promise<SessionBody> => {
    if (asking?.generation !== generation) {
      const entry = { generation, request: meHttp.request<SessionBody>(endpoints.me) }
      asking = entry
      const settle = (): void => {
        if (asking === entry)
          asking = undefined
      }
      entry.request.then(settle, settle)
    }
    return asking!.request
  }
  /**
   * The session as `me` describes it. An answer (or a refusal) that arrives
   * after the session changed hands belongs to nobody: the session that
   * replaced it is read instead, asking again when it has no user yet.
   */
  const restore = async (): Promise<SimpleAuthSession> => {
    while (true) {
      const started = generation
      try {
        const body = await me()
        if (started === generation) {
          session.user = body.data?.user ?? null
          session.permissions = Array.isArray(body.data?.permissions) ? body.data.permissions.filter((item): item is string => typeof item === 'string') : []
          return session
        }
      }
      catch (error) {
        if (started === generation)
          throw error
      }
      if (!hasSession() || session.user)
        return session
    }
  }

  const post = async (path: string, params: unknown): Promise<{ ok: boolean, body: SessionBody }> => {
    try {
      const body = await sessionHttp.request<SessionBody>(path, { method: 'POST', body: params ?? {} })
      return { ok: true, body: body ?? {} }
    }
    catch (error) {
      const raw = (error as { raw?: SessionBody }).raw
      return { ok: false, body: { ...raw, message: raw?.message ?? (error instanceof Error ? error.message : undefined) } }
    }
  }
  // An account flow that does not sign anyone in: the server's message explains a refusal.
  const account = (path: string, fallback: string) => async (params: unknown) => {
    const { ok, body } = await post(path, params)
    return ok ? { success: true } : { success: false, error: new Error(body.message ?? fallback) }
  }

  const authProvider: AuthProvider = {
    async login(params: Record<string, unknown>) {
      const { ok, body } = await post(endpoints.login, params)
      if (!ok || !adopt(body.data))
        return { success: false, error: new Error(body.message ?? 'Login failed') }
      return { success: true }
    },
    ...(endpoints.register
      ? {
          async register(params: Record<string, unknown>) {
            const { ok, body } = await post(endpoints.register!, params)
            if (!ok)
              return { success: false, error: new Error(body.message ?? 'Sign-up failed') }
            if (!adopt(body.data))
              return { success: true, redirectTo: loginPath }
            return { success: true }
          },
        }
      : {}),
    ...(endpoints.forgotPassword ? { forgotPassword: account(endpoints.forgotPassword, 'Password reset failed') } : {}),
    ...(endpoints.updatePassword ? { updatePassword: account(endpoints.updatePassword, 'Password update failed') } : {}),
    async logout() {
      if (hasSession())
        await sessionHttp.request(endpoints.logout, { method: 'POST' }).catch(() => undefined)
      clear()
      return { success: true, redirectTo: loginPath }
    },
    async check() {
      if (!hasSession())
        return { authenticated: false, redirectTo: loginPath }
      try {
        await restore()
        // The reader may have signed out while `me` was out.
        return hasSession() ? { authenticated: true } : { authenticated: false, redirectTo: loginPath }
      }
      catch (error) {
        clear()
        return { authenticated: false, redirectTo: loginPath, error: error instanceof Error ? error : undefined }
      }
    },
    async getIdentity<T = unknown>() {
      if (session.user)
        return session.user as T
      return hasSession() ? (await restore()).user as T : null
    },
    async getPermissions() {
      if (session.permissions.length)
        return session.permissions
      return hasSession() ? (await restore()).permissions : []
    },
    async onError(error: { status?: unknown }) {
      if (error?.status === 401) {
        clear()
        return { logout: true, redirectTo: loginPath }
      }
      return {}
    },
    authorizeRequest,
    ...(endpoints.refresh
      ? {
          async refresh() {
            if (!hasSession())
              return false
            const started = generation
            try {
              const body = await sessionHttp.request<SessionBody>(endpoints.refresh!, { method: 'POST' })
              // Signed out or signed in again meanwhile: this token is nobody's.
              if (started !== generation)
                return false
              if (mode === 'cookie')
                return true
              if (!body?.data?.token)
                return false
              storage.setItem(tokenKey, body.data.token)
              return true
            }
            catch {
              return false
            }
          },
        }
      : {}),
  }
  meHttp = base.extend({ auth: true, authProvider })

  const matches = createPermissionMatcher(options.permission)
  const accessProvider: AccessProvider = {
    async can({ resource, action }) {
      return { can: matches(session.permissions, { resource, action }) }
    },
  }

  return {
    authProvider,
    accessProvider,
    getSession: () => session,
  }
}
