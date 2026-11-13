// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { adminRegistry } from '@duxweb/lumi-admin'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { LumiBarChart } from '../src/react/pages/LumiBarChart.js'
import { funnelWidths, LumiFunnelChart } from '../src/react/pages/LumiFunnelChart.js'
import { LumiProportionList } from '../src/react/pages/LumiProportionList.js';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

async function render(children: ReactNode): Promise<{ container: HTMLElement, cleanup: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(children))
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

const WEEK = [
  { key: 'mon', label: 'Mon', value: 148 },
  { key: 'tue', label: 'Tue', value: 162 },
  { key: 'fri', label: 'Fri', value: 189 },
  { key: 'sun', label: 'Sun', value: 0 },
]

const texts = (container: HTMLElement, selector: string): string[] => Array.from(container.querySelectorAll(selector), node => node.textContent ?? '')

describe('column chart', () => {
  it('emphasises the peak on a rounded scale and keeps every reading in the DOM', async () => {
    const view = await render(<LumiBarChart ariaLabel="Orders per weekday" points={WEEK} showValues />)
    expect(texts(view.container, '.lumi-bar-chart__y span')).toEqual(['200', '150', '100', '50', '0'])
    expect(view.container.querySelectorAll('.lumi-bar-chart__grid i')).toHaveLength(5)
    const columns = Array.from(view.container.querySelectorAll<HTMLElement>('[role="listitem"]'))
    expect(columns.map(column => column.hasAttribute('data-emphasis'))).toEqual([false, false, true, false])
    expect(columns.map(column => column.querySelector<HTMLElement>('.lumi-bar-chart__bar')!.style.height)).toEqual(['74%', '81%', '94.5%', '0%'])
    expect(texts(view.container, '.lumi-bar-chart__value')).toEqual(['148', '162', '189', '0'])
    expect(texts(view.container, '[role="listitem"] .sr-only')).toEqual(['Mon: 148', 'Tue: 162', 'Fri: 189', 'Sun: 0'])
    expect(view.container.querySelector('[role="list"]')?.getAttribute('aria-label')).toBe('Orders per weekday')
    await view.cleanup()
  })

  it('emphasises a chosen key, every column, or a toned point', async () => {
    const view = await render(
      <>
        <LumiBarChart ariaLabel="Today" points={WEEK} highlight="tue" axis={false} formatTick={value => `$${value}`} />
        <LumiBarChart ariaLabel="All" points={WEEK} highlight="none" />
        <LumiBarChart ariaLabel="Flagged" points={[...WEEK.slice(0, 3), { key: 'sun', label: 'Sun', value: 12, tone: 'danger' }]} max={400} />
      </>,
    )
    const [today, all, flagged] = Array.from(view.container.querySelectorAll('figure'))
    expect(Array.from(today!.querySelectorAll('[role="listitem"]'), column => column.hasAttribute('data-emphasis'))).toEqual([false, true, false, false])
    expect(today!.querySelector('.lumi-bar-chart__y')).toBeNull()
    expect(all!.querySelectorAll('[role="listitem"][data-emphasis]')).toHaveLength(4)
    expect(texts(flagged!, '.lumi-bar-chart__y span')[0]).toBe('400')
    expect(Array.from(flagged!.querySelectorAll('[role="listitem"]'), column => column.hasAttribute('data-emphasis'))).toEqual([false, false, true, true])
    expect(flagged!.querySelector('[data-tone="danger"]')).not.toBeNull()
    await view.cleanup()
  })
})

