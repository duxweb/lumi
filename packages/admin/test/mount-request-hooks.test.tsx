// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { MountedAdmin } from '../src/react/mountAdmin.js'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountAdmin } from '../src/react/mountAdmin.js'

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const manifest = { app: { id: 'shop', title: 'Shop' }, routes: [] }

describe('mountAdmin request hooks', () => {
  afterEach(() => {
    history.replaceState(null, '', '/')
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('gives dataProviders.default hooks to every request at api.url, and a source only its own', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const sent: Array<{ url: string, headers: Record<string, string> }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      sent.push({ url: String(input), headers: (init.headers ?? {}) as Record<string, string> })
      return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    let mounted!: MountedAdmin
    await act(async () => {
      mounted = await mountAdmin(
        { data: [{ name: 'main', url: 'https://api.test' }, { name: 'cms', url: 'https://cms.test' }, { name: 'logs', url: 'https://logs.test' }], panels: { manifest: manifest as never } },
        () => ({
          dataProviders: {
            default: { onRequest: (request) => { request.headers['X-Sign'] = `app ${request.method} ${request.url}` } },
            cms: { onRequest: (request) => { request.headers['X-Sign'] = 'cms' } },
          },
        }),
      )
    })
    try {
      await act(async () => {
        await mounted.context.getDataProvider().getList({ resource: 'orders' })
        await mounted.http.request('/me')
        await mounted.context.getDataProvider('cms').getList({ resource: 'posts' })
        await mounted.context.getDataProvider('logs').getList({ resource: 'entries' })
      })
      const sign = (prefix: string) => sent.find(entry => entry.url.startsWith(prefix))?.headers['X-Sign']
      expect(sign('https://api.test/orders')).toBe('app GET https://api.test/orders')
      expect(sign('https://api.test/me')).toBe('app GET https://api.test/me')
      expect(sign('https://cms.test/posts')).toBe('cms')
      expect(sign('https://logs.test/entries')).toBeUndefined()
    }
    finally {
      act(() => mounted.unmount())
    }
  })

  it('takes an extension\'s data providers with the config left as it is: `default` replaces the panel\'s backend, any other name is added', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const sent: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      sent.push(String(input))
      return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const provider = (label: string): DataProvider => ({
      getList: async () => ({ data: [{ label }], total: 1 }),
      getOne: async () => ({ data: { label } }),
      create: async () => ({ data: { label } }),
      update: async () => ({ data: { label } }),
      deleteOne: async () => ({ data: { label } }),
    }) as unknown as DataProvider
    let mounted!: MountedAdmin
    await act(async () => {
      // `data` has one backend and names neither `legacy` nor a replacement.
      mounted = await mountAdmin(
        { data: { url: 'https://api.test' }, panels: { manifest: manifest as never } },
        () => ({ dataProviders: { default: provider('own'), legacy: provider('legacy') } }),
      )
    })
    try {
      await act(async () => {
        expect((await mounted.context.getDataProvider().getList({ resource: 'orders' })).data).toEqual([{ label: 'own' }])
        expect((await mounted.context.getDataProvider('legacy').getList({ resource: 'orders' })).data).toEqual([{ label: 'legacy' }])
        // Sign-in still goes to `data.url`: the config's backend stays the address of the session requests.
        await mounted.http.request('/me')
      })
      expect(sent.filter(url => url.includes('/orders'))).toEqual([])
      expect(sent).toContain('https://api.test/me')
    }
    finally {
      act(() => mounted.unmount())
    }
  })

  it('refuses hooks for a backend the config does not name', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    await expect(mountAdmin({ data: { url: 'https://api.test' }, panels: { manifest: manifest as never } }, () => ({ dataProviders: { shop: { onRequest: () => {} } } }))).rejects.toThrow(/data has no "shop"/)
  })

  it('mounts the panel the address names, with its own backend, sign-in and token', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/merchant/orders')
    localStorage.setItem('lumi_staff_token', 'staff-token')
    localStorage.setItem('lumi_merchant_token', 'merchant-token')
    const sent: Array<{ url: string, headers: Record<string, string> }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      sent.push({ url: String(input), headers: (init.headers ?? {}) as Record<string, string> })
      return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const config = {
      data: [{ name: 'main', url: 'https://api.test' }, { name: 'shop', url: 'https://shop.test' }],
      auth: [{ name: 'staff' }, { name: 'merchant' }],
      panels: [
        { name: 'admin', path: '/admin', manifest: manifest as never, auth: 'staff' },
        { name: 'merchant', path: '/merchant', manifest: manifest as never, auth: 'merchant', data: 'shop' },
      ],
    }
    let mounted!: MountedAdmin
    await act(async () => {
      mounted = await mountAdmin(config)
    })
    try {
      expect(mounted.panel.panel.name).toBe('merchant')
      await act(async () => {
        await mounted.context.getDataProvider().getList({ resource: 'orders' })
        await mounted.context.getDataProvider('main').getList({ resource: 'users' })
      })
      expect(sent.find(entry => entry.url.startsWith('https://shop.test/orders'))?.headers.Authorization).toBe('Bearer merchant-token')
      expect(sent.find(entry => entry.url.startsWith('https://api.test/users'))?.headers.Authorization).toBe('Bearer merchant-token')
    }
    finally {
      act(() => mounted.unmount())
    }

    // `/` is outside both panels: the first opens at its own path.
    history.replaceState(null, '', '/')
    await act(async () => {
      mounted = await mountAdmin(config, { authProviders: {} })
    })
    try {
      expect(mounted.panel.panel.name).toBe('admin')
      expect(location.pathname).toBe('/admin')
    }
    finally {
      act(() => mounted.unmount())
    }
  })
})
