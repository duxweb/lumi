// @vitest-environment jsdom
import type { DataProvider, Filter, GetListParams, GetManyParams } from '@duxweb/lumi'
import type { ReactElement } from 'react'
import { createStateStore, defineCatalog } from '@json-render/core'
import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { uiComponentDefinitions } from '../../../ui/src/catalog/index.js'
import { optionsSourceSchema } from '../../src/catalog'
import { createLumi } from '../../src/index'
import { connectOptions, LumiProvider, rowToOption, useSelect } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface Region { id: number, name: string, parentId: number }

const regions: Region[] = [
  { id: 1, name: 'Zhejiang', parentId: 0 },
  { id: 2, name: 'Hangzhou', parentId: 1 },
  { id: 3, name: 'Ningbo', parentId: 1 },
  { id: 4, name: 'Guangdong', parentId: 0 },
  { id: 5, name: 'Shenzhen', parentId: 4 },
]

function matches(row: Region, filters: Filter[] = []): boolean {
  return filters.every((filter) => {
    const value = row[filter.field as keyof Region]
    if (filter.operator === 'like')
      return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
    return value === filter.value
  })
}

function createProvider(listCalls: GetListParams[], manyCalls: GetManyParams[] = []): DataProvider {
  return {
    async getList(params) {
      listCalls.push(params)
      const all = regions.filter(row => matches(row, params.filters))
      const { page, pageSize } = params.pagination || { page: 1, pageSize: all.length }
      return { data: all.slice((page - 1) * pageSize, page * pageSize), total: all.length }
    },
    async getMany(params) {
      manyCalls.push(params)
      return { data: regions.filter(row => params.ids.includes(row.id)) }
    },
    async getOne(params) {
      return { data: regions.find(row => row.id === params.id)! }
    },
    async create() {
      throw new Error('not implemented')
    },
    async update() {
      throw new Error('not implemented')
    },
    async deleteOne() {
      throw new Error('not implemented')
    },
  }
}

async function settle(check: () => boolean, steps = 60): Promise<void> {
  for (let step = 0; step < steps && !check(); step++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }
  expect(check()).toBe(true)
}

const roots: ReturnType<typeof createRoot>[] = []
afterEach(async () => {
  await act(async () => roots.splice(0).forEach(root => root.unmount()))
  document.body.innerHTML = ''
})

function mount(node: ReactElement): Promise<void> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  return act(async () => root.render(node))
}

type HostProps = Record<string, any>
const seen: { current: HostProps } = { current: {} }
function Host(props: HostProps): null {
  seen.current = props
  return null
}
const catalog = defineCatalog(schema, {
  components: {
    Select: {
      ...uiComponentDefinitions.Select,
      props: uiComponentDefinitions.Select.props.extend({ options: uiComponentDefinitions.Select.props.shape.options.optional(), source: optionsSourceSchema.optional() }),
    },
  },
  actions: {},
})
const { registry } = defineRegistry(catalog, { components: { Select: connectOptions(Host) } })
const single = (props: Record<string, unknown>) => ({ root: 'field', elements: { field: { type: 'Select', props, children: [] } } })
const labels = (): string[] => (seen.current.options ?? []).map((option: { label: string }) => option.label)

describe('optionsSourceSchema', () => {
  it('accepts a resource with field mapping and state-path dependencies only', () => {
    expect(optionsSourceSchema.safeParse({ resource: 'regions', labelField: 'name', searchField: 'name', pageSize: 10, dependsOn: { parentId: '/form/province' } }).success).toBe(true)
    expect(optionsSourceSchema.safeParse({ resource: 'regions', dependsOn: { parentId: 'form.province' } }).success).toBe(false)
    expect(optionsSourceSchema.safeParse({ resource: 'regions', url: '/regions' }).success).toBe(false)
  })
})

describe('rowToOption', () => {
  it('maps label, value, description and media fields', () => {
    const fields = { labelField: 'name', descriptionField: 'role', avatarField: 'avatar', imageField: 'photo' }
    expect(rowToOption({ id: 7, name: 'Ada', role: 'Lead', avatar: null, photo: '/p.png' }, fields))
      .toEqual({ label: 'Ada', value: 7, description: 'Lead', avatar: '', image: '/p.png' })
    expect(rowToOption({ id: 8, title: 'Plain' }, {})).toEqual({ label: 'Plain', value: 8 })
  })
})