describe('funnel chart', () => {
  const STAGES = [
    { key: 'visits', label: 'Visits', value: 18420 },
    { key: 'carts', label: 'Added to cart', value: 2310 },
    { key: 'paid', label: 'Paid', value: 1086, display: '1.1k' },
  ]
  const bandWidths = (container: HTMLElement): string[] => Array.from(container.querySelectorAll('.lumi-funnel-chart__band rect'), rect => Number(rect.getAttribute('width')).toFixed(1))

  it('draws centred bands joined by connectors that carry the conversion', async () => {
    const view = await render(<LumiFunnelChart ariaLabel="Conversion funnel" stages={STAGES} color={2} />)
    const figure = view.container.querySelector('figure')!
    expect(figure.getAttribute('aria-label')).toBe('Conversion funnel')
    expect(figure.style.getPropertyValue('--lumi-funnel-fill')).toBe('var(--chart-2)')
    expect(bandWidths(view.container)).toEqual(['100.0', '50.9', '42.5'])
    const rects = Array.from(view.container.querySelectorAll('.lumi-funnel-chart__band rect'))
    expect(rects.map(rect => Number(rect.getAttribute('x')) * 2 + Number(rect.getAttribute('width')))).toEqual([100, 100, 100])
    const connectors = Array.from(view.container.querySelectorAll('.lumi-funnel-chart__connector polygon'))
    expect(connectors).toHaveLength(2)
    expect(connectors[0]!.getAttribute('points')!.split(' ').map(point => point.split(',').map(Number).map(n => Number(n.toFixed(1))).join(','))).toEqual(['0,0', '100,0', '75.5,1', '24.5,1'])
    expect(texts(view.container, '.lumi-funnel-chart__rate')).toEqual(['12.5% converted', '47% converted'])
    expect(texts(view.container, '.lumi-funnel-chart__label')).toEqual(['Visits', 'Added to cart', 'Paid'])
    expect(texts(view.container, '.lumi-funnel-chart__value')).toEqual(['18,420100%', '2,31012.5%', '1.1k5.9%'])
    expect(view.container.querySelector('.lumi-funnel-chart__plot')!.getAttribute('aria-hidden')).toBe('true')
    expect(texts(view.container, 'ol.sr-only li')).toEqual([
      'Visits: 18,420 (100%)',
      'Added to cart: 2,310 (12.5%), 12.5% converted, 16,110 dropped',
      'Paid: 1.1k (5.9%), 47% converted, 1,224 dropped',
    ])
    expect(texts(view.container, '.lumi-funnel-chart__band .lumi-chart-tip')[2]).toContain('1,224 dropped')
    await view.cleanup()
  })

  it('scales linearly on request and never narrows below the minimum or widens downwards', async () => {
    const view = await render(<LumiFunnelChart ariaLabel="Linear" stages={STAGES} scale="linear" />)
    expect(bandWidths(view.container)).toEqual(['100.0', '33.5', '28.5'])
    await view.cleanup()
    expect(funnelWidths([10, 4, 9]).map(width => width.toFixed(1))).toEqual(['100.0', '72.1', '72.1'])
    expect(funnelWidths([10, 0], 'linear')).toEqual([100, 24])
  })

  it('does not divide by an empty first stage', async () => {
    const view = await render(<LumiFunnelChart ariaLabel="Empty" stages={[{ key: 'a', label: 'A', value: 0 }, { key: 'b', label: 'B', value: 0 }]} />)
    expect(bandWidths(view.container)).toEqual(['24.0', '24.0'])
    expect(texts(view.container, '.lumi-funnel-chart__rate')).toEqual(['0% converted'])
    expect(texts(view.container, 'ol.sr-only li')[1]).toBe('B: 0 (0%), 0% converted, 0 dropped')
    await view.cleanup()
  })
})

describe('ranking list', () => {
  const items = [
    { key: 'cord', label: 'Lumi Cord', value: 14500, display: '$14.5k' },
    { key: 'other', label: 'Other', value: 19600, display: '$19.6k', other: true },
    { key: 'lamp', label: 'Lumi Lamp', value: 40800, display: '$40.8k' },
    { key: 'shade', label: 'Lumi Shade', value: 31600, display: '$31.6k', tone: 'warning' as const },
  ]

  it('ranks by value with the remainder last in a neutral tone and shows each share', async () => {
    const view = await render(<LumiProportionList ariaLabel="Top products" items={items} showShare />)
    expect(texts(view.container, '.lumi-proportion-list__label')).toEqual(['Lumi Lamp', 'Lumi Shade', 'Lumi Cord', 'Other'])
    expect(texts(view.container, '.lumi-proportion-list__share')).toEqual(['38.3%', '29.7%', '13.6%', '18.4%'])
    const rows = Array.from(view.container.querySelectorAll<HTMLElement>('.lumi-proportion-list__row'))
    expect(rows.map(row => row.dataset.tone)).toEqual(['primary', 'warning', 'primary', 'neutral'])
    expect(rows[3]!.hasAttribute('data-other')).toBe(true)
    expect(rows.map(row => Number.parseFloat(row.querySelector<HTMLElement>('.lumi-proportion-list__bar')!.style.width).toFixed(1))).toEqual(['100.0', '77.5', '35.5', '48.0'])
    expect(view.container.querySelector('[data-slot="segment-bar"]')).toBeNull()
    await view.cleanup()
  })

  it('keeps the given order when asked and leaves the share column out by default', async () => {
    const view = await render(<LumiProportionList ariaLabel="As given" items={items} sort="none" />)
    expect(texts(view.container, '.lumi-proportion-list__label')).toEqual(['Lumi Cord', 'Other', 'Lumi Lamp', 'Lumi Shade'])
    expect(view.container.querySelector('.lumi-proportion-list__share')).toBeNull()
    await view.cleanup()
  })
})

describe('chart catalog', () => {
  it('registers the funnel and validates the new chart props', () => {
    expect(adminRegistry).toHaveProperty('FunnelChart')
    const { BarChart, FunnelChart, ProportionList } = adminCatalogDefinitions.components
    expect(FunnelChart.props.safeParse({ ariaLabel: 'Funnel', stages: [{ key: 'a', label: 'A', value: 10 }] }).success).toBe(true)
    expect(FunnelChart.props.safeParse({ ariaLabel: 'Funnel', stages: [{ key: 'a', label: 'A', value: '10' }] }).success).toBe(false)
    expect(FunnelChart.props.safeParse({ ariaLabel: 'Funnel', stages: [], color: 4, scale: 'linear' }).success).toBe(true)
    expect(FunnelChart.props.safeParse({ ariaLabel: 'Funnel', stages: [], color: 6 }).success).toBe(false)
    expect(BarChart.props.safeParse({ ariaLabel: 'Bars', points: [], highlight: 'fri', axis: false, max: 200 }).success).toBe(true)
    expect(ProportionList.props.safeParse({ ariaLabel: 'Rank', items: [{ key: 'o', label: 'Other', value: 1, other: true }], sort: 'desc', showShare: true }).success).toBe(true)
    expect(ProportionList.props.safeParse({ ariaLabel: 'Rank', items: [], sort: 'asc' }).success).toBe(false)
  })
})
