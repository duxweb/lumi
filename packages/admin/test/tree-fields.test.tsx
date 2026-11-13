// @vitest-environment jsdom
import type { DataProvider, GetListParams, GetManyParams } from '@duxweb/lumi'
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createLumi, LumiProvider } from '@duxweb/lumi'
import { createStateStore } from '@json-render/core'
import { Renderer } from '@json-render/react'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminRegistry, LumiListPage, LumiRecordPicker, LumiTreeFilter } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const customers = [
  { id: 1, name: 'Acme', email: 'hi@acme.test' },
  { id: 2, name: 'Blue Pine', email: 'team@pine.test' },
  { id: 3, name: 'Orchid', email: 'team@orchid.test' },
]

function createProvider(listCalls: GetListParams[], manyCalls: GetManyParams[]): DataProvider {
  return {
    getList: async (params: GetListParams) => {
      listCalls.push(params)
      const like = params.filters?.find(filter => filter.operator === 'like')
      const data = customers.filter(row => !like || row.name.toLowerCase().includes(String(like.value).toLowerCase()))
      return { data, total: data.length }
    },
    getMany: async (params: GetManyParams) => {
      manyCalls.push(params)
      return { data: customers.filter(row => params.ids.includes(row.id)) }
    },
    getOne: async () => ({ data: {} }),
    create: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
    deleteOne: async () => ({ data: {} }),
  } as unknown as DataProvider
}

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function render(element: ReactNode, provider = createProvider([], [])): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => root.render(
    <LumiProvider context={createLumi({ dataProvider: provider })} registry={{}} queryClient={queryClient}>
      {element}
    </LumiProvider>,
  ))
  return host
}

async function settle(check: () => boolean, steps = 40): Promise<void> {
  for (let step = 0; step < steps && !check(); step++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }
  expect(check()).toBe(true)
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  document.body.innerHTML = ''
})

function rowWith(text: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[role=dialog] tbody tr')].find(row => row.textContent?.includes(text))
}

const categories = [
  { value: 1, label: 'Electronics', children: [{ value: 2, label: 'Audio', children: [{ value: 3, label: 'Headphones' }] }, { value: 4, label: 'Cameras' }] },
  { value: 5, label: 'Home' },
]

describe('tree filter', () => {
  it('reports the chosen node and its subtree, and clears with All', async () => {
    const onChange = vi.fn()
    const onSubtreeChange = vi.fn()
    const host = await render(<LumiTreeFilter items={categories} defaultExpandAll title="Categories" onChange={onChange} onSubtreeChange={onSubtreeChange} />)
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Categories')
    const audio = [...host.querySelectorAll<HTMLElement>('.lumi-tree__row')].find(row => row.textContent === 'Audio')!
    await act(async () => audio.click())
    expect(onChange).toHaveBeenLastCalledWith(2)
    expect(onSubtreeChange).toHaveBeenLastCalledWith([2, 3])
    await act(async () => host.querySelector<HTMLElement>('.lumi-tree-filter__all')!.click())
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(onSubtreeChange).toHaveBeenLastCalledWith(null)
  })

  it('sits beside the list results in the ListPage aside slot', async () => {
    const host = await render(<LumiListPage title="Products" results={<p>rows</p>} aside={<LumiTreeFilter items={categories} />} />)
    const layout = host.querySelector('.lumi-list-page__layout')!
    expect(layout.querySelector('aside.lumi-list-page__aside nav')).toBeTruthy()
    expect(layout.textContent).toContain('rows')
  })

  it('sizes the side panel by its own tree, never by the results beside it', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/styles/tree.css'), 'utf8')
    const aside = /\.lumi-list-page__aside \{([^}]*)\}/.exec(css)![1]!
    expect(aside).not.toMatch(/contain:\s*size|align-self:\s*stretch/)
    expect(aside).toMatch(/max-height:/)
    expect(aside).toMatch(/overflow-y:\s*auto/)
  })
})

