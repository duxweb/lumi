import type { SimpleDataProviderOptions } from '../../src/core/data/simpleDataProvider.js'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, vi } from 'vitest'
import { createLumi } from '../../src/core/context.js'
import { createSimpleDataProvider as createProvider } from '../../src/core/data/simpleDataProvider.js'
import { createHttpClient } from '../../src/core/http.js'
import { readMany } from '../../src/core/providers/data.js'
import { executeRequest } from '../../src/core/services.js'

// A mock fetch that asserts the Lumi REST wire conventions and returns matching responses.
const fetcher = (async (input: any, init?: any) => {
  const url = new URL(String(input))
  const method = (init?.method ?? 'GET').toUpperCase()

  let body: unknown = { data: { ok: true } }
  if (method === 'GET' && url.pathname.endsWith('/posts'))
    body = { data: [{ id: 1 }, { id: 2 }], meta: { total: 42 } }
  else if (method === 'GET' && /\/posts\/1$/.test(url.pathname))
    body = { data: { id: 1, title: 'a' } }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}) as typeof fetch

// The provider under test, its requests sent through a client with this fetch and locale.
function createSimpleDataProvider(options: Omit<SimpleDataProviderOptions, 'http'> & { fetcher?: typeof fetch, getLocale?: () => string }) {
  const { fetcher: send, getLocale, ...rest } = options
  return createProvider({ ...rest, http: createHttpClient({ ...(send ? { fetcher: send } : {}), ...(getLocale ? { getLocale } : {}) }) })
}

