// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { ComponentRegistry } from '@json-render/react'
import type { AdminManifest } from '../src/catalog.js'
import { createLumi, useList } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { adminManifestSchema } from '../src/config'
import { createAdmin } from '../src/react/index.js'

;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function named(name: string): DataProvider {
  return ({
    getList: async () => ({ data: [{ id: 1, name }], total: 1 }),
    getOne: async () => ({ data: {} }),
    create: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
    deleteOne: async () => ({ data: {} }),
  }) as unknown as DataProvider
}

function Source({ explicit }: { explicit?: string }): string {
  const list = useList<{ name: string }>({ resource: 'shops', ...(explicit ? { dataProviderName: explicit } : {}) })
  return list.data?.data[0]?.name ?? ''
}

const registry: ComponentRegistry = {
  // Badge stands in for a page element; its label names the provider, or `-` for none.
  Badge: ({ element }) => {
    const label = (element.props as { label?: string }).label
    return <span data-testid="probe">{Source(label && label !== '-' ? { explicit: label } : {})}</span>
  },
}

const page = (explicit = '-') => ({ spec: { root: 'p', elements: { p: { type: 'Badge', props: { label: explicit }, children: [] } } } })

describe('route data provider', () => {
  it('lets a route group pick the provider its pages use, an explicit name still winning', async () => {
    const manifest: AdminManifest = adminManifestSchema.parse({
      app: { id: 'scoped', title: 'Scoped' },
      routes: [
        { name: 'home', path: '/', page: page() },
        { name: 'merchant', path: '/merchant', dataProvider: 'merchant', children: [
          { name: 'shops', path: 'shops', page: page() },
          { name: 'main-shops', path: 'main', page: page('default') },
        ] },
      ],
    })
    const read = async (path: string): Promise<string> => {
      const admin = createAdmin({
        context: createLumi({ dataProvider: { default: named('main'), merchant: named('merchant') } }),
        registry,
        manifest,
        createRouter: routes => createMemoryRouter(routes, { initialEntries: [path] }),
      })
      await admin.ready()
      const container = document.createElement('div')
      const root = createRoot(container)
      await act(async () => root.render(<admin.App />))
      await act(async () => new Promise(resolve => setTimeout(resolve, 20)))
      const text = container.querySelector('[data-testid="probe"]')?.textContent ?? ''
      await act(async () => root.unmount())
      admin.dispose()
      return text
    }
    expect(await read('/')).toBe('main')
    expect(await read('/merchant/shops')).toBe('merchant')
    expect(await read('/merchant/main')).toBe('main')
  })
})
