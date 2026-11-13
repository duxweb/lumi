import type { AuthProvider, RequestAuthorization } from './providers/auth'
import { joinUrl } from './path.js'

/** The header the tenant travels in, unless `tenantHeader` names another. */
export const DEFAULT_TENANT_HEADER = 'X-Tenant'

/** A non-2xx answer, with the body's `message`, `code`, `data` and field `errors`. */
export class DataProviderError extends Error {
  status: number
  code: unknown
  data: unknown
  raw: unknown
  /** Structured field errors from the response body's `errors` array, e.g. on 422. */
  errors?: unknown[]
  constructor(payload: { status: number, code?: unknown, message: string, data?: unknown, raw?: unknown, errors?: unknown[] }) {
    super(payload.message)
    this.name = 'DataProviderError'
    this.status = payload.status
    this.code = payload.code
    this.data = payload.data
    this.raw = payload.raw
    this.errors = payload.errors
  }
}

/** One field's server error; forms show `message` under the field at `path`, dotted for nested fields, e.g. `items.0.sku`. */
export interface HttpFieldError {
  path: string
  message: string
  code?: string
}

/** What `parseError` reads out of a failed answer; anything left out falls back to the status. */
export interface HttpErrorDetails {
  message?: string
  code?: unknown
  data?: unknown
  /** Field errors; the form puts each under its field. */
  errors?: HttpFieldError[]
}

/**
 * Lumi's error convention: `{ message, code, data, errors: [{ path, message }] }`.
 * A backend with another shape supplies its own `parseError`.
 */
export function parseLumiError(body: unknown): HttpErrorDetails {
  const value = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  return {
    message: typeof value.message === 'string' ? value.message : undefined,
    code: value.code,
    data: value.data,
    errors: Array.isArray(value.errors) ? value.errors as HttpFieldError[] : undefined,
  }
}

/** The part of an auth provider a client uses: how to sign a request and how to renew. */
export type RequestSigner = Pick<AuthProvider, 'authorizeRequest' | 'refresh'>

export type HttpHeaders = Record<string, string> | (() => Record<string, string> | undefined)

export interface HttpClientOptions {
  /** Root that relative paths join onto; absolute URLs pass through. */
  baseUrl?: string
  /** The app's auth provider (or just its signing part); a function is read on every request. */
  authProvider?: RequestSigner | (() => RequestSigner | undefined)
  /**
   * `false` sends no app credentials and leaves failures to the caller: a 401
   * from such a backend does not sign the reader out. Its own key, if any,
   * goes in `headers`. Defaults to `true`.
   */
  auth?: boolean
  /** Current UI locale, sent as `Accept-Language`. */
  getLocale?: () => string | null | undefined
  /** Current tenant, sent as `tenantHeader`. */
  getTenant?: () => string | null | undefined
  /** Defaults to `X-Tenant`. */
  tenantHeader?: string
  /** Headers on every request, below the per-request and auth ones; a function is read on every request. */
  headers?: HttpHeaders
  /**
   * Other sites that get the same treatment as `baseUrl` and the page, e.g.
   * `["https://files.example.com"]`. A request to any other site goes out
   * plain: without the reader's credentials, the tenant, the default headers
   * or the hooks, and its 401 does not sign the reader out.
   */
  trustedOrigins?: string[]
  /** Defaults to the global fetch, read when a request starts. */
  fetcher?: typeof fetch
  /**
   * Reads this backend's error body (parsed JSON, or `{}` when it is not JSON)
   * into the one `DataProviderError` every caller handles. Defaults to
   * `parseLumiError`.
   */
  parseError?: (body: unknown, response: Response) => HttpErrorDetails
  /**
   * Last look at a request before it leaves, after the credentials, locale,
   * tenant and JSON encoding: add or rewrite headers, sign the method, URL and
   * body. Runs again for the resend after a 401 refresh. Change the request in
   * place or return a new one.
   */
  onRequest?: (request: HttpOutgoingRequest) => HttpOutgoingRequest | void | Promise<HttpOutgoingRequest | void>
  /**
   * First look at the final answer, whatever its status: check its signature,
   * decrypt it, or reshape it. Return another Response to replace it; throw to
   * fail the request.
   */
  onResponse?: (response: Response, request: HttpOutgoingRequest) => Response | void | Promise<Response | void>
}

