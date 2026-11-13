// @vitest-environment jsdom
import type { DataProvider, RouterProvider } from '@duxweb/lumi'
import type { UseTableReturn } from '../../src/react/index'
import { createLumi } from '@duxweb/lumi'
import { createStateStore } from '@json-render/core'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiProvider, useTable } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** An in-memory address with history, standing in for the app router. */
function memoryRouter(initial: string): RouterProvider & { entries: string[], push: (path: string) => void } {
  const entries = [initial]
  const listeners = new Set<() => void>()
  const notify = (): void => listeners.forEach(listener => listener())
  const current = (): URL => new URL(entries.at(-1)!, 'https://app.test')
  return {
    entries,
    go({ to, query, replace }) {
      const next = new URL(to ?? current().pathname, 'https://app.test')
      if (query)
        next.search = new URLSearchParams(query as Record<string, string>).toString()
      const path = `${next.pathname}${next.search}`
      if (replace)
        entries[entries.length - 1] = path
      else entries.push(path)
      notify()
    },
    back() {
      entries.pop()
      notify()
    },
    push(path) {
      entries.push(path)
      notify()
    },
    parse() {
      const url = current()
      return { pathname: url.pathname, params: {}, query: Object.fromEntries(url.searchParams) }
    },
    getCurrentPath() {
      const url = current()
      return `${url.pathname}${url.search}`
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

async function mount(router: RouterProvider, sync: boolean | string = true) {
  const getList = vi.fn(async () => ({ data: [], total: 100 }))
  const context = createLumi({ dataProvider: { getList } as unknown as DataProvider, routerProvider: router })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const table: { current?: UseTableReturn } = {}
  function Probe(): null {
    table.current = useTable({ resource: 'orders', statePath: '/list', pagination: { pageSize: 20 }, syncWithLocation: sync })
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<LumiProvider context={context} queryClient={client} registry={{}} store={createStateStore({})}><Probe /></LumiProvider>))
  return { table, getList, root }
}

describe('useTable syncWithLocation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens on the page, size and sort the link names', async () => {
    const router = memoryRouter('/orders?page=3&pageSize=50&sort=total:desc,name:asc&tab=open')
    const { table, getList } = await mount(router)
    expect(table.current).toMatchObject({ page: 3, pageSize: 50, sorters: [{ field: 'total', order: 'desc' }, { field: 'name', order: 'asc' }] })
    // The first request already asks for the linked page.
    expect(getList.mock.calls[0]![0]).toMatchObject({ pagination: { page: 3, pageSize: 50 } })
    expect(router.entries).toEqual(['/orders?page=3&pageSize=50&sort=total:desc,name:asc&tab=open'])
  })

  it('writes changes in place, keeps other parameters and leaves defaults out', async () => {
    const router = memoryRouter('/orders?tab=open')
    const { table } = await mount(router)
    await act(async () => table.current!.setPage(2))
    expect(router.entries).toEqual(['/orders?tab=open&page=2'])
    await act(async () => table.current!.setSorters([{ field: 'total', order: 'desc' }]))
    expect(router.entries).toEqual(['/orders?tab=open&page=2&sort=total%3Adesc'])
    await act(async () => table.current!.setPage(1))
    expect(router.entries).toEqual(['/orders?tab=open&sort=total%3Adesc'])
  })

  it('follows back and forward, and a prefix keeps two tables apart', async () => {
    const router = memoryRouter('/orders')
    const { table } = await mount(router, 'o_')
    await act(async () => router.push('/orders?o_page=4&page=9'))
    expect(table.current!.page).toBe(4)
    await act(async () => router.back())
    expect(table.current!.page).toBe(1)
  })

  it('ignores the address without the option', async () => {
    const router = memoryRouter('/orders?page=3')
    const { table } = await mount(router, false)
    expect(table.current!.page).toBe(1)
    await act(async () => table.current!.setPage(2))
    expect(router.entries).toEqual(['/orders?page=3'])
  })
})
