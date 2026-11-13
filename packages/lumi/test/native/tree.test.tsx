// @vitest-environment jsdom
import type { DataProvider, Filter, GetListParams, GetManyParams } from '@duxweb/lumi'
import type { TreeSource, TreeSourceState } from '../../src/react/index'
import { createStateStore, defineCatalog } from '@json-render/core'
import { defineRegistry, Renderer } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { uiComponentDefinitions } from '../../../ui/src/catalog/index.js'
import { LumiTree } from '../../../ui/src/react/index.js'
import { treeSourceSchema } from '../../src/catalog'
import { createLumi } from '../../src/index'
import { connectTree, LumiProvider, useTreeSource } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface Row { id: number, name: string, parentId: number | null }

const rows: Row[] = [
  { id: 1, name: 'Electronics', parentId: null },
  { id: 2, name: 'Audio', parentId: 1 },
  { id: 3, name: 'Headphones', parentId: 2 },
  { id: 4, name: 'Cameras', parentId: 1 },
  { id: 5, name: 'Home', parentId: null },
]

function matches(row: Row, filters: Filter[] = []): boolean {
  return filters.every((filter) => {
    const value = row[filter.field as keyof Row]
    if (filter.operator === 'null')
      return value === null
    if (filter.operator === 'like')
      return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
    return value === filter.value
  })
}

