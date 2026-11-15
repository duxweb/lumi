// @vitest-environment jsdom
import type { AuthProvider, DataProvider, LumiJsonLoader } from '@duxweb/lumi'
import type { Spec } from '@json-render/core'
import type { ComponentRegistry } from '@json-render/react'
import type { PropsWithChildren, ReactElement } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import type { ShellContextValue } from '../src/react/types.js'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createI18nProvider, createLumi, LumiProvider, useList } from '@duxweb/lumi'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAdmin,
  LumiAdminShellProvider,
  useShell,
} from '../src/react/index.js';

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
    <span data-testid="page-content">{String(props.label ?? '')}</span>
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

function memoryRouter(initialEntries = ['/']) {
  return (routes: Parameters<typeof createMemoryRouter>[0]) =>
    createMemoryRouter(routes, { initialEntries })
}

function shellManifest(
  id = 'shell-test',
  layout?: 'single' | 'dual',
): AdminManifest {
  return {
    app: { id, title: 'Shell Test', layout, tabs: true },
    routes: [
      {
        name: 'home',
        path: '/',
        page: {
          spec: {
            root: 'page',
            elements: {
              page: { type: 'Badge', props: { label: 'Home' }, children: [] },
            },
          },
        },
        menu: {
          label: 'Home',
          module: { name: 'home', label: 'Home module' },
          group: { name: 'overview', label: 'Overview' },
        },
      },
      {
        name: 'parent',
        path: '/settings',
        page: {
          spec: {
            root: 'page',
            elements: {
              page: {
                type: 'Badge',
                props: { label: 'Settings' },
                children: [],
              },
            },
          },
        },
        menu: {
          label: 'Settings',
          module: { name: 'settings', label: 'Settings module' },
          group: { name: 'general', label: 'General' },
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
                props: { label: 'Profile' },
                children: [],
              },
            },
          },
        },
        menu: {
          label: 'Profile',
          module: { name: 'settings', label: 'Settings module' },
          group: { name: 'account', label: 'Account' },
        },
      },
    ],
  }
}

async function renderAdmin(
  options: Parameters<typeof createAdmin>[0],
): Promise<{
  admin: ReturnType<typeof createAdmin>
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
  cleanup: () => Promise<void>
}> {
  const admin = createAdmin(options)
  await admin.ready()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<admin.App />))
  return {
    admin,
    container,
    root,
    cleanup: async () => {
      await act(async () => root.unmount())
      container.remove()
      admin.dispose()
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.classList.remove('dark')
  delete document.documentElement.dataset.theme
  vi.restoreAllMocks()
})