/** A request as it will be sent: `url` is absolute or rooted and carries the query string. */
export interface HttpOutgoingRequest {
  url: string
  method: string
  headers: Record<string, string>
  /** The encoded body: JSON as a string, FormData, Blob and the like as given. */
  body?: BodyInit | null | undefined
}

/** A request ready to send, with the fetch credentials the auth asks for. */
export interface HttpPreparedRequest extends HttpOutgoingRequest {
  credentials?: RequestCredentials
}

export interface HttpRequestOptions {
  method?: string
  /** Appended as a query string; arrays repeat as `key[]`, null and undefined are skipped. */
  query?: Record<string, unknown> | Array<[string, unknown]>
  /** Sent as JSON unless it is FormData, a Blob, URLSearchParams or a string. */
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

/** What `extend` may change: the root, whether and by whom requests are signed, the default headers, the fetch, the error format. */
export type HttpClientExtendOptions = Pick<HttpClientOptions, 'baseUrl' | 'auth' | 'headers' | 'authProvider' | 'trustedOrigins' | 'fetcher' | 'parseError' | 'onRequest' | 'onResponse'>

export interface HttpClient {
  readonly baseUrl: string
  /** Whether the app's auth signs these requests and handles their failures. */
  readonly signed: boolean
  /** The path joined onto `baseUrl`. */
  url: (path: string) => string
  /** The provider signing these requests, if any. */
  getAuthProvider: () => RequestSigner | undefined
  /**
   * The request as this client sends it: credentials, locale, tenant, then
   * `onRequest`. For transports `fetch` does not cover, such as an XHR upload,
   * which hands the answer to `receive`.
   */
  prepare: (request: HttpOutgoingRequest) => Promise<HttpPreparedRequest>
  /** Runs `onResponse` on an answer to a prepared request. */
  receive: (response: Response, request: HttpOutgoingRequest) => Promise<Response>
  /**
   * A signed fetch: on a 401 the auth's `refresh` runs once (shared by every
   * request waiting on it) and the request is sent again. The response is
   * returned as it is, whatever its status.
   */
  fetch: (path: string, init?: RequestInit) => Promise<Response>
  /** A signed JSON request; the parsed body on 2xx, else a `DataProviderError`. */
  request: <T = any>(path: string, options?: HttpRequestOptions) => Promise<T>
  /**
   * The same request, for an answer that is a file: the response itself on
   * 2xx, its body unread so the caller can follow the stream, else a
   * `DataProviderError`.
   */
  download: (path: string, options?: HttpRequestOptions) => Promise<Response>
  /** Marks a failure as this client's, so only a signed client's reaches the auth's `onError`. */
  own: <E>(error: E) => E
  extend: (options: HttpClientExtendOptions) => HttpClient
}

const unsigned = new WeakSet<object>()

/** Whether a failure came from a client with `auth: false`, which the auth provider leaves alone. */
export function isUnsignedFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && unsigned.has(error)
}

const refreshing = new WeakMap<RequestSigner, Promise<boolean>>()

/** One refresh per provider at a time; concurrent 401s wait on the same one. */
function refreshOnce(provider: RequestSigner): Promise<boolean> {
  let pending = refreshing.get(provider)
  if (!pending) {
    pending = Promise.resolve()
      .then(() => provider.refresh!())
      .catch(() => false)
      .finally(() => refreshing.delete(provider))
    refreshing.set(provider, pending)
  }
  return pending
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase()
  return Object.keys(headers).some(key => key.toLowerCase() === lower)
}