describe('createSimpleDataProvider (Lumi REST conventions)', () => {
  const dp = createSimpleDataProvider({ apiUrl: 'http://x/api', fetcher })

  it('getList sends page/pageSize and unwraps { data, meta.total }', async () => {
    const res = await dp.getList({ resource: 'posts', pagination: { page: 1, pageSize: 10 } })
    expect(res.total).toBe(42)
    expect(res.data).toHaveLength(2)
  })

  it('getOne unwraps single data', async () => {
    const res = await dp.getOne<{ id: number, title: string }>({ resource: 'posts', id: 1 })
    expect(res.data.title).toBe('a')
  })

  it('asks the backend for the current UI locale unless the call names one', async () => {
    const sent: Array<Record<string, string>> = []
    let locale = 'zh-CN'
    const provider = createSimpleDataProvider({
      apiUrl: '/api',
      getLocale: () => locale,
      fetcher: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        sent.push(init?.headers as Record<string, string>)
        return new Response(JSON.stringify({ data: {} }))
      }) as typeof fetch,
    })

    await provider.getOne({ resource: 'posts', id: 1 })
    locale = 'en-US'
    await provider.getOne({ resource: 'posts', id: 1 })
    await provider.custom!({ url: 'ping', headers: { 'accept-language': 'fr' } })

    expect(sent.map(headers => headers['Accept-Language'] ?? headers['accept-language'])).toEqual(['zh-CN', 'en-US', 'fr'])
  })

  it('preserves root-relative API URLs on nested application routes', async () => {
    let requested = ''
    const provider = createSimpleDataProvider({
      apiUrl: '/api/',
      fetcher: (async (input: RequestInfo | URL) => {
        requested = String(input)
        return new Response(JSON.stringify({ data: [], meta: { total: 0 } }))
      }) as typeof fetch,
    })

    await provider.getList({ resource: '/posts/' })

    expect(requested).toBe('/api/posts')
    expect(provider.getApiUrl?.()).toBe('/api')
  })

  it('preserves filter operators and repeated field constraints', async () => {
    let requested = ''
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async (input: RequestInfo | URL) => {
        requested = String(input)
        return new Response(JSON.stringify({ data: [], meta: { total: 0 } }))
      }) as typeof fetch,
    })

    await provider.getList({
      resource: 'products',
      filters: [
        { field: 'total', operator: 'gte', value: 10 },
        { field: 'total', operator: 'lte', value: 20 },
        { field: 'name', operator: 'like', value: 'camera' },
        { field: 'status', operator: 'in', value: ['active', 'draft'] },
      ],
    })

    const query = new URL(requested).searchParams
    expect(query.get('total[gte]')).toBe('10')
    expect(query.get('total[lte]')).toBe('20')
    expect(query.get('name[like]')).toBe('camera')
    expect(query.getAll('status[in][]')).toEqual(['active', 'draft'])
  })

  it('keeps filters and multi-column sorting on separate wire keys', async () => {
    let requested = ''
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async (input: RequestInfo | URL) => {
        requested = String(input)
        return new Response(JSON.stringify({ data: [], meta: { total: 0 } }))
      }) as typeof fetch,
    })

    await provider.getList({
      resource: 'products',
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      sorters: [
        { field: 'status', order: 'asc' },
        { field: 'createdAt', order: 'desc' },
      ],
    })

    const query = new URL(requested).searchParams
    expect(query.get('status')).toBe('active')
    expect(query.getAll('sort')).toEqual(['status,-createdAt'])
  })

  it('encodes string ids as one path segment', async () => {
    const requests: string[] = []
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async (input: RequestInfo | URL) => {
        requests.push(String(input))
        return new Response(JSON.stringify({ data: { id: 'folder/a b?#' } }))
      }) as typeof fetch,
    })

    await provider.getOne({ resource: 'files', id: 'folder/a b?#' })
    await provider.update({ resource: 'files', id: 'folder/a b?#', variables: {} })
    await provider.deleteOne({ resource: 'files', id: 'folder/a b?#' })

    expect(requests).toEqual(Array.from({ length: 3 }).fill('http://x/api/files/folder%2Fa%20b%3F%23'))
  })

  it('forwards meta for every request and sends delete variables as its body', async () => {
    const requests: Array<{ body?: string, method?: string, url: string }> = []
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          body: typeof init?.body === 'string' ? init.body : undefined,
          method: init?.method,
          url: String(input),
        })
        return new Response(JSON.stringify({ data: [] }))
      }) as typeof fetch,
    })
    const meta = { tenant: 'dux' }

    await provider.getList({ resource: 'posts', meta })
    await provider.getOne({ resource: 'posts', id: 1, meta })
    await provider.getMany?.({ resource: 'posts', ids: [1, 2], meta })
    await provider.create({ resource: 'posts', variables: { title: 'New' }, meta })
    await provider.update({ resource: 'posts', id: 1, variables: { title: 'Updated' }, meta })
    await provider.deleteOne({ resource: 'posts', id: 1, variables: { reason: 'duplicate' }, meta })
    await provider.custom?.({ url: 'stats', query: { range: 'week' }, meta })

    expect(requests.map(request => new URL(request.url).searchParams.get('tenant'))).toEqual(Array.from({ length: 7 }).fill('dux'))
    expect(new URL(requests[2]!.url).searchParams.getAll('ids[]')).toEqual(['1', '2'])
    expect(requests[5]).toMatchObject({
      body: JSON.stringify({ reason: 'duplicate' }),
      method: 'DELETE',
    })
  })

  it('exposes structured field errors from a non-2xx body', async () => {
    const failing = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async () => new Response(JSON.stringify({ message: 'Validation failed', code: 'invalid', errors: [{ path: 'title', message: 'Taken' }] }), { status: 422 })) as typeof fetch,
    })
    await expect(failing.create({ resource: 'notes', variables: { title: 'a' } })).rejects.toMatchObject({
      status: 422,
      code: 'invalid',
      message: 'Validation failed',
      errors: [{ path: 'title', message: 'Taken' }],
    })
  })

  it('reads a backend\'s own error format through parseError', async () => {
    const failing = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async () => new Response(JSON.stringify({ msg: 'Invalid', fields: { title: 'Taken' } }), { status: 422 })) as typeof fetch,
      parseError: (body) => {
        const value = body as { msg: string, fields: Record<string, string> }
        return { message: value.msg, errors: Object.entries(value.fields).map(([path, message]) => ({ path, message })) }
      },
    })
    await expect(failing.create({ resource: 'notes', variables: { title: 'a' } })).rejects.toMatchObject({
      status: 422,
      message: 'Invalid',
      errors: [{ path: 'title', message: 'Taken' }],
    })
  })

  it('rejects GET payloads before calling fetch', async () => {
    let calls = 0
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async () => {
        calls += 1
        return new Response(JSON.stringify({ data: {} }))
      }) as typeof fetch,
    })

    await expect(provider.custom?.({ url: 'search', payload: { keyword: 'lumi' } })).rejects.toThrow('use query instead')
    expect(calls).toBe(0)
  })

  it('forwards abort signals to every write operation', async () => {
    const signals: Array<AbortSignal | null | undefined> = []
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal)
        return new Response(JSON.stringify({ data: {} }))
      }) as typeof fetch,
    })
    const controller = new AbortController()

    await provider.create({ resource: 'posts', variables: {}, signal: controller.signal })
    await provider.update({ resource: 'posts', id: 1, variables: {}, signal: controller.signal })
    await provider.deleteOne({ resource: 'posts', id: 1, signal: controller.signal })

    expect(signals).toEqual([controller.signal, controller.signal, controller.signal])
  })

  it('calls auth onError and router redirect on 401', async () => {
    const authErrors: unknown[] = []
    const redirects: string[] = []
    let logoutCalls = 0
    const provider = createSimpleDataProvider({
      apiUrl: 'http://x/api',
      fetcher: (async () => new Response(JSON.stringify({ code: 'token_expired', message: 'unauthorized' }), { status: 401 })) as typeof fetch,
    })
    const client = new QueryClient()
    const context = createLumi({
      dataProvider: provider,
      authProvider: {
        async login() { return { success: true } },
        async logout() {
          logoutCalls += 1
          return { success: true }
        },
        async check() { return { authenticated: true } },
        async onError(error) {
          authErrors.push(error)
          return { logout: true, redirectTo: '/login' }
        },
      },
      routerProvider: {
        back() {},
        parse: () => ({ pathname: '/', params: {} }),
        getCurrentPath: () => '/',
        go({ to }) {
          redirects.push(String(to))
        },
      },
    })

    await expect(executeRequest(context, () => provider.getList({ resource: 'posts' }), client)).rejects.toThrow('unauthorized')
    expect(authErrors).toHaveLength(1)
    expect(authErrors[0]).toMatchObject({ status: 401, code: 'token_expired' })
    expect(logoutCalls).toBe(1)
    expect(redirects).toEqual(['/login'])
  })

  it('handles the same provider error only once across runtime layers', async () => {
    const error = new Error('expired')
    let onErrorCalls = 0
    let logoutCalls = 0
    const { handleAuthProviderError } = await import('@duxweb/lumi')
    const authProvider = {
      async login() { return { success: true } },
      async logout() {
        logoutCalls += 1
        return { success: true }
      },
      async check() { return { authenticated: true } },
      async onError() {
        onErrorCalls += 1
        return { logout: true }
      },
    }

    await Promise.all([
      handleAuthProviderError(authProvider, undefined, error),
      handleAuthProviderError(authProvider, undefined, error),
    ])

    expect(onErrorCalls).toBe(1)
    expect(logoutCalls).toBe(1)
  })
})

