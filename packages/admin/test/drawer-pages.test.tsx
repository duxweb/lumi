// @vitest-environment jsdom
/* eslint-disable no-template-curly-in-string -- $template expressions in page JSON. */
import type { DataProvider, LumiJsonLoader } from '@duxweb/lumi'
import type { Spec } from '@json-render/core'
import type { ComponentRegistry } from '@json-render/react'
import type { PropsWithChildren, ReactElement } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import type { AdminRoutedDrawerRegistry } from '../src/react/index.js'
import { createLumi } from '@duxweb/lumi'
import { act, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdmin, isDrawerPageSource, readDrawerLayers, useAdminDrawer, useAdminDrawerChrome, writeDrawerLayers } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dataProvider = {
  async getList() { return { data: [], total: 0 } },
  async getOne() { return { data: {} } },
  async create() { return { data: {} } },
  async update() { return { data: {} } },
  async deleteOne() { return { data: {} } },
} as unknown as DataProvider

vi.mock('@duxweb/lumi-ui', async (original) => {
  const actual = await original<typeof import('@duxweb/lumi-ui')>()
  // Plain overlays: Radix portals and animations are not what these tests check.
  const overlay = (role: string) => (props: PropsWithChildren<{ open?: boolean, title?: string, onOpenChange?: (open: boolean) => void }>) => props.open
    ? (
        <div role="dialog" data-kind={role} aria-label={props.title}>
          {props.children}
          <button type="button" onClick={() => props.onOpenChange?.(false)}>{`Close ${props.title}`}</button>
        </div>
      )
    : null
  return { ...actual, LumiDrawer: overlay('drawer'), LumiDialog: overlay('modal') }
})

const registry: ComponentRegistry = {
  Text: ({ element }) => <p>{String((element.props as { text?: unknown }).text)}</p>,
  Button: ({ element, emit }) => <button type="button" onClick={() => emit('press')}>{String((element.props as { label?: unknown }).label)}</button>,
  Stack: ({ children }) => <div>{children}</div>,
}

const button = (label: string, on: Record<string, unknown>) => ({ type: 'Button', props: { label }, on: { press: on }, children: [] })

/** A page whose button opens the shared editor with this page's record. */
function listPage(name: string, id: number): Spec {
  return {
    root: 'page',
    elements: {
      page: { type: 'Stack', props: {}, children: ['open'] },
      open: button(`Edit from ${name}`, { action: 'openDrawer', params: { src: '/pages/article-edit.json', id, title: 'Edit article', params: { from: name } } }),
    },
  } as unknown as Spec
}

const pages: Record<string, Spec> = {
  '/pages/article-edit.json': {
    root: 'page',
    elements: {
      page: { type: 'Stack', props: {}, children: ['record', 'from', 'author', 'close'] },
      record: { type: 'Text', props: { text: { $template: 'Article ${/drawer/id}' } }, children: [] },
      from: { type: 'Text', props: { text: { $template: 'Opened from ${/drawer/params/from}' } }, children: [] },
      author: button('Author', { action: 'openDrawer', params: { src: '/pages/author.json', id: 'ada', mode: 'modal', title: 'Author' } }),
      close: button('Done', { action: 'closeDrawer', params: {} }),
    },
  } as unknown as Spec,
  '/pages/author.json': {
    root: 'page',
    elements: { page: { type: 'Text', props: { text: { $template: 'Author ${/drawer/id}' } }, children: [] } },
  } as unknown as Spec,
}

function setup(initialEntry: string, drawers?: AdminRoutedDrawerRegistry) {
  const requested: string[] = []
  const specLoader: LumiJsonLoader<Spec> = {
    load: async (input) => {
      if (typeof input !== 'string')
        return input
      requested.push(input)
      const spec = pages[input]
      if (!spec)
        throw new Error(`no page ${input}`)
      return spec
    },
    invalidate: () => {},
    peek: () => undefined,
  }
  const manifest: AdminManifest = {
    app: { id: 'drawer-pages', title: 'Drawer pages' },
    routes: [
      { name: 'a', path: '/a', page: { spec: listPage('A', 12) } },
      { name: 'b', path: '/b', page: { spec: listPage('B', 34) } },
    ],
  }
  const admin = createAdmin({
    context: createLumi({ dataProvider }),
    registry,
    manifest,
    specLoader,
    drawers,
    shell: ({ children }: PropsWithChildren) => <main>{children}</main>,
    createRouter: routes => createMemoryRouter(routes, { initialEntries: [initialEntry] }),
  })
  return { admin, requested }
}

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
})

async function render(initialEntry: string, drawers?: AdminRoutedDrawerRegistry) {
  const { admin, requested } = setup(initialEntry, drawers)
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
  const path = () => decodeURIComponent(admin.context.routerProvider?.getCurrentPath() ?? '')
  return { admin, requested, path }
}

async function press(label: string): Promise<void> {
  const target = await vi.waitFor(() => {
    const found = [...document.body.querySelectorAll('button')].find(node => node.textContent === label)
    if (!found)
      throw new Error(`no button ${label}`)
    return found
  })
  await act(async () => target.click())
}

