import type { RouterProvider } from './router'

export interface AuthActionResponse {
  /** `false` keeps the current session; the sign-in page shows `error`. */
  success: boolean
  /** Where the reader goes next. */
  redirectTo?: string
  /** Why it failed. */
  error?: Error
  [key: string]: unknown
}

export interface CheckResponse {
  /** Whether a session exists. */
  authenticated: boolean
  /** Where a signed-out reader is sent, e.g. `/login`. */
  redirectTo?: string
  /** Why the check failed. */
  error?: Error
}

export interface AuthErrorResponse {
  /** `true` signs the reader out. */
  logout?: boolean
  /** Where the reader goes next. */
  redirectTo?: string
  /** The failure, for the caller. */
  error?: Error
}

/** How one request carries the reader's credentials. */
export interface RequestAuthorization {
  /** E.g. `{ Authorization: 'Bearer …' }`, an API key or a signature, or a CSRF header beside a cookie. */
  headers?: Record<string, string>
  /** `include` for a cookie session on another origin. */
  credentials?: RequestCredentials
}

/**
 * Authentication provider: the one sign-in session of the app. It runs the
 * session requests itself (sign in and out, register, password reset, the
 * current user), decides how every other request carries the credentials
 * (`authorizeRequest`) and what a failure means (`onError`). Data providers
 * never handle credentials: they send through the HttpClient that asks it.
 */
export interface AuthProvider {
  /** Signs in with the sign-in form's values, e.g. `{ username, password, remember }`. */
  login: (params: any) => Promise<AuthActionResponse>
  /** Signs out and forgets the session. */
  logout: (params?: any) => Promise<AuthActionResponse>
  /** Whether a session exists; asked before a protected route or manifest loads. */
  check: () => Promise<CheckResponse>
  /** The current user, for the account menu and `useIdentity`; `null` when signed out. */
  getIdentity?: <T = any>() => Promise<T | null>
  /** The raw permission data, for `usePermissions`. Lumi's own checks ask the AccessProvider. */
  getPermissions?: (params?: any) => Promise<unknown>
  /** What a failed data request means for the session, once `refresh` could not save it; `{ logout: true }` signs the reader out. */
  onError?: (error: any) => Promise<AuthErrorResponse>
  /** Headers and fetch credentials for one request; called before each one an HttpClient sends. */
  authorizeRequest?: (request: { url: string, method: string }) => RequestAuthorization | undefined | Promise<RequestAuthorization | undefined>
  /** Renews expired credentials after a 401; `true` sends the request again. Concurrent 401s share one call. */
  refresh?: () => Promise<boolean>
  /** Creates an account; a provider that also signs the new account in answers like `login`. Leave it out where accounts are assigned. */
  register?: (params: any) => Promise<AuthActionResponse>
  /** Starts a password reset, e.g. by mailing a link to the account's address. */
  forgotPassword?: (params: any) => Promise<AuthActionResponse>
  /** Sets a new password, with the reset link's token or the signed-in session. */
  updatePassword?: (params: any) => Promise<AuthActionResponse>
}

/** The account flows an auth provider supports beyond signing in and out. */
export type AuthAccountAction = 'forgotPassword' | 'updatePassword'

type AuthErrorProvider = Pick<AuthProvider, 'logout' | 'onError'>

const pendingAuthErrors = new WeakMap<object, Promise<AuthErrorResponse | undefined>>()

/** Asks the auth provider what a failure means and signs the reader out when it says so; one error is handled once. */
export async function handleAuthProviderError(
  authProvider: AuthErrorProvider | undefined,
  routerProvider: Pick<RouterProvider, 'go'> | undefined,
  error: unknown,
): Promise<AuthErrorResponse | undefined> {
  if (!authProvider || (error instanceof Error && error.name === 'AbortError'))
    return undefined
  const key = ((typeof error === 'object' && error !== null) || typeof error === 'function') ? error : undefined
  const pending = key ? pendingAuthErrors.get(key) : undefined
  if (pending)
    return pending

  const request = (async () => {
    const response = await authProvider.onError?.(error)
    if (!response)
      return undefined

    const logout = response.logout ? await authProvider.logout() : undefined
    const redirectTo = response.redirectTo ?? logout?.redirectTo
    if (redirectTo)
      routerProvider?.go({ to: redirectTo, replace: true })
    return response
  })()
  if (key) {
    pendingAuthErrors.set(key, request)
    const clear = (): void => {
      setTimeout(() => {
        if (pendingAuthErrors.get(key) === request)
          pendingAuthErrors.delete(key)
      }, 0)
    }
    void request.then(clear, clear)
  }
  return request
}
