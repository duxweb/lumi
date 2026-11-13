// @vitest-environment jsdom
import type { CustomParams, DataProvider } from '@duxweb/lumi'
import type { PropsWithChildren } from 'react'
import type { AdminManifest, AdminPagesSource } from '../src/catalog.js'
import { createLumi, packDocument } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminBaseConfigSchema } from '../src/catalog.js'
import { createAdmin } from '../src/react/index.js'
import { resolveAdminBaseConfig } from '../src/react/mountAdmin.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function page(text: string) {
  return {
    root: 'page',
    elements: {
      page: { type: 'Stack', props: {}, children: ['text'] },
      text: { type: 'Text', props: { text }, children: [] },
    },
  }
}

const served: Record<string, ReturnType<typeof page>> = {
  'home': page('Served home'),
  '/pages/edit.json': page('Served editor'),
}

function backend() {
  const calls: CustomParams[] = []
  const custom = vi.fn(async (params: CustomParams) => {
    calls.push(params)
    const path = String((params.payload as { path?: unknown } | undefined)?.path ?? params.query?.path)
    // A backend that hides its pages from the network panel answers them packed.
    const document = path === 'packed' ? await packDocument(page('Unpacked page'), { key: 'pk' }) : served[path]
    if (!document)
      throw Object.assign(new Error('Not found'), { status: 404 })
    return { data: document }
  })
  const dataProvider = {
    async getList() { return { data: [], total: 0 } },
    async getOne() { return { data: {} } },
    async create() { return { data: {} } },
    async update() { return { data: {} } },
    async deleteOne() { return { data: {} } },
    custom,
  } as unknown as DataProvider
  return { calls, dataProvider }
}

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
  vi.unstubAllGlobals()
})

async function render(entry: string, pages: AdminPagesSource | undefined, packKey?: string) {
  const { calls, dataProvider } = backend()
  const manifest: AdminManifest = {
    app: { id: 'page-proxy', title: 'Page proxy' },
    routes: [
      { name: 'home', path: '/', page: { src: 'home' } },
      { name: 'missing', path: '/missing', page: { src: 'nowhere' } },
      { name: 'packed', path: '/packed', page: { src: 'packed' } },
      { name: 'remote', path: '/remote', page: { src: 'https://cdn.test/remote.json' } },
    ],
  }
  const admin = createAdmin({
    context: createLumi({ dataProvider }),
    manifest,
    pages,
    ...(packKey ? { packKey } : {}),
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
  return { admin, calls }
}

const text = (value: string) => vi.waitFor(() => expect(document.body.textContent).toContain(value))
// Unpacking inflates through real streams, so the page settles some time
// after the render's own act. React is told not to expect act while waiting.
async function settled(check: () => void): Promise<void> {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  environment.IS_REACT_ACT_ENVIRONMENT = false
  try {
    await vi.waitFor(check)
  }
  finally {
    environment.IS_REACT_ACT_ENVIRONMENT = true
  }
}

describe('pages served by the backend', () => {
  it('asks the endpoint for each page by its src, with the fixed data beside it, once per page', async () => {
    const { admin, calls } = await render('/', { endpoint: '/admin/page', data: { app: 'shop' } })
    await text('Served home')
    expect(calls).toEqual([expect.objectContaining({ url: '/admin/page', method: 'POST', payload: { app: 'shop', path: 'home' } })])

    await act(async () => {
      await admin.getRouter()!.navigate('/?drawer=%2Fpages%2Fedit.json&record=3')
    })
    await text('Served editor')
    await act(async () => {
      await admin.getRouter()!.navigate('/')
    })
    await act(async () => {
      await admin.getRouter()!.navigate('/?drawer=%2Fpages%2Fedit.json&record=4')
    })
    await text('Served editor')
    expect(calls.map(call => (call.payload as { path: string }).path)).toEqual(['home', '/pages/edit.json'])
  })

  it('sends the values as the query for GET', async () => {
    const { calls } = await render('/', { endpoint: '/admin/page', method: 'GET' })
    await text('Served home')
    expect(calls[0]).toMatchObject({ method: 'GET', query: { path: 'home' } })
    expect(calls[0]!.payload).toBeUndefined()
  })

  it('shows a page the backend refuses as failed to load', async () => {
    const { calls } = await render('/missing', { endpoint: '/admin/page' })
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    await vi.waitFor(() => expect(document.body.querySelector('[role="alert"]')).not.toBeNull())
    expect(document.body.textContent).not.toContain('Served')
  })

  it('still fetches a page given as a full URL', async () => {
    const fetched: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      fetched.push(String(input))
      return new Response(JSON.stringify(page('Fetched remote')), { headers: { 'Content-Type': 'application/json' } })
    }))
    const { calls } = await render('/remote', { endpoint: '/admin/page' })
    await text('Fetched remote')
    expect(fetched).toEqual(['https://cdn.test/remote.json'])
    expect(calls).toHaveLength(0)
  })

  it('unpacks a page the endpoint answers packed, with the configured key', async () => {
    const { calls } = await render('/packed', { endpoint: '/admin/page' }, 'pk')
    await settled(() => expect(document.body.textContent).toContain('Unpacked page'))
    expect(calls).toHaveLength(1)
  })

  it('shows a packed page as failed to load when the key is wrong', async () => {
    await render('/packed', { endpoint: '/admin/page' }, 'other')
    await settled(() => expect(document.body.querySelector('[role="alert"]')).not.toBeNull())
    expect(document.body.textContent).not.toContain('Unpacked page')
  })

  it('unpacks a packed page file fetched directly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(await packDocument(page('Unpacked remote'))), { headers: { 'Content-Type': 'application/json' } })))
    await render('/remote', undefined)
    await settled(() => expect(document.body.textContent).toContain('Unpacked remote'))
  })
})

describe('pages in config.json', () => {
  it('reads pages from a panel and checks the method', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { url: '/api' },
      panels: { manifest: 'manifest.json', pages: { endpoint: '/page', method: 'GET', data: { v: 2 } } },
    }))))
    const config = await resolveAdminBaseConfig('https://site.test/admin/config.json')
    expect(config.panels).toMatchObject({ pages: { endpoint: '/page', method: 'GET', data: { v: 2 } } })
    expect(adminBaseConfigSchema.safeParse({ data: { url: '/api' }, panels: { manifest: '/m.json', pages: { method: 'PUT', endpoint: '/x' } } }).success).toBe(false)
  })

  it('takes the key of packed documents at the root', () => {
    const base = { data: { url: '/api' }, panels: { manifest: '/m.json' } }
    expect(adminBaseConfigSchema.parse({ ...base, packKey: 'pk' }).packKey).toBe('pk')
    expect(adminBaseConfigSchema.safeParse({ ...base, packKey: '' }).success).toBe(false)
  })
})
