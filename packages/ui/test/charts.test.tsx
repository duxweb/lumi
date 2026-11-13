// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chartRegistry, LumiChart } from '../src/charts.js'

const engine = vi.hoisted(() => ({ mount: vi.fn(), release: vi.fn() }))
vi.mock('../src/charts/engine.js', () => ({ mountChart: engine.mount }))

const element = document.createElement('div')
document.body.append(element)
let root = createRoot(element)
afterEach(async () => {
  await act(async () => root.unmount())
  root = createRoot(element)
  vi.resetAllMocks()
})

describe('optional charts capability', () => {
  it('exports a composable native registry', () => {
    expect(Object.keys(chartRegistry)).toEqual(['Chart'])
  })

  it('exposes actual values in an accessible table and releases the canvas', async () => {
    engine.mount.mockReturnValue(engine.release)
    await act(async () => root.render(<LumiChart type="area" ariaLabel="Revenue" valueFormat="currency" points={[{ label: 'Monday', value: 1250 }]} />))
    expect(element.querySelector('figure')?.dataset.chartStatus).toBe('ready')
    expect(element.querySelector('caption')?.textContent).toBe('Revenue')
    expect(element.querySelector('tbody')?.textContent).toBe('Monday$1,250')
    await act(async () => root.render(null))
    expect(engine.release).toHaveBeenCalledOnce()
  })

  it('does not paint a fake donut for zero totals', async () => {
    await act(async () => root.render(<LumiChart type="donut" ariaLabel="Orders" points={[{ label: 'Paid', value: 0 }]} />))
    expect(element.querySelector('[role="status"]')?.textContent).toBe('No data for this period')
    expect(engine.mount).not.toHaveBeenCalled()
    expect(element.querySelector('tbody')?.textContent).toBe('Paid0')
  })

  it('keeps readable data when the renderer fails', async () => {
    engine.mount.mockImplementation(() => {
      throw new Error('Canvas unavailable')
    })
    await act(async () => root.render(<LumiChart type="area" ariaLabel="Orders" points={[{ label: 'Paid', value: 4 }]} />))
    expect(element.querySelector('figure')?.dataset.chartStatus).toBe('error')
    expect(element.querySelector('[role="status"]')?.textContent).toBe('Chart unavailable')
    expect(element.querySelector('tbody')?.textContent).toBe('Paid4')
  })

  it('draws bars as solid amounts against the largest reading, without the engine', async () => {
    await act(async () => root.render(<LumiChart type="bar" ariaLabel="Orders" color={3} points={[{ label: 'Web', value: 40 }, { label: 'App', value: 10 }]} />))
    const fills = Array.from(element.querySelectorAll<HTMLElement>('.lumi-chart__bar-fill'))
    expect(fills.map(fill => fill.style.width)).toEqual(['100%', '25%'])
    expect(fills[0]!.style.getPropertyValue('--lumi-chart-bar-fill')).toBe('var(--chart-3)')
    expect(element.querySelector('[data-slot="segment-bar"]')).toBeNull()
    expect(Array.from(element.querySelectorAll('.lumi-chart__bar-value'), value => value.textContent)).toEqual(['40', '10'])
    expect(engine.mount).not.toHaveBeenCalled()
  })
})
