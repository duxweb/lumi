// @vitest-environment jsdom
/* eslint-disable no-template-curly-in-string -- $template expressions in page JSON. */
import type { DataProvider } from '@duxweb/lumi'
import type { PropsWithChildren } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import { createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdmin } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const read: Array<string | number> = []
const dataProvider = {
  async getList() { return { data: [], total: 0 } },
  async getOne({ id }: { id: string | number }) {
    read.push(id)
    return { data: { id, name: `Order ${id}` } }
  },
  async create() { return { data: {} } },
  async update() { return { data: {} } },
  async deleteOne() { return { data: {} } },
} as unknown as DataProvider

const text = (value: unknown) => ({ type: 'Text', props: { text: value }, children: [] })
const manifest: AdminManifest = {
  app: { id: 'params', title: 'Params' },
  routes: [
    {
      name: 'order',
      path: '/orders/:id',
      page: {
        spec: {
          root: 'page',
          // The page's own entry under `route` gives way to the route's.
          state: { note: 'untouched', route: { params: { id: 'from-the-page' } } },
          elements: {
            page: { type: 'Stack', props: {}, children: ['query', 'id', 'name', 'note', 'edit'] },
            query: { type: 'Query', props: { resource: 'orders', operation: 'one', id: { $state: '/route/params/id' }, resultPath: '/order' }, children: [] },
            id: text({ $template: 'id=${/route/params/id}' }),
            name: text({ $state: '/order/data/name' }),
            note: text({ $state: '/note' }),
            edit: { type: 'Button', props: { label: 'Edit note' }, on: { press: { action: 'setState', params: { statePath: '/note', value: 'edited' } } }, children: [] },
          },
        } as never,
      },
    },
    { name: 'plain', path: '/plain', page: { spec: { root: 'id', elements: { id: text({ $template: 'id=${/route/params/id}' }) } } as never } },
  ],
}

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
  read.length = 0
})

async function render(entry: string) {
  const admin = createAdmin({
    context: createLumi({ dataProvider }),
    manifest,
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
  return admin
}

// The record arrives some time after the render's own act; React is told not
// to expect act while waiting for it.
async function shows(value: string): Promise<void> {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  environment.IS_REACT_ACT_ENVIRONMENT = false
  try {
    await vi.waitFor(() => expect(document.body.textContent).toContain(value))
  }
  finally {
    environment.IS_REACT_ACT_ENVIRONMENT = true
  }
}

describe('a JSON page on a route with path params', () => {
  it('reads them at /route/params, in props and in a Query', async () => {
    await render('/orders/7')
    await shows('id=7')
    await shows('Order 7')
    expect(read).toEqual(['7'])
  })

  it('starts over for another record', async () => {
    const admin = await render('/orders/7')
    await shows('Order 7')
    await act(async () => {
      [...document.querySelectorAll('button')].find(node => node.textContent === 'Edit note')!.click()
    })
    await shows('edited')
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    environment.IS_REACT_ACT_ENVIRONMENT = false
    await admin.getRouter()!.navigate('/orders/8')
    await shows('id=8')
    await shows('Order 8')
    expect(document.body.textContent).toContain('untouched')
    expect(document.body.textContent).not.toContain('Order 7')
  })

  it('has no params on a route without any', async () => {
    await render('/plain')
    await shows('id=')
    expect(document.body.textContent).not.toContain('id=undefined')
  })
})
