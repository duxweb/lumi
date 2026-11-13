// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chartPoints, formatChartValue } from '../src/charts/model.js'
import { LumiCascader, LumiCheckboxGroup, LumiDateRangePicker, LumiDialog, LumiInput, LumiMultiSelect, LumiNumberInput, LumiPagination, LumiTable, LumiTagSelect, LumiTagsInput, LumiTextarea } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]
const mounted: Array<() => void> = []
afterEach(() => mounted.splice(0).forEach(stop => stop()))

async function mount(node: React.ReactElement): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(node))
  mounted.push(() => {
    act(() => root.unmount())
    host.remove()
  })
  return host
}

describe('a null value in state', () => {
  // A cleared field, a reset form or a backend field that is JSON null.
  it('reads as empty in list controls instead of failing the render', () => {
    const empty = null as never
    for (const node of [
      <LumiCascader key="1" options={options} value={empty} />,
      <LumiMultiSelect key="2" options={options} value={empty} />,
      <LumiCheckboxGroup key="3" options={options} value={empty} />,
      <LumiTagsInput key="4" value={empty} />,
      <LumiDateRangePicker key="5" value={empty} />,
    ])
      expect(() => renderToStaticMarkup(node)).not.toThrow()
  })

  it('empties a text field that showed a value before', async () => {
    function Field({ value }: { value: string | null }): React.ReactElement {
      return (
        <>
          <LumiInput value={value as never} ariaLabel="name" />
          <LumiTextarea value={value as never} ariaLabel="note" />
        </>
      )
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<Field value="Foo" />))
    await act(async () => root.render(<Field value={null} />))
    expect(host.querySelector('input')!.value).toBe('')
    expect(host.querySelector('textarea')!.value).toBe('')
    mounted.push(() => {
      act(() => root.unmount())
      host.remove()
    })
  })
})

describe('values the data may not have cleaned', () => {
  it('shows an amount without a symbol when the currency is not an ISO code', () => {
    const html = renderToStaticMarkup(<LumiTable rows={[{ id: 1, total: 12.5 }]} columns={[{ field: 'total', label: 'Total', kind: 'currency', currency: 'USDT' }]} />)
    expect(html).toContain('12.50')
    expect(formatChartValue(1200, { valueFormat: 'currency', currency: '¥' })).toBe('1,200')
    expect(formatChartValue(1200, { locale: 'zh_CN' })).toBe('1,200')
  })

  it('treats chart points that have not loaded as none', () => {
    expect(chartPoints('bar', undefined)).toEqual([])
    expect(chartPoints('bar', null)).toEqual([])
  })

  it('keeps chosen tags that are not among the options', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiTagSelect multiple options={[...options, { label: 'C', value: 'c' }]} value={['a', 'x']} onChange={onChange} />)
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'B')!.click())
    expect(onChange).toHaveBeenCalledWith(['x', 'a', 'b'])
  })

  it('steps a number without rounding away its decimals', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiNumberInput value={1.5} onChange={onChange} ariaLabel="amount" />)
    const increase = [...host.querySelectorAll('button')].find(button => /increase/i.test(button.getAttribute('aria-label') ?? ''))!
    await act(async () => increase.click())
    expect(onChange).toHaveBeenCalledWith(2.5)
  })
})

describe('pagination past the last page', () => {
  it('steps back to the last page, and never offers Infinity or NaN pages', async () => {
    const onPageChange = vi.fn()
    const host = await mount(<LumiPagination page={5} pageSize={10} total={25} onPageChange={onPageChange} />)
    await act(async () => host.querySelector<HTMLElement>('[aria-label="Go to previous page"]')!.click())
    expect(onPageChange).toHaveBeenCalledWith(3)
    for (const [pageSize, total] of [[0, 5], [0, 0]] as const) {
      const html = renderToStaticMarkup(<LumiPagination page={1} pageSize={pageSize} total={total} />)
      expect(html).not.toMatch(/Infinity|NaN/)
    }
  })
})

describe('a confirm dialog', () => {
  it('counts Escape as a cancel, and stays open while its confirm is running', async () => {
    const onCancel = vi.fn()
    const onOpenChange = vi.fn()
    function Confirm({ loading }: { loading: boolean }): React.ReactElement {
      return <LumiDialog open title="Delete?" confirmText="Delete" cancelText="Cancel" loading={loading} onCancel={onCancel} onOpenChange={onOpenChange} />
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push(() => {
      act(() => root.unmount())
      host.remove()
    })
    const escape = () => act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await act(async () => root.render(<Confirm loading />))
    await escape()
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => root.render(<Confirm loading={false} />))
    await escape()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('bounds and identity', () => {
  it('lets a number be typed into a slider box, committing once it is inside the range', async () => {
    const { LumiSlider } = await import('../src/react/index.js')
    const onChange = vi.fn()
    const host = await mount(<LumiSlider input min={10} max={100} value={30} onChange={onChange} ariaLabel="volume" />)
    const box = host.querySelector<HTMLInputElement>('input[type="number"]')!
    const type = (text: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, text)
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await type('5')
    // On the way to 50: nothing is written and the box keeps what was typed.
    expect(onChange).not.toHaveBeenCalled()
    expect(box.value).toBe('5')
    await type('50')
    expect(onChange).toHaveBeenLastCalledWith(50)
  })

  it('reads a UTC timestamp as the day it names in a date picker', async () => {
    const { LumiDatePicker } = await import('../src/react/index.js')
    expect(renderToStaticMarkup(<LumiDatePicker value="2026-11-11T00:00:00Z" />)).toContain('2026-11-11')
    expect(renderToStaticMarkup(<LumiDatePicker value="2026-11-11T23:30:00-08:00" />)).toContain('2026-11-11')
  })

  it('does not let a row without its key be selected under its position', () => {
    const html = renderToStaticMarkup(<LumiTable selectable rows={[{ name: 'No id' }, { id: 7, name: 'Keyed' }]} columns={[{ field: 'name', label: 'Name' }]} selectedKeys={[0, 7]} />)
    // Only the keyed row is selected; key 0 names no row.
    expect(html.match(/data-state="selected"/g) ?? []).toHaveLength(1)
  })
})

describe('lists that have not loaded', () => {
  // A list bound to a Query is `null` until its data arrives.
  it('render empty instead of failing', async () => {
    const { LumiCascaderPanel, LumiColorSwatches, LumiLightbox, LumiRepeater, LumiTree, LumiTreeSelect } = await import('../src/react/index.js')
    const none = null as never
    for (const node of [
      <LumiCascader key="1" options={none} />,
      <LumiCascaderPanel key="2" options={none} />,
      <LumiTree key="3" items={none} />,
      <LumiTreeSelect key="4" items={none} selectedNodes={none} />,
      <LumiRepeater key="5" columns={none} value={none} />,
      <LumiColorSwatches key="6" swatches={none} />,
      <LumiLightbox key="7" items={none} />,
    ])
      expect(() => renderToStaticMarkup(node)).not.toThrow()
  })
})
