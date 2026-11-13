// @vitest-environment jsdom
/* eslint-disable no-template-curly-in-string -- $template expressions in page JSON. */
import type { DataProvider, LumiJsonLoader } from '@duxweb/lumi'
import type { Spec } from '@json-render/core'
import type { PropsWithChildren } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import { createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdmin, MAX_INCLUDE_DEPTH } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dataProvider = {
  async getList() { return { data: [], total: 0 } },
  async getOne() { return { data: {} } },
  async create() { return { data: {} } },
  async update() { return { data: {} } },
  async deleteOne() { return { data: {} } },
} as unknown as DataProvider

type Elements = Record<string, Record<string, unknown>>
function spec(elements: Elements, state?: Record<string, unknown>): Spec {
  return { root: 'page', elements: { page: { type: 'Stack', props: {}, children: Object.keys(elements) }, ...elements }, ...(state ? { state } : {}) } as unknown as Spec
}
const text = (value: string | Record<string, unknown>) => ({ type: 'Text', props: { text: value }, children: [] })
const include = (src: string, params?: Record<string, unknown>) => ({ type: 'Include', props: { src, ...(params ? { params } : {}) }, children: [] })

const deep = Object.fromEntries(Array.from({ length: MAX_INCLUDE_DEPTH + 2 }, (_, level) => [`deep-${level}.json`, spec({ label: text(`Level ${level}`), next: include(`deep-${level + 1}.json`) })]))
const pages: Record<string, Spec> = {
  'card.json': spec({
    title: text({ $template: 'Card ${/include/params/id}' }),
    own: text({ $template: 'Card state ${/x}' }),
    inner: include('inner.json'),
  }, { x: 'inner' }),
  'inner.json': spec({ label: text('Inner block') }),
  'worded.json': { ...spec({ label: text({ $t: 'label' }) }), translations: { 'en-US': { label: 'Included wording' } } } as unknown as Spec,
  'loop-a.json': spec({ label: text('Loop A'), next: include('loop-b.json') }),
  'loop-b.json': spec({ label: text('Loop B'), next: include('loop-a.json') }),
  ...deep,
}

const routes: AdminManifest['routes'] = [
  {
    path: '/',
    page: {
      spec: spec({
        outer: text({ $template: 'Outer state ${/x}' }),
        first: include('card.json', { id: { $state: '/selected' } }),
        second: include('card.json', { id: 9 }),
        next: { type: 'Button', props: { label: 'Next card' }, on: { press: { action: 'setState', params: { statePath: '/selected', value: 2 } } }, children: [] },
      }, { x: 'outer', selected: 1 }),
    },
  },
  { path: '/loop', page: { spec: spec({ start: include('loop-a.json') }) } },
  { path: '/deep', page: { spec: spec({ start: include('deep-0.json') }) } },
  { path: '/worded', page: { spec: { ...spec({ label: text({ $t: 'label' }), inner: include('worded.json') }), translations: { 'en-US': { label: 'Outer wording' } } } as unknown as Spec } },
]

const mounted: Array<() => void> = []
afterEach(() => {
  mounted.splice(0).forEach(stop => stop())
})

async function render(entry: string) {
  const requested: string[] = []
  const specLoader: LumiJsonLoader<Spec> = {
    load: async (input) => {
      if (typeof input !== 'string')
        return input
      requested.push(input)
      const found = pages[input]
      if (!found)
        throw new Error(`no page ${input}`)
      return found
    },
    invalidate: () => {},
    peek: () => undefined,
  }
  const admin = createAdmin({
    context: createLumi({ dataProvider }),
    manifest: { app: { id: 'include', title: 'Include' }, routes },
    specLoader,
    shell: ({ children }: PropsWithChildren) => <main>{children}</main>,
    createRouter: list => createMemoryRouter(list, { initialEntries: [entry] }),
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
  return { requested }
}

const shows = (value: string) => vi.waitFor(() => expect(document.body.textContent).toContain(value))

describe('include', () => {
  it('shows another page with its params, nested includes and its own state', async () => {
    await render('/')
    await shows('Card 1')
    await shows('Card 9')
    await shows('Inner block')
    // Each page keeps its own /x.
    await shows('Outer state outer')
    await shows('Card state inner')
  })

  it('requests only the pages it shows, the shared one by its src alone', async () => {
    const { requested } = await render('/')
    await shows('Card 9')
    await shows('Inner block')
    expect(new Set(requested)).toEqual(new Set(['card.json', 'inner.json']))
  })

  it('starts the included page afresh when a bound param changes', async () => {
    await render('/')
    await shows('Card 1')
    const button = [...document.body.querySelectorAll('button')].find(node => node.textContent === 'Next card')!
    await act(async () => button.click())
    await shows('Card 2')
    expect(document.body.textContent).not.toContain('Card 1')
  })

  it('stops a page that includes itself further down', async () => {
    await render('/loop')
    await shows('Loop B')
    await shows('Include loop: loop-a.json → loop-b.json → loop-a.json')
    expect(document.body.textContent?.match(/Loop A/g)).toHaveLength(1)
  })

  it('gives each page its own translations, which the other cannot see', async () => {
    await render('/worded')
    await shows('Included wording')
    expect(Array.from(document.body.querySelectorAll('p'), node => node.textContent)).toEqual(['Outer wording', 'Included wording'])
  })

  it(`stops nesting past ${MAX_INCLUDE_DEPTH}`, async () => {
    await render('/deep')
    await shows(`Level ${MAX_INCLUDE_DEPTH - 1}`)
    await shows(`Includes nest deeper than ${MAX_INCLUDE_DEPTH}`)
    expect(document.body.textContent).not.toContain(`Level ${MAX_INCLUDE_DEPTH}`)
  })
})
