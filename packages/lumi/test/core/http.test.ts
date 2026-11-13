import type { AuthProvider } from '../../src/core'
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, createLumi, DataProviderError, executeRequest, isUnsignedFailure } from '../../src/core'

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function recorder(answer: (url: string) => Response = () => json(200, { data: { ok: true } })) {
  const sent: Array<{ url: string, init: RequestInit & { headers: Record<string, string> } }> = []
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({ url: String(input), init: init as never })
    return answer(String(input))
  }) as typeof fetch
  return { sent, fetcher }
}

function auth(overrides: Partial<AuthProvider> = {}): AuthProvider {
  return {
    login: async () => ({ success: true }),
    logout: vi.fn(async () => ({ success: true, redirectTo: '/login' })),
    check: async () => ({ authenticated: true }),
    onError: vi.fn(async (error: { status?: number }) => (error.status === 401 ? { logout: true, redirectTo: '/login' } : {})),
    authorizeRequest: () => ({ headers: { Authorization: 'Bearer app' } }),
    ...overrides,
  }
}

describe('createHttpClient', () => {
  it('joins paths, encodes the query and JSON body, and adds locale and tenant', async () => {
    const { sent, fetcher } = recorder()
    const http = createHttpClient({ baseUrl: 'https://api.test/v1/', fetcher, getLocale: () => 'zh-CN', getTenant: () => 'north' })
    await expect(http.request('/orders', { method: 'POST', query: { page: 2, tags: ['a', 'b'], skip: undefined }, body: { title: 'x' } })).resolves.toEqual({ data: { ok: true } })
    expect(sent[0]!.url).toBe('https://api.test/v1/orders?page=2&tags%5B%5D=a&tags%5B%5D=b')
    expect(sent[0]!.init).toMatchObject({ method: 'POST', body: '{"title":"x"}', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'zh-CN', 'X-Tenant': 'north' } })
  })

  it('lets a request name its own locale and tenant, but never its own credentials', async () => {
    const { sent, fetcher } = recorder()
    const http = createHttpClient({ fetcher, authProvider: auth(), getLocale: () => 'zh-CN', getTenant: () => 'north' })
    await http.request('/ping', { headers: { 'accept-language': 'fr', 'x-tenant': 'other', 'authorization': 'Bearer forged' } })
    const headers = sent[0]!.init.headers
    expect(headers['accept-language']).toBe('fr')
    expect(headers['x-tenant']).toBe('other')
    expect(headers.Authorization).toBe('Bearer app')
    expect(headers.authorization).toBeUndefined()
  })

  it('reads the auth provider per request, so a replaced or signed-out session takes effect at once', async () => {
    const { sent, fetcher } = recorder()
    let current: AuthProvider | undefined = auth()
    const http = createHttpClient({ fetcher, authProvider: () => current })
    await http.request('/a')
    current = undefined
    await http.request('/b')
    expect(sent.map(item => item.init.headers.Authorization)).toEqual(['Bearer app', undefined])
  })

  it('passes the auth\'s fetch credentials for a cookie session', async () => {
    const { sent, fetcher } = recorder()
    const http = createHttpClient({ fetcher, authProvider: auth({ authorizeRequest: () => ({ credentials: 'include' }) }) })
    await http.fetch('/stream')
    expect(sent[0]!.init.credentials).toBe('include')
  })

  it('turns a non-2xx answer into a DataProviderError with the field errors', async () => {
    const { fetcher } = recorder(() => json(422, { message: 'Invalid', code: 'invalid', errors: [{ path: 'title', message: 'Taken' }] }))
    const error = await createHttpClient({ fetcher }).request('/x').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(DataProviderError)
    expect(error).toMatchObject({ status: 422, message: 'Invalid', code: 'invalid', errors: [{ path: 'title', message: 'Taken' }] })
  })

  it('reads another backend\'s error body through parseError, and extend keeps or replaces it', async () => {
    const { fetcher } = recorder(() => json(400, { msg: 'Bad input', detail: { name: ['Taken'] } }))
    const http = createHttpClient({
      fetcher,
      parseError: (body) => {
        const value = body as { msg: string, detail: Record<string, string[]> }
        return { message: value.msg, errors: Object.entries(value.detail).map(([path, messages]) => ({ path, message: messages[0]! })) }
      },
    })
    await expect(http.request('/x')).rejects.toMatchObject({ status: 400, message: 'Bad input', errors: [{ path: 'name', message: 'Taken' }], raw: { msg: 'Bad input' } })
    await expect(http.extend({ baseUrl: '/other' }).request('/x')).rejects.toMatchObject({ message: 'Bad input' })
    // Nothing readable falls back to the status text.
    await expect(http.extend({ parseError: () => ({}) }).request('/x')).rejects.toMatchObject({ status: 400, message: 'Request failed with 400', errors: undefined })
  })

  it('extends with another root and its own key, sending no app credentials', async () => {
    const { sent, fetcher } = recorder()
    const app = createHttpClient({ baseUrl: '/api', fetcher, authProvider: auth() })
    const cms = app.extend({ baseUrl: 'https://cms.test', auth: false, headers: { 'X-Api-Key': 'k' } })
    await cms.request('/posts')
    expect(sent[0]!.url).toBe('https://cms.test/posts')
    expect(sent[0]!.init.headers).toMatchObject({ 'X-Api-Key': 'k' })
    expect(sent[0]!.init.headers.Authorization).toBeUndefined()
    expect(cms.signed).toBe(false)
  })

  it('appends the query to a path that already has one', async () => {
    const { sent, fetcher } = recorder()
    await createHttpClient({ baseUrl: 'https://api.test', fetcher }).request('/reports?type=daily', { query: { date: '2026-11-11' } })
    expect(sent[0]!.url).toBe('https://api.test/reports?type=daily&date=2026-11-11')
  })

  it('fails a 2xx whose body breaks off instead of answering an empty success', async () => {
    const broken = (status: number): Response => new Response(new ReadableStream({
      start(controller) {
        controller.error(new Error('connection reset'))
      },
    }), { status })
    await expect(createHttpClient({ fetcher: (async () => broken(200)) as typeof fetch }).request('/orders')).rejects.toThrow('connection reset')
    // A failure status is still reported as that status.
    await expect(createHttpClient({ fetcher: (async () => broken(502)) as typeof fetch }).request('/orders')).rejects.toMatchObject({ status: 502 })
  })

  it('downloads a file as the unread response, and reports a refusal like any request', async () => {
    const { sent, fetcher } = recorder(url => (url.includes('denied')
      ? json(403, { message: 'No export for you' })
      : new Response('id,name\r\n1,A\r\n', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="orders.csv"' } })))
    const http = createHttpClient({ baseUrl: 'https://api.test', fetcher, authProvider: auth() })
    const response = await http.download('/orders/export', { query: { status: 'paid' } })
    expect(sent[0]!.url).toBe('https://api.test/orders/export?status=paid')
    expect(sent[0]!.init.headers.Authorization).toBe('Bearer app')
    expect(response.headers.get('Content-Disposition')).toContain('orders.csv')
    expect(response.bodyUsed).toBe(false)
    await expect(response.text()).resolves.toBe('id,name\r\n1,A\r\n')
    await expect(http.download('/denied')).rejects.toMatchObject({ status: 403, message: 'No export for you' })
  })
})

describe('requests to another site', () => {
  const options = (fetcher: typeof fetch, provider = auth({ refresh: vi.fn(async () => true) })) => ({
    baseUrl: 'https://api.test',
    fetcher,
    authProvider: provider,
    getTenant: () => 'north',
    headers: { 'X-Api-Key': 'k' },
    onRequest: (request: { headers: Record<string, string> }) => {
      request.headers['X-Sign'] = 'signed'
    },
    onResponse: () => {
      throw new Error('hook ran')
    },
  })

  it('sends a full URL to a foreign site without credentials, tenant, default headers or hooks', async () => {
    const { sent, fetcher } = recorder()
    const http = createHttpClient(options(fetcher))
    await expect(http.request('https://evil.test/collect', { headers: { 'X-Own': '1' } })).resolves.toEqual({ data: { ok: true } })
    expect(sent[0]!.url).toBe('https://evil.test/collect')
    expect(sent[0]!.init.headers).toEqual({ 'Accept': 'application/json', 'X-Own': '1' })
    expect(sent[0]!.init.credentials).toBeUndefined()
    // The same client still signs its own backend, by path or by full URL.
    await expect(http.request('https://api.test/orders')).rejects.toThrow('hook ran')
    expect(sent[1]!.init.headers).toMatchObject({ 'Authorization': 'Bearer app', 'X-Tenant': 'north', 'X-Api-Key': 'k', 'X-Sign': 'signed' })
  })

  it('does not refresh or sign the reader out on a foreign 401', async () => {
    const provider = auth({ refresh: vi.fn(async () => true) })
    const { sent, fetcher } = recorder(() => json(401, {}))
    const http = createHttpClient(options(fetcher, provider))
    const context = createLumi({ authProvider: provider })
    const error = await executeRequest(context, () => http.request('https://evil.test/x')).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ status: 401 })
    expect(isUnsignedFailure(error)).toBe(true)
    expect(sent).toHaveLength(1)
    expect(provider.refresh).not.toHaveBeenCalled()
    expect(provider.onError).not.toHaveBeenCalled()
    expect(provider.logout).not.toHaveBeenCalled()
  })

  it('treats a trusted origin like its own backend', async () => {
    const { sent, fetcher } = recorder()
    const http = createHttpClient({ baseUrl: 'https://api.test', fetcher, authProvider: auth(), trustedOrigins: ['https://files.test'] })
    await http.request('https://files.test/list')
    await http.request('https://files.test.evil.test/list')
    expect(sent.map(entry => entry.init.headers.Authorization)).toEqual(['Bearer app', undefined])
  })

  it('prepares a foreign request for another transport as it was given', async () => {
    const { fetcher } = recorder()
    const http = createHttpClient(options(fetcher))
    await expect(http.prepare({ url: 'https://bucket.test/key', method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: 'bytes' })).resolves.toEqual({
      url: 'https://bucket.test/key',
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: 'bytes',
    })
  })
})

