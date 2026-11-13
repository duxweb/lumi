// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { PropsWithChildren } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import { createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminBaseConfigSchema, adminManifestSchema } from '../src/catalog.js'
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

const manifest: AdminManifest = {
  app: { id: 'frames', title: 'Frames' },
  routes: [
    { name: 'sales', path: '/sales', page: { iframe: 'https://bi.test/sales' }, menu: { label: 'Sales report' } },
    { name: 'legacy', path: '/legacy', page: { iframe: 'https://old.test/orders' } },
    {
      name: 'mixed',
      path: '/mixed',
      page: { spec: { root: 'frame', elements: { frame: { type: 'Iframe', props: { src: 'https://old.test/x', title: 'Old' }, children: [] } } } as never },
    },
  ],
}

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
})

async function render(entry: string, frameOrigins?: string[]) {
  const admin = createAdmin({
    context: createLumi({ dataProvider }),
    manifest,
    ...(frameOrigins ? { frameOrigins } : {}),
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
}

describe('routes that show another site', () => {
  it('fill the page area with a frame named after the menu entry', async () => {
    await render('/sales')
    const frame = await vi.waitFor(() => document.querySelector('iframe')!)
    expect(frame.getAttribute('src')).toBe('https://bi.test/sales')
    expect(frame.title).toBe('Sales report')
    expect(frame.closest('.lumi-admin-page--embed')).not.toBeNull()
    expect(frame.parentElement!.className).toContain('flex-1')
  })

  it('keep frames, route or element, to frameOrigins', async () => {
    await render('/legacy', ['https://bi.test'])
    await vi.waitFor(() => expect(document.querySelector('[data-slot="iframe"][data-status="blocked"]')).not.toBeNull())
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('apply the same list to an Iframe element in a JSON page', async () => {
    await render('/mixed', ['https://old.test'])
    await vi.waitFor(() => expect(document.querySelector('iframe')?.getAttribute('src')).toBe('https://old.test/x'))
  })
})

describe('frames in the manifest and config', () => {
  it('accept page.iframe alone and https origins only', () => {
    const route = (page: unknown) => adminManifestSchema.safeParse({ app: { id: 'a' }, routes: [{ path: '/', page }] }).success
    expect(route({ iframe: 'https://bi.test' })).toBe(true)
    expect(route({ iframe: 'https://bi.test', src: '/a.json' })).toBe(false)
    const base = { data: { url: '/api' }, panels: { manifest: '/m.json' } }
    expect(adminBaseConfigSchema.safeParse({ ...base, frameOrigins: ['https://bi.test'] }).success).toBe(true)
    expect(adminBaseConfigSchema.safeParse({ ...base, frameOrigins: ['http://bi.test'] }).success).toBe(false)
  })

  it('resolves an inline manifest\'s relative frame path against config.json', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({
      data: { url: '/api' },
      panels: { manifest: { app: { id: 'a' }, routes: [{ path: '/', page: { iframe: 'legacy/index.html' } }] } },
    }))) as typeof fetch
    try {
      const config = await resolveAdminBaseConfig('https://site.test/admin/config.json')
      expect((config.panels as { manifest: AdminManifest }).manifest.routes[0]!.page).toEqual({ iframe: 'https://site.test/admin/legacy/index.html' })
    }
    finally {
      globalThis.fetch = original
    }
  })
})