describe('record ids', () => {
  const recording = () => {
    const sent: string[] = []
    const provider = createSimpleDataProvider({
      apiUrl: 'https://api.test/v1',
      fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
        sent.push(`${init?.method ?? 'GET'} ${String(input)}`)
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }) as typeof fetch,
    })
    return { sent, provider }
  }

  it('refuses an id that would address the collection or another path, before any request', async () => {
    const { sent, provider } = recording()
    for (const id of ['', '.', '..']) {
      await expect(provider.getOne({ resource: 'orders', id })).rejects.toThrow('is not a record id')
      await expect(provider.update({ resource: 'orders', id, variables: {} })).rejects.toThrow('is not a record id')
      await expect(provider.deleteOne({ resource: 'orders', id })).rejects.toThrow('is not a record id')
    }
    await expect(provider.deleteMany!({ resource: 'orders', ids: [3, ''] })).rejects.toThrow('is not a record id')
    expect(sent).toEqual(['DELETE https://api.test/v1/orders/3'])
  })

  it('answers no records for no ids instead of listing the resource', async () => {
    const { sent, provider } = recording()
    await expect(provider.getMany!({ resource: 'orders', ids: [] })).resolves.toEqual({ data: [] })
    expect(sent).toEqual([])
  })
})

describe('reading several records', () => {
  it('falls back to one getOne per id when the provider has no getMany', async () => {
    const getOne = vi.fn(async ({ id }: { id: number }) => ({ data: { id } }))
    const result = await readMany({ getOne } as never, { resource: 'orders', ids: [1, 2] })
    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }] })
    expect(getOne).toHaveBeenCalledTimes(2)
  })
})
