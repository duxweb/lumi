// @vitest-environment jsdom
import type { LumiLoadError } from '../../src/index.js'
import { describe, expect, it, vi } from 'vitest'
import { uiCatalog } from '../../../ui/src/react/registry.js'
import { createSpecLoader, packDocument } from '../../src/index.js'

const specDocument = {
  root: 'card',
  elements: { card: { type: 'Card', props: { title: 'Hello' }, children: [] } },
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  })
}

describe('createSpecLoader', () => {
  it('validates local documents and reports structured diagnostics', async () => {
    const loader = createSpecLoader(uiCatalog, { baseURL: location.href })
    await expect(loader.load(specDocument)).resolves.toEqual(specDocument)
    await expect(
      loader.load({
        root: 'missing',
        elements: { missing: { type: 'Missing', props: {}, children: [] } },
      } as any),
    ).rejects.toMatchObject({
      code: 'invalid_document',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'unknown_component' }),
      ]),
    })
  })

  it('deduplicates requests and serves fresh cached documents', async () => {
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    const [first, second] = await Promise.all([
      loader.load('/page.json'),
      loader.load('/page.json'),
    ])
    expect(first).toEqual(specDocument)
    expect(second).toBe(first)
    await expect(loader.load('/page.json')).resolves.toBe(first)
    expect(loader.peek('/page.json')).toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('isolates cached documents by explicit authentication context', async () => {
    const tenantB = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Tenant B' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(specDocument))
      .mockResolvedValueOnce(jsonResponse(tenantB))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    await expect(
      loader.load('/page.json', { cacheKey: 'tenant-a' }),
    ).resolves.toEqual(specDocument)
    await expect(
      loader.load('/page.json', { cacheKey: 'tenant-b' }),
    ).resolves.toEqual(tenantB)
    await expect(
      loader.load('/page.json', { cacheKey: 'tenant-a' }),
    ).resolves.toEqual(specDocument)
    expect(loader.peek('/page.json', 'tenant-b')).toEqual(tenantB)
    expect(fetcher).toHaveBeenCalledTimes(2)

    loader.invalidate('/page.json')
    expect(loader.peek('/page.json', 'tenant-a')).toBeUndefined()
    expect(loader.peek('/page.json', 'tenant-b')).toBeUndefined()
  })

  it('isolates requests and cache entries by resolved request headers', async () => {
    const tenantB = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Tenant B' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(specDocument))
      .mockResolvedValueOnce(jsonResponse(tenantB))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    const [tenantAResult, tenantBResult] = await Promise.all([
      loader.load('/page.json', {
        headers: { Authorization: 'Bearer tenant-a' },
      }),
      loader.load('/page.json', {
        headers: { Authorization: 'Bearer tenant-b' },
      }),
    ])

    expect(tenantAResult).toEqual(specDocument)
    expect(tenantBResult).toEqual(tenantB)
    await expect(
      loader.load('/page.json', {
        headers: { Authorization: 'Bearer tenant-a' },
      }),
    ).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not collide when cache keys and URLs contain separators', async () => {
    const secondDocument = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Second' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(specDocument))
      .mockResolvedValueOnce(jsonResponse(secondDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    await expect(
      loader.load('/page.json', { cacheKey: 'tenant\0section' }),
    ).resolves.toEqual(specDocument)
    await expect(
      loader.load('section\0/page.json', { cacheKey: 'tenant' }),
    ).resolves.toEqual(secondDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('isolates dynamic authentication headers without exposing them through peek', async () => {
    let token = 'tenant-a'
    const tenantB = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Tenant B' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(specDocument))
      .mockResolvedValueOnce(jsonResponse(tenantB))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: () => ({ Authorization: `Bearer ${token}` }),
    })

    await expect(loader.load('/page.json')).resolves.toEqual(specDocument)
    token = 'tenant-b'
    await expect(loader.load('/page.json')).resolves.toEqual(tenantB)
    expect(loader.peek('/page.json')).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('revalidates stale entries with ETag and supports invalidation', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(specDocument, { headers: { etag: 'page-v1' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      cacheTime: 0,
    })

    await loader.load('/page.json')
    await loader.load('/page.json')
    expect(
      new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('If-None-Match'),
    ).toBe('page-v1')

    loader.invalidate('/page.json')
    await loader.load('/page.json')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('cancels one caller without cancelling a shared request', async () => {
    const fetcher = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return jsonResponse(specDocument)
    })
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })
    const controller = new AbortController()
    const cancelled = loader.load('/page.json', { signal: controller.signal })
    const shared = loader.load('/page.json')
    controller.abort()

    await expect(cancelled).rejects.toMatchObject({ code: 'aborted' })
    await expect(shared).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('times out one caller without cancelling a shared request', async () => {
    let resolveRequest!: (value: Response) => void
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
    )
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      timeout: 1000,
    })
    const timedOut = loader.load('/page.json', { timeout: 5 })
    const shared = loader.load('/page.json')

    await expect(timedOut).rejects.toMatchObject({ code: 'timeout' })
    resolveRequest(jsonResponse(specDocument))
    await expect(shared).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('lets each caller override or disable the loader timeout', async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 20)
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(init.signal?.reason)
            },
            { once: true },
          )
        })
        return jsonResponse(specDocument)
      },
    )
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      timeout: 5,
    })

    await expect(loader.load('/long.json', { timeout: 50 })).resolves.toEqual(
      specDocument,
    )
    await expect(
      loader.load('/unbounded.json', { timeout: 0 }),
    ).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps shared request timeouts isolated between callers', async () => {
    let resolveRequest!: (value: Response) => void
    const fetcher = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          resolveRequest = resolve
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason))
        }),
    )
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      timeout: 1000,
    })
    const short = loader.load('/shared-timeout.json', { timeout: 5 })
    const long = loader.load('/shared-timeout.json', { timeout: 50 })

    await expect(short).rejects.toMatchObject({ code: 'timeout' })
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(false)
    resolveRequest(jsonResponse(specDocument))
    await expect(long).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not resolve headers or start a request for an already aborted caller', async () => {
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const headers = vi.fn(async () => ({ Authorization: 'Bearer token' }))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers,
    })
    const controller = new AbortController()
    controller.abort('unmounted')

    await expect(
      loader.load('/page.json', { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'aborted',
      url: '/page.json',
    })
    expect(headers).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not start a request when the caller aborts while headers resolve', async () => {
    let resolveHeaders!: (headers: HeadersInit) => void
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: () =>
        new Promise<HeadersInit>((resolve) => {
          resolveHeaders = resolve
        }),
    })
    const controller = new AbortController()
    const request = loader.load('/page.json', { signal: controller.signal })

    controller.abort('unmounted')
    await expect(request).rejects.toMatchObject({ code: 'aborted' })
    resolveHeaders({ Authorization: 'Bearer token' })
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not start a request when header resolution aborts the caller', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: async () => {
        controller.abort('unmounted')
        return { Authorization: 'Bearer token' }
      },
    })

    await expect(
      loader.load('/page.json', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not start a request when the caller times out while headers resolve', async () => {
    let resolveHeaders!: (headers: HeadersInit) => void
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: () =>
        new Promise<HeadersInit>((resolve) => {
          resolveHeaders = resolve
        }),
    })
    const request = loader.load('/page.json', { timeout: 5 })

    await expect(request).rejects.toMatchObject({ code: 'timeout' })
    resolveHeaders({ Authorization: 'Bearer token' })
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns a rejected promise when static headers are invalid', async () => {
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher: async () => jsonResponse(specDocument),
    })
    let request: Promise<unknown> | undefined

    expect(() => {
      request = loader.load('/page.json', {
        headers: { 'invalid\nname': 'value' },
      })
    }).not.toThrow()
    await expect(request).rejects.toBeInstanceOf(TypeError)
  })

  it('does not send host headers to an untrusted document origin', async () => {
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: { Authorization: 'Bearer token' },
    })

    await expect(
      loader.load('https://schemas.invalid/page.json'),
    ).rejects.toMatchObject({
      code: 'untrusted_origin',
      url: 'https://schemas.invalid/page.json',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('checks the origin after URL parsing instead of relying on URL spelling', async () => {
    vi.stubGlobal('location', new URL('https://app.example.com/base'))
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: { Authorization: 'Bearer token' },
    })

    try {
      await expect(
        loader.load('http:schemas.invalid/page.json'),
      ).rejects.toMatchObject({
        code: 'untrusted_origin',
        url: 'http:schemas.invalid/page.json',
      })
      expect(fetcher).not.toHaveBeenCalled()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('loads public cross-origin documents without host headers', async () => {
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    await expect(
      loader.load('https://cdn.example.com/page.json'),
    ).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('sends host headers only to explicitly trusted cross-origin documents', async () => {
    const fetcher = vi.fn(async () => jsonResponse(specDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: { Authorization: 'Bearer token' },
      trustedOrigins: ['https://schemas.example.com'],
    })

    await expect(
      loader.load('https://schemas.example.com/page.json'),
    ).resolves.toEqual(specDocument)
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer token')
  })

  it('does not forward host headers across an untrusted redirect', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === 'https://schemas.example.com/page.json') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://schemas.invalid/stolen.json' },
        })
      }
      return jsonResponse(specDocument)
    })
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: { 'X-Lumi-Token': 'secret' },
      trustedOrigins: ['https://schemas.example.com'],
    })

    await expect(
      loader.load('https://schemas.example.com/page.json'),
    ).rejects.toMatchObject({
      code: 'untrusted_origin',
      url: 'https://schemas.invalid/stolen.json',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('manual')
  })

  it('follows trusted redirects one hop at a time with a custom fetcher', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/page.json')) {
        return new Response(null, {
          status: 302,
          headers: { location: '/redirected.json' },
        })
      }
      return jsonResponse(specDocument)
    })
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
      headers: { 'X-Lumi-Token': 'secret' },
      trustedOrigins: ['https://schemas.example.com'],
    })

    await expect(
      loader.load('https://schemas.example.com/page.json'),
    ).resolves.toEqual(specDocument)
    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
      'https://schemas.example.com/page.json',
      'https://schemas.example.com/redirected.json',
    ])
    expect(
      fetcher.mock.calls.every(call => call[1]?.redirect === 'manual'),
    ).toBe(true)
  })

  it('keeps public headerless redirects compatible with custom fetchers', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/page.json')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'redirected.json' },
        })
      }
      return jsonResponse(specDocument)
    })
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    await expect(
      loader.load('https://cdn.example.com/page.json'),
    ).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(
      fetcher.mock.calls.every(call => call[1]?.redirect === 'follow'),
    ).toBe(true)
  })

  it('does not reuse or cache an invalidated in-flight request', async () => {
    let resolveFirst!: (value: Response) => void
    const freshDocument = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Fresh' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce(jsonResponse(freshDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    const stale = loader.load('/page.json')
    loader.invalidate('/page.json')
    const fresh = loader.load('/page.json')
    resolveFirst(jsonResponse(specDocument))

    await expect(stale).resolves.toEqual(specDocument)
    await expect(fresh).resolves.toEqual(freshDocument)
    await expect(loader.load('/page.json')).resolves.toEqual(freshDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidates a header-isolated request before it reaches the cache', async () => {
    let resolveFirst!: (value: Response) => void
    const freshDocument = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Fresh' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce(jsonResponse(freshDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    const stale = loader.load('/page.json', {
      headers: { Authorization: 'Bearer token' },
    })
    loader.invalidate('/page.json')
    const fresh = loader.load('/page.json', {
      headers: { Authorization: 'Bearer token' },
    })
    resolveFirst(jsonResponse(specDocument))

    await expect(stale).resolves.toEqual(specDocument)
    await expect(fresh).resolves.toEqual(freshDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('reloads instead of reusing an in-flight default request', async () => {
    let resolveDefault!: (value: Response) => void
    const reloadedDocument = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Reloaded' }, children: [] },
      },
    }
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveDefault = resolve
          }),
      )
      .mockResolvedValueOnce(jsonResponse(reloadedDocument))
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    const initial = loader.load('/page.json')
    const reloaded = loader.load('/page.json', { cache: 'reload' })
    resolveDefault(jsonResponse(specDocument))

    await expect(initial).resolves.toEqual(specDocument)
    await expect(reloaded).resolves.toEqual(reloadedDocument)
    await expect(loader.load('/page.json')).resolves.toEqual(reloadedDocument)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('shares an in-flight reload with subsequent default callers', async () => {
    let resolveReload!: (value: Response) => void
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveReload = resolve
        }),
    )
    const loader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher,
    })

    const reloaded = loader.load('/page.json', { cache: 'reload' })
    const shared = loader.load('/page.json')
    resolveReload(jsonResponse(specDocument))

    await expect(reloaded).resolves.toEqual(specDocument)
    await expect(shared).resolves.toEqual(specDocument)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reports timeout and HTTP failures with stable error codes', async () => {
    const timeoutFetcher = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason))
        }),
    )
    await expect(
      createSpecLoader(uiCatalog, {
        baseURL: location.href,
        fetcher: timeoutFetcher,
        timeout: 5,
      }).load('/slow.json'),
    ).rejects.toMatchObject({ code: 'timeout' })

    const httpLoader = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher: async () => new Response(null, { status: 503 }),
    })
    await expect(httpLoader.load('/down.json')).rejects.toEqual(
      expect.objectContaining<LumiLoadError>({
        code: 'http_error',
        status: 503,
      }),
    )
  })

  it('unpacks a packed answer before validating and caching it', async () => {
    const fetcher = vi.fn(async () => jsonResponse(await packDocument(specDocument)))
    const loader = createSpecLoader(uiCatalog, { baseURL: location.href, fetcher })
    const first = await loader.load('/page.json')
    expect(first).toEqual(specDocument)
    await expect(loader.load('/page.json')).resolves.toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(1)

    const invalid = createSpecLoader(uiCatalog, {
      baseURL: location.href,
      fetcher: async () => jsonResponse(await packDocument({ root: 'x', elements: { x: { type: 'Missing', props: {}, children: [] } } })),
    })
    await expect(invalid.load('/page.json')).rejects.toMatchObject({ code: 'invalid_document' })
  })

  it('unpacks with the configured key and reports a wrong one as an unreadable answer', async () => {
    const fetcher = async (): Promise<Response> => jsonResponse(await packDocument(specDocument, { key: 'k1' }))
    await expect(createSpecLoader(uiCatalog, { baseURL: location.href, fetcher, packKey: 'k1' }).load('/page.json')).resolves.toEqual(specDocument)
    await expect(createSpecLoader(uiCatalog, { baseURL: location.href, fetcher, packKey: 'k2' }).load('/page.json')).rejects.toMatchObject({
      code: 'invalid_json',
      message: expect.stringContaining('could not be unpacked'),
    })
    await expect(createSpecLoader(uiCatalog, { baseURL: location.href, fetcher }).load('/page.json')).rejects.toMatchObject({ code: 'invalid_json' })
  })
})
