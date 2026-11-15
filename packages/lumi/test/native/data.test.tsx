// @vitest-environment jsdom
import type { DataProvider, I18nProvider } from '@duxweb/lumi'
import type { ReactNode } from 'react'
import { createI18nProvider, createLumi } from '@duxweb/lumi'
import { QueryClient } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTenantProvider } from '../../src/core/providers/tenant.js'
import { LumiProvider, useClient, useCreate, useCustom, useCustomMutation, useDelete, useFormatCurrency, useFormatDateTime, useInvalidate, useList, useLocale, useOne, useTable } from '../../src/react/index'
import { useImport } from '../../src/react/transfer.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('react data services', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('preserves its default query client across parent renders', async () => {
    const context = createLumi({ dataProvider: {} as DataProvider })
    let client!: QueryClient
    let rerender!: () => void

    function Probe(): null {
      client = useClient()
      return null
    }

    function Host(): ReactNode {
      const [, setRevision] = useState(0)
      rerender = () => setRevision(value => value + 1)
      return (
        <LumiProvider
          context={context}
          registry={{}}
        >
          <Probe />
        </LumiProvider>
      )
    }

    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<Host />))
    const initialClient = client
    initialClient.setQueryData(['stable'], { value: 1 })

    await act(async () => rerender())

    expect(client).toBe(initialClient)
    expect(client.getQueryData(['stable'])).toEqual({ value: 1 })
    await act(async () => root.unmount())
  })

  it('subscribes to class-based i18n providers with the provider receiver', async () => {
    class ClassI18nProvider implements I18nProvider {
      private locale = 'en-US'
      private readonly listeners = new Set<() => void>()

      translate(key: string): string {
        return key
      }

      getLocale(): string {
        return this.locale
      }

      changeLocale(locale: string): void {
        this.locale = locale
        this.listeners.forEach(listener => listener())
      }

      subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
      }
    }

    const i18nProvider = new ClassI18nProvider()
    const context = createLumi({ dataProvider: {} as DataProvider, i18nProvider })

    function Probe(): ReactNode {
      return <span data-testid="locale">{useLocale()}</span>
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(async () => root.render(<LumiProvider context={context} registry={{}}><Probe /></LumiProvider>))
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('en-US')

    await act(async () => i18nProvider.changeLocale('zh-CN'))

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('zh-CN')
    await act(async () => root.unmount())
  })

  it('uses the configured currency unit and UTC display time zone', async () => {
    const context = createLumi({
      dataProvider: {} as DataProvider,
      i18nProvider: createI18nProvider({
        locale: 'en-US',
        format: { currency: 'USD', currencyUnit: 'minor', timeZone: 'America/New_York', dateTimeInput: 'iso-utc' },
      }),
    })
    let formatCurrency!: ReturnType<typeof useFormatCurrency>
    let formatDateTime!: ReturnType<typeof useFormatDateTime>
    function Probe(): null {
      formatCurrency = useFormatCurrency()
      formatDateTime = useFormatDateTime()
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} registry={{}}><Probe /></LumiProvider>))

    expect(formatCurrency(2700)).toBe('$27.00')
    expect(formatDateTime('2026-08-10T12:00:00Z', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).toBe('08:00')
    expect(() => formatDateTime('2026-08-10T12:00:00', { hour: '2-digit' })).toThrow('ISO-8601 UTC')
    await act(async () => root.unmount())
  })

  it('rejects currency and datetime formatting without an explicit format contract', async () => {
    let formatCurrency!: ReturnType<typeof useFormatCurrency>
    let formatDateTime!: ReturnType<typeof useFormatDateTime>
    function Probe(): null {
      formatCurrency = useFormatCurrency()
      formatDateTime = useFormatDateTime()
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(
      <LumiProvider context={createLumi({ dataProvider: {} as DataProvider, i18nProvider: createI18nProvider({ locale: 'en-US' }) })} registry={{}}>
        <Probe />
      </LumiProvider>,
    ))

    expect(() => formatCurrency(27)).toThrow('currency format is not configured')
    expect(() => formatDateTime('2026-08-10T12:00:00Z')).toThrow('datetime format is not configured')
    await act(async () => root.unmount())
  })

  it('uses the explicitly selected data provider in query keys', async () => {
    const dataProvider: DataProvider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    }
    const context = createLumi({
      dataProvider: { default: dataProvider, reporting: dataProvider },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe(): null {
      useList({ resource: 'reports', dataProviderName: 'reporting' })
      return null
    }
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>)
    })
    await expect.poll(() => queryClient.getQueryCache().getAll().length).toBe(1)
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey.slice(0, 3)).toEqual(['lumi', 'reporting', 'reports'])
    await act(async () => root.unmount())
  })

  it('keeps custom query keys free of hook control options', async () => {
    const custom = vi.fn(async () => ({ data: { ok: true } }))
    const provider: DataProvider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
      custom,
    }
    const context = createLumi({ dataProvider: provider })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe(): null {
      useCustom({ url: '/stats', query: { range: 'week' }, enabled: true })
      return null
    }
    const root = createRoot(document.createElement('div'))

    await act(async () => {
      root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>)
    })
    await expect.poll(() => custom).toHaveBeenCalled()
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'lumi',
      'default',
      '',
      'custom',
      { url: '/stats', query: { range: 'week' } },
    ])
    await act(async () => root.unmount())
  })

  it('forwards the selected data provider and metadata through useTable', async () => {
    const getList = vi.fn(async () => ({ data: [], total: 0 }))
    const dataProvider: DataProvider = {
      getList,
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    }
    const context = createLumi({ dataProvider: { default: dataProvider, reporting: dataProvider } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe(): null {
      useTable({ resource: 'reports', dataProviderName: 'reporting', meta: { tenant: 'dux' } })
      return null
    }
    const root = createRoot(document.createElement('div'))

    await act(async () => {
      root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>)
    })
    await expect.poll(() => getList).toHaveBeenCalled()
    expect(getList).toHaveBeenCalledWith(expect.objectContaining({ resource: 'reports', meta: { tenant: 'dux' } }))
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey.slice(0, 3)).toEqual(['lumi', 'reporting', 'reports'])
    await act(async () => root.unmount())
  })

  it('publishes aggregate data only for the current list filter snapshot', async () => {
    let resolveAggregate!: (value: { data: Record<string, number | string | readonly number[]> }) => void
    const getList = vi.fn(async ({ filters }: { filters?: Array<{ value: unknown }> }) => ({ data: [], total: filters?.[0]?.value === 'active' ? 7 : 3 }))
    const custom = vi.fn(() => new Promise<{ data: Record<string, number | string | readonly number[]> }>((resolve) => {
      resolveAggregate = resolve
    }))
    const dataProvider = {
      getList,
      custom,
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    } satisfies DataProvider
    const context = createLumi({ dataProvider })
    const queryClient = new QueryClient({ defaultOptions: { queries: { placeholderData: previous => previous, retry: false } } })
    let table!: ReturnType<typeof useTable>
    let setStatus!: (value: string) => void
    function Probe(): null {
      const [status, updateStatus] = useState('draft')
      setStatus = updateStatus
      table = useTable({ resource: 'products', filters: [{ field: 'status', operator: 'eq', value: status }], aggregate: { url: '/products/aggregate', totalKey: 'products' } })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>))
    await expect.poll(() => custom).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveAggregate({ data: { products: 99, active: 0, activeSeries: [0, 0] } })
      await expect.poll(() => table.aggregate).toEqual({ products: 3, active: 0, activeSeries: [0, 0] })
    })

    await act(async () => setStatus('active'))
    // The last agreed snapshot stays until the new rows and stats both land.
    expect(table.aggregate).toEqual({ products: 3, active: 0, activeSeries: [0, 0] })
    await expect.poll(() => custom).toHaveBeenCalledTimes(2)
    expect(custom).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [{ field: 'status', operator: 'eq', value: 'active' }] }))
    expect(queryClient.getQueryCache().getAll().some(query => query.queryKey.slice(0, 4).join('/') === 'lumi/default/products/aggregate')).toBe(true)
    await act(async () => {
      resolveAggregate({ data: { products: 999, active: 7, activeSeries: [3, 7] } })
      await expect.poll(() => table.aggregate).toEqual({ products: 7, active: 7, activeSeries: [3, 7] })
    })
    await act(async () => root.unmount())
  })

  it('keeps showing fresh rows when the aggregate request fails', async () => {
    let version = 1
    let aggregateFails = false
    const getList = vi.fn(async ({ pagination }: { pagination?: { page: number } | false }) => ({ data: [{ id: `v${version}-p${pagination ? pagination.page : 0}` }], total: 40 }))
    const custom = vi.fn(async () => {
      if (aggregateFails)
        throw new Error('stats down')
      return { data: { active: 2 } }
    })
    const context = createLumi({
      dataProvider: {
        getList,
        custom,
        getOne: async () => ({ data: {} }),
        create: async () => ({ data: {} }),
        update: async () => ({ data: {} }),
        deleteOne: async () => ({ data: {} }),
      },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let table!: ReturnType<typeof useTable>
    let invalidate!: ReturnType<typeof useInvalidate>
    function Probe(): null {
      table = useTable({ resource: 'products', aggregate: { url: '/products/aggregate' } })
      invalidate = useInvalidate()
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>))
    await act(async () => {
      await expect.poll(() => table.rows).toEqual([{ id: 'v1-p1' }])
    })
    expect(table.aggregate).toEqual({ active: 2 })

    // The stats endpoint starts failing: the list still follows its own data.
    version = 2
    aggregateFails = true
    await act(async () => {
      // The refresh reports the failed request; the list is what is under test.
      await invalidate({ resource: 'products' }).catch(() => {})
      await expect.poll(() => table.rows).toEqual([{ id: 'v2-p1' }])
    })
    expect(table.aggregate).toBeUndefined()
    await act(async () => {
      table.setPage(2)
      await expect.poll(() => table.rows).toEqual([{ id: 'v2-p2' }])
    })
    await act(async () => root.unmount())
  })

  it('list and aggregate must keep one snapshot during an invalidation refetch', async () => {
    let rev = 1
    let finish!: (v: { data: { revision: number } }) => void
    const context = createLumi({ dataProvider: {
      getList: async () => ({ data: [{ id: 1, revision: rev }], total: 1 }),
      custom: () => rev === 1
        ? Promise.resolve({ data: { revision: 1 } })
        : new Promise((resolve) => {
            finish = resolve
          }),
    } as never })
    const client = new QueryClient()
    let table!: ReturnType<typeof useTable>
    function Probe() {
      table = useTable({ resource: 'orders', aggregate: { url: '/orders/stats' } })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(async () => root.render(<LumiProvider context={context} queryClient={client} registry={{}}><Probe /></LumiProvider>))
      await act(async () => {
        await vi.waitFor(() => expect(table.aggregate?.revision).toBe(1))
      })
      rev = 2
      let refreshing!: Promise<void>
      await act(async () => {
        refreshing = client.invalidateQueries({ queryKey: ['lumi'] })
      })
      await act(async () => {
        await vi.waitFor(() => expect(table.query.data?.data[0].revision).toBe(2))
      })
      const shown = [table.rows[0].revision, table.aggregate?.revision]
      finish({ data: { revision: 2 } })
      await act(async () => {
        await refreshing
      })
      expect(shown[0]).toBe(shown[1])
    }
    finally {
      await act(async () => root.unmount())
      client.clear()
    }
  })

  it('scopes broad invalidation to Lumi and the selected provider', async () => {
    const dataProvider: DataProvider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    }
    const context = createLumi({ dataProvider: { default: dataProvider, reporting: dataProvider } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let invalidate!: ReturnType<typeof useInvalidate>
    function Probe(): null {
      invalidate = useInvalidate()
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>))
    queryClient.setQueryData(['foreign', 'query'], { ok: true })
    queryClient.setQueryData(['lumi', 'default', 'posts'], { ok: true })
    queryClient.setQueryData(['lumi', 'reporting', 'reports'], { ok: true })

    await act(async () => invalidate({ dataProviderName: 'reporting' }))

    expect(queryClient.getQueryState(['foreign', 'query'])?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(['lumi', 'default', 'posts'])?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(['lumi', 'reporting', 'reports'])?.isInvalidated).toBe(true)
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('invalidates the resource captured when a mutation starts', async () => {
    let resolveCreate!: (value: { data: Record<string, unknown> }) => void
    const create = vi.fn(() => new Promise<{ data: Record<string, unknown> }>((resolve) => {
      resolveCreate = resolve
    }))
    const dataProvider: DataProvider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create,
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    }
    const context = createLumi({ dataProvider })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let mutation!: ReturnType<typeof useCreate>
    let setResource!: (value: string) => void
    function Probe(): null {
      const [resource, updateResource] = useState('posts')
      setResource = updateResource
      mutation = useCreate({ resource })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>))
    queryClient.setQueryData(['lumi', 'default', 'posts'], { ok: true })
    queryClient.setQueryData(['lumi', 'default', 'comments'], { ok: true })

    const pending = mutation.mutateAsync({ title: 'First' })
    await expect.poll(() => create).toHaveBeenCalled()
    await act(async () => setResource('comments'))
    resolveCreate({ data: {} })
    await act(async () => pending)

    expect(queryClient.getQueryState(['lumi', 'default', 'posts'])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['lumi', 'default', 'comments'])?.isInvalidated).toBe(false)
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('forwards mutation-level metadata through custom requests', async () => {
    const custom = vi.fn(async () => ({ data: { ok: true } }))
    const dataProvider: DataProvider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
      custom,
    }
    const context = createLumi({ dataProvider })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let mutation!: ReturnType<typeof useCustomMutation>
    function Probe(): null {
      mutation = useCustomMutation({
        meta: { tenant: 'dux' },
        build: (id: number) => ({ url: `/approve/${id}`, method: 'POST' }),
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>))

    await act(async () => mutation.mutateAsync(7))

    expect(custom).toHaveBeenCalledWith(expect.objectContaining({ url: '/approve/7', meta: { tenant: 'dux' } }))
    await act(async () => root.unmount())
    queryClient.clear()
  })

  it('handles query authentication errors once', async () => {
    const failure = new Error('expired')
    const logout = vi.fn(async () => ({ success: true }))
    const onError = vi.fn(async () => ({ logout: true, redirectTo: '/login' }))
    const go = vi.fn()
    const dataProvider: DataProvider = {
      getList: vi.fn(async () => {
        throw failure
      }),
      getOne: vi.fn(async () => ({ data: {} })),
      create: vi.fn(async () => ({ data: {} })),
      update: vi.fn(async () => ({ data: {} })),
      deleteOne: vi.fn(async () => ({ data: {} })),
    }
    const context = createLumi({
      dataProvider,
      authProvider: { login: vi.fn(), logout, check: vi.fn(), onError },
      routerProvider: { go, back: vi.fn(), parse: vi.fn(() => ({ pathname: '/', params: {} })), getCurrentPath: vi.fn(() => '/') },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe(): null {
      useList({ resource: 'posts' })
      return null
    }
    const root = createRoot(document.createElement('div'))

    await act(async () => root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>))
    await expect.poll(() => onError).toHaveBeenCalledTimes(1)
    expect(logout).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledWith({ to: '/login', replace: true })
    await act(async () => root.unmount())
  })

  it('refreshes resource queries after delete without refetching the deleted record', async () => {
    const getList = vi.fn(async () => ({ data: [{ id: 1 }], total: 1 }))
    const getOne = vi.fn(async () => ({ data: { id: 1 } }))
    const deleteOne = vi.fn(async () => ({ data: { id: 1 } }))
    const onSuccess = vi.fn()
    const dataProvider: DataProvider = {
      getList,
      getOne,
      create: vi.fn(async () => ({ data: {} })),
      update: vi.fn(async () => ({ data: {} })),
      deleteOne,
    }
    let remove!: ReturnType<typeof useDelete>
    function Probe(): null {
      useList({ resource: 'posts' })
      useOne({ resource: 'posts', id: 1 })
      remove = useDelete({ resource: 'posts', onSuccess })
      return null
    }
    const context = createLumi({ dataProvider })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const root = createRoot(document.createElement('div'))

    await act(async () => {
      root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>)
    })
    await expect.poll(() => getList).toHaveBeenCalledTimes(1)
    await expect.poll(() => getOne).toHaveBeenCalledTimes(1)
    await act(async () => {
      await remove.mutateAsync({ id: 1 })
    })
    await expect.poll(() => getList).toHaveBeenCalledTimes(2)
    expect(getOne).toHaveBeenCalledTimes(1)
    expect(deleteOne).toHaveBeenCalledWith(expect.objectContaining({ resource: 'posts', id: 1 }))
    expect(onSuccess).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })
})

