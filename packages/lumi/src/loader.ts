import type { Catalog, Spec } from '@json-render/core'
import type { DocumentIssue, DocumentValidation, DocumentValidationOptions } from './validation.js'
import { isPackedDocument, unpackDocument } from './pack.js'
import { validateDocument } from './validation.js'

export type LumiLoadErrorCode
  = | 'aborted'
    | 'http_error'
    | 'invalid_document'
    | 'invalid_json'
    | 'network_error'
    | 'timeout'
    | 'untrusted_origin'

/** A document that could not be loaded: `code` tells the kind of failure and `diagnostics` lists the validation issues. */
export class LumiLoadError extends Error {
  readonly code: LumiLoadErrorCode
  readonly url?: string
  readonly status?: number
  readonly diagnostics?: DocumentIssue[]

  constructor(code: LumiLoadErrorCode, message: string, options: {
    cause?: unknown
    diagnostics?: DocumentIssue[]
    status?: number
    url?: string
  } = {}) {
    super(message, { cause: options.cause })
    this.name = 'LumiLoadError'
    this.code = code
    this.url = options.url
    this.status = options.status
    this.diagnostics = options.diagnostics
  }
}

type LumiRequestHeaders = NonNullable<RequestInit['headers']>

export type LumiCacheMode = 'default' | 'reload' | 'no-store'

export interface LumiLoadOptions {
  cache?: LumiCacheMode
  cacheKey?: string
  headers?: LumiRequestHeaders
  signal?: AbortSignal
  timeout?: number
}

export interface LumiJsonLoader<T> {
  load: (input: string | T, options?: LumiLoadOptions) => Promise<T>
  invalidate: (url?: string, cacheKey?: string) => void
  peek: (url: string, cacheKey?: string) => T | undefined
}

export interface CreateLumiLoaderOptions {
  baseURL?: string
  cacheTime?: number
  fetcher?: typeof fetch
  headers?: LumiRequestHeaders | (() => LumiRequestHeaders | Promise<LumiRequestHeaders>)
  /**
   * Key of packed answers, when the server masks them with one. A server may
   * answer `{ "packed": "…" }` (see `packDocument`) instead of the document,
   * so its text does not show in the network panel; the loader unpacks it
   * before validating and caching. Readable JSON loads as before.
   */
  packKey?: string
  timeout?: number
  trustedOrigins?: string[]
}

interface CacheEntry<T> {
  value: T
  etag?: string
  expiresAt: number
}

interface PendingRequest<T> {
  cacheState: { abandoned: boolean }
  callers: number
  controller: AbortController
  key: string
  promise: Promise<T>
  settled: boolean
}

const CACHE_MODES: LumiCacheMode[] = ['default', 'reload', 'no-store']
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 20

function documentKey(url: string, cacheKey?: string): string {
  return JSON.stringify([cacheKey ?? '', url])
}

function pendingKey(key: string, mode: LumiCacheMode): string {
  return JSON.stringify([mode, key])
}

function documentKeyFromPending(key: string): string | undefined {
  try {
    const value = JSON.parse(key) as unknown
    return Array.isArray(value) && typeof value[1] === 'string' ? value[1] : undefined
  }
  catch {
    return undefined
  }
}

function documentKeyMatchesUrl(key: string, url: string): boolean {
  try {
    const value = JSON.parse(key) as unknown
    return Array.isArray(value) && value[1] === url
  }
  catch {
    return false
  }
}

function headerKey(headers: Headers): string {
  const entries = [...headers.entries()].sort(([left], [right]) => left.localeCompare(right))
  return entries.length > 0 ? JSON.stringify(entries) : ''
}

function validationError(url: string | undefined, result: DocumentValidation): LumiLoadError {
  const diagnostics = result.valid ? [] : result.issues
  return new LumiLoadError('invalid_document', 'Lumi document validation failed', { diagnostics, url })
}

function throwIfInvalid<T>(value: T, validate: (value: unknown) => DocumentValidation, url?: string): T {
  const result = validate(value)
  if (!result.valid)
    throw validationError(url, result)
  return value
}