describe('tree filter in a JSON ListPage', () => {
  const categoryRows = [
    { id: 1, name: 'Electronics', parentId: null },
    { id: 2, name: 'Audio', parentId: 1 },
    { id: 3, name: 'Headphones', parentId: 2 },
    { id: 4, name: 'Cameras', parentId: 1 },
    { id: 5, name: 'Home', parentId: null },
  ]
  const productRows = [
    { id: 1, name: 'Studio headphones', categoryId: 3 },
    { id: 2, name: 'Pocket camera', categoryId: 4 },
    { id: 3, name: 'Desk lamp', categoryId: 5 },
  ]
  const spec: Spec = {
    root: 'list',
    elements: {
      list: {
        type: 'ListPage',
        props: {
          title: 'Products',
          resource: 'products',
          statePath: '/list',
          filters: [{ field: 'categoryId', operator: 'in', value: { $state: '/filter/categories' } }],
          columns: [{ field: 'name', label: 'Product' }],
        },
        slots: { aside: ['tree'] },
        children: [],
      },
      tree: {
        type: 'TreeFilter',
        props: { source: { resource: 'categories', labelField: 'name' }, value: { $bindState: '/filter/category' }, subtree: { $bindState: '/filter/categories' }, title: 'Categories', defaultExpandAll: true },
        children: [],
      },
    },
  }

  it('re-reads the list for a chosen branch while the tree and the current rows stay', async () => {
    const calls: GetListParams[] = []
    const gate: { held?: Promise<void> } = {}
    const provider = {
      getList: async (params: GetListParams) => {
        calls.push(params)
        if (params.resource === 'categories')
          return { data: categoryRows, total: categoryRows.length }
        await gate.held
        const within = params.filters?.find(filter => filter.field === 'categoryId')?.value
        const data = productRows.filter(row => !Array.isArray(within) || within.includes(row.categoryId))
        return { data, total: data.length }
      },
      getMany: async () => ({ data: [] }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    } as unknown as DataProvider
    const store = createStateStore({ list: { page: 1, pageSize: 10 }, filter: { category: null, categories: null } })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    roots.push({ root, host })
    await act(async () => root.render(
      <LumiProvider context={createLumi({ dataProvider: provider })} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })} registry={adminRegistry} store={store}>
        <Renderer spec={spec} registry={adminRegistry} />
      </LumiProvider>,
    ))
    const rowsText = (): string => host.querySelector('.lumi-list-page__surface tbody')?.textContent ?? ''
    const node = (label: string): HTMLElement => [...host.querySelectorAll<HTMLElement>('.lumi-tree-filter .lumi-tree__row')].find(row => row.textContent === label)!
    await settle(() => Boolean(node('Headphones')) && rowsText().includes('Desk lamp'))
    const panel = host.querySelector('.lumi-tree-filter')
    const tree = panel?.querySelector('[role=tree]')

    let release!: () => void
    gate.held = new Promise<void>((done) => {
      release = done
    })
    await act(async () => node('Audio').click())
    expect(store.get('/filter/categories')).toEqual([2, 3])
    await settle(() => calls.some(call => call.resource === 'products' && Array.isArray(call.filters?.[0]?.value)))
    // While the branch is read, the rows already on screen stay and the tree is untouched.
    expect(host.querySelector('.lumi-data-grid')?.hasAttribute('data-loading')).toBe(false)
    expect(rowsText()).toContain('Desk lamp')
    expect(host.querySelector('.lumi-tree-filter')).toBe(panel)
    expect(tree?.getAttribute('aria-busy')).toBeNull()
    expect(host.querySelector('.lumi-tree__status')).toBeNull()
    await act(async () => release())
    gate.held = undefined
    await settle(() => rowsText().includes('Studio headphones') && !rowsText().includes('Desk lamp'))

    await act(async () => node('Home').click())
    await settle(() => rowsText().includes('Desk lamp') && !rowsText().includes('Studio headphones'))
    expect(host.querySelector('.lumi-tree-filter')).toBe(panel)
    expect(panel?.querySelector('[role=tree]')).toBe(tree)
    expect(host.querySelector('[role=treeitem][aria-selected=true] > .lumi-tree__row')?.textContent).toBe('Home')
    expect(calls.filter(call => call.resource === 'categories')).toHaveLength(1)
  })
})

describe('record picker', () => {
  const columns = [{ field: 'name', label: 'Customer' }, { field: 'email', label: 'Email' }]

  it('names a chosen record by ID before the dialog opens', async () => {
    const listCalls: GetListParams[] = []
    const manyCalls: GetManyParams[] = []
    const host = await render(<LumiRecordPicker resource="customers" columns={columns} labelField="name" value={2} title="Customer" />, createProvider(listCalls, manyCalls))
    await settle(() => host.textContent?.includes('Blue Pine') === true)
    expect(manyCalls[0]?.ids).toEqual([2])
    expect(listCalls).toHaveLength(0)
  })

  it('searches the dialog table and commits one row on click', async () => {
    const listCalls: GetListParams[] = []
    const onChange = vi.fn()
    const host = await render(<LumiRecordPicker resource="customers" columns={columns} labelField="name" searchField="name" title="Customer" onChange={onChange} />, createProvider(listCalls, []))
    await act(async () => host.querySelector<HTMLElement>('[aria-label="Select Customer"]')!.click())
    await settle(() => Boolean(rowWith('Orchid')))
    const input = document.querySelector<HTMLInputElement>('[role=dialog] input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'orch')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle(() => !rowWith('Acme') && Boolean(rowWith('Orchid')))
    expect(listCalls.at(-1)?.filters).toEqual([{ field: 'name', operator: 'like', value: 'orch' }])
    await act(async () => rowWith('Orchid')!.click())
    expect(onChange).toHaveBeenLastCalledWith(3)
    await settle(() => !document.querySelector('[role=dialog]'))
  })

  it('edits a draft of several records and commits it on confirm', async () => {
    const onChange = vi.fn()
    const host = await render(<LumiRecordPicker resource="customers" columns={columns} labelField="name" multiple value={[1]} title="Customers" onChange={onChange} />)
    await act(async () => host.querySelector<HTMLElement>('[aria-label="Select Customers"]')!.click())
    await settle(() => Boolean(rowWith('Orchid')))
    await act(async () => rowWith('Orchid')!.click())
    expect(onChange).not.toHaveBeenCalled()
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('2 selected')
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(button => button.textContent === 'Confirm')!
    await act(async () => confirm.click())
    expect(onChange).toHaveBeenLastCalledWith([1, 3])
  })
})