describe('useSelect paging', () => {
  it('loads further pages until the total is reached', async () => {
    const listCalls: GetListParams[] = []
    const context = createLumi({ dataProvider: createProvider(listCalls) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const state: { current?: ReturnType<typeof useSelect> } = {}
    function Probe(): null {
      state.current = useSelect({ resource: 'regions', labelField: 'name', pageSize: 2 })
      return null
    }
    await mount(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>)
    await settle(() => state.current?.options.length === 2)
    expect(state.current!.hasMore).toBe(true)
    expect(state.current!.total).toBe(5)
    await act(async () => state.current!.loadMore())
    await settle(() => state.current?.options.length === 4)
    await act(async () => state.current!.loadMore())
    await settle(() => state.current?.options.length === 5 && !state.current.hasMore)
    expect(listCalls.map(call => call.pagination && call.pagination.page)).toEqual([1, 2, 3])
    await act(async () => state.current!.loadMore())
    expect(listCalls).toHaveLength(3)
  })

  it('reads labels of selected ids only when no loaded page holds them', async () => {
    const manyCalls: GetManyParams[] = []
    const context = createLumi({ dataProvider: createProvider([], manyCalls) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const state: { current?: ReturnType<typeof useSelect> } = {}
    function Probe({ selected }: { selected: number[] }): null {
      state.current = useSelect({ resource: 'regions', labelField: 'name', pageSize: 2, selected })
      return null
    }
    const tree = (selected: number[]) => <LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe selected={selected} /></LumiProvider>
    await mount(tree([1, 5]))
    await settle(() => state.current?.selectedOptions.map(option => option.label).join() === 'Zhejiang,Shenzhen')
    expect(manyCalls.at(-1)?.ids).toEqual([5])
  })
})

describe('connectOptions', () => {
  it('keeps static options and binds the value under plain json-render providers', async () => {
    const store = createStateStore({ form: { size: 'm' } })
    await mount(
      <JSONUIProvider registry={registry} store={store}>
        <Renderer registry={registry} spec={single({ value: { $bindState: '/form/size' }, options: [{ label: 'M', value: 'm' }, { label: 'L', value: 'l' }] }) as never} />
      </JSONUIProvider>,
    )
    expect(seen.current.value).toBe('m')
    expect(labels()).toEqual(['M', 'L'])
    expect(seen.current.onSearch).toBeUndefined()
    await act(async () => seen.current.onChange('l'))
    expect(store.get('/form/size')).toBe('l')
  })

  async function renderRemote(state: Record<string, unknown>, source: Record<string, unknown>) {
    const listCalls: GetListParams[] = []
    const store = createStateStore(state)
    const context = createLumi({ dataProvider: createProvider(listCalls) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await mount(
      <LumiProvider context={context} registry={registry} store={store} queryClient={queryClient}>
        <Renderer registry={registry} spec={single({ value: { $bindState: '/form/city' }, source }) as never} />
      </LumiProvider>,
    )
    return { listCalls, store }
  }

  it('waits for its parent, filters by it and clears when the parent changes', async () => {
    const { listCalls, store } = await renderRemote({ form: { province: null, city: null } }, { resource: 'regions', labelField: 'name', searchField: 'name', dependsOn: { parentId: '/form/province' } })
    expect(seen.current.disabled).toBe(true)
    expect(listCalls).toHaveLength(0)

    await act(async () => store.set('/form/province', 1))
    await settle(() => labels().join() === 'Hangzhou,Ningbo')
    expect(seen.current.disabled).toBe(false)
    expect(typeof seen.current.onSearch).toBe('function')
    expect(listCalls.at(-1)?.filters).toContainEqual({ field: 'parentId', operator: 'eq', value: 1 })

    await act(async () => seen.current.onChange(3))
    expect(store.get('/form/city')).toBe(3)
    await act(async () => store.set('/form/province', 4))
    await settle(() => labels().join() === 'Shenzhen')
    expect(store.get('/form/city')).toBeNull()
  })

  it('keeps the child when an empty parent is filled, and on request', async () => {
    const filled = await renderRemote({ form: { province: null, city: 5 } }, { resource: 'regions', labelField: 'name', dependsOn: { parentId: '/form/province' } })
    await act(async () => filled.store.set('/form/province', 4))
    await settle(() => labels().join() === 'Shenzhen')
    expect(filled.store.get('/form/city')).toBe(5)

    const kept = await renderRemote({ form: { province: 1, city: 2 } }, { resource: 'regions', labelField: 'name', dependsOn: { parentId: '/form/province' }, clearOnDependencyChange: false })
    await act(async () => kept.store.set('/form/province', 4))
    await settle(() => labels().join() === 'Shenzhen')
    expect(kept.store.get('/form/city')).toBe(2)
  })
})