describe('request and response hooks', () => {
  it('lets onRequest sign the final method, URL and encoded body, again for the resend after a refresh', async () => {
    let calls = 0
    const { sent, fetcher } = recorder(() => (++calls === 1 ? json(401, {}) : json(200, { data: 1 })))
    const http = createHttpClient({
      baseUrl: 'https://api.test',
      fetcher,
      authProvider: auth({ refresh: async () => true }),
      onRequest: (request) => {
        request.headers['X-Sign'] = `${request.method} ${request.url} ${String(request.body)} ${calls}`
        delete request.headers.Accept
      },
    })
    await http.request('/orders', { method: 'POST', query: { page: 1 }, body: { a: 1 } })
    expect(sent).toHaveLength(2)
    expect(sent[0]!.init.headers).toMatchObject({ 'Authorization': 'Bearer app', 'X-Sign': 'POST https://api.test/orders?page=1 {"a":1} 0' })
    expect(sent[0]!.init.headers.Accept).toBeUndefined()
    expect(sent[1]!.init.headers['X-Sign']).toBe('POST https://api.test/orders?page=1 {"a":1} 1')
  })

  it('lets onRequest replace the request, and onResponse check or replace the answer', async () => {
    const { sent, fetcher } = recorder(() => json(200, { data: 'raw' }))
    const onResponse = vi.fn(async (response: Response) => {
      expect(await response.clone().json()).toEqual({ data: 'raw' })
      return json(200, { data: 'checked' })
    })
    const http = createHttpClient({ fetcher, onRequest: request => ({ ...request, url: `${request.url}?v=2` }), onResponse })
    await expect(http.request('/a')).resolves.toEqual({ data: 'checked' })
    expect(sent[0]!.url).toBe('/a?v=2')
    expect(onResponse.mock.calls[0]![1]).toMatchObject({ url: '/a?v=2', method: 'GET' })
  })

  it('fails the request when onResponse throws, and extend keeps or clears the hooks', async () => {
    const { sent, fetcher } = recorder()
    const http = createHttpClient({
      fetcher,
      onRequest: (request) => {
        request.headers['X-App'] = '1'
      },
      onResponse: () => {
        throw new Error('Bad signature')
      },
    })
    await expect(http.request('/a')).rejects.toThrow('Bad signature')
    await expect(http.extend({ baseUrl: '/v2' }).request('/a')).rejects.toThrow('Bad signature')
    await expect(http.extend({ onRequest: undefined, onResponse: undefined }).request('/b')).resolves.toEqual({ data: { ok: true } })
    expect(sent.map(entry => entry.init.headers['X-App'])).toEqual(['1', '1', undefined])
  })

  it('prepares a request for another transport the way fetch sends it', async () => {
    const http = createHttpClient({
      authProvider: auth({ authorizeRequest: () => ({ credentials: 'include', headers: { 'X-CSRF': 't' } }) }),
      onRequest: (request) => {
        request.headers['X-Sign'] = String(request.body)
      },
    })
    await expect(http.prepare({ url: '/upload', method: 'POST', headers: { 'X-Extra': 'e' }, body: 'form' })).resolves.toEqual({
      url: '/upload',
      method: 'POST',
      body: 'form',
      credentials: 'include',
      headers: { 'X-Extra': 'e', 'X-CSRF': 't', 'X-Sign': 'form' },
    })
  })
})

describe('request failures and the session', () => {
  it('signs the reader out on a 401 from a signed client', async () => {
    const provider = auth()
    const { fetcher } = recorder(() => json(401, {}))
    const http = createHttpClient({ fetcher, authProvider: provider })
    const context = createLumi({ authProvider: provider })
    await expect(executeRequest(context, () => http.request('/orders'))).rejects.toMatchObject({ status: 401 })
    expect(provider.onError).toHaveBeenCalledTimes(1)
    expect(provider.logout).toHaveBeenCalledTimes(1)
  })

  it('leaves the session alone on a 401 from a backend the app does not sign for', async () => {
    const provider = auth()
    const { fetcher } = recorder(() => json(401, {}))
    const cms = createHttpClient({ fetcher, authProvider: provider }).extend({ auth: false })
    const context = createLumi({ authProvider: provider })
    const error = await executeRequest(context, () => cms.request('/posts')).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ status: 401 })
    expect(isUnsignedFailure(error)).toBe(true)
    expect(provider.onError).not.toHaveBeenCalled()
    expect(provider.logout).not.toHaveBeenCalled()
  })
})
