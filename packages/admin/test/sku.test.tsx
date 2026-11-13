// @vitest-environment jsdom
import type { ReactNode } from 'react'
import type { LumiSkuEditorProps, SkuColumn } from '../src/react/pages/LumiSkuEditor.js'
import type { SkuValue, SkuVariant } from '../src/react/pages/skuMatrix.js'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LumiSkuEditor } from '../src/react/pages/LumiSkuEditor.js'
import { activeAttributes, buildSkuVariants, skuCombinations, variantKey } from '../src/react/pages/skuMatrix.js'

const color = { name: 'Color', values: ['Red', 'Blue'] }
const size = { name: 'Size', values: ['S', 'M'] }

function priced(variants: SkuVariant[], prices: Record<string, [number, number, string]>): SkuVariant[] {
  return variants.map((variant) => {
    const [price, stock, sku] = prices[variant.key] ?? [0, 0, '']
    return { ...variant, price, stock, sku }
  })
}

describe('sku matrix', () => {
  it('ignores unnamed, empty and repeated specifications and builds every combination in order', () => {
    expect(activeAttributes([{ name: ' Color ', values: ['Red', ' Red', ''] }, { name: '', values: ['x'] }, { name: 'Size', values: [] }, { name: 'Color', values: ['Blue'] }]))
      .toEqual([{ name: 'Color', values: ['Red'] }])
    expect(skuCombinations([color, size]).map(variantKey)).toEqual(['Color:Red|Size:S', 'Color:Red|Size:M', 'Color:Blue|Size:S', 'Color:Blue|Size:M'])
    expect(skuCombinations([])).toEqual([])
  })

  it('keeps entered values when a value is added and leaves new combinations empty', () => {
    const before = priced(buildSkuVariants([color]), { 'Color:Red': [10, 5, 'R'], 'Color:Blue': [12, 3, 'B'] })
    const after = buildSkuVariants([{ ...color, values: ['Red', 'Green', 'Blue'] }], before)
    expect(after.map(variant => [variant.key, variant.price, variant.stock, variant.sku])).toEqual([
      ['Color:Red', 10, 5, 'R'],
      ['Color:Green', null, null, ''],
      ['Color:Blue', 12, 3, 'B'],
    ])
  })

  it('carries values into a new dimension, giving each old code to one row only', () => {
    const before = priced(buildSkuVariants([color]), { 'Color:Red': [10, 5, 'R'], 'Color:Blue': [12, 3, 'B'] })
    const after = buildSkuVariants([color, size], before)
    expect(after.map(variant => [variant.key, variant.price, variant.stock, variant.sku])).toEqual([
      ['Color:Red|Size:S', 10, 5, 'R'],
      ['Color:Red|Size:M', 10, 5, ''],
      ['Color:Blue|Size:S', 12, 3, 'B'],
      ['Color:Blue|Size:M', 12, 3, ''],
    ])
    const collapsed = buildSkuVariants([color], priced(after, { 'Color:Red|Size:S': [10, 5, 'R'], 'Color:Red|Size:M': [11, 1, 'RM'], 'Color:Blue|Size:S': [12, 3, 'B'], 'Color:Blue|Size:M': [13, 2, 'BM'] }))
    expect(collapsed.map(variant => [variant.key, variant.price, variant.sku])).toEqual([['Color:Red', 10, 'R'], ['Color:Blue', 12, 'B']])
  })

  it('keeps extra variant fields and options', () => {
    const [variant] = buildSkuVariants([{ name: 'Color', values: ['Red'] }], [{ key: 'Color:Red', options: { Color: 'Red' }, price: 1, stock: 2, sku: 'R', barcode: '123' }])
    expect(variant).toEqual({ key: 'Color:Red', options: { Color: 'Red' }, price: 1, stock: 2, sku: 'R', barcode: '123' })
  })
})

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
})

async function mount(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(node))
  return host
}

const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!