/** `?a=1&b[]=2`, or an empty string when nothing is left. */
export function buildQueryString(query: Record<string, unknown> | Array<[string, unknown]> | undefined): string {
  const params = new URLSearchParams()
  for (const [key, value] of Array.isArray(query) ? query : Object.entries(query ?? {})) {
    if (value === undefined || value === null)
      continue
    if (Array.isArray(value))
      value.forEach(item => params.append(`${key}[]`, String(item)))
    else
      params.append(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

function rawBody(body: unknown): body is BodyInit {
  return typeof body === 'string'
    || (typeof FormData !== 'undefined' && body instanceof FormData)
    || (typeof Blob !== 'undefined' && body instanceof Blob)
    || (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)
    || body instanceof ArrayBuffer
}

/** The parsed JSON of a body; text that is not JSON is the answer itself on success and nothing on failure. */
function parseBody(text: string, ok: boolean): any {
  if (!text)
    return {}
  try {
    return JSON.parse(text)
  }
  catch {
    return ok ? text : {}
  }
}

/**
 * The one request path of Lumi. Data providers, uploads, the agent, the live
 * stream and the auth provider's own sign-in requests all go through a client:
 * it asks the auth for the request's credentials (`authorizeRequest`), adds
 * the locale and tenant, encodes JSON, refreshes once on a 401 and turns a
 * non-2xx answer into a `DataProviderError`. The data layer passes a signed
 * client's failures to the auth's `onError`; an unsigned one's to the caller.
 *
 * All of that is for the client's own backend: `baseUrl`, the page's site and
 * `trustedOrigins`. A full URL to anywhere else is sent plain, so a page that
 * names a foreign address never carries the reader's credentials there.
 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const baseUrl = options.baseUrl ?? ''
  const signed = options.auth !== false
  const getAuthProvider = (): RequestSigner | undefined => {
    if (!signed)
      return undefined
    return typeof options.authProvider === 'function' ? options.authProvider() : options.authProvider
  }

  const url = (path: string): string => (baseUrl ? joinUrl(baseUrl, path) : path)

  /** Whether `target` is at this client's backend, the page's site or a trusted one. */
  const trusts = (target: string): boolean => {
    const page = typeof location === 'undefined' ? undefined : location.href
    const originOf = (value: string): string | undefined => {
      try {
        return new URL(value, page).origin
      }
      catch {
        return undefined
      }
    }
    const origin = originOf(target)
    // A path with no page to resolve against is the caller's own backend.
    if (origin === undefined)
      return true
    const sites = [page, baseUrl, ...(options.trustedOrigins ?? [])].filter(Boolean) as string[]
    // A server-side client without a root has nothing to compare against.
    return sites.length ? sites.some(site => originOf(site) === origin) : true
  }

  /**
   * Final headers for one request: defaults, then locale and tenant unless
   * the request names them, then the request's own, then the auth's, which
   * always win so a page cannot send another reader's credentials.
   */
  const sign = async (request: { url: string, method: string }, own: Record<string, string> = {}): Promise<{ headers: Record<string, string>, credentials?: RequestCredentials }> => {
    if (!trusts(request.url))
      return { headers: { ...own } }
    const provider = getAuthProvider()
    const granted: RequestAuthorization = provider?.authorizeRequest ? (await provider.authorizeRequest(request)) ?? {} : {}
    const defaults = typeof options.headers === 'function' ? options.headers() : options.headers
    const headers: Record<string, string> = { ...defaults, ...own }
    const locale = options.getLocale?.()
    if (locale && !hasHeader(headers, 'Accept-Language'))
      headers['Accept-Language'] = locale
    const tenant = options.getTenant?.()
    const tenantHeader = options.tenantHeader ?? DEFAULT_TENANT_HEADER
    if (tenant && !hasHeader(headers, tenantHeader))
      headers[tenantHeader] = tenant
    for (const [name, value] of Object.entries(granted.headers ?? {})) {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === name.toLowerCase())
          delete headers[key]
      }
      headers[name] = value
    }
    return { headers, ...(granted.credentials ? { credentials: granted.credentials } : {}) }
  }

  const prepare: HttpClient['prepare'] = async (request) => {
    const { headers, credentials } = await sign({ url: request.url, method: request.method }, request.headers)
    const draft: HttpOutgoingRequest = { url: request.url, method: request.method, headers, ...(request.body !== undefined ? { body: request.body } : {}) }
    const ready = trusts(request.url) ? (await options.onRequest?.(draft)) ?? draft : draft
    return { ...ready, ...(credentials ? { credentials } : {}) }
  }

  const receive: HttpClient['receive'] = async (response, request) =>
    trusts(request.url) ? (await options.onResponse?.(response, request)) ?? response : response

  const disown = <E>(error: E): E => {
    if (typeof error === 'object' && error !== null)
      unsigned.add(error)
    return error
  }
  const own = <E>(error: E): E => (signed ? error : disown(error))

  const signedFetch: HttpClient['fetch'] = async (path, init = {}) => {
    const target = url(path)
    const method = (init.method ?? 'GET').toUpperCase()
    const given = init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers) ? Object.fromEntries(init.headers) : init.headers
    let sent!: HttpOutgoingRequest
    const send = async (): Promise<Response> => {
      const { credentials, ...ready } = await prepare({ url: target, method, headers: given ?? {}, ...(init.body !== undefined ? { body: init.body } : {}) })
      sent = ready
      const fetcher = options.fetcher ?? globalThis.fetch
      return fetcher(ready.url, { ...init, method: ready.method, headers: ready.headers, ...(ready.body !== undefined ? { body: ready.body } : {}), ...(credentials && !init.credentials ? { credentials } : {}) })
    }
    let response = await send()
    const provider = response.status === 401 && trusts(target) ? getAuthProvider() : undefined
    if (provider?.refresh && await refreshOnce(provider))
      response = await send()
    // Only the answer the caller gets is inspected, so a 401 that a refresh
    // recovers never reaches `onResponse`.
    return receive(response, sent)
  }

  /** Sends a JSON request and answers the 2xx response unread; a failure is this client's unless the target is foreign. */
  const dispatch = async (path: string, requestOptions: HttpRequestOptions, accept: string): Promise<{ response: Response, fail: <E>(error: E) => E }> => {
    const headers: Record<string, string> = { Accept: accept, ...requestOptions.headers }
    let body: BodyInit | undefined
    if (requestOptions.body !== undefined) {
      if (rawBody(requestOptions.body)) {
        body = requestOptions.body
      }
      else {
        if (!hasHeader(headers, 'Content-Type'))
          headers['Content-Type'] = 'application/json'
        body = JSON.stringify(requestOptions.body)
      }
    }
    // A foreign site's failure is never the reader's session ending.
    const fail = trusts(url(path)) ? own : disown
    const query = buildQueryString(requestOptions.query)
    let response: Response
    try {
      response = await signedFetch(`${path}${path.includes('?') ? query.replace('?', '&') : query}`, {
        method: requestOptions.method ?? 'GET',
        headers,
        ...(body !== undefined ? { body } : {}),
        ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
      })
    }
    catch (error) {
      throw fail(error)
    }
    if (response.ok)
      return { response, fail }
    // The status already says it failed; a body that cannot be read adds nothing.
    const parsed = parseBody(await response.text().catch(() => ''), false)
    const details = (options.parseError ?? parseLumiError)(parsed, response)
    throw fail(new DataProviderError({
      status: response.status,
      code: details.code,
      message: details.message || response.statusText || `Request failed with ${response.status}`,
      data: details.data,
      raw: parsed,
      errors: details.errors,
    }))
  }

  const request: HttpClient['request'] = async (path, requestOptions = {}) => {
    const { response, fail } = await dispatch(path, requestOptions, 'application/json')
    let text: string
    try {
      text = await response.text()
    }
    catch (error) {
      // A 2xx whose body breaks off is not an empty success.
      throw fail(error)
    }
    return parseBody(text, true)
  }

  const download: HttpClient['download'] = async (path, requestOptions = {}) =>
    (await dispatch(path, requestOptions, '*/*')).response

  return {
    baseUrl,
    signed,
    url,
    getAuthProvider,
    prepare,
    receive,
    fetch: signedFetch,
    request,
    download,
    own,
    extend: next => createHttpClient({
      ...options,
      ...next,
      baseUrl: next.baseUrl === undefined ? baseUrl : next.baseUrl,
      headers: next.headers === undefined ? options.headers : next.headers,
      // Trust adds up: an extended client keeps the sites its parent trusted.
      trustedOrigins: [...(options.trustedOrigins ?? []), ...(next.trustedOrigins ?? [])],
    }),
  }
}
