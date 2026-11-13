// @vitest-environment jsdom
// The wiring the "lists" guide teaches: a FilterBar's values feed a ListPage's
// filters through page state, and ticked rows reach a bulk action.
import type { DataProvider, Filter } from '@duxweb/lumi'
import type { PropsWithChildren } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import { createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdmin } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const lists: Array<Filter[] | undefined> = []
const custom: unknown[] = []
const dataProvider = {
  async getList({ filters }: { filters?: Filter[] }) {
    lists.push(filters)
    return { data: [{ id: 1, number: 'ORD-1', status: 'paid' }, { id: 2, number: 'ORD-2', status: 'paid' }], total: 2 }
  },
  async getOne() { return { data: {} } },
  async create() { return { data: {} } },
  async update() { return { data: {} } },
  async deleteOne() { return { data: {} } },
  async custom(params: unknown) {
    custom.push(params)
    return { data: {} }
  },
} as unknown as DataProvider

const manifest: AdminManifest = {
  app: { id: 'lists', title: 'Lists' },
  routes: [{
    name: 'orders',
    path: '/orders',
    page: {
      spec: {
        root: 'list',
        state: { filters: { keyword: 'ORD', status: 'paid' }, selection: { keys: [], action: null } },
        elements: {
          filters: {
            type: 'FilterBar',
            props: {
              applyMode: 'immediate',
              value: { $bindState: '/filters' },
              schema: { fields: [
                { field: 'keyword', label: 'Search', widget: 'search', primary: true },
                { field: 'status', label: 'Status', widget: 'select', options: [{ label: 'Paid', value: 'paid' }] },
                { field: 'createdAt', label: 'Created', widget: 'dateRange' },
              ] },
            },
            children: [],
          },
          list: {
            type: 'ListPage',
            props: {
              title: 'Orders',
              resource: 'orders',
              statePath: '/list',
              filters: [
                { field: 'number', operator: 'like', value: { $state: '/filters/keyword' } },
                { field: 'status', operator: 'eq', value: { $state: '/filters/status' } },
                { field: 'createdAt', operator: 'between', value: { $state: '/filters/createdAt' } },
              ],
              columns: [{ field: 'number', label: 'Number' }],
              selectable: true,
              selectedKeys: { $bindState: '/selection/keys' },
              activeAction: { $bindState: '/selection/action' },
              bulkActions: [{ value: 'ship', label: 'Ship selected' }],
            },
            on: {
              bulkAction: {
                action: 'request',
                params: { url: '/orders/batch', method: 'POST', payload: { action: { $state: '/selection/action' }, ids: { $state: '/selection/keys' } } },
              },
            },
            slots: { toolbar: ['filters'] },
            children: [],
          },
        },
      } as never,
    },
  }],
}

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
  lists.length = 0
  custom.length = 0
})

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

describe('a list fed by a filter bar', () => {
  it('sends the bar\'s values as filters, an unset one with no value, and ticked rows to a bulk action', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      manifest,
      shell: ({ children }: PropsWithChildren) => <main>{children}</main>,
      createRouter: routes => createMemoryRouter(routes, { initialEntries: ['/orders'] }),
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
    await settled(() => expect(document.body.textContent).toContain('ORD-2'))
    // The bar sits in the list's toolbar, between its header and the results.
    expect(document.querySelector('.lumi-list-page__toolbar .lumi-filter-bar')).not.toBeNull()
    expect(lists.at(-1)).toEqual([
      { field: 'number', operator: 'like', value: 'ORD' },
      { field: 'status', operator: 'eq', value: 'paid' },
      // Not chosen yet: the filter is there without a value, which the default provider leaves out of the query.
      { field: 'createdAt', operator: 'between', value: undefined },
    ])

    const boxes = [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')]
    expect(boxes.length).toBeGreaterThan(2)
    await act(async () => boxes[1]!.click())
    await act(async () => boxes[2]!.click())
    const ship = await vi.waitFor(() => {
      const found = [...document.querySelectorAll('button')].find(node => node.textContent === 'Ship selected')
      if (!found)
        throw new Error('no bulk action')
      return found
    })
    await act(async () => ship.click())
    await settled(() => expect(custom).toHaveLength(1))
    expect(custom[0]).toMatchObject({ url: '/orders/batch', method: 'POST', payload: { action: 'ship', ids: [1, 2] } })
  })
})