it('changed filters must return useTable to page one', async () => {
  const context = createLumi({ dataProvider: { getList: async () => ({ data: [], total: 100 }) } as never })
  const client = new QueryClient()
  let table!: ReturnType<typeof useTable>
  function Probe({ status }: { status: string }) {
    table = useTable({ resource: 'orders', filters: [{ field: 'status', operator: 'eq', value: status }] })
    return null
  }
  const root = createRoot(document.createElement('div'))
  const render = (status: string) => root.render(<LumiProvider context={context} queryClient={client} registry={{}}><Probe status={status} /></LumiProvider>)
  try {
    await act(async () => render('all'))
    await act(async () => table.setPage(3))
    await act(async () => render('active'))
    expect(table.page).toBe(1)
  }
  finally {
    await act(async () => root.unmount())
    client.clear()
  }
})

it('does not start an import when the tenant changes while choosing the file', async () => {
  const tenantProvider = createTenantProvider({ initial: 'A' })
  const create = vi.fn()
  const context = createLumi({ tenantProvider, dataProvider: { getList: vi.fn(), getOne: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), create } })
  let choose!: (file: { name: string, content: string }) => void
  const pick = () => new Promise<{ name: string, content: string }>((resolve) => {
    choose = resolve
  })
  let importer!: ReturnType<typeof useImport>
  function Probe() {
    importer = useImport({ resource: 'orders', pick })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(async () => root.render(<LumiProvider context={context} registry={{}}><Probe /></LumiProvider>))
    const pending = importer.trigger()
    const refused = expect(pending).rejects.toThrow('session changed')
    await act(async () => tenantProvider.set('B'))
    choose({ name: 'rows.json', content: '[{"name":"A-only"}]' })
    await refused
    expect(create).not.toHaveBeenCalled()
  }
  finally {
    await act(async () => root.unmount())
  }
})
