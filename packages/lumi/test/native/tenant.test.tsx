// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import { createHttpClient, createLumi, createSimpleDataProvider, createTenantProvider } from '@duxweb/lumi'
import { QueryClient } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiProvider, useList, useTenant } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const options = [{ value: 'north', label: 'North store' }, { value: 'south', label: 'South store' }]

describe('tenant', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('keeps a known tenant, ignores unknown ones and stays usable without storage', () => {
    const store = new Map<string, string>([['t', 'gone']])
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) })
    const provider = createTenantProvider({ options, storageKey: 't' })
    // A stored tenant no longer offered falls back to the first option.
    expect(provider.get()).toBe('north')
    const listener = vi.fn()
    provider.subscribe(listener)
    provider.set('nowhere')
    provider.set('north')
    expect(listener).not.toHaveBeenCalled()
    provider.set('south')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.get('t')).toBe('south')
    expect(createTenantProvider({ options, storageKey: 't' }).get()).toBe('south')

    const blockedStorage = (): never => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blockedStorage, setItem: blockedStorage })
    const blocked = createTenantProvider({ storageKey: 't', initial: 'east' })
    expect(blocked.get()).toBe('east')
    blocked.set('west')
    expect(blocked.get()).toBe('west')
  })

  it('sends the tenant as a header, unless the call names its own', async () => {
    const sent: Record<string, string>[] = []
    let tenant: string | undefined = 'north'
    const provider = createSimpleDataProvider({
      apiUrl: 'https://api.test',
      http: createHttpClient({
        getTenant: () => tenant,
        fetcher: (async (_url: string, init: RequestInit) => {
          sent.push(init.headers as Record<string, string>)
          return new Response('{"data":{}}', { status: 200 })
        }) as typeof fetch,
      }),
    })
    await provider.getOne({ resource: 'orders', id: 1 })
    tenant = undefined
    await provider.getOne({ resource: 'orders', id: 1 })
    tenant = 'south'
    await provider.custom!({ url: 'ping', headers: { 'x-tenant': 'other' } })
    expect(sent.map(headers => headers['X-Tenant'] ?? headers['x-tenant'])).toEqual(['north', undefined, 'other'])
  })

  it('drops the cache and fetches again for the new tenant', async () => {
    const tenantProvider = createTenantProvider({ options })
    const getList = vi.fn(async () => ({ data: [{ id: 1, tenant: tenantProvider.get() }], total: 1 }))
    const context = createLumi({ dataProvider: { getList } as unknown as DataProvider, tenantProvider })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const seen: unknown[] = []
    let switchTo!: (value: string) => void

    function Probe(): null {
      const list = useList<{ id: number, tenant: string }>({ resource: 'orders' })
      const { tenant, current, setTenant } = useTenant()
      switchTo = setTenant
      seen.push([tenant, current?.label, list.data?.data[0]?.tenant])
      return null
    }

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const until = (expected: unknown[]): Promise<void> => act(async () => {
      await vi.waitFor(() => expect(seen.at(-1)).toEqual(expected))
    })
    await act(async () => root.render(<LumiProvider context={context} queryClient={client} registry={{}}><Probe /></LumiProvider>))
    await until(['north', 'North store', 'north'])
    // A second, unmounted query of the old tenant must not survive either.
    client.setQueryData(['lumi', 'default', 'customers', 'list', {}], { data: [], total: 0 })
    await act(async () => switchTo('south'))
    await until(['south', 'South store', 'south'])
    expect(getList).toHaveBeenCalledTimes(2)
    expect(client.getQueryData(['lumi', 'default', 'customers', 'list', {}])).toBeUndefined()
    // The old tenant's rows never show under the new one.
    expect(seen).not.toContainEqual(['south', 'South store', 'north'])
    await act(async () => root.unmount())
  })

  it('does not keep the old tenant\'s rows while another page of the list loads for the new one', async () => {
    const tenants = createTenantProvider({ options, initial: 'north' })
    const pending: Array<() => void> = []
    const getList = vi.fn(({ pagination }: { pagination: { page: number } }) => {
      const tenant = tenants.get()
      const answer = { data: [{ id: pagination.page, tenant }], total: 40 }
      // The first page answers at once; later ones wait for the test.
      return pagination.page === 1 && tenant === 'north'
        ? Promise.resolve(answer)
        : new Promise<typeof answer>(resolve => pending.push(() => resolve(answer)))
    })
    const context = createLumi({ dataProvider: { getList } as unknown as DataProvider, tenantProvider: tenants })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const seen: string[] = []
    let setPage!: (page: number) => void
    function Probe(): null {
      const [page, update] = useState(1)
      setPage = update
      const list = useList<{ id: number, tenant: string }>({ resource: 'orders', pagination: { page, pageSize: 20 } })
      const { tenant } = useTenant()
      seen.push(`${tenant}:${list.data?.data[0]?.tenant ?? '-'}`)
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} queryClient={client} registry={{}}><Probe /></LumiProvider>))
    await act(async () => {
      await vi.waitFor(() => expect(seen.at(-1)).toBe('north:north'))
    })
    // Page 2 is loading (page 1's rows stay on screen) when the tenant changes.
    await act(async () => setPage(2))
    expect(seen.at(-1)).toBe('north:north')
    await act(async () => tenants.set('south'))
    expect(seen).not.toContain('south:north')
    await act(async () => {
      pending.splice(0).forEach(answer => answer())
      await vi.waitFor(() => expect(seen.at(-1)).toBe('south:south'))
    })
    expect(seen).not.toContain('south:north')
    await act(async () => root.unmount())
  })
})