describe('lumi Admin Shell M2', () => {
  it('throws outside the Provider and exposes the complete facade to a children-only custom Shell', async () => {
    function InvalidProbe(): ReactElement {
      useShell()
      return <div />
    }
    expect(() => renderToString(<InvalidProbe />)).toThrow(
      'useShell must be used within LumiAdminShellProvider',
    )

    let facade!: ShellContextValue
    const CustomShell = vi.fn(({ children }: PropsWithChildren) => {
      facade = useShell()
      return <section data-testid="custom-shell">{children}</section>
    })
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest(),
      shell: CustomShell,
      createRouter: memoryRouter(),
    })

    expect(Object.keys(CustomShell.mock.calls[0]![0])).toEqual(['children'])
    expect(
      mounted.container.querySelector('[data-testid="custom-shell"]')
        ?.textContent,
    ).toContain('Home')
    expect(facade.app.layout).toBe('dual')
    expect(Object.keys(facade)).toEqual([
      'app',
      'workspace',
      'menu',
      'groups',
      'modules',
      'active',
      'navigation',
      'assistant',
      'tabs',
      'identity',
      'colorMode',
      'locale',
      'auth',
    ])
    expect(Object.keys(facade.navigation)).toEqual([
      'query',
      'collapsed',
      'mobileOpen',
      'setQuery',
      'toggleCollapsed',
      'openMobile',
      'closeMobile',
      'navigate',
    ])
    expect(Object.keys(facade.tabs)).toEqual([
      'enabled',
      'items',
      'activeKey',
      'activate',
      'close',
      'closeOthers',
      'closeAll',
      'reload',
    ])
    expect(facade.auth.available).toBe(false)
    const router = mounted.admin.getRouter()
    const page = mounted.container.querySelector(
      '[data-testid="page-content"]',
    )
    const renderCount = CustomShell.mock.calls.length
    await act(async () => facade.auth.logout())
    expect(mounted.admin.getRouter()).toBe(router)
    expect(
      mounted.container.querySelector('[data-testid="page-content"]'),
    ).toBe(page)
    expect(CustomShell).toHaveBeenCalledTimes(renderCount)
    await mounted.cleanup()
  })

  it('routes plain links inside the Shell and leaves links of the host page alone', async () => {
    function LinkShell({ children }: PropsWithChildren): ReactElement {
      return (
        <section>
          <a data-testid="inner-link" href="/settings">Settings</a>
          {children}
        </section>
      )
    }
    const hostLink = document.createElement('a')
    hostLink.href = '/guide/'
    document.body.append(hostLink)
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest(),
      shell: LinkShell,
      createRouter: memoryRouter(),
    })
    const router = mounted.admin.getRouter()!

    // Record whether anything claimed the host click, then stop jsdom from navigating.
    let claimed: boolean | undefined
    const record = (event: Event): void => {
      claimed = event.defaultPrevented
      event.preventDefault()
    }
    window.addEventListener('click', record)
    hostLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    window.removeEventListener('click', record)
    expect(claimed).toBe(false)
    expect(router.state.location.pathname).toBe('/')

    await act(async () => mounted.container.querySelector<HTMLAnchorElement>('[data-testid="inner-link"]')!.click())
    expect(router.state.location.pathname).toBe('/settings')

    hostLink.remove()
    await mounted.cleanup()
  })

  it('routes a link below a basename whether it is written as the address or as the route', async () => {
    function LinkShell({ children }: PropsWithChildren): ReactElement {
      return (
        <section>
          <a data-testid="address-link" href="/admin/settings">Settings</a>
          <a data-testid="route-link" href="/">Home</a>
          {children}
        </section>
      )
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest(),
      shell: LinkShell,
      createRouter: routes => createMemoryRouter(routes, { basename: '/admin', initialEntries: ['/admin'] }),
    })
    const router = mounted.admin.getRouter()!
    // The basename is not added a second time.
    await act(async () => mounted.container.querySelector<HTMLAnchorElement>('[data-testid="address-link"]')!.click())
    expect(router.state.location.pathname).toBe('/admin/settings')
    await act(async () => mounted.container.querySelector<HTMLAnchorElement>('[data-testid="route-link"]')!.click())
    expect(router.state.location.pathname).toBe('/admin')
    await mounted.cleanup()
  })

  it('mounts the public Shell Provider directly without private package context', async () => {
    let facade!: ShellContextValue
    function Probe(): ReactElement {
      facade = useShell()
      return <span data-testid="direct-provider">{facade.app.title}</span>
    }
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <LumiAdminShellProvider
            app={{
              id: 'direct-provider',
              title: 'Direct Provider',
              layout: 'single',
              tabs: true,
            }}
            menu={[{ name: 'home', path: '/', label: 'Home' }]}
            routePatterns={['/']}
          >
            <Probe />
          </LumiAdminShellProvider>
        ),
      },
    ])
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({ dataProvider })}
          registry={registry}
        >
          <RouterProvider router={router} />
        </LumiProvider>,
      ),
    )
    expect(
      container.querySelector('[data-testid="direct-provider"]')?.textContent,
    ).toBe('Direct Provider')
    expect(facade.colorMode.preference).toBe('system')
    await act(async () => facade.colorMode.toggle())
    expect(facade.colorMode.preference).toMatch(/light|dark/)

    await act(async () => root.unmount())
    container.remove()
    await router.dispose()
  })

  it('selects default dual and explicit single layouts for the same Manifest behavior', async () => {
    const dual = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('dual-default'),
      createRouter: memoryRouter(['/settings/profile']),
    })
    const dualShell = dual.container.querySelector('[data-lumi-shell]')
    expect(dualShell?.getAttribute('data-layout')).toBe('dual')
    expect(dualShell?.classList.contains('lumi-page')).toBe(true)
    expect(dualShell?.classList.contains('lumi-admin-page')).toBe(false)
    expect(
      dual.container
        .querySelector('.lumi-shell-dual-rail')
        ?.classList
        .contains('w-14'),
    ).toBe(true)
    expect(
      dual.container.querySelector('[data-testid="page-content"]')?.textContent,
    ).toBe('Profile')
    expect(
      dual.container.querySelector('[data-testid="admin-logout"]'),
    ).toBeNull()
    await dual.cleanup()

    const single = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('single-explicit', 'single'),
      createRouter: memoryRouter(['/settings/profile']),
    })
    const singleShell = single.container.querySelector('[data-lumi-shell]')
    expect(singleShell?.getAttribute('data-layout')).toBe('single')
    expect(singleShell?.classList.contains('lumi-page')).toBe(true)
    expect(singleShell?.classList.contains('lumi-admin-page')).toBe(false)
    expect(
      single.container.querySelector('[data-testid="page-content"]')
        ?.textContent,
    ).toBe('Profile')
    expect(
      single.container.querySelector('[data-testid="admin-logout"]'),
    ).toBeNull()
    await single.cleanup()
  })

  it('puts the search in the header on request and switches workspaces from the sidebar head', async () => {
    const changes: string[] = []
    for (const layout of ['dual', 'single'] as const) {
      const base = shellManifest(`workspace-${layout}`, layout)
      const manifest: AdminManifest = {
        ...base,
        app: {
          ...base.app,
          search: 'header',
          workspaces: [
            { value: 'prod', label: 'Dux', description: 'Production' },
            { value: 'stage', label: 'Dux Staging', description: 'Staging' },
          ],
        },
      }
      const mounted = await renderAdmin({
        context: createLumi({ dataProvider }),
        registry,
        manifest,
        createRouter: memoryRouter(),
        onWorkspaceChange: value => changes.push(value),
      })
      const search = mounted.container.querySelector('[data-testid="admin-menu-search"]')
      expect(search?.closest('.lumi-shell-header')).not.toBeNull()
      const head = mounted.container.querySelector<HTMLElement>('summary[data-testid="admin-workspace"]')!
      expect(head.textContent).toContain('Dux')
      expect(head.textContent).toContain('Production')
      expect(head.getAttribute('aria-label')).toBe('Switch workspace, current: Dux')
      await act(async () => head.click())
      const stage = mounted.container.querySelector<HTMLButtonElement>('[data-testid="admin-workspace-stage"]')!
      expect(stage.getAttribute('aria-checked')).toBe('false')
      await act(async () => stage.click())
      expect(head.textContent).toContain('Dux Staging')
      await mounted.cleanup()
    }
    expect(changes).toEqual(['stage', 'stage'])
  })

  it('collapses contextual menu groups inside the floating dual context panel', async () => {
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('dual-groups'),
      createRouter: memoryRouter(['/settings/profile']),
    })
    const contextSidebar = mounted.container.querySelector(
      '.lumi-shell-dual-context',
    )
    expect(contextSidebar?.classList.contains('lumi-shell-surface')).toBe(true)
    // By default the menu search heads the sidebar it filters; the header has none.
    expect(contextSidebar?.querySelector('[data-testid="admin-menu-search"]')).not.toBeNull()
    expect(mounted.container.querySelector('.lumi-shell-header [data-testid="admin-menu-search"]')).toBeNull()

    const general = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-menu-group-general"]',
    )!
    const generalItems = document.getElementById(
      general.getAttribute('aria-controls')!,
    )!
    expect(general.getAttribute('aria-expanded')).toBe('true')
    expect(generalItems.hidden).toBe(false)

    await act(async () => general.click())
    expect(general.getAttribute('aria-expanded')).toBe('false')
    expect(generalItems.hidden).toBe(true)
    expect(
      mounted.container
        .querySelector('[data-testid="admin-menu-group-account"]')
        ?.getAttribute('aria-expanded'),
    ).toBe('true')

    const search = mounted.container.querySelector<HTMLInputElement>(
      '[data-testid="admin-menu-search"]',
    )!
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(search, 'settings')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await vi.waitFor(() =>
      expect(general.getAttribute('aria-expanded')).toBe('true'),
    )
    expect(generalItems.hidden).toBe(false)

    await mounted.cleanup()
  })

  it('frames a host assistant beside the workspace and persists its open state', async () => {
    const bare = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('assistant-absent'),
      createRouter: memoryRouter(),
    })
    expect(bare.container.querySelector('[data-testid="admin-assistant-toggle"]')).toBeNull()
    expect(bare.container.querySelector('[data-testid="admin-assistant"]')).toBeNull()
    await bare.cleanup()

    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('assistant'),
      createRouter: memoryRouter(),
      assistant: <p data-testid="host-assistant">Agent</p>,
      shellStorageKey: 'assistant-shell',
    })
    const panel = (): Element | null => mounted.container.querySelector('[data-testid="admin-assistant"]')
    expect(panel()?.querySelector('[data-testid="host-assistant"]')).not.toBeNull()
    expect(panel()?.closest('[data-lumi-shell-main]')).toBeNull()
    const toggle = mounted.container.querySelector<HTMLButtonElement>('[data-testid="admin-assistant-toggle"]')!
    expect(toggle.closest('.lumi-shell-header')).not.toBeNull()
    expect(toggle.dataset.state).toBe('open')

    await act(async () => toggle.click())
    expect(panel()).toBeNull()
    expect(toggle.dataset.state).toBe('closed')
    expect(JSON.parse(localStorage.getItem('assistant-shell:preferences')!)).toMatchObject({ assistant: false })
    await mounted.cleanup()

    // A host may start the panel closed; the reader's stored choice still wins.
    localStorage.removeItem('assistant-closed-shell:preferences')
    const closed = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('assistant-closed'),
      createRouter: memoryRouter(),
      assistant: <p data-testid="host-assistant">Agent</p>,
      assistantDefaultOpen: false,
      shellStorageKey: 'assistant-closed-shell',
    })
    expect(closed.container.querySelector('[data-testid="admin-assistant"]')).toBeNull()
    expect(closed.container.querySelector<HTMLButtonElement>('[data-testid="admin-assistant-toggle"]')!.dataset.state).toBe('closed')
    await closed.cleanup()
  })

  it('gathers identity, the three color modes, and logout behind one account menu', async () => {
    const authProvider = {
      check: vi.fn(async () => ({ authenticated: true })),
      getIdentity: vi.fn(async () => ({
        id: 1,
        name: 'Ada',
        email: 'ada@lumi.dev',
      })),
      login: vi.fn(async () => ({ success: true })),
      logout: vi.fn(async () => ({ success: true })),
    } as unknown as AuthProvider
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider, authProvider }),
      registry,
      manifest: shellManifest('account'),
      createRouter: memoryRouter(),
    })
    await vi.waitFor(() =>
      expect(
        mounted.container.querySelector('[data-testid="admin-user"]')
          ?.textContent,
      ).toBe('Ada'),
    )

    const trigger = mounted.container.querySelector<HTMLElement>(
      '[data-testid="admin-account"]',
    )!
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    // Dual keeps personal controls at the rail's foot and page tools in the
    // header; the theme toggle cycles all three preferences right above the
    // avatar, and the account menu keeps direct light/dark/system selection.
    expect(trigger.closest('.lumi-shell-dual-rail')).toBeTruthy()
    expect(trigger.closest('header')).toBeNull()
    const headerToggle = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-header-theme"]',
    )!
    expect(headerToggle.tagName).toBe('BUTTON')
    expect(headerToggle.getAttribute('aria-label')).toBe('Toggle theme')
    expect(headerToggle.dataset.state).toBe('system')
    expect(
      headerToggle.querySelector('svg')?.getAttribute('data-lumi-icon'),
    ).toBe('hugeicons')
    expect(headerToggle.querySelector('[stroke-width="1.5"]')).not.toBeNull()
    expect(
      Boolean(
        headerToggle.compareDocumentPosition(trigger)
        & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true)
    expect(
      mounted.container.querySelector(
        '[data-testid="admin-header-theme-dark"]',
      ),
    ).toBeNull()
    const modes = ['light', 'dark', 'system'] as const
    for (const mode of modes) {
      expect(
        mounted.container
          .querySelector(`[data-testid="admin-theme-${mode}"]`)
          ?.getAttribute('role'),
      ).toBe('menuitemradio')
    }
    expect(
      mounted.container
        .querySelector('[data-testid="admin-theme-system"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')

    const initialResolvedTheme = document.documentElement.dataset.theme
    await act(async () => headerToggle.click())
    expect(headerToggle.dataset.state).toBe('light')
    expect(
      headerToggle.querySelector('svg')?.getAttribute('data-lumi-icon-name'),
    ).toBe('SunIcon')
    await act(async () => headerToggle.click())
    expect(headerToggle.dataset.state).toBe('dark')
    expect(
      headerToggle.querySelector('svg')?.getAttribute('data-lumi-icon-name'),
    ).toBe('MoonIcon')
    await act(async () => headerToggle.click())
    expect(headerToggle.dataset.state).toBe('system')
    expect(
      headerToggle.querySelector('svg')?.getAttribute('data-lumi-icon-name'),
    ).toBe('MonitorIcon')
    expect(document.documentElement.dataset.theme).toBe(initialResolvedTheme)

    await act(async () =>
      mounted.container
        .querySelector<HTMLButtonElement>('[data-testid="admin-theme-dark"]')!
        .click(),
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      mounted.container
        .querySelector('[data-testid="admin-theme-dark"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      mounted.container
        .querySelector<HTMLDetailsElement>('[data-testid="admin-account"]')
        ?.closest('details')
        ?.open,
    ).toBe(false)

    const logout = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-logout"]',
    )!
    expect(logout.getAttribute('role')).toBe('menuitem')
    expect(logout.disabled).toBe(false)
    await mounted.cleanup()
  })

  it('renders the host header slot on the header, not the account menu', async () => {
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('header-slot'),
      createRouter: memoryRouter(),
      headerEnd: (
        <button type="button" data-testid="host-bell">
          Notifications
        </button>
      ),
    })
    const bell = mounted.container.querySelector<HTMLElement>(
      '[data-testid="host-bell"]',
    )
    expect(bell).not.toBeNull()
    // It belongs to the header, and the header alone — not the account menu.
    expect(bell?.closest('.lumi-shell-header')).not.toBeNull()
    expect(bell?.closest('[role="menu"]')).toBeNull()
    await mounted.cleanup()
  })

  it('renders manifest header actions and routes clicks to a drawer, the router, and the event emitter', async () => {
    const onEvent = vi.fn()
    const manifest = shellManifest('header-actions')
    manifest.app.header = {
      actions: [
        {
          name: 'notifications',
          label: 'Notifications',
          icon: 'bell',
          drawer: 'feed',
        },
        { name: 'docs', label: 'Docs', href: '/settings' },
        { name: 'ping', label: 'Ping', event: 'admin:ping' },
      ],
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      createRouter: memoryRouter(),
      onEvent,
      drawers: {
        feed: {
          title: 'Feed',
          component: () => <p data-testid="drawer-body">Activity</p>,
        },
      },
    })
    const notifications = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-header-notifications"]',
    )!
    expect(notifications.getAttribute('aria-label')).toBe('Notifications')
    await act(async () => notifications.click())
    expect(
      document.body.querySelector('[data-testid="drawer-body"]')?.textContent,
    ).toBe('Activity')

    await act(async () =>
      mounted.container
        .querySelector<HTMLButtonElement>('[data-testid="admin-header-docs"]')!
        .click(),
    )
    expect(
      mounted.container
        .querySelector('[data-testid="nav-parent"]')
        ?.getAttribute('aria-current'),
    ).toBe('page')

    await act(async () =>
      mounted.container
        .querySelector<HTMLButtonElement>('[data-testid="admin-header-ping"]')!
        .click(),
    )
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({
      name: 'admin:ping',
      payload: {},
    })
    await mounted.cleanup()
  })

  it('uses longest-path active state and derives tabs and breadcrumbs from the child route', async () => {
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest(),
      shell: ProbeShell,
      createRouter: memoryRouter(['/settings/profile']),
    })

    expect(facade.active.item?.name).toBe('profile')
    expect(facade.active.group?.name).toBe('account')
    expect(facade.active.module?.name).toBe('settings')
    expect(facade.active.breadcrumbs.map(item => item.label)).toEqual([
      'Settings module',
      'Account',
      'Profile',
    ])
    expect(
      facade.tabs.items.find(item => item.key === '/settings/profile')?.label,
    ).toBe('Profile')
    await mounted.cleanup()

    const builtin = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest(),
      createRouter: memoryRouter(['/settings/profile']),
    })
    expect(
      builtin.container.querySelectorAll('[aria-current="page"]'),
    ).toHaveLength(1)
    expect(
      builtin.container
        .querySelector('[data-testid="nav-profile"]')
        ?.getAttribute('aria-current'),
    ).toBe('page')
    expect(
      builtin.container
        .querySelector('[data-testid="nav-parent"]')
        ?.hasAttribute('aria-current'),
    ).toBe(false)
    await builtin.cleanup()
  })

  it('matches static, dynamic, and splat route patterns with Router specificity', async () => {
    const manifest: AdminManifest = {
      app: { id: 'patterns', tabs: true },
      routes: [
        {
          name: 'home',
          path: '/',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: { type: 'Badge', props: { label: 'Home' }, children: [] },
              },
            },
          },
          menu: { label: 'Home' },
        },
        {
          name: 'users',
          path: '/users',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: {
                  type: 'Badge',
                  props: { label: 'Users' },
                  children: [],
                },
              },
            },
          },
          menu: { label: 'Users' },
        },
        {
          name: 'user-new',
          path: '/users/new',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: {
                  type: 'Badge',
                  props: { label: 'New user' },
                  children: [],
                },
              },
            },
          },
          menu: {
            label: 'New user',
            module: { name: 'people', label: 'People' },
            group: { name: 'create', label: 'Create' },
          },
        },
        {
          name: 'user',
          path: '/users/:id',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: { type: 'Badge', props: { label: 'User' }, children: [] },
              },
            },
          },
          menu: {
            label: 'User',
            module: { name: 'people', label: 'People' },
            group: { name: 'detail', label: 'Detail' },
          },
        },
        {
          name: 'file',
          path: '/files/:id',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: { type: 'Badge', props: { label: 'File' }, children: [] },
              },
            },
          },
          menu: { label: 'File' },
        },
        {
          name: 'files',
          path: '/files/*',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: {
                  type: 'Badge',
                  props: { label: 'Files' },
                  children: [],
                },
              },
            },
          },
          menu: { label: 'Files' },
        },
      ],
    }
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const user = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: ProbeShell,
      createRouter: memoryRouter(['/users/42']),
    })
    expect(facade.active.item?.name).toBe('user')
    expect(facade.active.group?.name).toBe('detail')
    expect(facade.active.module?.name).toBe('people')
    expect(
      facade.tabs.items.find(tab => tab.key === '/users/42')?.label,
    ).toBe('User · 42')
    await user.cleanup()

    const staticRoute = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: ProbeShell,
      createRouter: memoryRouter(['/users/new']),
    })
    expect(facade.active.item?.name).toBe('user-new')
    expect(facade.active.breadcrumbs.at(-1)?.label).toBe('New user')
    await staticRoute.cleanup()

    const splat = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: ProbeShell,
      createRouter: memoryRouter(['/files/reports/2026']),
    })
    expect(facade.active.item?.name).toBe('files')
    await splat.cleanup()
  })

  it('distinguishes restored record tabs using hidden route labels while keeping the list active in navigation', async () => {
    const manifest = shellManifest('record-tabs')
    manifest.routes = [
      manifest.routes[0]!,
      {
        name: 'products',
        path: '/products',
        page: manifest.routes[0]!.page,
        menu: { label: 'Products' },
      },
      {
        name: 'product-detail',
        path: '/products/:id',
        page: manifest.routes[0]!.page,
        menu: { label: 'Product detail', labelKey: 'menu.productDetail', hidden: true },
      },
    ]
    const tabs = [
      { key: '/', path: '/' },
      { key: '/products', path: '/products' },
      { key: '/products/1', path: '/products/1?view=activity#notes' },
      { key: '/products/2', path: '/products/2' },
    ]
    sessionStorage.setItem('lumi:record-tabs:shell:tabs', JSON.stringify(tabs))
    const i18n = createI18nProvider({
      locale: 'en-US',
      translations: {
        'en-US': { 'menu.productDetail': 'Product detail' },
        'zh-CN': { 'menu.productDetail': '商品详情' },
      },
    })
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider, i18nProvider: i18n }),
      registry,
      manifest,
      shell: ProbeShell,
      createRouter: memoryRouter(['/products/2']),
    })
    expect(facade.tabs.items.map(tab => tab.label)).toEqual([
      'Home',
      'Products',
      'Product detail · 1',
      'Product detail · 2',
    ])
    expect(facade.active.item?.name).toBe('products')
    expect(facade.menu.some(item => item.name === 'product-detail')).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('lumi:record-tabs:shell:tabs')!)).toEqual(tabs)

    await act(async () => i18n.changeLocale('zh-CN'))
    expect(facade.tabs.items.find(tab => tab.key === '/products/1')?.label).toBe('商品详情 · 1')
    await act(async () => facade.tabs.close('/products/2'))
    expect(mounted.admin.getRouter()?.state.location).toMatchObject({
      pathname: '/products/1',
      search: '?view=activity',
      hash: '#notes',
    })
    expect(facade.active.item?.name).toBe('products')
    await mounted.cleanup()
  })

  it('invalidates the splat source when it overlaps a dynamic route', async () => {
    const manifest: AdminManifest = {
      app: { id: 'overlap-reload', tabs: true },
      routes: [
        {
          name: 'home',
          path: '/',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: { type: 'Badge', props: { label: 'Home' }, children: [] },
              },
            },
          },
          menu: { label: 'Home' },
        },
        {
          name: 'file',
          path: '/files/:id',
          page: { src: '/file.json' },
          menu: { label: 'File' },
        },
        {
          name: 'files',
          path: '/files/*',
          page: { src: '/files.json' },
          menu: { label: 'Files' },
        },
      ],
    }
    const loader = {
      load: vi.fn(
        async () =>
          ({
            root: 'page',
            elements: {
              page: { type: 'Badge', props: { label: 'Files' }, children: [] },
            },
          }) satisfies Spec,
      ),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<Spec>
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      specLoader: loader,
      shell: ProbeShell,
      createRouter: memoryRouter(['/files/a/b']),
    })

    expect(facade.active.item?.name).toBe('files')
    await act(async () => facade.tabs.reload('/files/a/b'))
    expect(loader.invalidate).toHaveBeenCalledWith('/files.json', mounted.admin.context.session.cacheKey())
    expect(loader.invalidate).not.toHaveBeenCalledWith('/file.json', mounted.admin.context.session.cacheKey())
    await mounted.cleanup()
  })

  it('isolates storage namespaces, persists no labels, and survives corrupt or unavailable storage', async () => {
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const first = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('alpha'),
      shell: ProbeShell,
      createRouter: memoryRouter(['/settings/profile']),
    })
    await act(async () => {
      facade.navigation.toggleCollapsed()
      facade.colorMode.set('dark')
    })
    const tabs = JSON.parse(
      sessionStorage.getItem('lumi:alpha:shell:tabs')!,
    ) as Array<Record<string, unknown>>
    expect(tabs.some(tab => 'label' in tab)).toBe(false)
    expect(
      JSON.parse(localStorage.getItem('lumi:alpha:shell:preferences')!),
    ).toEqual({ collapsed: true, colorMode: 'dark' })
    await first.cleanup()

    const second = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('beta'),
      shell: ProbeShell,
      createRouter: memoryRouter(),
    })
    expect(facade.navigation.collapsed).toBe(false)
    expect(facade.colorMode.preference).toBe('system')
    await second.cleanup()

    localStorage.setItem('override:preferences', '{broken')
    sessionStorage.setItem(
      'override:tabs',
      JSON.stringify([{ key: '/', path: '/', label: 'obsolete' }]),
    )
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const corrupt = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('corrupt'),
      shell: ProbeShell,
      shellStorageKey: 'override',
      createRouter: memoryRouter(),
    })
    expect(corrupt.container.textContent).toContain('Home')
    expect(
      warning.mock.calls.some(call =>
        String(call[0]).includes('could not read override:preferences'),
      ),
    ).toBe(true)
    expect(
      warning.mock.calls.some(call =>
        String(call[0]).includes('could not read override:tabs'),
      ),
    ).toBe(true)
    expect(localStorage.getItem('override:preferences')).not.toBeNull()
    expect(localStorage.getItem('lumi:corrupt:shell:preferences')).toBeNull()
    await corrupt.cleanup()

    warning.mockClear()
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementationOnce(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      .mockImplementationOnce(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })
    const fallback = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('fallback'),
      shell: ProbeShell,
      shellStorageKey: 'blocked',
      createRouter: memoryRouter(),
    })
    expect(fallback.container.textContent).toContain('Home')
    expect(warning).toHaveBeenCalled()
    expect(
      warning.mock.calls.every(call =>
        String(call[0]).startsWith('[lumi-admin] shell storage:'),
      ),
    ).toBe(true)
    getItem.mockRestore()
    setItem.mockRestore()
    await fallback.cleanup()
  })

  it('derives restored tab labels from the current locale after remounting', async () => {
    const i18n = createI18nProvider({
      locale: 'en-US',
      translations: {
        'en-US': { 'menu.profile': 'Profile' },
        'zh-CN': { 'menu.profile': '个人资料' },
      },
    })
    const localized = shellManifest('locale')
    localized.routes[2]!.menu!.label = 'Profile'
    localized.routes[2]!.menu!.labelKey = 'menu.profile'
    sessionStorage.setItem(
      'lumi:locale:shell:tabs',
      JSON.stringify([
        { key: '/', path: '/' },
        { key: '/settings/profile', path: '/settings/profile' },
      ]),
    )
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }

    const first = await renderAdmin({
      context: createLumi({ dataProvider, i18nProvider: i18n }),
      registry,
      manifest: localized,
      shell: ProbeShell,
      createRouter: memoryRouter(),
    })
    expect(
      facade.tabs.items.find(tab => tab.key === '/settings/profile')?.label,
    ).toBe('Profile')
    await first.cleanup()
    await i18n.changeLocale('zh-CN')
    const second = await renderAdmin({
      context: createLumi({ dataProvider, i18nProvider: i18n }),
      registry,
      manifest: localized,
      shell: ProbeShell,
      createRouter: memoryRouter(),
    })
    expect(
      facade.tabs.items.find(tab => tab.key === '/settings/profile')?.label,
    ).toBe('个人资料')
    await second.cleanup()
  })

  it('uses an indicator tab state and exposes a keyboard-operable overflow menu', async () => {
    const routes: AdminManifest['routes'] = Array.from(
      { length: 8 },
      (_, index) => ({
        name: `page-${index}`,
        path: index === 0 ? '/' : `/page-${index}`,
        page: {
          spec: {
            root: 'page',
            elements: {
              page: {
                type: 'Badge' as const,
                props: { label: `Page ${index}` },
                children: [],
              },
            },
          },
        },
        menu: { label: `Page ${index}` },
      }),
    )
    const manifest: AdminManifest = {
      app: { id: 'tab-overflow', tabs: true },
      routes,
    }
    sessionStorage.setItem(
      'lumi:tab-overflow:shell:tabs',
      JSON.stringify(
        routes.map(route => ({ key: route.path, path: route.path })),
      ),
    )
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.getAttribute('data-testid') === 'admin-tabs' ? 900 : 0
      })
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.getAttribute('data-testid') === 'admin-tabs' ? 240 : 0
      })
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      createRouter: memoryRouter(['/page-7']),
    })
    await vi.waitFor(() =>
      expect(
        mounted.container.querySelector('[data-testid="admin-tabs-overflow"]'),
      ).not.toBeNull(),
    )

    const activeLink = mounted.container.querySelector<HTMLElement>(
      '[data-testid="admin-tabs"] [data-active="true"]',
    )!
    const activeTab = activeLink.parentElement!
    const activeClose = activeTab.querySelector<HTMLElement>(
      '[data-testid="admin-tab-close--page-7"]',
    )!
    const inactiveClose = mounted.container.querySelector<HTMLElement>(
      '[data-testid="admin-tab-close--page-1"]',
    )!
    // Line tabs: the active tab claims a segment of the strip's own rule, and
    // never a brand-coloured surface.
    expect(activeTab.className).toContain('border-foreground')
    expect(activeTab.className).not.toContain('bg-primary')
    // Closing stays one click away on every tab, active or not.
    expect(activeClose.className).toContain('opacity-70')
    expect(inactiveClose.className).toContain('opacity-70')
    expect(inactiveClose.className).not.toContain('opacity-0')

    const trigger = mounted.container.querySelector<HTMLElement>(
      '[data-testid="admin-tabs-overflow"]',
    )!
    await act(async () => trigger.click())
    const menu = mounted.container.querySelector<HTMLElement>(
      '[data-testid="admin-tabs-overflow-menu"]',
    )!
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    )
    items[0]!.focus()
    await act(async () =>
      items[0]!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    expect(document.activeElement).toBe(items[1])
    await act(async () => items[0]!.click())
    expect(mounted.admin.getRouter()?.state.location.pathname).toBe('/')

    scrollWidth.mockRestore()
    clientWidth.mockRestore()
    await mounted.cleanup()
  })

  it('removes stale restored tabs before persistence and never closes into a hidden path', async () => {
    sessionStorage.setItem(
      'lumi:sanitize:shell:tabs',
      JSON.stringify([
        { key: '/', path: '/' },
        { key: '/removed', path: '/removed' },
        { key: '/settings/removed', path: '/settings/removed' },
        {
          key: '/settings/profile',
          path: '/settings/profile?section=security',
        },
        { key: '/mismatch', path: '/settings' },
      ]),
    )
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('sanitize'),
      shell: ProbeShell,
      createRouter: memoryRouter(['/settings/profile']),
    })
    expect(facade.tabs.items.map(tab => tab.key)).toEqual([
      '/',
      '/settings/profile',
    ])
    expect(
      JSON.parse(sessionStorage.getItem('lumi:sanitize:shell:tabs')!),
    ).toEqual([
      { key: '/', path: '/' },
      { key: '/settings/profile', path: '/settings/profile?section=security' },
    ])

    await act(async () => facade.tabs.close('/settings/profile'))
    expect(mounted.admin.getRouter()?.state.location.pathname).toBe('/')
    expect(facade.tabs.items.map(tab => tab.key)).toEqual(['/'])
    await mounted.cleanup()
  })

  it('tracks light, dark, and system modes, toggles from resolved mode, and cleans media listeners', async () => {
    let dark = true
    const listeners = new Set<() => void>()
    const media = {
      get matches() {
        return dark
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn((_name: string, listener: () => void) =>
        listeners.add(listener),
      ),
      removeEventListener: vi.fn((_name: string, listener: () => void) =>
        listeners.delete(listener),
      ),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    )
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('color'),
      shell: ProbeShell,
      createRouter: memoryRouter(),
    })

    expect(facade.colorMode.preference).toBe('system')
    expect(facade.colorMode.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(media.addEventListener).toHaveBeenCalledTimes(2)
    await act(async () => facade.colorMode.toggle())
    expect(facade.colorMode.preference).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(listeners.size).toBe(1)
    dark = false
    await act(async () => listeners.forEach(listener => listener()))
    expect(facade.colorMode.preference).toBe('light')
    expect(facade.colorMode.resolved).toBe('light')
    await act(async () => facade.colorMode.set('system'))
    expect(listeners.size).toBe(2)
    await act(async () => listeners.forEach(listener => listener()))
    expect(facade.colorMode.resolved).toBe('light')
    dark = true
    await act(async () => listeners.forEach(listener => listener()))
    expect(facade.colorMode.resolved).toBe('dark')
    await act(async () => facade.colorMode.set('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    dark = false
    await act(async () => listeners.forEach(listener => listener()))
    expect(facade.colorMode.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      JSON.parse(localStorage.getItem('lumi:color:shell:preferences')!),
    ).toEqual({ collapsed: false, colorMode: 'dark' })

    await mounted.cleanup()
    expect(media.removeEventListener).toHaveBeenCalled()
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })

  it('exposes complete mobile controls, focuses main on same-route navigation, and keeps the trap stable while typing', async () => {
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('mobile'),
      createRouter: memoryRouter(),
    })
    const trigger = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-mobile-navigation-trigger"]',
    )!
    await act(async () => trigger.click())
    const dialog
      = mounted.container.querySelector<HTMLElement>('[role="dialog"]')!
    const input = dialog.querySelector<HTMLInputElement>(
      '[data-testid="admin-menu-search"]',
    )!
    expect(
      dialog.querySelector('[data-testid="admin-mobile-user"]')?.textContent,
    ).toBe('User')
    expect(dialog.querySelector('[aria-label="Toggle theme"]')).not.toBeNull()
    expect(
      dialog.querySelector('[data-testid="admin-mobile-logout"]'),
    ).toBeNull()

    input.focus()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      setter?.call(input, 'Home')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.activeElement).toBe(input)
    await act(async () =>
      dialog
        .querySelector<HTMLAnchorElement>('[data-testid="nav-home"]')!
        .click(),
    )
    expect(
      mounted.container.querySelector(
        '[data-testid="admin-mobile-navigation"]',
      ),
    ).toBeNull()
    expect(document.activeElement).toBe(
      mounted.container.querySelector('[data-lumi-shell-main]'),
    )
    await mounted.cleanup()
  })

  it('disables every logout control while pending and reports provider errors', async () => {
    let finish!: (value: { success: boolean, error?: Error }) => void
    const logout = vi.fn(
      () =>
        new Promise<{ success: boolean, error?: Error }>((resolve) => {
          finish = resolve
        }),
    )
    const authProvider = {
      check: vi.fn(async () => ({ authenticated: true })),
      getIdentity: vi.fn(async () => ({ id: 1, name: 'Ada' })),
      login: vi.fn(async () => ({ success: true })),
      logout,
    } as AuthProvider
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider, authProvider }),
      registry,
      manifest: shellManifest('logout'),
      createRouter: memoryRouter(),
    })
    await act(async () =>
      mounted.container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-mobile-navigation-trigger"]',
        )!
        .click(),
    )
    const mobileLogout = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-mobile-logout"]',
    )!
    await act(async () => mobileLogout.click())
    expect(logout).toHaveBeenCalledTimes(1)
    expect(
      Array.from(
        mounted.container.querySelectorAll<HTMLButtonElement>(
          '[data-testid="admin-logout"], [data-testid="admin-mobile-logout"]',
        ),
      ).every(button => button.disabled),
    ).toBe(true)

    await act(async () =>
      finish({ success: false, error: new Error('Sign out unavailable') }),
    )
    expect(
      mounted.container.querySelector('[role="alert"]')?.textContent,
    ).toContain('Session unavailable')
    expect(mobileLogout.disabled).toBe(false)
    await mounted.cleanup()
  })

  it('reloads active schema and Lumi queries in place without remounting the page', async () => {
    let mounts = 0
    let unmounts = 0
    let listCalls = 0
    const queryDataProvider = {
      ...dataProvider,
      async getList() {
        listCalls += 1
        return { data: [], total: 0 }
      },
    } as DataProvider
    function PageProbe(): ReactElement {
      useList({ resource: 'records' })
      useEffect(() => {
        mounts += 1
        return () => {
          unmounts += 1
        }
      }, [])
      return <span data-testid="mounted-page">Page</span>
    }
    const reloadRegistry: ComponentRegistry = {
      ...registry,
      Badge: () => <PageProbe />,
    }
    const load = vi.fn(
      async () =>
        ({
          root: 'page',
          elements: { page: { type: 'Badge', props: {}, children: [] } },
        }) satisfies Spec,
    )
    const loader = {
      load,
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<Spec>
    const remoteManifest: AdminManifest = {
      app: { id: 'reload', tabs: true },
      routes: [
        {
          name: 'home',
          path: '/',
          page: { src: '/home.json' },
          menu: { label: 'Home' },
        },
        {
          name: 'reports',
          path: '/reports',
          page: { src: '/reports.json' },
          menu: { label: 'Reports' },
        },
      ],
    }
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    sessionStorage.setItem(
      'lumi:reload:shell:tabs',
      JSON.stringify([
        { key: '/', path: '/' },
        { key: '/reports', path: '/reports' },
      ]),
    )
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider: queryDataProvider }),
      registry: reloadRegistry,
      manifest: remoteManifest,
      specLoader: loader,
      shell: ProbeShell,
      createRouter: memoryRouter(),
    })
    await vi.waitFor(() => expect(listCalls).toBe(1))
    expect(mounts).toBe(1)

    await act(async () => facade.tabs.reload('/reports'))
    expect(loader.invalidate).toHaveBeenCalledWith('/reports.json', mounted.admin.context.session.cacheKey())
    expect(listCalls).toBe(1)
    await act(async () => facade.tabs.close('/reports'))
    expect(mounts).toBe(1)

    await act(async () => {
      facade.navigation.toggleCollapsed()
      facade.navigation.openMobile()
      facade.navigation.closeMobile()
      facade.colorMode.toggle()
      facade.tabs.reload('/')
    })
    await vi.waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(
        '/home.json',
        expect.objectContaining({ cache: 'reload' }),
      ),
    )
    await vi.waitFor(() => expect(listCalls).toBe(2))
    expect(loader.invalidate).toHaveBeenCalledWith('/home.json', mounted.admin.context.session.cacheKey())
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)

    await mounted.cleanup()
    expect(unmounts).toBe(1)
  })

  it('invalidates a dynamic route source when reloading its concrete tab URL', async () => {
    const loader = {
      load: vi.fn(
        async () =>
          ({
            root: 'page',
            elements: {
              page: { type: 'Badge', props: { label: 'User' }, children: [] },
            },
          }) satisfies Spec,
      ),
      invalidate: vi.fn(),
      peek: vi.fn(),
    } as LumiJsonLoader<Spec>
    const manifest: AdminManifest = {
      app: { id: 'dynamic-reload', tabs: true },
      routes: [
        {
          name: 'home',
          path: '/',
          page: {
            spec: {
              root: 'page',
              elements: {
                page: { type: 'Badge', props: { label: 'Home' }, children: [] },
              },
            },
          },
          menu: { label: 'Home' },
        },
        {
          name: 'user',
          path: '/users/:id',
          page: { src: '/user.json' },
          menu: { label: 'User' },
        },
      ],
    }
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      specLoader: loader,
      shell: ProbeShell,
      createRouter: memoryRouter(['/users/42']),
    })
    await act(async () => facade.tabs.reload('/users/42'))
    expect(loader.invalidate).toHaveBeenCalledWith('/user.json', mounted.admin.context.session.cacheKey())
    await mounted.cleanup()
  })

  it('restores a stored color preference after the manifest theme effect runs', async () => {
    localStorage.setItem(
      'lumi:theme-restore:shell:preferences',
      JSON.stringify({ collapsed: false, colorMode: 'dark' }),
    )
    let facade!: ShellContextValue
    function ProbeShell({ children }: PropsWithChildren): ReactElement {
      facade = useShell()
      return <div>{children}</div>
    }
    const mounted = await renderAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest: shellManifest('theme-restore'),
      theme: { mode: 'light' },
      shell: ProbeShell,
      createRouter: memoryRouter(),
    })
    await vi.waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )
    expect(facade.colorMode.preference).toBe('dark')
    await mounted.cleanup()
  })

  it('owns structural Shell CSS in the published package source', () => {
    const root = process.cwd().endsWith('/packages/admin')
      ? resolve(process.cwd(), '../..')
      : process.cwd()
    const packageCss = readFileSync(
      resolve(root, 'packages/admin/src/style.css'),
      'utf8',
    )
    expect(packageCss).toContain('.lumi-shell-column')
    expect(packageCss).toContain('.lumi-shell-panel')
    expect(packageCss).toContain('.lumi-shell-mobile-trigger')
    expect(packageCss).toContain('.lumi-shell-menu-group')
    expect(packageCss).toContain('.lumi-admin-page {')
    // The Shell consumes adapter tokens; it never declares a palette of its own.
    expect(packageCss).toContain('var(--sidebar-border)')
    // No invented ornaments: shadcn's sidebar has no bevel, no double rule and
    // no brand-tinted state.
    expect(packageCss).not.toContain('.lumi-shell-bevel')
    expect(packageCss).not.toMatch(
      /\.lumi-shell-menu-group[^{]*::(?:before|after)/,
    )
    // The current module is an inverse primary tile, never a brand tint.
    expect(packageCss).not.toMatch(
      /data-active='true'\]\s*\{[^}]*var\(--brand\)/,
    )
    expect(packageCss).not.toMatch(/^\s*--lumi-shell-[\w-]+\s*:/m)
    expect(packageCss).not.toMatch(/\.lumi-page\s*\{/)
    expect(packageCss).not.toContain('var(--foreground) 92%')
    // The demo app composes library parts only; it ships no stylesheet of its own.
    expect(existsSync(resolve(root, 'apps/admin/src/style.css'))).toBe(false)

    // This package ships its own Tailwind build and its stylesheet loads after
    // the adapter's, so any base utility it emits beats the adapter's variant
    // utilities on every adapter component. `bg-transparent` is the one that
    // bit us: it silently disabled `dark:bg-input/30` on every Input.
    const shellSources = [
      'components/ShellParts.tsx',
      'components/LumiAdminDualShell.tsx',
      'components/LumiAdminSingleShell.tsx',
      'components/LumiAdminLogin.tsx',
    ]
      .map(file =>
        readFileSync(resolve(root, 'packages/admin/src/react', file), 'utf8'),
      )
      .join('\n')
    expect(shellSources).not.toMatch(/\bbg-transparent\b/)
  })
})
