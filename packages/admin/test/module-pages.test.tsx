// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { PropsWithChildren, ReactElement } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import type { AdminModulePageProps } from '../src/react/index.js'
import { createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminManifestSchema } from '../src/catalog.js'
import { createAdmin } from '../src/react/index.js'
import { resolveAdminBaseConfig } from '../src/react/mountAdmin.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dataProvider = {
  async getList() { return { data: [], total: 0 } },
  async getOne() { return { data: {} } },
  async create() { return { data: {} } },
  async update() { return { data: {} } },
  async deleteOne() { return { data: {} } },
} as unknown as DataProvider

function Report({ params, query }: AdminModulePageProps): ReactElement {
  return <p>{`Report ${params.id} for ${query.month}`}</p>
}

const manifest: AdminManifest = {
  app: { id: 'modules', title: 'Modules' },
  routes: [
    { path: '/reports/:id', page: { module: '/pages/report.js' } },
    { path: '/broken', page: { module: '/pages/broken.js' } },
    { path: '/home', page: { spec: { root: 'text', elements: { text: { type: 'Text', props: { text: 'Home' }, children: [] } } } as never } },
  ],
}

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
})

async function render(entry: string, loadPageModule: (url: string) => Promise<typeof Report>) {
  const admin = createAdmin({
    context: createLumi({ dataProvider }),
    manifest,
    loadPageModule,
    shell: ({ children }: PropsWithChildren) => <main>{children}</main>,
    createRouter: routes => createMemoryRouter(routes, { initialEntries: [entry] }),
  })
  await admin.ready()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<admin.App />))
  mounted.push(() => {
    act(() => root.unmount())
    container.remove()
    admin.dispose()
  })
  const go = (path: string) => act(async () => {
    await admin.getRouter()!.navigate(path)
  })
  return { go }
}

const shows = (value: string) => vi.waitFor(() => expect(document.body.textContent).toContain(value))

describe('pages written as JavaScript modules', () => {
  it('renders the module with the route params and query, loading each module once', async () => {
    const load = vi.fn(async (url: string) => {
      if (url.endsWith('broken.js'))
        throw new Error('Failed to fetch /pages/broken.js')
      return Report
    })
    const { go } = await render('/reports/7?month=2026-10', load)
    await shows('Report 7 for 2026-10')
    await go('/home')
    await shows('Home')
    await go('/reports/8?month=2026-11')
    await shows('Report 8 for 2026-11')
    expect(load.mock.calls).toEqual([['/pages/report.js']])
  })

  it('shows a module that fails to load, and tries again on the next visit', async () => {
    let attempts = 0
    const load = vi.fn(async () => {
      if (++attempts === 1)
        throw new Error('Failed to fetch /pages/broken.js')
      return Report
    })
    const { go } = await render('/broken?month=1', load)
    await vi.waitFor(() => expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Failed to fetch /pages/broken.js'))
    await go('/home')
    await shows('Home')
    await go('/broken?month=1')
    await shows('Report undefined for 1')
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('page modules in the manifest and config', () => {
  it('accepts a module page and refuses a page with two sources', () => {
    const route = (page: unknown) => adminManifestSchema.safeParse({ app: { id: 'a' }, routes: [{ path: '/', page }] }).success
    expect(route({ module: '/pages/report.js' })).toBe(true)
    expect(route({ module: '/pages/report.js', src: '/pages/report.json' })).toBe(false)
  })

  it('resolves module paths of an inline manifest against config.json, and keeps page names for a pages endpoint', async () => {
    const inline = { app: { id: 'a' }, routes: [{ path: '/', page: { src: 'orders/list' } }, { path: '/r', page: { module: 'pages/report.js' } }] }
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({
      data: [{ name: 'main', url: '/api' }],
      panels: [{ name: 'served', path: '/a', manifest: inline, pages: { endpoint: '/page' } }, { name: 'files', path: '/b', manifest: inline }],
    }))) as typeof fetch
    try {
      const config = await resolveAdminBaseConfig('https://site.test/admin/config.json')
      const [served, files] = config.panels as Array<{ manifest: AdminManifest }>
      expect(served!.manifest.routes.map(route => route.page)).toEqual([{ src: 'orders/list' }, { module: 'https://site.test/admin/pages/report.js' }])
      expect(files!.manifest.routes.map(route => route.page)).toEqual([{ src: 'https://site.test/admin/orders/list' }, { module: 'https://site.test/admin/pages/report.js' }])
    }
    finally {
      globalThis.fetch = original
    }
  })
})
