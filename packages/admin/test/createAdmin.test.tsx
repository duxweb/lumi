// @vitest-environment jsdom
import type { DataProvider, LumiJsonLoader } from '@duxweb/lumi'
import type { ComponentRegistry } from '@json-render/react'
import type { PropsWithChildren } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import type { ShellContextValue } from '../src/react/types.js'
import { createHttpClient, createI18nProvider, createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdmin, useShell } from '../src/react/index.js';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const dataProvider = {
  async getList() {
    return { data: [], total: 0 }
  },
  async getOne() {
    return { data: {} }
  },
  async create() {
    return { data: {} }
  },
  async update() {
    return { data: {} }
  },
  async deleteOne() {
    return { data: {} }
  },
} as unknown as DataProvider

const testComponents = {
  Badge: (props: { label?: unknown }) => (
    <span>{String(props.label ?? '')}</span>
  ),
  Alert: (props: { title?: string, message?: string }) => (
    <div data-testid="page-alert">
      {props.title}
      {' '}
      {props.message}
    </div>
  ),
  Input: (props: {
    'value'?: string | number
    'type'?: string
    'name'?: string
    'ariaLabel'?: string
    'data-testid'?: string
    'onChange'?: (value: string) => void
  }) => (
    <input
      data-testid={props['data-testid']}
      type={props.type}
      name={props.name}
      aria-label={props.ariaLabel}
      value={props.value ?? ''}
      onChange={event => props.onChange?.(event.target.value)}
    />
  ),
  Button: (props: {
    'label'?: string
    'type'?: 'button' | 'submit' | 'reset'
    'disabled'?: boolean
    'data-testid'?: string
    'onClick'?: () => void
  }) => (
    <button
      data-testid={props['data-testid']}
      type={props.type}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  ),
  Dialog: (
    props: PropsWithChildren<{
      open?: boolean
      title?: string
      description?: string
      confirmText?: string
      cancelText?: string
      onConfirm?: () => void
      onOpenChange?: (open: boolean) => void
    }>,
  ) =>
    props.open
      ? (
          <div role="dialog" aria-label={props.title}>
            <p>{props.description}</p>
            {props.children}
            <button type="button" onClick={() => props.onOpenChange?.(false)}>
              {props.cancelText ?? 'Close'}
            </button>
            {props.confirmText && (
              <button type="button" onClick={props.onConfirm}>
                {props.confirmText}
              </button>
            )}
          </div>
        )
      : null,
  Drawer: (
    props: PropsWithChildren<{
      open?: boolean
      title?: string
      description?: string
      onOpenChange?: (open: boolean) => void
    }>,
  ) =>
    props.open
      ? (
          <div role="dialog" aria-label={props.title}>
            <p>{props.description}</p>
            {props.children}
            <button type="button" onClick={() => props.onOpenChange?.(false)}>
              Close drawer
            </button>
          </div>
        )
      : null,
}
const registry: ComponentRegistry = Object.fromEntries(
  Object.entries(testComponents).map(([name, Component]) => [
    name,
    ({ element }) => <Component {...(element.props as any)} />,
  ]),
)

function manifest(label = 'Home'): AdminManifest {
  return {
    app: { id: 'test-admin', title: 'Test Admin', logo: './logo.svg' },
    routes: [
      {
        name: 'home',
        path: '/',
        page: {
          spec: {
            root: 'page',
            elements: {
              page: { type: 'Badge', props: { label }, children: [] },
            },
          },
        },
        menu: { label, order: 10 },
      },
      {
        path: '/settings',
        children: [
          {
            name: 'profile',
            path: 'profile',
            page: { src: './profile.json' },
            menu: { label: 'Profile', order: 20 },
          },
        ],
      },
      {
        name: 'landing',
        path: '/landing',
        public: true,
        page: {
          spec: {
            root: 'page',
            elements: {
              page: {
                type: 'Badge',
                props: { label: 'Landing' },
                children: [],
              },
            },
          },
        },
      },
    ],
  }
}

function memoryRouter(initialEntries = ['/']) {
  return (routes: Parameters<typeof createMemoryRouter>[0]) =>
    createMemoryRouter(routes, { initialEntries })
}

