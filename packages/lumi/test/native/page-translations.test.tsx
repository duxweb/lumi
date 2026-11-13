// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ComponentRegistry } from '@json-render/react'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createI18nProvider, createLumi, lumiActionDefinitions, validateDocument, withPageTranslations } from '../../src/index.js'
import { LumiSpecPage } from '../../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const catalog = defineCatalog(schema, {
  components: {
    Stack: { props: z.object({}), slots: ['default'], description: 'Stack' },
    Text: { props: z.object({ text: z.string() }), description: 'Text' },
  },
  actions: {},
})
const registry: ComponentRegistry = {
  Stack: ({ children }) => <div>{children}</div>,
  Text: ({ element }) => <p>{String((element.props as { text: unknown }).text)}</p>,
}

const shared = {
  'zh-CN': { 'common.save': '保存', 'orders.title': '全局订单' },
  'en-US': { 'common.save': 'Save', 'orders.only': 'Only in English' },
}

function page(translations?: unknown): Spec {
  const t = (key: string, extra: Record<string, unknown> = {}) => ({ type: 'Text', props: { text: { $t: key, ...extra } }, children: [] })
  return {
    root: 'page',
    ...(translations ? { translations } : {}),
    elements: {
      page: { type: 'Stack', props: {}, children: ['title', 'total', 'save', 'only', 'missing'] },
      title: t('orders.title'),
      total: t('orders.total', { params: { count: 3 } }),
      save: t('common.save'),
      only: t('orders.only'),
      missing: t('orders.missing', { default: 'Fallback text' }),
    },
  } as unknown as Spec
}

const ordersPage = page({
  'zh-CN': { orders: { title: '订单', total: '共 {count} 单' } },
  'en-US': { 'orders.title': 'Orders', 'orders.only': 'Page English' },
})

const roots: Array<() => void> = []
afterEach(() => {
  roots.splice(0).forEach(stop => stop())
})

async function render(spec: Spec, i18nProvider = createI18nProvider({ locale: 'zh-CN', fallbackLocale: 'en-US', translations: shared })) {
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(<LumiSpecPage context={createLumi({ i18nProvider })} catalog={catalog} registry={registry} spec={spec} agent={false} />))
  roots.push(() => act(() => root.unmount()))
  return { lines: () => Array.from(host.querySelectorAll('p'), node => node.textContent), i18nProvider }
}

describe('a page\'s own translations', () => {
  it('win over the shared ones on this page, then shared, then the page\'s fallback locale, then the default', async () => {
    const { lines } = await render(ordersPage)
    expect(lines()).toEqual(['订单', '共 3 单', '保存', 'Only in English', 'Fallback text'])
  })

  it('follow a locale switch without reloading the page', async () => {
    const { lines, i18nProvider } = await render(ordersPage)
    await act(async () => i18nProvider.changeLocale('en-US'))
    expect(lines()).toEqual(['Orders', 'orders.total', 'Save', 'Page English', 'Fallback text'])
  })

  it('stay on their page: another page sees only the shared ones', async () => {
    const i18nProvider = createI18nProvider({ locale: 'zh-CN', fallbackLocale: 'en-US', translations: shared })
    await render(ordersPage, i18nProvider)
    const { lines } = await render(page(), i18nProvider)
    expect(lines()).toEqual(['全局订单', 'orders.total', '保存', 'Only in English', 'Fallback text'])
  })

  it('leave every other part of the provider alone', () => {
    const base = createI18nProvider({ locale: 'zh-CN', fallbackLocale: 'en-US' })
    const scoped = withPageTranslations(base, { 'zh-CN': { a: 'A' } })
    expect(scoped.getLocale()).toBe('zh-CN')
    expect(scoped.getFallbackLocale?.()).toBe('en-US')
    expect(scoped.formatNumber?.(1200)).toBe(base.formatNumber?.(1200))
    expect(scoped.translate('a')).toBe('A')
  })
})

describe('a page reloaded with its own translations', () => {
  it('keeps its actions working when the reload brings new translations', async () => {
    const actionCatalog = defineCatalog(schema, {
      components: {
        Stack: { props: z.object({}), slots: ['default'], description: 'Stack' },
        Text: { props: z.object({ text: z.string() }), description: 'Text' },
        Trigger: { props: z.object({}), events: ['press'], description: 'Trigger' },
      },
      actions: lumiActionDefinitions,
    })
    const actionRegistry: ComponentRegistry = {
      ...registry,
      Trigger: ({ emit }) => <button type="button" onClick={() => emit('press')}>Run</button>,
    }
    const document = (title: string): Spec => ({
      root: 'page',
      translations: { 'zh-CN': { 'orders.title': title } },
      elements: {
        page: { type: 'Stack', props: {}, children: ['title', 'run', 'result'] },
        title: { type: 'Text', props: { text: { $t: 'orders.title' } }, children: [] },
        run: { type: 'Trigger', props: {}, children: [], on: { press: { action: 'request', params: { url: '/ping', resultPath: '/result' } } } },
        result: { type: 'Text', props: { text: { $state: '/result/data/count' } }, children: [] },
      },
    } as unknown as Spec)
    let calls = 0
    const dataProvider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
      custom: async () => ({ data: { count: `calls ${++calls}` } }),
    }
    const context = createLumi({ dataProvider, i18nProvider: createI18nProvider({ locale: 'zh-CN', fallbackLocale: 'en-US', translations: shared }) })
    // A server that answers 200 on reload: a fresh document each time.
    const titles = ['订单', '订单（新）']
    let loads = 0
    const loader = { load: async () => document(titles[Math.min(loads++, 1)]!), invalidate: () => {}, peek: () => undefined }
    const host = window.document.createElement('div')
    const root = createRoot(host)
    const show = (reloadKey: number) => act(async () => root.render(
      <LumiSpecPage context={context} catalog={actionCatalog} registry={actionRegistry} src="/orders.json" loader={loader} reloadKey={reloadKey} agent={false} />,
    ))
    roots.push(() => act(() => root.unmount()))
    const lines = () => Array.from(host.querySelectorAll('p'), node => node.textContent)
    const press = () => act(async () => host.querySelector('button')!.click())

    await show(0)
    await press()
    expect(lines()).toEqual(['订单', 'calls 1'])

    await show(1)
    expect(lines()[0]).toBe('订单（新）')
    await press()
    expect(lines()).toEqual(['订单（新）', 'calls 2'])
  })
})

describe('translations in a Spec', () => {
  it('are checked: locales of keys to text, flat or nested', () => {
    expect(validateDocument(ordersPage, catalog)).toEqual({ valid: true, issues: [] })
    expect(validateDocument(page({ 'zh-CN': { a: 1 } }), catalog).valid).toBe(false)
    expect(validateDocument(page({ 'zh-CN': 'locales/zh-CN.json' }), catalog).valid).toBe(false)
    expect(validateDocument({ ...ordersPage, extra: {} }, catalog).valid).toBe(false)
  })
})