function createProvider(listCalls: GetListParams[], manyCalls: GetManyParams[]): DataProvider {
  return {
    async getList(params) {
      listCalls.push(params)
      const data = rows.filter(row => matches(row, params.filters))
      return { data, total: data.length }
    },
    async getMany(params) {
      manyCalls.push(params)
      return { data: rows.filter(row => params.ids.includes(row.id)) }
    },
    async getOne(params) {
      return { data: rows.find(row => row.id === params.id)! }
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

const treeCatalog = defineCatalog(schema, {
  components: { Tree: { ...uiComponentDefinitions.Tree, props: uiComponentDefinitions.Tree.props.extend({ source: treeSourceSchema.optional() }) } },
  actions: {},
})
const { registry } = defineRegistry(treeCatalog, { components: { Tree: connectTree(LumiTree, { expanded: true }) } })

/** Lets chained queries and effects run, one act per step, until the check holds. */
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

async function probe(source: TreeSource, value?: unknown) {
  const listCalls: GetListParams[] = []
  const manyCalls: GetManyParams[] = []
  const context = createLumi({ dataProvider: createProvider(listCalls, manyCalls) })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const state: { current?: TreeSourceState } = {}
  function Probe(): null {
    state.current = useTreeSource(source, { value })
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(
    <LumiProvider context={context} registry={{}} queryClient={queryClient}>
      <Probe />
    </LumiProvider>,
  ))
  return { state, listCalls, manyCalls }
}

function labels(nodes: TreeSourceState['items']): unknown[] {
  return nodes.map(node => node.children ? [node.label, labels(node.children)] : node.label)
}

describe('tree source', () => {
  it('validates the source contract', () => {
    expect(treeSourceSchema.safeParse({ resource: 'categories', lazy: true, labelField: 'name' }).success).toBe(true)
    expect(treeSourceSchema.safeParse({ resource: 'categories', query: 'x' }).success).toBe(false)
  })

  it('reads a full resource once and nests it by parent', async () => {
    const { state, listCalls } = await probe({ resource: 'categories', labelField: 'name' })
    await settle(() => state.current?.items.length === 2)
    expect(listCalls).toHaveLength(1)
    expect(labels(state.current!.items)).toEqual([['Electronics', [['Audio', ['Headphones']], 'Cameras']], 'Home'])
    expect(state.current!.loadChildren).toBeUndefined()
  })

  it('reads a lazy root level, then one level per opened parent', async () => {
    const { state, listCalls } = await probe({ resource: 'categories', labelField: 'name', lazy: true })
    await settle(() => state.current?.items.length === 2)
    expect(listCalls[0]?.filters).toEqual([{ field: 'parentId', operator: 'null', value: true }])
    expect(state.current!.items[0]!.children).toBeUndefined()
    await act(async () => state.current!.loadChildren!({ value: 1 }))
    await settle(() => state.current?.items[0]?.children?.length === 2)
    expect(state.current!.items[0]!.children!.map(node => node.label)).toEqual(['Audio', 'Cameras'])
    expect(listCalls.at(-1)?.filters).toEqual([{ field: 'parentId', operator: 'eq', value: 1 }])
    const calls = listCalls.length
    await settle(() => true, 3)
    expect(listCalls).toHaveLength(calls)
  })

  it('echoes a deep lazy value: reads it by ID and loads the levels above it', async () => {
    const { state, manyCalls } = await probe({ resource: 'categories', labelField: 'name', lazy: true }, [3])
    const nested = JSON.stringify([['Electronics', [['Audio', ['Headphones']], 'Cameras']], 'Home'])
    await settle(() => JSON.stringify(labels(state.current?.items ?? [])) === nested)
    expect(state.current!.selectedNodes.map(node => node.label)).toEqual(['Headphones'])
    expect(manyCalls[0]?.ids).toEqual([3])
  })

  it('searches a lazy source on the server and reveals the hits', async () => {
    const { state, listCalls } = await probe({ resource: 'categories', labelField: 'name', lazy: true, searchField: 'name' })
    await settle(() => state.current?.items.length === 2)
    await act(async () => state.current!.search!('head'))
    await settle(() => listCalls.some(call => call.filters?.some(filter => filter.operator === 'like' && filter.value === 'head')))
    await settle(() => state.current?.items[0]?.children?.[0]?.children?.[0]?.label === 'Headphones')
  })
})

async function renderSpec(spec: unknown, store = createStateStore({}), listCalls: GetListParams[] = []): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  const context = createLumi({ dataProvider: createProvider(listCalls, []) })
  await act(async () => root.render(
    <LumiProvider context={context} registry={registry} store={store} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Renderer registry={registry} spec={spec as never} />
    </LumiProvider>,
  ))
  return host
}

describe('connectTree', () => {
  it('binds a static tree to state without data services', async () => {
    const store = createStateStore({ picked: null })
    const host = await renderSpec({
      root: 'tree',
      elements: {
        tree: { type: 'Tree', props: { items: [{ value: 'a', label: 'Alpha' }], value: { $bindState: '/picked' } }, children: [] },
      },
    }, store)
    await act(async () => host.querySelector<HTMLElement>('.lumi-tree__row')!.click())
    expect(store.get('/picked')).toBe('a')
  })

  it('fills a tree from its source', async () => {
    const host = await renderSpec({
      root: 'tree',
      elements: {
        tree: { type: 'Tree', props: { source: { resource: 'categories', labelField: 'name' }, defaultExpandAll: true }, children: [] },
      },
    })
    await settle(() => host.querySelectorAll('[role=treeitem]:not([inert] *)').length === 5)
  })

  it('keeps a full source on screen while the chosen node changes: no request, no loading', async () => {
    const listCalls: GetListParams[] = []
    const store = createStateStore({ picked: null })
    const host = await renderSpec({
      root: 'tree',
      elements: {
        tree: { type: 'Tree', props: { source: { resource: 'categories', labelField: 'name' }, value: { $bindState: '/picked' }, defaultExpandAll: true }, children: [] },
      },
    }, store, listCalls)
    const visible = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('[role=treeitem]:not([inert] *)')]
    await settle(() => visible().length === 5)
    const tree = host.querySelector('[role=tree]')
    for (const label of ['Audio', 'Home', 'Headphones']) {
      const row = [...host.querySelectorAll<HTMLElement>('.lumi-tree__row')].find(item => item.textContent === label)!
      await act(async () => row.click())
      expect(host.querySelector('[role=tree]')).toBe(tree)
      expect(tree?.getAttribute('aria-busy')).toBeNull()
      expect(host.querySelector('.lumi-tree__status')).toBeNull()
      expect(visible()).toHaveLength(5)
    }
    await settle(() => true, 3)
    expect(store.get('/picked')).toBe(3)
    expect(host.querySelector('[role=treeitem][aria-selected=true] > .lumi-tree__row')?.textContent).toBe('Headphones')
    expect(listCalls).toHaveLength(1)
  })
})
