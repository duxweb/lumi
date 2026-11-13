// @vitest-environment jsdom
import type { DataProvider, Filter, GetListParams, GetManyParams, ID } from '@duxweb/lumi'
import { createLumi } from '@duxweb/lumi'
import { QueryClient } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LumiProvider, useSelect } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface CategoryRow {
  id: number
  name: string
  countryId: number
}

const rows: CategoryRow[] = [
  { id: 1, name: 'Cameras', countryId: 1 },
  { id: 2, name: 'Audio', countryId: 1 },
  { id: 3, name: 'Yorkshire', countryId: 2 },
  { id: 99, name: 'Archived Camera', countryId: 9 },
]

function matchesFilters(row: CategoryRow, filters: Filter[] = []): boolean {
  return filters.every((filter) => {
    const value = row[filter.field as keyof CategoryRow]
    if (filter.operator === 'like')
      return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
    return value === filter.value
  })
}

function createDataProvider(listCalls: GetListParams[], manyCalls: GetManyParams[]): DataProvider {
  return {
    async getList(params) {
      listCalls.push(params)
      const data = rows.filter(row => matchesFilters(row, params.filters))
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

describe('useSelect', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('searches remote options, reacts to dependsOn values, and backfills selected labels', async () => {
    const listCalls: GetListParams[] = []
    const manyCalls: GetManyParams[] = []
    let select!: ReturnType<typeof useSelect>
    let deps: Record<string, unknown> = { countryId: 1 }
    const selected: ID = 99
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const context = createLumi({ dataProvider: createDataProvider(listCalls, manyCalls) })

    function Probe(): null {
      select = useSelect({
        resource: 'categories',
        labelField: 'name',
        valueField: 'id',
        searchField: 'name',
        dependsOn: ['countryId'],
        pageSize: 10,
        selected,
        deps,
        debounce: 1,
      })
      return null
    }

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const render = (): void => {
      root.render(
        <LumiProvider context={context} registry={{}} queryClient={queryClient}>
          <Probe />
        </LumiProvider>,
      )
    }

    await act(async () => render())
    await act(async () => {
      await expect.poll(() => listCalls.length).toBeGreaterThan(0)
    })
    expect(listCalls.at(-1)?.filters).toContainEqual({ field: 'countryId', operator: 'eq', value: 1 })

    await act(async () => {
      await expect.poll(() => manyCalls.length).toBe(1)
      await expect.poll(() => select.selectedOptions.find(option => option.value === 99)?.label).toBe('Archived Camera')
    })
    expect(select.options.some(option => option.value === 99)).toBe(false)

    await act(async () => {
      select.search('Cam')
      await new Promise(resolve => setTimeout(resolve, 2))
    })
    await act(async () => {
      await expect.poll(() => listCalls.at(-1)?.filters).toEqual([
        { field: 'name', operator: 'like', value: 'Cam' },
        { field: 'countryId', operator: 'eq', value: 1 },
      ])
    })

    deps = { countryId: 2 }
    await act(async () => render())
    await act(async () => {
      await expect.poll(() => listCalls.at(-1)?.filters).toEqual([
        { field: 'name', operator: 'like', value: 'Cam' },
        { field: 'countryId', operator: 'eq', value: 2 },
      ])
    })

    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('treats inline deps as a controlled value without a render loop', async () => {
    const listCalls: GetListParams[] = []
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const context = createLumi({ dataProvider: createDataProvider(listCalls, []) })
    let renderCount = 0
    let rerender!: () => void

    function Probe(): null {
      renderCount += 1
      const [, setRevision] = useState(0)
      rerender = () => setRevision(value => value + 1)
      useSelect({
        resource: 'categories',
        dependsOn: ['countryId'],
        deps: { countryId: 1 },
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(
      <LumiProvider context={context} registry={{}} queryClient={queryClient}>
        <Probe />
      </LumiProvider>,
    ))
    await expect.poll(() => listCalls.length).toBeGreaterThan(0)
    const settledRenderCount = renderCount

    await act(async () => rerender())

    expect(renderCount).toBe(settledRenderCount + 1)
    expect(listCalls.at(-1)?.filters).toContainEqual({ field: 'countryId', operator: 'eq', value: 1 })
    await act(async () => root.unmount())
    queryClient.clear()
  })
})