function abortError(url: string, reason?: unknown): LumiLoadError {
  if (reason instanceof LumiLoadError)
    return reason
  return new LumiLoadError('aborted', `Loading "${url}" was aborted`, { cause: reason, url })
}

function timeoutError(url: string): LumiLoadError {
  return new LumiLoadError('timeout', `Loading "${url}" timed out`, { url })
}

async function raceCaller<T>(promise: Promise<T>, signal: AbortSignal | undefined, timeout: number | undefined, url: string): Promise<T> {
  if (!signal && !(timeout && timeout > 0))
    return promise
  if (signal?.aborted)
    throw abortError(url, signal.reason)

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let abort: (() => void) | undefined
    const cleanup = (): void => {
      if (abort)
        signal?.removeEventListener('abort', abort)
      if (timeoutId !== undefined)
        clearTimeout(timeoutId)
    }
    const settle = (callback: () => void): void => {
      if (settled)
        return
      settled = true
      cleanup()
      callback()
    }
    abort = () => settle(() => reject(abortError(url, signal?.reason)))
    timeoutId = timeout && timeout > 0
      ? setTimeout(() => settle(() => reject(timeoutError(url))), timeout)
      : undefined
    signal?.addEventListener('abort', abort, { once: true })
    promise.then(
      value => settle(() => resolve(value)),
      error => settle(() => reject(error)),
    )
  })
}