function shellManifest(): AdminManifest {
  const homeModule = { name: 'home', label: 'Home', icon: 'i-hugeicons-home' }
  const settingsModule = {
    name: 'settings',
    label: 'Settings',
    icon: 'i-hugeicons-settings',
  }
  return {
    app: { id: 'test-admin', title: 'Test Admin', layout: 'dual', tabs: true },
    routes: [
      {
        name: 'home',
        path: '/',
        page: {
          spec: {
            root: 'page',
            elements: {
              page: {
                type: 'Badge',
                props: { label: 'Home page' },
                children: [],
              },
            },
          },
        },
        menu: {
          label: 'Home',
          order: 10,
          module: homeModule,
          group: { name: 'overview', label: 'Overview' },
        },
      },
      {
        name: 'reports',
        path: '/reports',
        page: {
          spec: {
            root: 'page',
            elements: {
              page: {
                type: 'Badge',
                props: { label: 'Reports page' },
                children: [],
              },
            },
          },
        },
        menu: {
          label: 'Reports',
          order: 20,
          module: homeModule,
          group: { name: 'overview', label: 'Overview' },
        },
      },
      {
        name: 'profile',
        path: '/settings/profile',
        page: {
          spec: {
            root: 'page',
            elements: {
              page: {
                type: 'Badge',
                props: { label: 'Profile page' },
                children: [],
              },
            },
          },
        },
        menu: {
          label: 'Profile',
          order: 30,
          module: settingsModule,
          group: { name: 'account', label: 'Account' },
        },
      },
    ],
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('createAdmin React', () => {
  it('renders a diagnostic error when initial loading fails', async () => {
    const loader = {
      load: vi.fn().mockRejectedValue(new Error('manifest unavailable')),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<admin.App />))
    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'manifest unavailable',
      ),
    )

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('requires an auth provider for protected manifests', () => {
    expect(() =>
      createAdmin({
        context: createLumi({ dataProvider }),
        registry,
        manifest: manifest(),
        manifestAuth: 'protected',
        createRouter: memoryRouter(),
      }),
    ).toThrow('manifestAuth "protected" requires an authProvider')
  })

  it('checks a protected session once before loading its Manifest', async () => {
    const order: string[] = []
    const check = vi.fn(async () => {
      order.push('check')
      return { authenticated: true }
    })
    const loader = {
      load: vi.fn(async () => {
        order.push('manifest')
        return manifest()
      }),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const context = createLumi({
      dataProvider,
      authProvider: {
        check,
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      manifestAuth: 'protected',
      createRouter: memoryRouter(),
    })

    await admin.ready()

    expect(check).toHaveBeenCalledOnce()
    expect(order).toEqual(['check', 'manifest'])
    admin.dispose()
  })

  it('signs a manifest the backend serves, but not one from another origin', async () => {
    const seen: Array<{ url: string, authorization: string | null }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      seen.push({ url: String(input), authorization: new Headers(init.headers).get('Authorization') })
      return new Response(JSON.stringify(manifest()), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    try {
      const authProvider = {
        check: async () => ({ authenticated: true }),
        login: async () => ({ success: true }),
        logout: async () => ({ success: true }),
        authorizeRequest: () => ({ headers: { Authorization: 'Bearer reader' } }),
      }
      for (const url of ['/api/menu', 'https://cdn.example/manifest.json']) {
        const admin = createAdmin({ context: createLumi({ dataProvider, authProvider }), registry, manifest: url, manifestAuth: 'protected', createRouter: memoryRouter() })
        await admin.ready()
        admin.dispose()
      }
      expect(seen.find(entry => entry.url.endsWith('/api/menu'))?.authorization).toBe('Bearer reader')
      expect(seen.find(entry => entry.url.startsWith('https://cdn.example'))?.authorization).toBeNull()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps credentials from another origin when the API root is a path on this site', async () => {
    const seen: Array<{ url: string, authorization: string | null, tenant: string | null }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      seen.push({ url: String(input), authorization: headers.get('Authorization'), tenant: headers.get('X-Tenant') })
      return new Response(JSON.stringify(manifest()), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    try {
      const authProvider = {
        check: async () => ({ authenticated: true }),
        login: async () => ({ success: true }),
        logout: async () => ({ success: true }),
        authorizeRequest: () => ({ headers: { Authorization: 'Bearer reader' } }),
      }
      // `/api` resolves against the page, so a CDN is not "the API".
      const http = createHttpClient({ baseUrl: '/api', authProvider, getTenant: () => 'north' })
      for (const url of ['/api/menu', 'https://cdn.example/manifest.json']) {
        const admin = createAdmin({ context: createLumi({ dataProvider, authProvider, http }), registry, manifest: url, manifestAuth: 'protected', createRouter: memoryRouter() })
        await admin.ready()
        admin.dispose()
      }
      expect(seen.find(entry => entry.url.endsWith('/api/menu'))).toMatchObject({ authorization: 'Bearer reader', tenant: 'north' })
      expect(seen.find(entry => entry.url.startsWith('https://cdn.example'))).toMatchObject({ authorization: null, tenant: null })
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('refuses a handler named like a built-in Admin action, by name', () => {
    for (const name of ['navigate', 'openDrawer', 'closeDrawer']) {
      expect(() => createAdmin({ context: createLumi({ dataProvider }), registry, manifest: manifest(), handlers: { [name]: async () => {} } }))
        .toThrow(`"${name}" is a built-in Admin action`)
    }
  })

  it('uses a text-free accessible skeleton during initial bootstrap', async () => {
    let resolveManifest!: (value: AdminManifest) => void
    const loader = {
      load: vi.fn(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveManifest = resolve
          }),
      ),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<admin.App />))

    expect(
      container.querySelector('[aria-label="Loading Admin"]'),
    ).toBeTruthy()
    expect(container.textContent).toBe('')
    resolveManifest(manifest())
    await act(async () => admin.ready())
    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('creates ordered menus and nested routes without mutating context', async () => {
    const input = createLumi({ dataProvider })
    const admin = createAdmin({
      context: input,
      registry,
      manifest: manifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()

    expect(admin.getMenu().map(item => [item.name, item.path])).toEqual([
      ['home', '/'],
      ['profile', '/settings/profile'],
    ])
    expect(hasRouteId(admin.getRouter()?.routes ?? [], 'landing')).toBe(true)
    expect(input.routerProvider).toBeUndefined()
    expect(admin.context.routerProvider).toBeDefined()
  })

  it('loads remote manifests, resolves relative sources, and refreshes in place', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(manifest('First'))
      .mockResolvedValueOnce({
        app: { id: 'next' },
        routes: [
          {
            name: 'next',
            path: '/',
            page: {
              spec: {
                root: 'page',
                elements: {
                  page: {
                    type: 'Badge',
                    props: { label: 'Next' },
                    children: [],
                  },
                },
              },
            },
            menu: { label: 'Next' },
          },
        ],
      })
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/admin/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })

    await admin.ready()
    expect(admin.getMenu()[1]?.path).toBe('/settings/profile')
    await act(async () => admin.refresh())
    expect(load).toHaveBeenLastCalledWith(
      '/admin/manifest.json',
      expect.objectContaining({ cache: 'reload' }),
    )
    expect(admin.getMenu().map(item => item.name)).toEqual(['next'])
  })

  it('keeps ready pending until a replacement refresh finishes', async () => {
    let resolveInitial!: (value: AdminManifest) => void
    let resolveRefresh!: (value: AdminManifest) => void
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveInitial = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveRefresh = resolve
          }),
      )
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })
    const settled = vi.fn()

    const ready = admin.ready().then(settled)
    const refresh = admin.refresh()
    resolveInitial(manifest('Initial'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(settled).not.toHaveBeenCalled()
    expect(admin.getRouter()).toBeUndefined()

    resolveRefresh(manifest('Refreshed'))
    await Promise.all([ready, refresh])
    expect(settled).toHaveBeenCalledOnce()
    expect(admin.getMenu().map(item => item.label)).toEqual([
      'Refreshed',
      'Profile',
    ])
  })

  it('lets ready follow a refresh before the canceled loader settles', async () => {
    let resolveInitial!: (value: AdminManifest) => void
    let resolveRefresh!: (value: AdminManifest) => void
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveInitial = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveRefresh = resolve
          }),
      )
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })
    const settled = vi.fn()

    const ready = admin.ready().then(settled)
    const refresh = admin.refresh()
    resolveRefresh(manifest('Latest'))
    await refresh
    await vi.waitFor(() => expect(settled).toHaveBeenCalledOnce())

    expect(admin.getMenu().map(item => item.label)).toEqual([
      'Latest',
      'Profile',
    ])
    resolveInitial(manifest('Stale'))
    await ready
    expect(admin.getMenu().map(item => item.label)).toEqual([
      'Latest',
      'Profile',
    ])
  })

  it('starts a fresh load after clear and ignores the canceled response', async () => {
    let resolveInitial!: (value: AdminManifest) => void
    let resolveReload!: (value: AdminManifest) => void
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveInitial = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<AdminManifest>((resolve) => {
            resolveReload = resolve
          }),
      )
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })

    const initialReady = admin.ready()
    admin.clear()
    const reloadedReady = admin.ready()
    expect(load).toHaveBeenCalledTimes(2)

    resolveInitial(manifest('Stale'))
    resolveReload(manifest('Fresh'))
    await Promise.all([initialReady, reloadedReady])

    expect(admin.getMenu().map(item => item.label)).toEqual([
      'Fresh',
      'Profile',
    ])
    expect(loader.invalidate).toHaveBeenCalledWith('/manifest.json')
  })

  it('swallows a canceled load rejection after clear', async () => {
    let rejectLoad!: (reason: unknown) => void
    const load = vi.fn(
      () =>
        new Promise<AdminManifest>((_resolve, reject) => {
          rejectLoad = reject
        }),
    )
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })

    const ready = admin.ready()
    admin.clear()
    rejectLoad(new Error('late failure'))

    await expect(ready).resolves.toBeUndefined()
    expect(admin.getRouter()).toBeUndefined()
    expect(admin.getMenu()).toEqual([])
  })

  it('reloads a public manifest after authenticated clear', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(manifest('Initial'))
      .mockResolvedValueOnce(manifest('Reloaded'))
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated: true }
        },
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })

    await admin.ready()
    admin.clear()
    expect(admin.getMenu()).toEqual([])
    expect(admin.getRouter()).toBeDefined()

    await admin.ready()
    expect(load).toHaveBeenCalledTimes(2)
    expect(admin.getMenu().map(item => item.label)).toEqual([
      'Reloaded',
      'Profile',
    ])
  })

  it('disposes the active router without creating a bootstrap replacement', async () => {
    let resolveLoad!: (value: AdminManifest) => void
    const load = vi.fn(
      () =>
        new Promise<AdminManifest>((resolve) => {
          resolveLoad = resolve
        }),
    )
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated: true }
        },
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: '/manifest.json',
      manifestLoader: loader,
      createRouter: memoryRouter(),
    })

    const ready = admin.ready()
    admin.dispose()
    admin.clear()
    resolveLoad(manifest('Late'))

    await expect(ready).resolves.toBeUndefined()
    expect(admin.getRouter()).toBeUndefined()
    expect(admin.getMenu()).toEqual([])
    await expect(admin.ready()).rejects.toThrow('admin instance is disposed')
    await expect(admin.refresh()).rejects.toThrow('admin instance is disposed')
  })

  it('disposes a loaded router exactly once', async () => {
    const routers: ReturnType<typeof createMemoryRouter>[] = []
    const createRouter = (routes: Parameters<typeof createMemoryRouter>[0]) => {
      const router = createMemoryRouter(routes)
      vi.spyOn(router, 'dispose')
      routers.push(router)
      return router
    }
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated: true }
        },
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: manifest(),
      createRouter,
    })

    await admin.ready()
    expect(routers).toHaveLength(1)
    const router = routers[0]!
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    expect(container.textContent).toContain('Home')

    await act(async () => admin.dispose())
    admin.dispose()
    admin.clear()

    expect(admin.getRouter()).toBeUndefined()
    expect(routers).toHaveLength(1)
    expect(router.dispose).toHaveBeenCalledOnce()
    expect(container.textContent).toBe('')
    await act(async () => root.unmount())
    container.remove()
  })

  it('shows the bootstrap login before loading a protected manifest', async () => {
    let authenticated = false
    const manifestLoader = {
      load: vi.fn().mockResolvedValue(manifest()),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated }
        },
        async login() {
          authenticated = true
          return { success: true }
        },
        async logout() {
          authenticated = false
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: '/manifest.json',
      manifestAuth: 'protected',
      manifestLoader,
      createRouter: memoryRouter(['/login']),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))

    expect(
      container.querySelector('[data-testid="admin-login-form"]'),
    ).toBeTruthy()
    expect(manifestLoader.load).not.toHaveBeenCalled()
    const username = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-login-username"]',
    )!
    const password = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-login-password"]',
    )!
    await act(async () => {
      setInputValue(username, 'admin')
      setInputValue(password, 'secret')
      container
        .querySelector<HTMLFormElement>('[data-testid="admin-login-form"]')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      await vi.waitFor(() =>
        expect(manifestLoader.load).toHaveBeenCalledOnce(),
      )
    })
    expect(admin.getMenu()).toHaveLength(2)
    await act(async () => root.unmount())
    container.remove()
  })

  it('redirects a protected manifest deep link to login with its full URL', async () => {
    let authenticated = false
    const manifestLoader = {
      load: vi.fn().mockResolvedValue(manifest()),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return {
            authenticated,
            redirectTo: authenticated ? undefined : '/login?reason=expired',
          }
        },
        async login() {
          authenticated = true
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: '/manifest.json',
      manifestAuth: 'protected',
      manifestLoader,
      createRouter: memoryRouter(['/settings/profile?tab=one#details']),
    })

    await admin.ready()

    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/login?reason=expired&redirect=%2Fsettings%2Fprofile%3Ftab%3Done%23details',
    )
    expect(manifestLoader.load).not.toHaveBeenCalled()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await act(async () => {
      setInputValue(
        container.querySelector<HTMLInputElement>(
          '[data-testid="admin-login-username"]',
        )!,
        'admin',
      )
      setInputValue(
        container.querySelector<HTMLInputElement>(
          '[data-testid="admin-login-password"]',
        )!,
        'secret',
      )
      container
        .querySelector<HTMLFormElement>('[data-testid="admin-login-form"]')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      await vi.waitFor(() =>
        expect(admin.context.routerProvider?.getCurrentPath()).toBe(
          '/settings/profile?tab=one#details',
        ),
      )
    })
    expect(manifestLoader.load).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('removes protected manifest routes when a refreshed session expires', async () => {
    let authenticated = true
    const check = vi.fn(async () => ({
      authenticated,
      redirectTo: authenticated ? undefined : '/login?reason=expired',
    }))
    const context = createLumi({
      dataProvider,
      authProvider: {
        check,
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: manifest(),
      manifestAuth: 'protected',
      createRouter: memoryRouter(),
    })
    await admin.ready()
    await admin.context.routerProvider?.go({
      to: '/settings/profile',
      query: { tab: 'one' },
      hash: '#details',
    })
    const loadedRouter = admin.getRouter()

    authenticated = false
    await admin.refresh()

    expect(admin.getRouter()).not.toBe(loadedRouter)
    expect(admin.getMenu()).toEqual([])
    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/login?reason=expired&redirect=%2Fsettings%2Fprofile%3Ftab%3Done%23details',
    )
    expect(hasRouteId(admin.getRouter()?.routes ?? [], 'profile')).toBe(false)
    admin.dispose()
  })

  it('fails closed when protected manifest reauthentication throws', async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error('session unavailable'))
    const context = createLumi({
      dataProvider,
      authProvider: {
        check,
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: manifest(),
      manifestAuth: 'protected',
      createRouter: memoryRouter(),
    })

    await expect(admin.ready()).rejects.toThrow('session unavailable')

    expect(admin.getMenu()).toEqual([])
    expect(admin.getRouter()).toBeUndefined()
    admin.dispose()
  })

  it('hides an existing protected manifest when refresh authentication throws', async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({ authenticated: true })
      .mockRejectedValueOnce(new Error('session unavailable'))
    const context = createLumi({
      dataProvider,
      authProvider: {
        check,
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: manifest(),
      manifestAuth: 'protected',
      createRouter: memoryRouter(),
    })
    await admin.ready()
    expect(admin.getMenu()).not.toEqual([])

    await expect(admin.refresh()).rejects.toThrow('session unavailable')

    expect(admin.getMenu()).toEqual([])
    expect(admin.getRouter()).toBeUndefined()
    admin.dispose()
  })

  it('rechecks protected manifest authentication on a later ready call', async () => {
    let authenticated = false
    const manifestLoader = {
      load: vi.fn().mockResolvedValue(manifest()),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<AdminManifest>
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated }
        },
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: '/manifest.json',
      manifestAuth: 'protected',
      manifestLoader,
      createRouter: memoryRouter(['/login']),
    })

    await admin.ready()
    expect(admin.getRouter()).toBeDefined()
    expect(manifestLoader.load).not.toHaveBeenCalled()

    authenticated = true
    await admin.ready()
    expect(manifestLoader.load).toHaveBeenCalledOnce()
    expect(admin.getMenu().map(item => item.name)).toEqual([
      'home',
      'profile',
    ])
  })

  it('refreshes access-filtered menus after public manifest login', async () => {
    let authenticated = false
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated }
        },
        async login() {
          authenticated = true
          return { success: true }
        },
        async logout() {
          authenticated = false
          return { success: true }
        },
      },
      accessProvider: {
        async can() {
          return { can: authenticated }
        },
      },
    })
    const protectedManifest = manifest()
    protectedManifest.routes[0]!.access = {
      resource: 'dashboard',
      action: 'list',
    }
    const admin = createAdmin({
      context,
      registry,
      manifest: protectedManifest,
      createRouter: memoryRouter(['/login']),
    })
    await admin.ready()
    expect(admin.getMenu().map(item => item.name)).toEqual(['profile'])

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    const username = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-login-username"]',
    )!
    const password = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-login-password"]',
    )!
    await act(async () => {
      setInputValue(username, 'admin')
      setInputValue(password, 'secret')
      container
        .querySelector<HTMLFormElement>('[data-testid="admin-login-form"]')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        )
      await vi.waitFor(() =>
        expect(admin.getMenu().map(item => item.name)).toContain('home'),
      )
    })
    await act(async () => root.unmount())
    container.remove()
  })

  it('enforces authentication from the deepest nested route', async () => {
    const context = createLumi({
      dataProvider,
      authProvider: {
        async check() {
          return { authenticated: false }
        },
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    const nestedManifest: AdminManifest = {
      app: { id: 'nested' },
      routes: [
        {
          path: '/private-parent',
          children: [
            {
              name: 'public-child',
              path: 'public-child',
              public: true,
              page: {
                spec: {
                  root: 'page',
                  elements: {
                    page: {
                      type: 'Badge',
                      props: { label: 'Public child' },
                      children: [],
                    },
                  },
                },
              },
            },
          ],
        },
        {
          path: '/public-parent',
          public: true,
          children: [
            {
              name: 'private-child',
              path: 'private-child',
              page: {
                spec: {
                  root: 'page',
                  elements: {
                    page: {
                      type: 'Badge',
                      props: { label: 'Private child' },
                      children: [],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    }

    const publicAdmin = createAdmin({
      context,
      registry,
      manifest: nestedManifest,
      createRouter: memoryRouter(['/private-parent/public-child']),
    })
    await publicAdmin.ready()
    const publicContainer = document.createElement('div')
    document.body.append(publicContainer)
    const publicRoot = createRoot(publicContainer)
    await act(async () => publicRoot.render(<publicAdmin.App />))
    await vi.waitFor(() =>
      expect(publicContainer.textContent).toContain('Public child'),
    )
    expect(publicAdmin.context.routerProvider?.getCurrentPath()).toBe(
      '/private-parent/public-child',
    )
    await act(async () => publicRoot.unmount())
    publicContainer.remove()
    publicAdmin.dispose()

    const privateAdmin = createAdmin({
      context,
      registry,
      manifest: nestedManifest,
      createRouter: memoryRouter(['/public-parent/private-child']),
    })
    await privateAdmin.ready()
    const privateContainer = document.createElement('div')
    document.body.append(privateContainer)
    const privateRoot = createRoot(privateContainer)
    await act(async () => privateRoot.render(<privateAdmin.App />))
    await vi.waitFor(() =>
      expect(privateAdmin.context.routerProvider?.getCurrentPath()).toBe(
        '/login?redirect=%2Fpublic-parent%2Fprivate-child',
      ),
    )
    expect(
      privateContainer.querySelector('[data-testid="admin-login-form"]'),
    ).toBeTruthy()
    await act(async () => privateRoot.unmount())
    privateContainer.remove()
    privateAdmin.dispose()
  })

  it('rejects reserved and host route conflicts', async () => {
    const context = createLumi({ dataProvider })
    const reserved = createAdmin({
      context,
      registry,
      manifest: {
        app: { id: 'reserved' },
        routes: [
          {
            name: 'lumi-admin-fallback',
            path: '/bad',
            page: {
              spec: {
                root: 'page',
                elements: { page: { type: 'Badge', props: {}, children: [] } },
              },
            },
          },
        ],
      },
      createRouter: memoryRouter(),
    })
    await expect(reserved.ready()).rejects.toThrow('is reserved by Admin')

    const host = createAdmin({
      context,
      registry,
      manifest: {
        app: { id: 'remote' },
        routes: [
          {
            name: 'remote',
            path: '/workflow',
            page: {
              spec: {
                root: 'page',
                elements: { page: { type: 'Badge', props: {}, children: [] } },
              },
            },
          },
        ],
      },
      routes: [{ id: 'workflow', path: '/workflow', element: <div /> }],
      createRouter: memoryRouter(),
    })
    await expect(host.ready()).rejects.toThrow('conflicts with a host route')
  })

  it('preserves query and hash through the neutral router provider', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: manifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()
    await act(async () =>
      admin.context.routerProvider?.go({
        to: '/landing',
        query: { tab: 'one' },
        hash: '#details',
      }),
    )
    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/landing?tab=one#details',
    )
  })

  it('preserves the full current URL while refreshing routes', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: manifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()
    await act(async () =>
      admin.context.routerProvider?.go({
        to: '/',
        query: { tab: 'one' },
        hash: '#details',
      }),
    )

    await admin.refresh()

    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/?tab=one#details',
    )
  })

  it('preserves a later navigation while a refreshed router restores location', async () => {
    let releaseRestore!: () => void
    let restoreStarted!: () => void
    const restoreGate = new Promise<void>((resolve) => {
      releaseRestore = resolve
    })
    const restoreStart = new Promise<void>((resolve) => {
      restoreStarted = resolve
    })
    const routers: ReturnType<typeof createMemoryRouter>[] = []
    const createRouter = (routes: Parameters<typeof createMemoryRouter>[0]) => {
      const router = createMemoryRouter(routes)
      routers.push(router)
      if (routers.length === 2) {
        const navigate = router.navigate.bind(router)
        let delayed = false
        vi.spyOn(router, 'navigate').mockImplementation(async (to, init) => {
          if (!delayed) {
            delayed = true
            restoreStarted()
            await restoreGate
          }
          return typeof to === 'number' ? navigate(to) : navigate(to, init)
        })
      }
      return router
    }
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: manifest(),
      createRouter,
    })
    await admin.ready()
    await admin.context.routerProvider?.go({
      to: '/landing',
      query: { tab: 'old' },
      hash: '#first',
    })

    const refresh = admin.refresh()
    await restoreStart
    await admin.context.routerProvider?.go({
      to: '/',
      query: { tab: 'latest' },
      hash: '#second',
    })
    releaseRestore()
    await refresh

    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/?tab=latest#second',
    )
    expect(routers[1]?.navigate).toHaveBeenCalledTimes(2)
    admin.dispose()
  })

  it('preserves a navigation that is still loading when routes refresh', async () => {
    let releaseLoader!: () => void
    const loaderGate = new Promise<void>((resolve) => {
      releaseLoader = resolve
    })
    const slowLoader = vi.fn(() => loaderGate)
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: manifest(),
      routes: [
        {
          id: 'slow',
          path: '/slow',
          loader: slowLoader,
          element: <div>Slow</div>,
        },
      ],
      createRouter: memoryRouter(),
    })
    await admin.ready()
    const source = admin.getRouter()!
    admin.context.routerProvider?.go({ to: '/slow?tab=latest#pending' })
    await vi.waitFor(() =>
      expect(source.state.navigation.location?.pathname).toBe('/slow'),
    )

    const refresh = admin.refresh()
    await vi.waitFor(() => expect(slowLoader).toHaveBeenCalledTimes(2))
    releaseLoader()
    await refresh

    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/slow?tab=latest#pending',
    )
    admin.dispose()
  })

  it('cancels and disposes a candidate router whose location restore is pending', async () => {
    let restoreStarted!: () => void
    const restoreStart = new Promise<void>((resolve) => {
      restoreStarted = resolve
    })
    const routers: ReturnType<typeof createMemoryRouter>[] = []
    const createRouter = (routes: Parameters<typeof createMemoryRouter>[0]) => {
      const router = createMemoryRouter(routes)
      vi.spyOn(router, 'dispose')
      routers.push(router)
      if (routers.length === 2) {
        vi.spyOn(router, 'navigate').mockImplementation(() => {
          restoreStarted()
          return new Promise<void>(() => undefined)
        })
      }
      return router
    }
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: manifest(),
      createRouter,
    })
    await admin.ready()
    await admin.context.routerProvider?.go({ to: '/landing' })

    const refresh = admin.refresh()
    await restoreStart
    admin.dispose()

    await expect(refresh).resolves.toBeUndefined()
    expect(routers).toHaveLength(2)
    expect(routers[0]?.dispose).toHaveBeenCalledOnce()
    expect(routers[1]?.dispose).toHaveBeenCalledOnce()
    expect(admin.getRouter()).toBeUndefined()
  })

  it('observes a candidate navigation rejection after synchronous disposal', async () => {
    const unhandled = vi.fn()
    const onUnhandled = (error: unknown): void => unhandled(error)
    process.on('unhandledRejection', onUnhandled)
    const routers: ReturnType<typeof createMemoryRouter>[] = []
    let admin!: ReturnType<typeof createAdmin>
    const createRouter = (routes: Parameters<typeof createMemoryRouter>[0]) => {
      const router = createMemoryRouter(routes)
      vi.spyOn(router, 'dispose')
      routers.push(router)
      if (routers.length === 2) {
        vi.spyOn(router, 'navigate').mockImplementation(() => {
          admin.dispose()
          return Promise.reject(new Error('late navigation failure'))
        })
      }
      return router
    }
    try {
      admin = createAdmin({
        context: createLumi({ dataProvider }),
        registry,
        manifest: manifest(),
        createRouter,
      })
      await admin.ready()
      await admin.context.routerProvider?.go({ to: '/landing' })

      await expect(admin.refresh()).resolves.toBeUndefined()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(unhandled).not.toHaveBeenCalled()
      expect(routers[0]?.dispose).toHaveBeenCalledOnce()
      expect(routers[1]?.dispose).toHaveBeenCalledOnce()
    }
    finally {
      process.off('unhandledRejection', onUnhandled)
      admin?.dispose()
    }
  })

  it('navigates to a complete URL supplied to the neutral router provider', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: manifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()

    await admin.context.routerProvider?.go({ to: '/landing?tab=one#details' })

    expect(admin.context.routerProvider?.getCurrentPath()).toBe(
      '/landing?tab=one#details',
    )
    await admin.context.routerProvider?.go({ to: '/landing?tag=one&tag=two' })
    expect(admin.context.routerProvider?.parse().query).toEqual({
      tag: ['one', 'two'],
    })
    admin.dispose()
  })

  it('supports dual modules, menu search, sidebar collapse, and closable tabs', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))

    expect(container.querySelector('[data-testid="module-home"]')).toBeTruthy()
    expect(
      container.querySelector('[data-testid="module-settings"]'),
    ).toBeTruthy()
    expect(container.querySelector('[data-testid="nav-home"]')).toBeTruthy()

    await click(
      container.querySelector<HTMLElement>('[data-testid="module-settings"]')!,
    )
    await vi.waitFor(() =>
      expect(admin.context.routerProvider?.getCurrentPath()).toBe(
        '/settings/profile',
      ),
    )
    expect(container.querySelector('[data-testid="nav-profile"]')).toBeTruthy()
    expect(
      container.querySelector('[data-testid="admin-tabs"]')?.textContent,
    ).toContain('Profile')

    const search = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-menu-search"]',
    )!
    await act(async () => setInputValue(search, 'missing'))
    expect(container.querySelector('[data-testid="nav-profile"]')).toBeNull()
    expect(container.textContent).toContain('No matching navigation items')
    await act(async () => setInputValue(search, 'profile'))
    expect(container.querySelector('[data-testid="nav-profile"]')).toBeTruthy()

    await click(
      container.querySelector<HTMLElement>(
        '[data-testid="admin-sidebar-toggle"]',
      )!,
    )
    expect(container.querySelector('[data-testid="admin-sidebar"]')).toBeNull()
    await click(
      container.querySelector<HTMLElement>(
        '[data-testid="admin-sidebar-toggle"]',
      )!,
    )
    expect(
      container.querySelector('[data-testid="admin-sidebar"]'),
    ).toBeTruthy()

    await click(
      container.querySelector<HTMLElement>(
        '[data-testid="admin-tab-close--settings-profile"]',
      )!,
    )
    await vi.waitFor(() =>
      expect(admin.context.routerProvider?.getCurrentPath()).toBe('/'),
    )
    expect(
      container.querySelector('[data-testid="admin-tabs"]')?.textContent,
    ).not.toContain('Profile')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('updates existing tab labels when the locale changes', async () => {
    const i18n = createI18nProvider({
      locale: 'en-US',
      translations: {
        'en-US': { 'menu.home': 'Home', 'menu.reports': 'Reports' },
        'zh-CN': { 'menu.home': '首页', 'menu.reports': '报表' },
      },
    })
    const localized = shellManifest()
    localized.routes[0]!.menu!.label = 'Home'
    localized.routes[0]!.menu!.labelKey = 'menu.home'
    localized.routes[1]!.menu!.label = 'Reports'
    localized.routes[1]!.menu!.labelKey = 'menu.reports'
    const admin = createAdmin({
      context: createLumi({ dataProvider, i18nProvider: i18n }),
      registry,
      manifest: localized,
      createRouter: memoryRouter(['/reports']),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="admin-tabs"]')?.textContent,
      ).toContain('Reports'),
    )

    await act(async () => i18n.changeLocale('zh-CN'))
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="admin-tabs"]')?.textContent,
      ).toContain('报表'),
    )
    expect(
      container.querySelector('[data-testid="admin-tabs"]')?.textContent,
    ).toContain('首页')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('checks authentication once at bootstrap and only rechecks on refresh', async () => {
    const check = vi.fn(async () => ({ authenticated: true as const }))
    const context = createLumi({
      dataProvider,
      authProvider: {
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
        check,
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: shellManifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Home page'),
    )

    await act(async () =>
      admin.context.routerProvider?.go({
        to: '/reports',
        query: { tab: 'one' },
        hash: '#summary',
      }),
    )
    expect(check).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('Reports page')
    expect(container.textContent).not.toContain('Checking session')
    await act(async () => admin.refresh())
    expect(check).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('Checking session')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('supports mobile navigation, persistent theme switching, and logout', async () => {
    const logout = vi.fn(async () => ({ success: true }))
    const context = createLumi({
      dataProvider,
      authProvider: {
        async login() {
          return { success: true }
        },
        logout,
        async check() {
          return { authenticated: true }
        },
      },
    })
    const admin = createAdmin({
      context,
      registry,
      manifest: shellManifest(),
      createRouter: memoryRouter(),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="admin-logout"]'),
      ).toBeTruthy(),
    )

    await click(
      container.querySelector<HTMLElement>(
        '[data-testid="admin-mobile-navigation-trigger"]',
      )!,
    )
    const mobileNavigation = container.querySelector<HTMLElement>(
      '[data-testid="admin-mobile-navigation"]',
    )!
    const mobilePanel
      = mobileNavigation.querySelector<HTMLElement>('[role="dialog"]')!
    const focusable = [
      ...mobilePanel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      ),
    ]
    const first = focusable[0]!
    const last = focusable.at(-1)!
    expect(document.activeElement).toBe(first)
    last.focus()
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    expect(document.activeElement).toBe(first)
    first.focus()
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    expect(document.activeElement).toBe(last)
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    )
    expect(
      container.querySelector('[data-testid="admin-mobile-navigation"]'),
    ).toBeNull()
    expect(document.activeElement).toBe(
      container.querySelector(
        '[data-testid="admin-mobile-navigation-trigger"]',
      ),
    )

    await click(
      container.querySelector<HTMLElement>('[data-testid="admin-theme-dark"]')!,
    )
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(
      JSON.parse(localStorage.getItem('lumi:test-admin:shell:preferences')!),
    ).toEqual({ collapsed: false, colorMode: 'dark' })

    await click(
      container.querySelector<HTMLElement>('[data-testid="admin-logout"]')!,
    )
    await vi.waitFor(() =>
      expect(admin.context.routerProvider?.getCurrentPath()).toBe('/login'),
    )
    expect(logout).toHaveBeenCalledOnce()
    expect(
      container.querySelector('[data-testid="admin-login-form"]'),
    ).toBeTruthy()
    // Sign-out drops the manifest, not the app: the sign-in page keeps the
    // reader's theme, and its own switch writes the Shell's entry.
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(
      container.querySelector('[data-testid="admin-login-theme-dark"]')?.getAttribute('aria-checked'),
    ).toBe('true')
    await click(
      container.querySelector<HTMLElement>('[data-testid="admin-login-theme-light"]')!,
    )
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(
      JSON.parse(localStorage.getItem('lumi:test-admin:shell:preferences')!),
    ).toEqual({ collapsed: false, colorMode: 'light' })

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('mounts host routes inside the authenticated Shell and retains them in tabs and reload', async () => {
    let shell!: ShellContextValue
    let mounts = 0
    function HostShell({ children }: PropsWithChildren) {
      shell = useShell()
      return <section data-testid="host-shell">{children}</section>
    }
    function HostPage() {
      mounts += 1
      return <div data-testid="host-page">Host tools</div>
    }
    const hostLoader = vi.fn(async () => null)
    const check = vi.fn(async () => ({ authenticated: true as const }))
    const context = createLumi({
      dataProvider,
      authProvider: {
        check,
        async login() {
          return { success: true }
        },
        async logout() {
          return { success: true }
        },
      },
    })
    sessionStorage.setItem(
      'lumi:test-admin:shell:tabs',
      JSON.stringify([
        { key: '/', path: '/' },
        { key: '/host-tools', path: '/host-tools' },
      ]),
    )
    const admin = createAdmin({
      context,
      registry,
      manifest: manifest(),
      routes: [
        {
          id: 'host-tools',
          path: '/host-tools',
          loader: hostLoader,
          hydrateFallbackElement: <div />,
          element: <HostPage />,
        },
      ],
      shell: HostShell,
      createRouter: memoryRouter(['/host-tools']),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="host-page"]'),
      ).not.toBeNull(),
    )
    expect(
      container.querySelector('[data-testid="host-shell"]'),
    ).not.toBeNull()
    expect(check).toHaveBeenCalledOnce()
    expect(shell.tabs.items.some(tab => tab.key === '/host-tools')).toBe(
      true,
    )
    expect(mounts).toBe(1)
    await act(async () => shell.tabs.reload('/host-tools'))
    await vi.waitFor(() => expect(hostLoader).toHaveBeenCalledTimes(2))
    expect(mounts).toBe(1)
    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('never instantiates private host data routes before authentication and preserves denied route URLs', async () => {
    let authenticated = false
    const hostLoader = vi.fn(async () => null)
    const hostAction = vi.fn(async () => null)
    const unauthenticated = createAdmin({
      context: createLumi({
        dataProvider,
        authProvider: {
          async check() {
            return { authenticated }
          },
          async login() {
            return { success: true }
          },
          async logout() {
            return { success: true }
          },
        },
      }),
      registry,
      manifest: manifest(),
      routes: [
        {
          id: 'host-private',
          path: '/host-private',
          loader: hostLoader,
          action: hostAction,
          shouldRevalidate: () => false,
          hydrateFallbackElement: <div />,
          element: <div data-testid="host-private">Private</div>,
        },
      ],
      createRouter: memoryRouter(['/host-private?view=all#details']),
    })
    await unauthenticated.ready()
    const authContainer = document.createElement('div')
    document.body.append(authContainer)
    const authRoot = createRoot(authContainer)
    await act(async () => authRoot.render(<unauthenticated.App />))
    await vi.waitFor(() =>
      expect(unauthenticated.context.routerProvider?.getCurrentPath()).toBe(
        '/login?redirect=%2Fhost-private%3Fview%3Dall%23details',
      ),
    )
    expect(
      authContainer.querySelector('[data-testid="host-private"]'),
    ).toBeNull()
    expect(hostLoader).not.toHaveBeenCalled()
    expect(hostAction).not.toHaveBeenCalled()
    await act(async () => {
      await unauthenticated
        .getRouter()
        ?.navigate('/host-private?attempt=post', {
          formMethod: 'post',
          formEncType: 'application/json',
          body: { intent: 'blocked' },
        })
    })
    expect(unauthenticated.context.routerProvider?.getCurrentPath()).toBe(
      '/login?redirect=%2Fhost-private%3Fattempt%3Dpost',
    )
    expect(hostLoader).not.toHaveBeenCalled()
    expect(hostAction).not.toHaveBeenCalled()

    authenticated = true
    await act(async () => unauthenticated.refresh())
    hostLoader.mockClear()
    await act(async () => {
      await unauthenticated
        .getRouter()
        ?.navigate('/host-private?view=all#details')
    })
    expect(hostLoader).toHaveBeenCalledOnce()
    await act(async () => {
      await unauthenticated
        .getRouter()
        ?.navigate('/host-private?view=all#details', {
          formMethod: 'post',
          formEncType: 'application/json',
          body: { intent: 'save' },
        })
    })
    expect(hostAction).toHaveBeenCalledOnce()
    expect(hostLoader).toHaveBeenCalledOnce()
    expect(unauthenticated.context.routerProvider?.getCurrentPath()).toBe(
      '/host-private?view=all#details',
    )
    await act(async () => authRoot.unmount())
    authContainer.remove()
    unauthenticated.dispose()

    const deniedManifest = manifest()
    deniedManifest.routes[0]!.access = {
      resource: 'dashboard',
      action: 'list',
    }
    const denied = createAdmin({
      context: createLumi({
        dataProvider,
        accessProvider: {
          async can() {
            return { can: false, reason: 'policy' }
          },
        },
      }),
      registry,
      manifest: deniedManifest,
      createRouter: memoryRouter(['/']),
    })
    await denied.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<denied.App />))
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Permission required'),
    )
    expect(denied.context.routerProvider?.getCurrentPath()).toBe('/')
    expect(container.textContent).toContain('Ask an administrator')
    await act(async () => root.unmount())
    container.remove()
    denied.dispose()
  })
})

async function click(element: HTMLElement): Promise<void> {
  await act(async () =>
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    ),
  )
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function hasRouteId(
  routes: Parameters<typeof createMemoryRouter>[0],
  id: string,
): boolean {
  return routes.some(
    route => route.id === id || hasRouteId(route.children ?? [], id),
  )
}
