// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import type { RepeaterColumn, UploadFileContext } from '../src/catalog/index.js'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiFormField } from '../src/components/form.js'
import { computeCell, LumiRepeater, LumiRepeaterRow, moveRow, remapRowErrors, summarize } from '../src/components/repeater.js'
import { formatFileSize, LumiUpload, matchesAccept } from '../src/components/upload.js'
import { uiRegistry } from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return host
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
})

async function click(target: Element | null | undefined): Promise<void> {
  if (!target)
    throw new Error('click target missing')
  await act(async () => (target as HTMLElement).click())
}

async function pick(input: HTMLInputElement, files: File[]): Promise<void> {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}

async function press(target: Element | null | undefined, key: string): Promise<void> {
  if (!target)
    throw new Error('key target missing')
  await act(async () => {
    (target as HTMLElement).focus()
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

const handle = (host: ParentNode, row: number): HTMLButtonElement | undefined => button(host, `Drag row ${row} to reorder, or use the arrow keys`)

function button(host: ParentNode, label: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label)
}

function rows(host: ParentNode): Array<{ status: string | null, text: string }> {
  return Array.from(host.querySelectorAll('[data-slot="upload-file"]')).map(row => ({ status: row.getAttribute('data-status'), text: row.textContent ?? '' }))
}

function row(host: ParentNode, name: string): { status: string | null, text: string } | undefined {
  return rows(host).find(item => item.text.includes(name))
}

interface Pending { file: File, context: UploadFileContext, resolve: (url: string) => void, reject: (error: Error) => void }

function heldUploads(): { calls: Pending[], onUploadFile: (file: File, context: UploadFileContext) => Promise<string> } {
  const calls: Pending[] = []
  return {
    calls,
    onUploadFile: (file, context) => new Promise<string>((resolve, reject) => {
      context.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      calls.push({ file, context, resolve, reject })
    }),
  }
}

describe('upload helpers', () => {
  it('formats sizes and matches accept lists by extension, MIME and wildcard', () => {
    expect([formatFileSize(512), formatFileSize(2048), formatFileSize(5 * 1024 * 1024)]).toEqual(['512 B', '2 KB', '5 MB'])
    expect(matchesAccept({ name: 'a.PNG', type: 'image/png' }, 'image/*')).toBe(true)
    expect(matchesAccept({ name: 'a.pdf', type: 'application/pdf' }, '.pdf,text/plain')).toBe(true)
    expect(matchesAccept({ name: 'a.zip', type: 'application/zip' }, 'image/*,.pdf')).toBe(false)
    expect(matchesAccept({ name: 'a.zip' }, undefined)).toBe(true)
  })
})

describe('upload', () => {
  it('renders the dropzone as a labelled button with a generated hint', async () => {
    const host = await mount(<LumiUpload ariaLabel="Product images" accept="image/*" multiple maxFiles={4} maxSize={5 * 1024 * 1024} />)
    const zone = host.querySelector('[data-slot="upload-dropzone"]')
    expect(zone?.tagName).toBe('BUTTON')
    expect(zone?.getAttribute('aria-label')).toBe('Product images')
    expect(host.textContent).toContain('Click to upload')
    expect(host.textContent).toContain('Images up to 5 MB')
    expect(host.textContent).toContain('Up to 4 files')
  })

  it('tracks each file: progress, success appended to the value, refusals without retry', async () => {
    const uploads = heldUploads()
    const onChange = vi.fn()
    const host = await mount(<LumiUpload defaultValue={['/kept.png']} multiple accept="image/*" maxSize={10} onUploadFile={uploads.onUploadFile} onChange={onChange} />)
    await pick(host.querySelector('input[type=file]')!, [
      new File(['x'], 'ok.png', { type: 'image/png' }),
      new File(['x'.repeat(20)], 'big.png', { type: 'image/png' }),
      new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
    ])
    expect(uploads.calls.map(call => call.file.name)).toEqual(['ok.png'])
    expect(row(host, 'kept.png')?.status).toBe('done')
    expect(row(host, 'ok.png')?.status).toBe('uploading')
    expect(row(host, 'big.png')).toMatchObject({ status: 'error', text: expect.stringContaining('Larger than 10 B') })
    expect(row(host, 'doc.pdf')).toMatchObject({ status: 'error', text: expect.stringContaining('This file type is not accepted') })
    expect(button(host, 'Retry big.png')).toBeUndefined()

    await act(async () => uploads.calls[0]!.context.onProgress(40))
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40')
    expect(row(host, 'ok.png')?.text).toContain('40%')

    await act(async () => uploads.calls[0]!.resolve('/uploads/ok.png'))
    expect(onChange).toHaveBeenLastCalledWith(['/kept.png', '/uploads/ok.png'])
    await click(button(host, 'Dismiss big.png'))
    expect(rows(host).map(item => item.status).sort()).toEqual(['done', 'done', 'error'])
  })

  it('retries a failed file and cancels one in flight without writing it', async () => {
    const uploads = heldUploads()
    const onChange = vi.fn()
    const host = await mount(<LumiUpload multiple onUploadFile={uploads.onUploadFile} onChange={onChange} />)
    const input = host.querySelector('input[type=file]') as HTMLInputElement
    await pick(input, [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')])

    await act(async () => uploads.calls[0]!.reject(new Error('Server down')))
    expect(row(host, 'a.txt')).toMatchObject({ status: 'error', text: expect.stringContaining('Server down') })
    await click(button(host, 'Retry a.txt'))
    expect(uploads.calls).toHaveLength(3)

    await click(button(host, 'Cancel upload of b.txt'))
    expect(uploads.calls[1]!.context.signal.aborted).toBe(true)
    expect(row(host, 'b.txt')).toBeUndefined()

    await act(async () => uploads.calls[2]!.resolve('/uploads/a.txt'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(['/uploads/a.txt'])
  })

  it('shows processing once every byte is sent but the server has not answered', async () => {
    const uploads = heldUploads()
    const host = await mount(<LumiUpload onUploadFile={uploads.onUploadFile} />)
    await pick(host.querySelector('input[type=file]')!, [new File(['a'], 'a.txt')])
    await act(async () => uploads.calls[0]!.context.onProgress(100))
    expect(host.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(false)
    expect(row(host, 'a.txt')?.text).toContain('Processing…')
  })

  it('replaces the single value in the image variant and offers retry beside the tile', async () => {
    const uploads = heldUploads()
    const onChange = vi.fn()
    const host = await mount(<LumiUpload variant="image" shape="circle" defaultValue={['/old.png']} ariaLabel="Avatar" onUploadFile={uploads.onUploadFile} onChange={onChange} />)
    expect(host.querySelector('[data-slot="upload-image"]')?.getAttribute('data-shape')).toBe('circle')
    await pick(host.querySelector('input[type=file]')!, [new File(['a'], 'me.png', { type: 'image/png' })])
    await act(async () => uploads.calls[0]!.reject(new Error('Too big')))
    expect(host.textContent).toContain('Too big')
    await click(button(host, 'Retry'))
    await act(async () => uploads.calls[1]!.resolve('/new.png'))
    expect(onChange).toHaveBeenLastCalledWith(['/new.png'])
  })

  it('lays a finished row out as thumbnail, name over size and type, status badge and tooltip actions', async () => {
    const uploads = heldUploads()
    const host = await mount(<LumiUpload multiple preview onUploadFile={uploads.onUploadFile} />)
    await pick(host.querySelector('input[type=file]')!, [new File(['x'.repeat(2048)], 'shot.png', { type: 'image/png' })])
    await act(async () => uploads.calls[0]!.context.onProgress(30))
    const uploading = host.querySelector('[data-slot="upload-file"]')!
    expect(uploading.querySelector('[data-slot="upload-file-status"]')?.textContent).toBe('30%')
    expect(uploading.querySelector('[data-slot="upload-file-body"] [role="progressbar"]')).not.toBeNull()

    await act(async () => uploads.calls[0]!.resolve('/uploads/shot.png'))
    const done = host.querySelector('[data-slot="upload-file"][data-status="done"]')!
    expect(done.querySelector('[data-slot="upload-file-meta"]')?.textContent).toBe('2 KBPNG')
    expect(done.querySelector('[data-slot="upload-file-status"] [data-slot="badge"]')?.textContent).toBe('Uploaded')
    expect(done.querySelector('[data-slot="upload-file-actions"] [data-slot="tooltip-trigger"]')).not.toBeNull()
    await click(button(host, 'Preview shot.png'))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

describe('field error display', () => {
  const describedText = (control: Element): string => (control.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent ?? '').join('|')

  it('keeps inline errors under the control by default and moves them into a tooltip on request', async () => {
    const host = await mount(
      <>
        <LumiFormField name="code" label="Code" error="Use 4 characters" />
        <LumiFormField name="sku" label="SKU" error="Too short" errorDisplay="tooltip" />
      </>,
    )
    const [inline, tooltip] = Array.from(host.querySelectorAll('input'))
    expect(host.querySelectorAll('[data-slot="field-error"]')).toHaveLength(1)
    expect(describedText(inline!)).toContain('Use 4 characters')
    expect(describedText(tooltip!)).toContain('Too short')
    expect(tooltip!.getAttribute('aria-invalid')).toBe('true')
    // The tooltip-mode message is only a visually hidden copy until it opens.
    expect(document.getElementById(tooltip!.getAttribute('aria-describedby')!.split(' ').at(-1)!)?.className).toContain('sr-only')
    expect(document.querySelector('[data-slot="tooltip"][data-tone="danger"]')).toBeNull()

    await act(async () => tooltip!.focus())
    expect(document.querySelector('[data-slot="tooltip"][data-tone="danger"]')?.textContent).toContain('Too short')
    await act(async () => tooltip!.blur())
    expect(document.querySelector('[data-slot="tooltip"][data-tone="danger"]')).toBeNull()
  })

  it('shows table cell errors as tooltips, opening the first one when errors arrive', async () => {
    function Harness({ layout }: { layout?: 'table' | 'card' }) {
      const [errors, setErrors] = useState<Record<string, string>>({})
      const rows = [{ id: 'a', name: 'Mouse' }, { id: 'b', name: 'Hub' }]
      return (
        <>
          <button type="button" onClick={() => setErrors({ 'items.1.name': 'Second', 'items.0.name': 'First' })}>Fail</button>
          <LumiRepeater value={rows} errors={errors} onErrorsChange={setErrors} name="items" rowKey="id" layout={layout} columns={[{ key: 'name', label: 'Name' }]}>
            {rows.map((row, index) => <LumiRepeaterRow key={row.id} index={index}><input aria-label={`Name ${index + 1}`} defaultValue={row.name} /></LumiRepeaterRow>)}
          </LumiRepeater>
        </>
      )
    }
    const host = await mount(<Harness />)
    const rowHeight = (): number => host.querySelector('[data-slot="repeater-row"]')!.childElementCount
    const cells = rowHeight()
    await click(button(host, 'Fail'))
    await act(async () => new Promise(resolve => setTimeout(resolve, 5)))

    // No message node joins the row: it stays one line high.
    expect(host.querySelector('[data-slot="repeater-cell-error"]')).toBeNull()
    expect(rowHeight()).toBe(cells)
    const first = host.querySelector('input[aria-label="Name 1"]')!
    expect(first.getAttribute('aria-invalid')).toBe('true')
    expect(describedText(first)).toBe('First')
    const open = document.querySelectorAll('[data-slot="tooltip"][data-tone="danger"]')
    expect(Array.from(open).map(item => item.textContent)).toEqual(['First'])

    // Pressing elsewhere dismisses the automatic one.
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.querySelector('[data-slot="tooltip"][data-tone="danger"]')).toBeNull()
  })

  it('keeps inline errors in the card layout and when a column asks for them', async () => {
    const host = await mount(
      <LumiRepeater value={[{ id: 'a', name: '' }]} errors={{ 'items.0.name': 'Required' }} name="items" layout="card" columns={[{ key: 'name', label: 'Name' }]}>
        <LumiRepeaterRow index={0}><input aria-label="Name" /></LumiRepeaterRow>
      </LumiRepeater>,
    )
    expect(host.querySelector('[data-slot="repeater-cell-error"]')?.textContent).toBe('Required')
    const table = await mount(
      <LumiRepeater value={[{ id: 'a', name: '' }]} errors={{ 'items.0.name': 'Required' }} name="items" columns={[{ key: 'name', label: 'Name', errorDisplay: 'inline' }]}>
        <LumiRepeaterRow index={0}><input aria-label="Name" /></LumiRepeaterRow>
      </LumiRepeater>,
    )
    expect(table.querySelector('[data-slot="repeater-cell-error"]')?.textContent).toBe('Required')
  })
})

describe('repeater helpers', () => {
  it('moves rows and re-addresses their errors', () => {
    expect(moveRow(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(remapRowErrors({ 'items.0.qty': 'A', 'items.2.price': 'C', 'items': 'list', 'title': 'other' }, 'items', index => index === 0 ? undefined : index - 1))
      .toEqual({ 'items.1.price': 'C', 'items': 'list', 'title': 'other' })
  })

  it('computes cells and summaries, skipping rows that are not numbers yet', () => {
    const total: RepeaterColumn = { key: 'total', label: 'Total', compute: { op: 'product', fields: ['qty', 'price'] } }
    const lines = [{ qty: 2, price: 10 }, { qty: '3', price: 5 }, { qty: '', price: 4 }]
    expect(lines.map(row => computeCell(row, total))).toEqual([20, 15, undefined])
    expect(summarize(lines, total, 'sum')).toBe(35)
    expect(summarize(lines, { key: 'qty', label: 'Qty' }, 'max')).toBe(3)
    expect(summarize(lines, { key: 'qty', label: 'Qty' }, 'count')).toBe(3)
    expect(summarize([], total, 'avg')).toBeUndefined()
  })
})

interface Line { id: string, name: string, qty: number, price: number }

const lineColumns: RepeaterColumn[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'qty', label: 'Qty' },
  { key: 'total', label: 'Total', compute: { op: 'product', fields: ['qty', 'price'] } },
]

function Lines({ initial, initialErrors = {}, errorDisplay, layout, report }: { initial: Line[], initialErrors?: Record<string, string>, errorDisplay?: 'inline' | 'tooltip', layout?: 'table' | 'card', report: (state: { rows: Line[], errors: Record<string, string> }) => void }) {
  const [lines, setLines] = useState(initial)
  const [errors, setErrors] = useState(initialErrors)
  report({ rows: lines, errors })
  return (
    <LumiRepeater
      value={lines}
      onChange={next => setLines(next as unknown as Line[])}
      errors={errors}
      onErrorsChange={setErrors}
      errorDisplay={errorDisplay}
      layout={layout}
      name="items"
      rowKey="id"
      columns={lineColumns}
      summary={[{ key: 'total', op: 'sum' }]}
      newRow={{ name: '', qty: 1, price: 0 }}
      min={1}
      max={3}
    >
      {lines.map((line, index) => (
        <LumiRepeaterRow key={line.id} index={index}>
          <input aria-label={`Name ${index + 1}`} value={line.name} onChange={event => setLines(lines.map((item, at) => at === index ? { ...item, name: event.target.value } : item))} />
          <input aria-label={`Qty ${index + 1}`} value={line.qty} readOnly />
        </LumiRepeaterRow>
      ))}
    </LumiRepeater>
  )
}

describe('repeater', () => {
  const initial: Line[] = [
    { id: 'a', name: 'Mouse', qty: 2, price: 10 },
    { id: 'b', name: 'Hub', qty: 1, price: 30 },
  ]

  it('adds, duplicates and removes rows within min and max, with a computed total', async () => {
    let state!: { rows: Line[], errors: Record<string, string> }
    const host = await mount(<Lines initial={initial} report={next => (state = next)} />)
    expect(host.querySelector('tfoot')?.textContent).toContain('50')
    expect(host.textContent).toContain('2 of 3')

    await click(button(host, 'Duplicate row 1'))
    expect(state.rows.map(row => row.name)).toEqual(['Mouse', 'Mouse', 'Hub'])
    expect(new Set(state.rows.map(row => row.id)).size).toBe(3)
    expect(button(host, 'Add row')?.disabled).toBe(true)

    await click(button(host, 'Remove row 1'))
    await click(button(host, 'Remove row 1'))
    expect(state.rows.map(row => row.name)).toEqual(['Hub'])
    expect(button(host, 'Remove row 1')).toBeUndefined()

    await click(button(host, 'Add row'))
    expect(state.rows[1]).toMatchObject({ name: '', qty: 1, price: 0 })
    expect(state.rows[1]?.id).toBeTruthy()
  })

  it('reorders from the focused drag handle by keyboard, with no move buttons', async () => {
    const three: Line[] = [...initial, { id: 'c', name: 'Stand', qty: 3, price: 5 }]
    for (const layout of ['table', 'card'] as const) {
      let state!: { rows: Line[], errors: Record<string, string> }
      const host = await mount(<Lines initial={three} layout={layout} report={next => (state = next)} />)
      const announcer = host.querySelector('[data-slot="repeater-announcer"]')
      expect(announcer?.getAttribute('aria-live')).toBe('polite')
      expect(Array.from(host.querySelectorAll('button')).some(item => /\bmove\b/i.test(item.getAttribute('aria-label') ?? ''))).toBe(false)
      expect(Array.from(host.querySelectorAll('[data-slot="repeater-tools"] button')).map(item => item.getAttribute('aria-label'))).toEqual(['Remove row 1', 'Remove row 2', 'Remove row 3'])

      await press(handle(host, 1), 'ArrowDown')
      expect(state.rows.map(row => row.id)).toEqual(['b', 'a', 'c'])
      expect(document.activeElement).toBe(handle(host, 2))
      expect(announcer?.textContent).toBe('Moved to row 2 of 3')

      await press(document.activeElement, 'End')
      expect(state.rows.map(row => row.id)).toEqual(['b', 'c', 'a'])
      expect(document.activeElement).toBe(handle(host, 3))

      await press(document.activeElement, 'ArrowDown')
      expect(state.rows.map(row => row.id)).toEqual(['b', 'c', 'a'])

      await press(document.activeElement, 'Home')
      expect(state.rows.map(row => row.id)).toEqual(['a', 'b', 'c'])
      expect(document.activeElement).toBe(handle(host, 1))
      expect(announcer?.textContent).toBe('Moved to row 1 of 3')
    }
  })

  it('keeps errors on their row through moves and removals, and drops one when its cell changes', async () => {
    let state!: { rows: Line[], errors: Record<string, string> }
    const host = await mount(<Lines initial={initial} errorDisplay="inline" initialErrors={{ 'items.1.qty': 'Only 4 left', 'items.0.name': 'Duplicate' }} report={next => (state = next)} />)
    const errorsIn = (row: number): string[] => Array.from(host.querySelectorAll('[data-slot="repeater-row"]')[row]?.querySelectorAll('[role="alert"]') ?? []).map(item => item.textContent ?? '')
    expect(errorsIn(1)).toEqual(['Only 4 left'])
    expect(host.querySelectorAll('[data-slot="repeater-row"]')[1]?.querySelector('[data-invalid]')).not.toBeNull()

    await press(handle(host, 2), 'ArrowUp')
    expect(state.rows.map(row => row.id)).toEqual(['b', 'a'])
    expect(state.errors).toEqual({ 'items.0.qty': 'Only 4 left', 'items.1.name': 'Duplicate' })
    expect(errorsIn(0)).toEqual(['Only 4 left'])

    const name = host.querySelector('input[aria-label="Name 2"]') as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setValue.call(name, 'Mouse pad')
      name.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(state.errors).toEqual({ 'items.0.qty': 'Only 4 left' })

    await click(button(host, 'Remove row 1'))
    expect(state.errors).toEqual({})
  })

  it('renders through the native registry with repeat and $bindItem, writing to the StateStore', async () => {
    const store = createStateStore({
      order: { items: [{ id: 'a', name: 'Mouse', qty: 2, price: 10 }, { id: 'b', name: 'Hub', qty: 1, price: 30 }] },
      status: { fieldErrors: { 'items.1.qty': 'Only 4 left' } },
    })
    const spec: Spec = {
      root: 'lines',
      elements: {
        lines: {
          type: 'Repeater',
          props: {
            value: { $bindState: '/order/items' },
            errors: { $bindState: '/status/fieldErrors' },
            name: 'items',
            rowKey: 'id',
            columns: lineColumns,
            summary: [{ key: 'total', op: 'sum' }],
            newRow: { name: '', qty: 1, price: 0 },
          },
          repeat: { statePath: '/order/items', key: 'id' },
          children: ['row'],
        },
        row: { type: 'RepeaterRow', props: {}, children: ['name', 'qty'] },
        name: { type: 'Input', props: { value: { $bindItem: 'name' }, ariaLabel: 'Name' }, children: [] },
        qty: { type: 'NumberInput', props: { value: { $bindItem: 'qty' }, ariaLabel: 'Qty' }, children: [] },
      },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    expect(Array.from(host.querySelectorAll('input[aria-label="Name"]')).map(input => (input as HTMLInputElement).value)).toEqual(['Mouse', 'Hub'])
    expect(host.querySelector('tfoot')?.textContent).toContain('50')
    expect(host.textContent).toContain('Only 4 left')

    await press(handle(host, 2), 'ArrowUp')
    expect((store.get('/order/items') as Line[]).map(row => row.id)).toEqual(['b', 'a'])
    expect(store.get('/status/fieldErrors')).toEqual({ 'items.0.qty': 'Only 4 left' })
    expect(Array.from(host.querySelectorAll('input[aria-label="Name"]')).map(input => (input as HTMLInputElement).value)).toEqual(['Hub', 'Mouse'])
    expect(document.activeElement).toBe(handle(host, 1))

    await click(button(host, 'Add row'))
    expect(store.get('/order/items/2')).toMatchObject({ name: '', qty: 1, price: 0 })
  })
})