/** A loader of JSON documents, by URL or as an inline value: fetches, unpacks a packed answer, validates, and caches with ETag revalidation; concurrent loads of one URL share a request. */
export function createJsonLoader<T>(validate: (value: unknown) => DocumentValidation, options: CreateLumiLoaderOptions = {}): LumiJsonLoader<T> {
  const cache = new Map<string, CacheEntry<T>>()
  const pending = new Map<string, PendingRequest<T>>()
  const revisions = new Map<string, number>()
  const fetcher = options.fetcher ?? globalThis.fetch
  const cacheTime = options.cacheTime ?? 5 * 60_000
  const defaultTimeout = options.timeout ?? 15_000
  const trustedOrigins = new Set((options.trustedOrigins ?? []).map((value) => {
    try {
      return new URL(value, options.baseURL).origin
    }
    catch {
      return undefined
    }
  }).filter((value): value is string => value !== undefined))
  let globalRevision = 0

  const assertTrustedTarget = (url: string, headers: Headers): void => {
    if (headers.entries().next().done)
      return

    const base = options.baseURL ?? 'http://lumi.invalid/'
    let targetOrigin: string
    try {
      targetOrigin = new URL(url, base).origin
    }
    catch {
      throw new LumiLoadError('untrusted_origin', `Refusing to send loader headers to invalid URL "${url}"`, { url })
    }
    const pageOrigin = new URL(base).origin
    if (targetOrigin === pageOrigin || trustedOrigins.has(targetOrigin))
      return
    throw new LumiLoadError('untrusted_origin', `Refusing to send loader headers to untrusted origin "${targetOrigin}"`, { url })
  }

  const resolveRedirectTarget = (locationHeader: string, currentUrl: string): string => {
    const base = options.baseURL ?? 'http://lumi.invalid/'
    try {
      return new URL(locationHeader, new URL(currentUrl, base)).href
    }
    catch (error) {
      throw new LumiLoadError('network_error', `Invalid redirect target from "${currentUrl}"`, { cause: error, url: currentUrl })
    }
  }

  const remainingTimeout = (deadline: number | undefined, url: string): number | undefined => {
    if (deadline === undefined)
      return undefined
    const remaining = deadline - Date.now()
    if (remaining <= 0)
      throw timeoutError(url)
    return remaining
  }

  const mergeHeaders = (baseHeaders: LumiRequestHeaders | undefined, loadOptions: LumiLoadOptions): Headers => {
    const headers = new Headers(baseHeaders)
    new Headers(loadOptions.headers).forEach((value, key) => headers.set(key, value))
    return headers
  }

  const fetchDocument = async (
    url: string,
    key: string,
    loadOptions: LumiLoadOptions,
    headers: Headers,
    revision: number,
    requestGlobalRevision: number,
    signal: AbortSignal,
    cacheState: { abandoned: boolean },
  ): Promise<T> => {
    if (!fetcher)
      throw new LumiLoadError('network_error', 'No fetch implementation is available', { url })

    const cached = cache.get(key)
    const manualRedirects = !headers.entries().next().done
    if (cached?.etag && loadOptions.cache !== 'no-store')
      headers.set('If-None-Match', cached.etag)

    let response: Response
    let responseUrl = url
    let redirects = 0
    while (true) {
      try {
        response = await fetcher(responseUrl, {
          headers: new Headers(headers),
          redirect: manualRedirects ? 'manual' : 'follow',
          signal,
        })
      }
      catch (error) {
        if (signal.aborted) {
          const reason = signal.reason
          if (reason instanceof LumiLoadError)
            throw reason
          throw abortError(url, reason)
        }
        if (error instanceof LumiLoadError)
          throw error
        throw new LumiLoadError('network_error', `Failed to load "${url}"`, { cause: error, url })
      }

      if (manualRedirects && response.redirected && response.url)
        assertTrustedTarget(response.url, headers)
      if (response.redirected && response.url)
        responseUrl = response.url
      if (!REDIRECT_STATUSES.has(response.status))
        break

      const locationHeader = response.headers.get('location')
      if (!locationHeader) {
        throw new LumiLoadError('http_error', `Failed to load "${responseUrl}": redirect response has no Location header`, {
          status: response.status,
          url: responseUrl,
        })
      }
      if (redirects >= MAX_REDIRECTS)
        throw new LumiLoadError('network_error', `Failed to load "${url}": too many redirects`, { url })

      const nextUrl = resolveRedirectTarget(locationHeader, responseUrl)
      assertTrustedTarget(nextUrl, headers)
      responseUrl = nextUrl
      redirects += 1
    }

    if (response.type === 'opaqueredirect') {
      if (manualRedirects) {
        throw new LumiLoadError('untrusted_origin', `Refusing to follow an opaque redirect from "${responseUrl}" with loader headers`, {
          url: responseUrl,
        })
      }
      throw new LumiLoadError('network_error', `Failed to load "${responseUrl}": the redirect target is opaque`, { url: responseUrl })
    }
    if (response.status === 304 && cached) {
      if (!cacheState.abandoned && revision === revisions.get(key) && requestGlobalRevision === globalRevision)
        cached.expiresAt = Date.now() + cacheTime
      return cached.value
    }
    if (!response.ok) {
      throw new LumiLoadError('http_error', `Failed to load "${responseUrl}": HTTP ${response.status}`, {
        status: response.status,
        url: responseUrl,
      })
    }

    let value: unknown
    try {
      value = await response.json()
    }
    catch (error) {
      throw new LumiLoadError('invalid_json', `Response from "${responseUrl}" is not valid JSON`, { cause: error, url: responseUrl })
    }
    if (isPackedDocument(value)) {
      try {
        value = await unpackDocument(value, { key: options.packKey })
      }
      catch (error) {
        throw new LumiLoadError('invalid_json', `Response from "${responseUrl}" is a packed document that could not be unpacked`, { cause: error, url: responseUrl })
      }
    }

    const document = throwIfInvalid(value as T, validate, responseUrl)
    if (!cacheState.abandoned && loadOptions.cache !== 'no-store' && revision === revisions.get(key) && requestGlobalRevision === globalRevision) {
      // Entries under other keys (a rotated token in the headers, say) are
      // never asked for again; drop the ones that have expired.
      const nowAt = Date.now()
      for (const [other, entry] of cache) {
        if (other !== key && entry.expiresAt <= nowAt && !entry.etag) {
          cache.delete(other)
          revisions.delete(other)
        }
      }
      cache.set(key, {
        value: document,
        etag: response.headers.get('etag') ?? undefined,
        expiresAt: Date.now() + cacheTime,
      })
    }
    return document
  }

  return {
    async load(input, loadOptions = {}) {
      if (typeof input !== 'string')
        return throwIfInvalid(input, validate)
      if (loadOptions.signal?.aborted)
        throw abortError(input, loadOptions.signal.reason)

      const callerTimeout = loadOptions.timeout ?? defaultTimeout
      const deadline = callerTimeout > 0
        ? Date.now() + callerTimeout
        : undefined

      const loadWithHeaders = (headers: Headers): { type: 'cached', value: T } | { type: 'pending', request: PendingRequest<T> } => {
        const documentCacheKey = documentKey(input, loadOptions.cacheKey ?? headerKey(headers))
        const cached = cache.get(documentCacheKey)
        if (loadOptions.cache === 'default' || loadOptions.cache === undefined) {
          if (cached && cached.expiresAt > Date.now())
            return { type: 'cached', value: cached.value }
        }

        const mode = loadOptions.cache ?? 'default'
        const key = pendingKey(documentCacheKey, mode)
        let request = mode === 'default'
          ? pending.get(pendingKey(documentCacheKey, 'reload')) ?? pending.get(key)
          : pending.get(key)
        if (!request) {
          if (mode === 'reload')
            revisions.set(documentCacheKey, (revisions.get(documentCacheKey) ?? 0) + 1)
          const revision = revisions.get(documentCacheKey) ?? 0
          revisions.set(documentCacheKey, revision)
          const controller = new AbortController()
          const cacheState = { abandoned: false }
          let createdRequest!: PendingRequest<T>
          const promise = fetchDocument(input, documentCacheKey, loadOptions, headers, revision, globalRevision, controller.signal, cacheState)
            .finally(() => {
              createdRequest.settled = true
              if (pending.get(key) === createdRequest)
                pending.delete(key)
            })
          createdRequest = { cacheState, callers: 0, controller, key, promise, settled: false }
          request = createdRequest
          pending.set(key, request)
        }
        return { type: 'pending', request }
      }

      const resolveHeaders = options.headers
      const baseHeaders = typeof resolveHeaders === 'function'
        ? await raceCaller(
            Promise.resolve().then(resolveHeaders),
            loadOptions.signal,
            remainingTimeout(deadline, input),
            input,
          )
        : resolveHeaders
      if (loadOptions.signal?.aborted)
        throw abortError(input, loadOptions.signal.reason)
      const headers = mergeHeaders(baseHeaders, loadOptions)
      assertTrustedTarget(input, headers)
      const resolved = loadWithHeaders(headers)
      if (resolved.type === 'cached') {
        remainingTimeout(deadline, input)
        return resolved.value
      }
      const { request } = resolved
      request.callers += 1
      try {
        return await raceCaller(request.promise, loadOptions.signal, remainingTimeout(deadline, input), input)
      }
      finally {
        request.callers -= 1
        if (request.callers === 0 && !request.settled) {
          request.cacheState.abandoned = true
          if (pending.get(request.key) === request)
            pending.delete(request.key)
          request.controller.abort(abortError(input))
        }
      }
    },
    invalidate(url, cacheKey) {
      if (!url) {
        cache.clear()
        globalRevision += 1
        revisions.clear()
        pending.clear()
        return
      }

      const keys = cacheKey === undefined
        ? new Set([
            ...cache.keys(),
            ...revisions.keys(),
            ...Array.from(pending.keys()).map(documentKeyFromPending).filter((key): key is string => Boolean(key)),
          ].filter(key => documentKeyMatchesUrl(key, url)))
        : new Set([documentKey(url, cacheKey)])
      for (const key of keys) {
        cache.delete(key)
        revisions.set(key, (revisions.get(key) ?? 0) + 1)
        CACHE_MODES.forEach(mode => pending.delete(pendingKey(key, mode)))
      }
    },
    peek(url, cacheKey) {
      return cache.get(documentKey(url, cacheKey))?.value
    },
  }
}

/** A loader of page Specs, validated against the Catalog. */
export function createSpecLoader(catalog: Catalog, options?: CreateLumiLoaderOptions & DocumentValidationOptions): LumiJsonLoader<Spec> {
  return createJsonLoader(value => validateDocument(value, catalog, options), options)
}