async function type(input: Element | null | undefined, text: string): Promise<void> {
  await act(async () => {
    setInputValue.call(input as HTMLInputElement, text)
    input!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function button(host: ParentNode, label: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label)
}

function Editor({ initial, initialErrors = {}, report, ...rest }: Partial<LumiSkuEditorProps> & { initial: SkuValue, initialErrors?: Record<string, string>, report: (state: { value: SkuValue, errors: Record<string, string> }) => void }) {
  const [value, setValue] = useState(initial)
  const [errors, setErrors] = useState(initialErrors)
  report({ value, errors })
  return <LumiSkuEditor name="sku" value={value} onChange={setValue} errors={errors} onErrorsChange={setErrors} {...rest} />
}

const headers = (host: ParentNode): string[] => Array.from(host.querySelectorAll('[data-slot="repeater-table"] thead th:not([data-slot])')).map(cell => cell.textContent?.replace(/\s*\*$/, '').trim() ?? '').filter(Boolean)

const fillButtons = (host: ParentNode): string[] => Array.from(host.querySelectorAll('[data-slot="repeater-column-action"]')).map(item => item.getAttribute('aria-label') ?? '')

async function addValue(host: ParentNode, attribute: number, text: string): Promise<void> {
  const input = host.querySelector(`div[data-slot="sku-attribute"]:nth-of-type(${attribute}) [data-slot="tags-input"] input`)
  await type(input, text)
  await act(async () => input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
}

describe('sku editor', () => {
  it('fills a column from the first row via its header, regenerates rows from a new specification and drops stale variant errors', async () => {
    let state!: { value: SkuValue, errors: Record<string, string> }
    const initial: SkuValue = { attributes: [color], variants: priced(buildSkuVariants([color]), { 'Color:Red': [10, 5, 'R'], 'Color:Blue': [12, 3, 'B'] }) }
    const host = await mount(<Editor initial={initial} initialErrors={{ 'sku.variants.1.stock': 'Stock is required', 'title': 'kept' }} report={next => (state = next)} />)
    expect(host.querySelectorAll('[data-slot="repeater-row"]')).toHaveLength(2)
    expect(host.textContent).toContain('Stock is required')
    expect(headers(host)).toEqual(['Color', 'Price', 'Stock', 'Code'])
    const [specs, matrix] = Array.from(host.querySelectorAll('[data-slot="sku-section-header"]'))
    expect(specs?.textContent).toBe('SpecificationsAdd specification')
    expect(matrix?.textContent).toBe('Combinations2 combinations')
    expect(host.querySelector('[data-slot="sku-bulk"]')).toBeNull()
    expect(fillButtons(host)).toEqual(['Price: Apply first row to all', 'Stock: Apply first row to all'])
    expect((host.querySelector('input[aria-label="Red Code"]') as HTMLInputElement).value).toBe('R')

    await act(async () => button(host, 'Stock: Apply first row to all')!.click())
    expect(state.value.variants.map(variant => [variant.price, variant.stock])).toEqual([[10, 5], [12, 5]])
    expect(host.querySelector('[data-slot="repeater-announcer"]')?.textContent).toBe('Applied to 2 rows')

    await act(async () => button(host, 'Add specification')!.click())
    expect(state.value.variants).toHaveLength(2)
    const names = host.querySelectorAll('input[aria-label="Specification name"]')
    await type(names[1], 'Size')
    await addValue(host, 2, 'S')
    expect(state.value.variants.map(variant => [variant.key, variant.price, variant.stock, variant.sku])).toEqual([
      ['Color:Red|Size:S', 10, 5, 'R'],
      ['Color:Blue|Size:S', 12, 5, 'B'],
    ])
    expect(state.errors).toEqual({ title: 'kept' })
    expect(host.querySelector('[data-slot="repeater-table"] thead')?.textContent).toContain('Size')
  })

  it('edits custom columns under their keys, with header fill, defaults, carried values, keyed errors and renamed chrome', async () => {
    let state!: { value: SkuValue, errors: Record<string, string> }
    const columns: SkuColumn[] = [
      { key: 'cost', label: 'Cost', kind: 'currency', required: true },
      { key: 'weight', label: 'Weight', kind: 'number', suffix: 'kg', precision: 2, defaultValue: 0.5 },
      { key: 'channel', label: 'Channel', kind: 'select', options: [{ value: 'online', label: 'Online' }, { value: 'store', label: 'Store' }], defaultValue: 'online' },
      { key: 'barcode', label: 'Barcode', kind: 'text' },
      { key: 'note', label: 'Note', kind: 'text', fill: true },
      { key: 'grade', label: 'Grade', kind: 'number', fill: false },
    ]
    const labels = { title: 'Bundles', count: '{count} bundles', fill: 'Copy down', filled: 'Copied to {count} bundles', attributes: 'Options', addAttribute: 'Add option', attributeName: 'Option name' }
    const variants = buildSkuVariants([color], [], { cost: null, weight: 0.5, channel: 'online', barcode: null, note: null, grade: null })
      .map(variant => variant.key === 'Color:Red'
        ? { ...variant, cost: 8, weight: 1.25, barcode: '690001' }
        : { ...variant, cost: 9, channel: 'store', barcode: '' })
    const host = await mount(<Editor initial={{ attributes: [color], variants }} initialErrors={{ 'sku.variants.0.cost': 'Cost is below the floor.' }} columns={columns} labels={labels} pricePrefix="¥" report={next => (state = next)} />)

    expect(headers(host)).toEqual(['Color', 'Cost', 'Weight', 'Channel', 'Barcode', 'Note', 'Grade'])
    expect(Array.from(host.querySelectorAll('[data-slot="sku-section-header"]')).map(header => header.textContent)).toEqual(['OptionsAdd option', 'Bundles2 bundles'])
    expect(fillButtons(host)).toEqual(['Cost: Copy down', 'Weight: Copy down', 'Channel: Copy down', 'Note: Copy down'])
    expect(button(host, 'Note: Copy down')?.disabled).toBe(true)
    expect(host.querySelector('input[aria-label="Option name"]')).not.toBeNull()
    expect(host.textContent).not.toMatch(/SKU|Combinations/)

    const cost = host.querySelector('input[aria-label="Red Cost"]') as HTMLInputElement
    expect(cost.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(cost.getAttribute('aria-describedby')!.split(' ').at(-1)!)?.textContent).toBe('Cost is below the floor.')
    expect(host.querySelector('[data-slot="repeater-cell-error"]')).toBeNull()
    expect(host.querySelector('[data-slot="lumi-input-affix"]')?.textContent).toContain('¥')

    await act(async () => button(host, 'Weight: Copy down')!.click())
    await act(async () => button(host, 'Channel: Copy down')!.click())
    expect(host.querySelector('[data-slot="repeater-announcer"]')?.textContent).toBe('Copied to 2 bundles')
    await type(host.querySelector('input[aria-label="Red Note"]'), 'fragile')
    expect(button(host, 'Note: Copy down')?.disabled).toBe(false)
    await act(async () => button(host, 'Note: Copy down')!.click())
    expect(state.value.variants.map(variant => [variant.cost, variant.weight, variant.channel, variant.barcode, variant.note])).toEqual([
      [8, 1.25, 'online', '690001', 'fragile'],
      [9, 1.25, 'online', '', 'fragile'],
    ])

    await addValue(host, 1, 'Green')
    expect(state.value.variants.map(variant => [variant.key, variant.cost, variant.weight, variant.channel, variant.barcode])).toEqual([
      ['Color:Red', 8, 1.25, 'online', '690001'],
      ['Color:Blue', 9, 1.25, 'online', ''],
      ['Color:Green', null, 0.5, 'online', null],
    ])
    expect(state.errors).toEqual({})
  })

  it('disables header fill with a single row and hides it when locked', async () => {
    const one = buildSkuVariants([{ name: 'Color', values: ['Red'] }]).map(variant => ({ ...variant, price: 10, stock: 1 }))
    const host = await mount(<Editor initial={{ attributes: [{ name: 'Color', values: ['Red'] }], variants: one }} report={() => {}} />)
    expect(fillButtons(host)).toHaveLength(2)
    expect(button(host, 'Price: Apply first row to all')?.disabled).toBe(true)
    const locked = await mount(<Editor initial={{ attributes: [color], variants: buildSkuVariants([color]) }} readonly report={() => {}} />)
    expect(fillButtons(locked)).toEqual([])
    expect(locked.querySelector('[data-slot="sku-section-header"] button')).toBeNull()
  })
})