const text = (value: string) => vi.waitFor(() => expect(document.body.textContent).toContain(value))

describe('drawers that show a JSON page', () => {
  it('opens one shared page from two pages, each with its own record, and loads the document by its address alone', async () => {
    const { admin, requested, path } = await render('/a')
    await press('Edit from A')
    await text('Article 12')
    await text('Opened from A')
    const query = new URL(path(), 'https://x.test').searchParams
    expect(Object.fromEntries(query)).toEqual({ drawer: '/pages/article-edit.json', record: '12', drawerParams: '{"from":"A"}', drawerTitle: 'Edit article' })
    expect(document.querySelector('[data-kind="drawer"]')?.getAttribute('aria-label')).toBe('Edit article')
    await press('Done')
    await vi.waitFor(() => expect(path()).toBe('/a'))

    await act(async () => {
      await admin.getRouter()!.navigate('/b')
    })
    await press('Edit from B')
    await text('Article 34')
    await text('Opened from B')
    expect(requested.every(url => url === '/pages/article-edit.json')).toBe(true)
  })

  it('opens a layer on top from inside a drawer, as a modal, and closes only that layer', async () => {
    const { path } = await render('/a')
    await press('Edit from A')
    await press('Author')
    await text('Author ada')
    expect(document.querySelector('[data-kind="modal"]')?.getAttribute('aria-label')).toBe('Author')
    expect(readDrawerLayers(new URL(path(), 'https://x.test').search).map(layer => layer.target)).toEqual(['/pages/article-edit.json', '/pages/author.json'])
    await press('Close Author')
    await vi.waitFor(() => expect(document.querySelector('[data-kind="modal"]')).toBeNull())
    expect(document.body.textContent).toContain('Article 12')
  })

  it('reopens every layer from a shared address', async () => {
    const shared = `/b?${writeDrawerLayers('', [
      { target: '/pages/article-edit.json', id: 5, params: { from: 'link' } },
      { target: '/pages/author.json', id: 'grace', mode: 'modal' },
    ]).toString()}`
    await render(shared)
    await text('Article 5')
    await text('Opened from link')
    await text('Author grace')
  })

  it('refuses an address on another site from the location bar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { path } = await render(`/a?drawer=${encodeURIComponent('https://evil.test/page.json')}`)
    await vi.waitFor(() => expect(path()).toBe('/a'))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ignoring unknown routed drawer'))
    warn.mockRestore()
  })
})

describe('registered drawers', () => {
  it('keep one controller across renders, so closing after a save runs once', async () => {
    let effects = 0
    function Counter(): ReactElement {
      const drawer = useAdminDrawer()
      const [count, setCount] = useState(0)
      // Each chrome change re-renders the drawer host.
      useAdminDrawerChrome({ revision: String(count), title: `Counter ${count}` })
      useEffect(() => {
        effects++
      }, [drawer])
      return <button type="button" onClick={() => setCount(count + 1)}>{`Rendered ${count}`}</button>
    }
    await render('/a?drawer=counter', { counter: { title: 'Counter', component: Counter } })
    await press('Rendered 0')
    await press('Rendered 1')
    await text('Rendered 2')
    expect(effects).toBe(1)
  })
})

describe('drawer page addresses', () => {
  it('accepts site and manifest-relative JSON paths only', () => {
    expect(isDrawerPageSource('/pages/a.json')).toBe(true)
    expect(isDrawerPageSource('pages/a.json')).toBe(true)
    expect(isDrawerPageSource('./a')).toBe(true)
    expect(isDrawerPageSource('https://evil.test/a.json')).toBe(false)
    expect(isDrawerPageSource('//evil.test/a.json')).toBe(false)
    expect(isDrawerPageSource('javascript:alert(1)')).toBe(false)
    expect(isDrawerPageSource('edit-customer')).toBe(false)
  })

  it('refuses an address a URL parser would read as another site', () => {
    // The parser trims edge spaces and drops tabs and newlines anywhere.
    for (const target of [' https://evil.test/a.json', '/\t/evil.test/a.json', '\n//evil.test/a.json', ' //evil.test/a.json', '/pages/a.json ', '/pa\u0000ges/a.json']) {
      expect(isDrawerPageSource(target), JSON.stringify(target)).toBe(false)
      if (target.trim() !== '/pages/a.json' && !target.includes('\u0000'))
        expect(new URL(target, 'https://app.test/admin').origin).toBe('https://evil.test')
    }
  })

  it('round-trips layers through the query, keeping unrelated keys', () => {
    const layers = [{ target: 'edit', id: 7 }, { target: '/pages/b.json', params: { a: 1 }, mode: 'modal' as const, size: 'lg' as const, title: 'B' }]
    const query = writeDrawerLayers('?tab=2', layers)
    expect(query.get('tab')).toBe('2')
    expect(readDrawerLayers(`?${query.toString()}`)).toEqual([{ target: 'edit', id: '7' }, { target: '/pages/b.json', params: { a: 1 }, mode: 'modal', size: 'lg', title: 'B' }])
  })
})
