// @vitest-environment jsdom
import type { ListFilterSchema, TableColumn } from '../src/catalog/index.js'
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/index.js'
import { CheckCircleIcon, HelpCircleIcon, InfoIcon, TrashIcon, WarningIcon } from '../src/icons.js'
import { paginationRange } from '../src/internal/pagination-range.js'
import { LUMI_HIGHLIGHT_EVENT, LumiAlert, LumiBadge, LumiButton, LumiCheckbox, LumiCheckboxGroup, LumiDescriptionList, LumiDialog, LumiDrawer, LumiFilters, LumiForm, LumiFormField, LumiFragment, LumiFrame, LumiInput, LumiMultiSelect, LumiNumberInput, LumiPagination, LumiRadioGroup, LumiRichText, LumiSelect, LumiSelectionExtras, LumiStepper, LumiSwitch, LumiTable, LumiTabs, LumiTextarea, LumiThemeProvider, LumiTimeline, LumiUpload, uiRegistry } from '../src/react/index.js'

async function mount(element: React.ReactNode): Promise<{ container: HTMLDivElement, root: ReturnType<typeof createRoot> }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(element))
  return { container, root }
}

describe('shadcn renderer adapter', () => {
  it('uses host translations for filter actions and field chrome', () => {
    const html = renderToStaticMarkup(
      <LumiFilters
        schema={{ fields: [
          { field: 'status', label: 'Status', widget: 'chips' },
          { field: 'price', label: 'Price', widget: 'numberRange' },
        ] }}
        applyMode="explicit"
        translate={key => `translated:${key}`}
      />,
    )
    expect(html).toContain('translated:lumi.common.all')
    expect(html).toContain('translated:lumi.filter.reset')
    expect(html).toContain('translated:lumi.filter.apply')
    expect(html).toContain('translated:lumi.filter.min')
  })
  it('registers every catalog component exactly once', () => {
    const componentNames = Object.keys(uiComponentDefinitions)
    expect(componentNames.length).toBeGreaterThan(0)
    expect(Object.keys(uiRegistry).sort()).toEqual([...componentNames].sort())
    expect(new Set(Object.values(uiRegistry)).size).toBe(componentNames.length)
    expect(LumiFragment).toBeDefined()
  })

  it('renders Fragment layout props instead of dropping them', () => {
    // A bare React Fragment cannot carry props — the renderer throws on one that
    // tries — so the adapter must give `layout` a box to live in.
    expect(renderToStaticMarkup(<LumiFragment><span>bare</span></LumiFragment>)).toBe('<span>bare</span>')
    const stack = renderToStaticMarkup(<LumiFragment layout="stack"><span>one</span></LumiFragment>)
    expect(stack).toContain('data-layout="stack"')
    expect(stack).toContain('flex-col')
    const split = renderToStaticMarkup(
      <LumiFragment layout="split" asideWidth={320}>
        <span>main</span>
        <span>aside</span>
      </LumiFragment>,
    )
    expect(split).toContain('data-layout="split"')
    expect(split).toContain('--lumi-fragment-aside:320px')
    // Only breakpoint variants set the direction, so no later plain `flex-col` can pin it.
    expect(split.match(/class="([^"]*)"[^>]*data-layout="split"/)![1]!.split(' ')).not.toContain('flex-col')
  })

  it('leaves the row-actions column header unlabelled but spoken', () => {
    const html = renderToStaticMarkup(
      <LumiTable
        rows={[{ id: 1, name: 'Lumi' }]}
        columns={[{ field: 'name', label: 'Name' }, { field: 'actions', kind: 'actions', actions: [{ value: 'view', label: 'View' }] }]}
      />,
    )
    expect(html).not.toContain('>actions<')
    expect(html).toContain('Actions')
    expect(html).toContain('border-y')
    expect(html).not.toMatch(/data-slot="table-head"[^>]*class="[^"]*\bbg-muted\b/)
  })

  it('renders neutral props without exposing internal components', () => {
    const html = renderToStaticMarkup(<LumiButton appearance="outline" label="Save" loading />)
    expect(html).toContain('Save')
    expect(html).toContain('disabled')
    expect(html).toContain('data-lumi-control-size="md"')
    // The spinner replaces the leading icon instead of squeezing in beside it.
    expect(renderToStaticMarkup(<LumiButton shape="circle" icon="plus" label="Add" />)).toMatch(/<svg[^>]*data-icon="inline-start"/)
    for (const button of [<LumiButton key="icon" shape="circle" icon="plus" label="Add" loading />, <LumiButton key="label" icon="plus" label="New order" loading />])
      expect(renderToStaticMarkup(button).match(/data-icon="inline-start"/g)).toHaveLength(1)
    expect(renderToStaticMarkup(<LumiInput defaultValue="Draft" invalid />)).toContain('aria-invalid="true"')
  })

  it('renders choice controls with options still loading (null) instead of throwing', () => {
    // A Query projects `data: null` while it loads; bound options arrive later.
    const pending = null as unknown as []
    expect(() => renderToStaticMarkup(
      <>
        <LumiSelect ariaLabel="City" options={pending} />
        <LumiSelect ariaLabel="City search" filterable options={pending} />
        <LumiMultiSelect ariaLabel="Cities" options={pending} />
        <LumiCheckboxGroup ariaLabel="Tags" options={pending} />
        <LumiRadioGroup ariaLabel="Tier" options={pending} />
        <LumiFormField name="city" label="City" fieldType="enum" widget="Select" options={pending} />
      </>,
    )).not.toThrow()
  })

  it('leaves Form validation to field checks instead of browser constraint bubbles', () => {
    expect(renderToStaticMarkup(<LumiForm><LumiFormField name="title" label="Title" required /></LumiForm>)).toMatch(/<form[^>]*novalidate/i)
  })

  it('renders FormField errors with accessible alert semantics', () => {
    const html = renderToStaticMarkup(<LumiFormField name="email" label="Email" error="Email is required" />)
    expect(html).toContain('Email is required')
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-invalid="true"')
  })

  it('emits the raw control value', async () => {
    const values: string[] = []
    const { container, root } = await mount(<LumiInput value="" onChange={value => values.push(value)} />)
    const input = container.querySelector('input')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Ada')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(values).toEqual(['Ada'])
    await act(async () => root.unmount())
    container.remove()
  })

  it('preserves NumberInput uncontrolled defaults, applies precision, and gates textarea auto-resize', async () => {
    const numberHtml = renderToStaticMarkup(<LumiNumberInput name="amount" defaultValue={12} precision={2} />)
    expect(numberHtml).toContain('value="12"')
    expect(numberHtml).toContain('step="0.01"')
    expect(renderToStaticMarkup(<LumiNumberInput value={1.239} precision={2} />)).toContain('value="1.24"')
    const values: Array<number | null> = []
    const { container, root } = await mount(<LumiNumberInput defaultValue={1} precision={2} onChange={next => values.push(next)} />)
    const input = container.querySelector('input')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, '1.239')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(values).toEqual([1.24])
    // The steppers step by the precision, stop at `max`, and report through onChange.
    const steps: Array<number | null> = []
    const stepped = await mount(<LumiNumberInput defaultValue={1} precision={2} max={1.02} onChange={next => steps.push(next)} />)
    const increase = stepped.container.querySelector<HTMLButtonElement>('[data-slot="number-stepper"] button')!
    await act(async () => increase.click())
    await act(async () => increase.click())
    await act(async () => increase.click())
    expect(steps).toEqual([1.01, 1.02, 1.02])
    await act(async () => stepped.root.unmount())
    stepped.container.remove()
    expect(renderToStaticMarkup(<LumiNumberInput readonly defaultValue={1} />)).not.toContain('number-stepper')
    const fixed = renderToStaticMarkup(<LumiTextarea autoResize={false} />)
    const growing = renderToStaticMarkup(<LumiTextarea autoResize />)
    expect(fixed).not.toContain('data-auto-resize')
    expect(growing).toContain('data-auto-resize="true"')
    expect(readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')).toContain('textarea[data-slot="textarea"]:not([data-auto-resize="true"]) { field-sizing: fixed; }')
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders declared MultiSelect placeholders and Upload image previews', () => {
    expect(renderToStaticMarkup(<LumiMultiSelect options={[]} placeholder="Choose tags" />)).toContain('Choose tags')
    const preview = renderToStaticMarkup(<LumiUpload defaultValue={['/media/cover.png']} preview />)
    expect(preview).toContain('data-slot="upload-preview"')
    expect(preview).toContain('src="/media/cover.png"')
    expect(renderToStaticMarkup(<LumiUpload defaultValue={['/media/cover.png']} />)).not.toContain('data-slot="upload-preview"')
  })

  it('supports remote search and clear for select controls', async () => {
    const searches: string[] = []
    const selections: unknown[] = []
    const { container, root } = await mount(
      <LumiSelect
        defaultValue={1}
        options={[{ label: 'Alpha', value: 1 }, { label: 'Beta', value: 2 }]}
        filterable
        clearable
        ariaLabel="Project"
        onSearch={query => searches.push(query)}
        onChange={next => selections.push(next)}
      />,
    )
    await act(async () => container.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Project search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(search, 'bet')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // With onSearch the host owns filtering, so both rows stay listed.
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(2)
    await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent?.includes('Beta'))!.click())
    expect(selections).toEqual([2])
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!.click())
    expect(searches).toEqual(['bet', ''])
    expect(selections).toEqual([2, null])
    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps async controlled selections in forms without reporting a user edit', async () => {
    const change = vi.fn()
    const render = (value?: string) => <form><LumiSelect name="tier" value={value} options={[{ label: 'Enterprise', value: 'enterprise' }]} onChange={change} /></form>
    const { container, root } = await mount(render())
    await act(async () => root.render(render('enterprise')))
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain('Enterprise')
    const native = container.querySelector('select')!
    await act(async () => {
      // Radix can bubble an empty internal option while the option collection registers.
      native.value = ''
      native.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(change).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    container.remove()
  })

  it('supports multi-select search, clear, and read-only state', async () => {
    const searches: string[] = []
    const selections: unknown[] = []
    const { container, root } = await mount(
      <LumiMultiSelect
        defaultValue={['a']}
        options={[{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }]}
        filterable
        clearable
        ariaLabel="Tags"
        onSearch={query => searches.push(query)}
        onChange={next => selections.push(next)}
      />,
    )
    await act(async () => container.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Tags search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(search, 'alp')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!.click())
    expect(searches).toEqual(['alp'])
    expect(selections).toEqual([[]])
    await act(async () => root.render(<LumiMultiSelect options={[{ label: 'Alpha', value: 'a' }]} readonly ariaLabel="Tags" />))
    expect(container.querySelector('[role="combobox"]')?.getAttribute('aria-readonly')).toBe('true')
    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps multi-select typed values and names while navigating and replacing remote options', async () => {
    const selections: unknown[] = []
    const initial = [{ label: 'Zero', value: 0 }, { label: 'Locked', value: 'locked', disabled: true }, { label: 'No', value: false }]
    const render = (options = initial) => <LumiMultiSelect name="tags" defaultValue={[0]} options={options} ariaLabel="Tags" onChange={next => selections.push(next)} />
    const { container, root } = await mount(render())
    await act(async () => container.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    const list = document.querySelector<HTMLElement>('[role="listbox"]')!
    await act(async () => list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    await act(async () => list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(selections).toEqual([[0, false]])
    expect(container.querySelector<HTMLInputElement>('input[name="tags"]')?.value).toBe('[0,false]')
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    await act(async () => root.render(render([{ label: 'Remote result', value: 'remote' }])))
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain('Zero')
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain('No')
    expect(selections).toEqual([[0, false]])
    await act(async () => root.unmount())
    container.remove()
  })

  it('disables form descendants and preserves controlled and uncontrolled values', async () => {
    const controlledChanges: boolean[] = []
    function Controlled(): React.ReactElement {
      const [checked, setChecked] = useState(false)
      return (
        <LumiCheckbox
          label="Controlled"
          value={checked}
          onChange={(next) => {
            controlledChanges.push(next)
            setChecked(next)
          }}
        />
      )
    }
    const { container, root } = await mount(
      <>
        <LumiForm disabled><LumiInput ariaLabel="Disabled input" /></LumiForm>
        <Controlled />
        <LumiCheckbox label="Uncontrolled" defaultValue />
      </>,
    )
    expect(container.querySelector('fieldset')?.disabled).toBe(true)
    const controls = Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]'))
    await act(async () => controls[0]!.click())
    expect(controlledChanges).toEqual([true])
    expect(controls[0]!.getAttribute('data-state')).toBe('checked')
    expect(controls[1]!.getAttribute('data-state')).toBe('checked')
    await act(async () => controls[1]!.click())
    expect(controls[1]!.getAttribute('data-state')).toBe('unchecked')
    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps readonly boolean and radio values immutable and present in FormData', async () => {
    const changes = vi.fn()
    const { container, root } = await mount(
      <LumiForm>
        <LumiCheckbox name="approved" label="Approved" defaultValue readonly onChange={changes} />
        <LumiRadioGroup name="status" defaultValue="active" readonly options={[{ label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }]} onChange={changes} />
        <LumiSwitch name="published" label="Published" defaultValue readonly onChange={changes} />
      </LumiForm>,
    )
    // A radio takes readonly from its group (ARIA does not allow it on the radio); each radio is still clicked.
    expect(container.querySelector('[role="radio"][aria-readonly]')).toBeNull()
    const readonlyControls = Array.from(container.querySelectorAll<HTMLElement>('[aria-readonly="true"], [role="radiogroup"][aria-readonly="true"] [role="radio"]'))
    expect(readonlyControls.length).toBeGreaterThanOrEqual(5)
    for (const control of readonlyControls)
      await act(async () => control.click())
    expect(changes).not.toHaveBeenCalled()
    expect(Object.fromEntries(new FormData(container.querySelector('form')!))).toEqual({ approved: 'true', status: 'active', published: 'true' })
    await act(async () => root.unmount())
    container.remove()
  })

  it('merges edited uncontrolled form fields over default values on submit', async () => {
    const submitted: Array<Record<string, unknown>> = []
    const { container, root } = await mount(
      <LumiForm defaultValue={{ name: 'Before', preserved: 'yes' }} onSubmit={values => submitted.push(values)}>
        <LumiInput name="name" defaultValue="Before" />
      </LumiForm>,
    )
    const input = container.querySelector<HTMLInputElement>('input[name="name"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'After')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      container.querySelector<HTMLFormElement>('form')!.requestSubmit()
    })
    expect(submitted).toEqual([{ name: 'After', preserved: 'yes' }])
    await act(async () => root.unmount())
    container.remove()
  })

  it('uses unique option ids for groups with repeated values', () => {
    const html = renderToStaticMarkup(
      <>
        <LumiCheckboxGroup options={[{ label: 'Same', value: 'same' }]} />
        <LumiCheckboxGroup options={[{ label: 'Same', value: 'same' }]} />
      </>,
    )
    const ids = Array.from(html.matchAll(/id="([^"]+)"/g), match => match[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps table selection separate from row activation and renders totals', async () => {
    const selections: Array<Array<string | number>> = []
    const rowClicks: Array<Record<string, unknown>> = []
    const { container, root } = await mount(
      <LumiTable
        rows={[{ id: 7, name: 'Ada' }]}
        columns={[{ field: 'name', label: 'Name' }]}
        selectable
        total={12}
        summary="Filtered results"
        onSelectionChange={keys => selections.push(keys)}
        onRowClick={row => rowClicks.push(row)}
      />,
    )
    await act(async () => container.querySelector<HTMLElement>('tbody [role="checkbox"]')!.click())
    expect(selections).toEqual([[7]])
    expect(rowClicks).toEqual([])
    const footer = container.querySelector('[data-slot="table-summary"]')
    expect(footer?.textContent).toContain('Filtered results')
    expect(footer?.textContent).toContain('12 total')

    // Select-all covers the rows in view and reads back their partial state.
    await act(async () => root.render(
      <LumiTable
        rows={[{ id: 7, name: 'Ada' }, { id: 8, name: 'Grace' }]}
        columns={[{ field: 'name', label: 'Name' }]}
        selectable
        selectedKeys={[7]}
        onSelectionChange={keys => selections.push(keys)}
      />,
    ))
    const selectAll = container.querySelector<HTMLElement>('thead [role="checkbox"]')!
    expect(selectAll.getAttribute('aria-label')).toBe('Select all rows')
    expect(selectAll.getAttribute('data-state')).toBe('indeterminate')
    await act(async () => selectAll.click())
    expect(selections.at(-1)).toEqual([7, 8])
    await act(async () => root.unmount())
    container.remove()
  })

  it('adds host commands to the selection bar and flags rows named by the highlight event', async () => {
    vi.useFakeTimers()
    const picked: unknown[] = []
    const { container, root } = await mount(
      <LumiSelectionExtras extras={[{ value: 'cite', label: 'Reference in chat', onSelect: selection => picked.push(selection) }]}>
        <LumiTable rows={[{ id: 7, name: 'Ada' }, { id: 8, name: 'Grace' }]} columns={[{ field: 'name', label: 'Name' }]} selectable selectedKeys={[8, 99]} />
      </LumiSelectionExtras>,
    )
    // No bulk actions of its own, yet the bar shows for the added command.
    const cite = container.querySelector<HTMLElement>('[data-slot="selection-bar"] [data-extra="cite"]')!
    expect(cite.textContent).toBe('Reference in chat')
    await act(async () => cite.click())
    expect(picked).toEqual([{ keys: [8, 99], rows: [{ id: 8, name: 'Grace' }, undefined] }])

    // Keys compare as text, and the flag clears after a moment.
    await act(async () => window.dispatchEvent(new CustomEvent(LUMI_HIGHLIGHT_EVENT, { detail: { keys: ['7'] } })))
    const flagged = (): string[] => Array.from(container.querySelectorAll('[data-agent-highlight]'), row => row.textContent ?? '')
    expect(flagged()).toEqual([expect.stringContaining('Ada')])
    await act(async () => vi.advanceTimersByTime(4000))
    expect(flagged()).toEqual([])
    vi.useRealTimers()

    // Without extras or bulk actions there is no bar.
    await act(async () => root.render(<LumiTable rows={[{ id: 7, name: 'Ada' }]} columns={[{ field: 'name', label: 'Name' }]} selectable selectedKeys={[7]} />))
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull()
    await act(async () => root.unmount())
    container.remove()
  })

  it('implements Table column kinds, bidirectional sorting, action disclosure, keyboard rows, and loading skeletons', async () => {
    const sorts: Array<Array<{ field: string, order: 'asc' | 'desc' }>> = []
    const rowClicks: Array<Record<string, unknown>> = []
    const actions: unknown[] = []
    const row = { id: 7, name: 'Ada', description: 'Administrator', avatar: '/ada.png', updatedAt: '2026-08-10', status: 'active' }
    const columns: TableColumn[] = [
      { field: 'name', label: 'Name', kind: 'entity', descriptionField: 'description', imageField: 'avatar', sortable: true },
      { field: 'updatedAt', label: 'Updated', kind: 'date' },
      { field: 'status', label: 'Status', kind: 'badge', valueMap: { active: 'Active' }, toneMap: { active: 'success' } },
      { field: 'actions', label: 'Actions', kind: 'actions', actions: [{ value: 'edit', label: 'Edit', icon: 'i-hugeicons-pencil', tone: 'warning' }] },
    ]
    const { container, root } = await mount(
      <LumiTable
        rows={[row]}
        columns={columns}
        onSort={next => sorts.push(next)}
        onRowClick={next => rowClicks.push(next)}
        onRowAction={next => actions.push(next)}
      />,
    )
    expect(container.querySelector('[data-slot="table-entity"]')?.textContent).toContain('Administrator')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/ada.png')
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe('2026-08-10')
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute('data-tone')).toBe('success')
    const sort = container.querySelector<HTMLButtonElement>('button[aria-label^="Sort Name"]')!
    await act(async () => sort.click())
    await act(async () => sort.click())
    expect(sorts).toEqual([[{ field: 'name', order: 'asc' }], [{ field: 'name', order: 'desc' }]])
    const tableRow = container.querySelector<HTMLTableRowElement>('tbody tr')!
    await act(async () => tableRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(rowClicks).toEqual([row])
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Row actions 7"]')!.click())
    const edit = document.body.querySelector<HTMLButtonElement>('button[data-tone="warning"]')!
    expect(edit.querySelector('[data-lumi-icon="hugeicons"]')).not.toBeNull()
    await act(async () => edit.click())
    expect(actions).toEqual([{ action: 'edit', row }])
    expect(rowClicks).toEqual([row])
    await act(async () => root.render(<LumiTable loading rows={[]} columns={[{ field: 'name', label: 'Name' }]} />))
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelectorAll('[data-slot="table-skeleton"]')).toHaveLength(5)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps sorting and column order controlled by the neutral table contract', async () => {
    const sorts: Array<Array<{ field: string, order: 'asc' | 'desc' }>> = []
    const rows = [{ id: 7, name: 'Ada', status: 'Active' }]
    const columns = [
      { field: 'name', label: 'Name', sortable: true },
      { field: 'status', label: 'Status' },
    ]
    const { container, root } = await mount(
      <LumiTable
        rows={rows}
        columns={columns}
        columnOrder={['status', 'name']}
        sorters={[{ field: 'name', order: 'desc' }]}
        onSort={next => sorts.push(next)}
      />,
    )
    expect(Array.from(container.querySelectorAll('thead th'), cell => cell.textContent?.trim())).toEqual(['Status', 'Name'])
    const sort = container.querySelector<HTMLButtonElement>('button[aria-label^="Sort Name"]')!
    expect(sort.closest('th')?.getAttribute('aria-sort')).toBe('descending')
    await act(async () => sort.click())
    expect(sorts).toEqual([[{ field: 'name', order: 'asc' }]])

    await act(async () => root.render(
      <LumiTable
        rows={rows}
        columns={columns}
        columnOrder={['status', 'name']}
        sorters={[{ field: 'name', order: 'asc' }]}
        onSort={next => sorts.push(next)}
      />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label^="Sort Name"]')!.click())
    expect(sorts.at(-1)).toEqual([{ field: 'name', order: 'desc' }])
    await act(async () => root.unmount())
    container.remove()
  })

  it('wraps the selection and toggles line marks in RichText', async () => {
    const changes: string[] = []
    const { container, root } = await mount(<LumiRichText defaultValue="release notes" ariaLabel="Body" onChange={next => changes.push(next)} />)
    const field = container.querySelector<HTMLTextAreaElement>('textarea')!
    field.setSelectionRange(0, 7)
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')!.click())
    expect(changes.at(-1)).toBe('**release** notes')
    field.setSelectionRange(0, 0)
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Bullet list"]')!.click())
    expect(changes.at(-1)).toBe('- **release** notes')
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Bullet list"]')!.click())
    expect(changes.at(-1)).toBe('**release** notes')
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Body formatting')
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders DescriptionList pairs and a table totals footer', async () => {
    const list = renderToStaticMarkup(<LumiDescriptionList items={[{ label: 'Placed', value: '2026-08-10' }, { label: 'Note', value: null }]} />)
    expect(list).toContain('<dt')
    expect(list).toContain('2026-08-10')
    expect(list).toContain('—')
    const { container, root } = await mount(
      <LumiTable
        rows={[{ id: 1, item: 'Keyboard' }]}
        columns={[{ field: 'item', label: 'Item' }, { field: 'price', label: 'Price' }]}
        totals={[{ label: 'Subtotal', value: '€120.00' }, { label: 'Total', value: '€132.00', emphasis: true }]}
      />,
    )
    const footerRows = container.querySelectorAll('tfoot tr')
    expect(footerRows).toHaveLength(2)
    expect(footerRows[0].querySelector('td')?.getAttribute('colspan')).toBe('1')
    expect(footerRows[1].getAttribute('data-emphasis')).toBe('true')
    expect(container.querySelectorAll('[data-slot="table-total"]')[1].textContent).toBe('€132.00')
    await act(async () => root.unmount())
    container.remove()
  })

  it('formats currency and datetime columns and keeps money right-aligned', async () => {
    const { container, root } = await mount(
      <LumiTable
        rows={[{ id: 1, amount: 1234.5, placedAt: '2026-08-10T09:30:00.000Z', refund: 'n/a' }]}
        columns={[
          { field: 'amount', label: 'Amount', kind: 'currency', currency: 'EUR' },
          { field: 'placedAt', label: 'Placed', kind: 'datetime' },
          { field: 'refund', label: 'Refund', kind: 'currency' },
        ]}
      />,
    )
    const cells = container.querySelectorAll<HTMLTableCellElement>('tbody td')
    expect(container.querySelector('[data-slot="table-currency"]')?.textContent).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(1234.5))
    expect(cells[0].style.textAlign).toBe('right')
    expect(container.querySelector<HTMLTableCellElement>('thead th')?.style.textAlign).toBe('right')
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe('2026-08-10T09:30:00.000Z')
    // A table stamp is scanned down the column, so it drops the year and the
    // meridiem and keeps the full value in the title.
    const stampParts = new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date('2026-08-10T09:30:00.000Z'))
    const stampPart = (type: Intl.DateTimeFormatPartTypes): string => stampParts.find(entry => entry.type === type)?.value ?? ''
    expect(container.querySelector('time')?.textContent).toBe(`${stampPart('month')}/${stampPart('day')} ${stampPart('hour')}:${stampPart('minute')}`)
    expect(container.querySelector('time')?.getAttribute('title')).toBe(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-08-10T09:30:00.000Z')))
    expect(cells[2].textContent).toBe('n/a')
    await act(async () => root.unmount())
    container.remove()
  })

  it('associates FormField labels and submits non-native control values', async () => {
    const { container, root } = await mount(
      <LumiForm>
        <LumiFormField name="project" label="Project" widget="Select" defaultValue="alpha" appearance="filled" options={[{ label: 'Alpha', value: 'alpha' }]} />
        <LumiFormField name="tags" label="Tags" widget="MultiSelect" defaultValue={['stable']} appearance="filled" options={[{ label: 'Stable', value: 'stable' }]} />
        <LumiFormField name="publishedAt" label="Published at" widget="DatePicker" defaultValue="2026-08-10" appearance="filled" />
        <LumiFormField name="attachments" label="Attachments" widget="Upload" defaultValue={['/report.pdf']} appearance="filled" />
      </LumiForm>,
    )
    for (const label of Array.from(container.querySelectorAll('label'))) {
      expect(label.htmlFor, label.textContent ?? '').not.toBe('')
      expect(container.contains(document.getElementById(label.htmlFor)), label.textContent ?? '').toBe(true)
    }
    const values = new FormData(container.querySelector('form')!)
    expect(values.get('project')).toBe('alpha')
    expect(values.get('tags')).toBe('["stable"]')
    expect(values.get('publishedAt')).toBe('2026-08-10')
    expect(values.get('attachments')).toBe('["/report.pdf"]')
    expect(container.querySelectorAll('[data-appearance="filled"]').length).toBeGreaterThanOrEqual(4)
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders string tab content and makes disabled links inert', async () => {
    const tabs = renderToStaticMarkup(<LumiTabs aria-label="Settings sections" defaultValue="overview" items={[{ label: 'Overview', value: 'overview', content: 'Ready' }]} />)
    expect(tabs).toContain('Ready')
    expect(tabs).toContain('aria-label="Settings sections"')
    const clicks = vi.fn()
    const { container, root } = await mount(<LumiButton href="/unsafe" label="Unavailable" disabled onClick={clicks} />)
    const link = container.querySelector('a')!
    expect(link.hasAttribute('href')).toBe(false)
    expect(link.getAttribute('aria-disabled')).toBe('true')
    await act(async () => link.click())
    expect(clicks).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    container.remove()
  })

  it('removes disabled pagination links from the tab order', async () => {
    // Numbered by default: previous, pages 1 to 3 and next, all out of the tab order while disabled.
    const { container, root } = await mount(<LumiPagination page={1} pageSize={10} total={30} disabled onPageChange={() => {}} />)
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
    expect(links).toHaveLength(5)
    expect(links.find(link => link.getAttribute('aria-current') === 'page')?.textContent).toBe('1')
    expect(links.every(link => link.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(links.every(link => link.tabIndex === -1)).toBe(true)
    await act(async () => root.unmount())
    container.remove()

    // The simple variant spells out the position between the arrows instead.
    const simple = await mount(<LumiPagination page={1} pageSize={10} total={30} disabled variant="simple" onPageChange={() => {}} />)
    const arrows = Array.from(simple.container.querySelectorAll<HTMLAnchorElement>('a'))
    expect(arrows).toHaveLength(2)
    expect(simple.container.textContent).toContain('1 / 3')
    expect(arrows.every(link => link.tabIndex === -1)).toBe(true)
    await act(async () => simple.root.unmount())
    simple.container.remove()
  })

  it('folds long page runs into an ellipsis around the current page', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(paginationRange(2, 13)).toEqual([1, 2, 3, 4, 5, 'gap', 13])
    expect(paginationRange(7, 13)).toEqual([1, 'gap', 6, 7, 8, 'gap', 13])
    expect(paginationRange(12, 13)).toEqual([1, 'gap', 9, 10, 11, 12, 13])
  })

  it('jumps to a typed page from the ellipsis and ignores pages out of range', async () => {
    const onPageChange = vi.fn()
    const { container, root } = await mount(<LumiPagination page={7} pageSize={10} total={130} onPageChange={onPageChange} />)
    const gaps = container.querySelectorAll<HTMLButtonElement>('[data-slot="pagination-ellipsis"]')
    expect(gaps).toHaveLength(2)
    await act(async () => gaps[1]!.click())
    const field = document.querySelector<HTMLInputElement>('[data-slot="pagination-jump"] input')!
    expect(document.activeElement).toBe(field)
    const type = async (value: string): Promise<void> => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const submit = async (): Promise<void> => act(async () => field.form!.requestSubmit())
    await type('99')
    await submit()
    expect(onPageChange).not.toHaveBeenCalled()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    await type('12')
    await submit()
    expect(onPageChange).toHaveBeenCalledWith(12)
    expect(document.querySelector('[data-slot="pagination-jump"]')).toBeNull()
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders the ReUI-derived Frame structure without decorative shadows', () => {
    const html = renderToStaticMarkup(<LumiFrame title="Orders" description="Recent activity" summary="12 total" appearance="filled">Table</LumiFrame>)
    expect(html).toContain('data-slot="frame"')
    expect(html).toContain('data-variant="inverse"')
    expect(html).toContain('data-slot="frame-panel"')
    expect(html).toContain('12 total')
  })

  it('keeps Filters explicit application local until apply and disables loading controls', async () => {
    const changes: Array<Record<string, unknown>> = []
    const schema = { fields: [{ field: 'query', label: 'Search', widget: 'search' as const }] }
    const { container, root } = await mount(<LumiFilters schema={schema} applyMode="explicit" defaultValue={{ query: 'draft' }} toolbarStart={<span>Saved views</span>} toolbarEnd={<button type="button">Columns</button>} onChange={next => changes.push(next)} />)
    const toolbar = container.querySelector('[data-slot="filters-toolbar"]')!
    expect(toolbar.firstElementChild?.getAttribute('data-slot')).toBe('filters-toolbar-start')
    expect(toolbar.firstElementChild?.textContent).toBe('Saved views')
    expect(toolbar.lastElementChild?.textContent).toContain('Columns')
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'ready')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(changes).toEqual([])
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Apply')!.click())
    expect(changes).toEqual([{ query: 'ready' }])
    await act(async () => root.render(<LumiFilters schema={schema} applyMode="explicit" loading />))
    expect(container.querySelector('[data-slot="filters"]')?.getAttribute('aria-busy')).toBe('true')
    expect(Array.from(container.querySelectorAll('input,button')).every(control => (control as HTMLInputElement | HTMLButtonElement).disabled)).toBe(true)
    await act(async () => root.unmount())
    container.remove()
  })

  it('emits immediate Filters values while preserving a controlled display value', async () => {
    const changes: Array<Record<string, unknown>> = []
    const schema = { fields: [{ field: 'query', label: 'Search', widget: 'search' as const }] }
    const { container, root } = await mount(<LumiFilters schema={schema} applyMode="immediate" value={{ query: 'fixed' }} onChange={next => changes.push(next)} />)
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'attempt')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      // Typing settles before it is committed.
      expect(changes).toEqual([])
      await new Promise(resolve => setTimeout(resolve, 350))
    })
    expect(changes).toEqual([{ query: 'attempt' }])
    expect(input.value).toBe('fixed')
    await act(async () => root.unmount())
    container.remove()
  })

  it('preserves a controlled explicit draft across equal parent renders and syncs real external changes', async () => {
    const schema = { fields: [{ field: 'query', label: 'Search', widget: 'search' as const }] }
    function Harness(): React.ReactElement {
      const [revision, setRevision] = useState(0)
      const [value, setValue] = useState({ query: 'committed' })
      return (
        <>
          <button type="button" onClick={() => setRevision(current => current + 1)}>Rerender parent</button>
          <button type="button" onClick={() => setValue({ query: 'external' })}>External change</button>
          <span data-testid="revision">{revision}</span>
          <LumiFilters schema={schema} applyMode="explicit" value={{ ...value }} onChange={setValue} />
        </>
      )
    }
    const { container, root } = await mount(<Harness />)
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'draft')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Rerender parent')!.click())
    expect(input.value).toBe('draft')
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'External change')!.click())
    expect(input.value).toBe('external')
    await act(async () => root.unmount())
    container.remove()
  })

  it('implements primary, advanced, cascader, range preset, condition, and apply-mode filter semantics', async () => {
    const schema: ListFilterSchema = {
      fields: [
        { field: 'query', label: 'Search', widget: 'search', primary: true },
        {
          field: 'category',
          label: 'Category',
          widget: 'cascader',
          options: [{ label: 'Products', value: 'products', children: [{ label: 'Hardware', value: 'hardware' }] }],
        },
        { field: 'created', label: 'Created', widget: 'dateRange', presets: [{ label: 'Last week', value: ['2026-08-03', '2026-08-10'] }] },
        { field: 'amount', label: 'Amount', widget: 'numberRange', presets: [{ label: 'High value', value: [100, 500] }] },
      ],
      presets: [
        { name: 'ready', label: 'Ready only', conditions: [{ field: 'query', op: 'contains', value: 'ready' }] },
        { name: 'date-window', label: 'Date window', conditions: [{ field: 'created', op: 'gte', value: '2026-08-01' }, { field: 'created', op: 'lte', value: '2026-08-10' }] },
      ],
    }
    const explicitChanges: Array<Record<string, unknown>> = []
    const explicit = await mount(<LumiFilters schema={schema} applyMode="explicit" defaultValue={{ category: 'hardware' }} onChange={next => explicitChanges.push(next)} />)
    const primary = explicit.container.querySelector('[data-slot="filters-toolbar"] [data-slot="filters-field"][data-primary="true"]')
    expect(primary?.querySelector('input[aria-label="Search"]')).not.toBeNull()
    // The rest waits behind one toolbar toggle and only then unfolds, one
    // named row per field.
    expect(explicit.container.querySelector('[data-slot="filters-advanced"]')).toBeNull()
    const toggle = explicit.container.querySelector<HTMLButtonElement>('[data-slot="filters-advanced-toggle"]')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await act(async () => toggle.click())
    const advanced = explicit.container.querySelector<HTMLElement>('[data-slot="filters-advanced"]')!
    expect(toggle.getAttribute('aria-controls')).toBe(advanced.id)
    expect(advanced.querySelectorAll('[data-slot="filters-field"][data-layout="row"]')).toHaveLength(3)
    // One cascader shows the whole path of the stored leaf value.
    expect(advanced.querySelector('[data-slot="cascader"] button')?.textContent).toBe('Products / Hardware')
    const clickText = async (label: string): Promise<void> => {
      const button = Array.from(explicit.container.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent?.trim() === label)!
      await act(async () => button.click())
    }
    await clickText('Last week')
    expect(explicitChanges).toEqual([])
    await clickText('Apply')
    expect(explicitChanges.at(-1)).toEqual({ category: 'hardware', created: ['2026-08-03', '2026-08-10'] })
    // No summary row to close a chip in: the field is put back through the All
    // that leads its own row.
    const createdRow = Array.from(explicit.container.querySelectorAll<HTMLElement>('[data-slot="filters-field"][data-layout="row"]')).find(row => row.textContent?.startsWith('Created'))!
    await act(async () => Array.from(createdRow.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'All')!.click())
    expect(explicitChanges).toHaveLength(1)
    await clickText('Apply')
    expect(explicitChanges.at(-1)).toEqual({ category: 'hardware' })
    await clickText('Ready only')
    expect(explicitChanges).toHaveLength(2)
    await clickText('Apply')
    expect(explicitChanges.at(-1)).toEqual({ query: 'ready' })
    // The design drops the "conditions in force" chip row: each condition already
    // reads as the marked option in its row, and the count on the toggle covers
    // the ones the collapsed panel hides.
    expect(explicit.container.querySelector('[data-slot="filters-conditions"]')).toBeNull()
    await clickText('Reset')
    expect(explicitChanges).toHaveLength(3)
    await clickText('Apply')
    expect(explicitChanges.at(-1)).toEqual({})
    await clickText('Date window')
    expect(explicit.container.querySelector('button[aria-label="Created"]')?.textContent).toBe('2026-08-01 – 2026-08-10')
    await clickText('Apply')
    expect(explicitChanges.at(-1)).toEqual({ created: ['2026-08-01', '2026-08-10'] })
    await act(async () => explicit.root.unmount())
    explicit.container.remove()

    const immediateChanges: Array<Record<string, unknown>> = []
    const immediate = await mount(<LumiFilters schema={schema} applyMode="immediate" onChange={next => immediateChanges.push(next)} />)
    const clickImmediate = async (label: string): Promise<void> => {
      const button = Array.from(immediate.container.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent?.trim() === label)!
      await act(async () => button.click())
    }
    await act(async () => immediate.container.querySelector<HTMLButtonElement>('[data-slot="filters-advanced-toggle"]')!.click())
    await clickImmediate('High value')
    expect(immediateChanges.at(-1)).toEqual({ amount: [100, 500] })
    await clickImmediate('Ready only')
    expect(immediateChanges.at(-1)).toEqual({ query: 'ready' })
    await clickImmediate('Reset')
    expect(immediateChanges.at(-1)).toEqual({})
    await clickImmediate('Date window')
    expect(immediateChanges.at(-1)).toEqual({ created: ['2026-08-01', '2026-08-10'] })
    await clickImmediate('Ready only')
    await clickImmediate('Reset')
    expect(immediateChanges.at(-1)).toEqual({})
    await act(async () => immediate.root.unmount())
    immediate.container.remove()
  })

  it('supports Stepper keyboard navigation, raw keys, linear mode, and controlled values', async () => {
    const changes: string[] = []
    const items = [{ key: 'one', label: 'One' }, { key: 'two', label: 'Two' }, { key: 'three', label: 'Three' }]
    const { container, root } = await mount(
      <LumiStepper items={items} defaultValue="one" onChange={value => changes.push(value)}>
        First panel
        <span>Second panel</span>
      </LumiStepper>,
    )
    const triggers = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Progress')
    triggers[0]!.focus()
    await act(async () => triggers[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(document.activeElement).toBe(triggers[1])
    await act(async () => triggers[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(changes).toEqual(['two'])
    expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toBe('Second panel')
    await act(async () => root.render(<LumiStepper items={items} value="one" linear onChange={value => changes.push(value)} />))
    const controlled = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    expect(controlled[1]?.disabled).toBe(false)
    expect(controlled[2]?.disabled).toBe(true)
    expect(controlled[0]?.getAttribute('aria-selected')).toBe('true')
    await act(async () => root.unmount())
    container.remove()
  })

  it('exposes every Stepper state with visible non-color text and an accessible status name', () => {
    const states = ['complete', 'current', 'upcoming', 'loading', 'error'] as const
    const html = renderToStaticMarkup(<LumiStepper items={states.map(state => ({ key: state, label: state, status: state }))} />)
    for (const state of states) {
      const label = `${state[0]!.toUpperCase()}${state.slice(1)}`
      expect(html).toContain(`status: ${label}`)
      expect(html).toContain(`data-slot="stepper-status">${label}</span>`)
    }
    expect((html.match(/role="tab"/g) ?? [])).toHaveLength(states.length)
  })

  it('renders Timeline loading, empty, status, and light/dark theme semantics', () => {
    expect(renderToStaticMarkup(<LumiTimeline items={[]} loading />)).toContain('Loading timeline')
    const empty = renderToStaticMarkup(<LumiTimeline items={[]} empty="Nothing happened" />)
    expect(empty).toContain('Nothing happened')
    expect(empty).toContain('role="status"')
    for (const mode of ['light', 'dark'] as const) {
      const html = renderToStaticMarkup(
        <LumiThemeProvider mode={mode}>
          <LumiTimeline items={[{ key: 'created', title: 'Created', description: 'Order created', timestamp: '2026-08-10', tone: 'success', status: 'complete' }]} />
        </LumiThemeProvider>,
      )
      expect(html).toContain(`data-theme="${mode}"`)
      expect(html).toContain('data-tone="success"')
      expect(html).toContain('data-state="complete"')
      expect(html).toContain('dateTime="2026-08-10"')
    }
  })

  it('exposes the complete Timeline status and tone matrices without relying on color', () => {
    const statuses = ['complete', 'current', 'upcoming', 'loading', 'error'] as const
    const tones = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const
    const html = renderToStaticMarkup(
      <LumiTimeline items={tones.map((tone, index) => ({ key: tone, title: tone, tone, status: statuses[index % statuses.length] }))} />,
    )
    for (const status of statuses) {
      const label = `${status[0]!.toUpperCase()}${status.slice(1)}`
      expect(html).toContain(`aria-label="Status: ${label}"`)
      expect(html).toContain(`${label}</span>`)
    }
    for (const tone of tones) {
      const label = `${tone[0]!.toUpperCase()}${tone.slice(1)}`
      expect(html).toContain(`aria-label="Tone: ${label}"`)
      expect(html).toContain(`Tone: ${label}</span>`)
    }
    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    expect(css).toMatch(/\[data-theme="light"\][\s\S]*--lumi-ui-tone-success: var\(--chart-2\)/)
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*--lumi-ui-tone-success: var\(--success\)/)
    // Info is the brand in both themes; the dark brand is already lifted for contrast.
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*--lumi-ui-tone-info: var\(--info\)/)
    expect(css).toMatch(/--info: var\(--lumi-theme-info, var\(--brand\)\)/)
    expect(css).not.toMatch(/\[data-slot="timeline[^\n]*#[0-9a-f]{3,8}/i)
  })

  it('resolves system color preference and reacts to preference changes', async () => {
    let dark = false
    let listener: (() => void) | undefined
    const removeEventListener = vi.fn()
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => ({
      get matches() { return dark },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type, next: EventListenerOrEventListenerObject) => {
        listener = typeof next === 'function' ? () => next(new Event('change')) : () => next.handleEvent(new Event('change'))
      }),
      removeEventListener,
      dispatchEvent: vi.fn(() => true),
    }))
    try {
      const { container, root } = await mount(<LumiThemeProvider mode="system">Content</LumiThemeProvider>)
      expect(container.firstElementChild?.getAttribute('data-theme')).toBe('light')
      dark = true
      await act(async () => listener?.())
      expect(container.firstElementChild?.getAttribute('data-theme')).toBe('dark')
      await act(async () => root.unmount())
      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
      container.remove()
    }
    finally {
      window.matchMedia = original
    }
  })

  it('ships concrete appearance, overlay sizing, typography, and the Lumi neutral ramp', () => {
    const css = readFileSync(resolve(process.cwd(), basename(process.cwd()) === 'ui' ? 'src/style.css' : 'packages/ui/src/style.css'), 'utf8')
    expect(css).toContain('[data-appearance="filled"]')
    expect(css).toContain('[data-slot="dialog-content"][data-size="xl"]')
    expect(css).toContain('[data-slot="drawer-content"][data-size="lg"]')
    const tokens = readFileSync(resolve(import.meta.dirname, '../src/tokens.css'), 'utf8')
    for (const step of ['caption', 'label', 'body', 'title', 'section', 'page', 'metric']) {
      expect(tokens).toContain(`var(--lumi-theme-font-${step}`)
      expect(css).toContain(`var(--lumi-fs-${step})`)
    }
    // Light surfaces are pure white, dark keeps muted ABOVE card, and dark
    // hairlines are translucent white. The ramp is seeded from zinc; primary
    // stays the neutral main action while brand carries emphasis and focus.
    expect(css).toMatch(/--card:\s*white;/)
    expect(css).toContain('--border: oklch(1 0 0 / 10%)')
    expect(css).toContain('var(--lumi-theme-neutral, oklch(0.552 0.016 285.938))')
    expect(css).toMatch(/--primary: var\(--lumi-theme-primary, color-mix\(in oklab, var\(--lumi-theme-neutral/)
    expect(css).toContain('--brand: var(--lumi-theme-brand, #2d5bff)')
    // A focused field: the brand edge over a faint brand tint, no halo.
    expect(css).toMatch(/--ring: color-mix\(in oklab, var\(--info\) 85%, transparent\)/)
    expect(tokens).toMatch(/--lumi-focus-bg: color-mix\(in oklab, var\(--brand\)/)
    expect(renderToStaticMarkup(<LumiButton appearance="brand" label="Hand off" />)).toContain('bg-brand')
    expect(css).not.toContain('--lumi-ui-frame-outer')
  })

  it('ships distinct semantic feedback tones, mobile targets, and reduced-motion overrides', () => {
    const badges = renderToStaticMarkup(<>{(['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const).map(tone => <LumiBadge key={tone} label={tone} tone={tone} appearance="solid" />)}</>)
    for (const tone of ['neutral', 'primary', 'success', 'warning', 'danger', 'info'])
      expect(badges).toContain(`data-tone="${tone}"`)
    expect(renderToStaticMarkup(<LumiAlert tone="success" title="Saved" />)).toContain('role="status"')
    expect(renderToStaticMarkup(<LumiAlert tone="danger" title="Failed" />)).toContain('role="alert"')
    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    for (const tone of ['neutral', 'primary', 'success', 'warning', 'danger', 'info'])
      expect(css).toContain(`[data-slot="badge"][data-tone="${tone}"]`)
    expect(css).toContain('[data-slot="button"][data-tone="warning"]')
    expect(css).toContain('@media (pointer: coarse)')
    expect(css).toContain('min-height: var(--lumi-control-touch)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('portals accessible dialog and drawer titles and restores focus', async () => {
    const focusTarget = document.createElement('button')
    document.body.append(focusTarget)
    focusTarget.focus()
    const { root } = await mount(<LumiDialog open title="Confirm deletion" size="xl">Body</LumiDialog>)
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('data-size')).toBe('xl')
    expect(document.body.textContent).toContain('Confirm deletion')
    await act(async () => root.render(<LumiDialog open={false} title="Confirm deletion">Body</LumiDialog>))
    expect(document.activeElement).toBe(focusTarget)
    await act(async () => root.render(<LumiDrawer open title="Edit product" size="lg">Drawer body</LumiDrawer>))
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('data-size')).toBe('lg')
    expect(document.body.textContent).toContain('Edit product')
    await act(async () => root.unmount())
    focusTarget.remove()
  })

  it('pins overlay header and footer around a scrolling body', async () => {
    const dialog = await mount(
      <LumiDialog open title="Edit" confirmText="Save" cancelText="Cancel" footerStart={<span>Draft</span>}>Body</LumiDialog>,
    )
    const content = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
    const bands = Array.from(content.children).map(child => child.getAttribute('data-slot'))
    expect(bands.slice(0, 3)).toEqual(['dialog-header', 'lumi-overlay-body', 'dialog-footer'])
    const body = content.querySelector<HTMLElement>('[data-slot="lumi-overlay-body"]')!
    expect(body.className).toContain('overflow-y-auto')
    const footer = content.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!
    // The primary commit stays last, so it lands rightmost once the footer justifies to the end.
    expect(Array.from(footer.querySelectorAll('button')).map(button => button.textContent)).toEqual(['Cancel', 'Save'])
    expect(footer.textContent).toContain('Draft')
    await act(async () => dialog.root.unmount())
    dialog.container.remove()

    const drawer = await mount(
      <LumiDrawer open title="Filters" footerEnd={<button type="button">Apply</button>}>Drawer body</LumiDrawer>,
    )
    const drawerContent = document.body.querySelector<HTMLElement>('[data-slot="drawer-content"]')!
    expect(drawerContent.querySelector('[data-slot="lumi-overlay-body"]')?.className).toContain('flex-1')
    expect(drawerContent.querySelector('[data-slot="drawer-footer"]')?.textContent).toBe('Apply')
    await act(async () => drawer.root.unmount())
    drawer.container.remove()

    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto;')
    expect(css).toContain('oklch(0 0 0 / 0.5)')
    expect(css).toContain('[data-slot="dialog-footer"]')
    expect(css).toContain('padding: var(--lumi-surface-band) var(--lumi-surface-padding);')
    // sm / md / lg drawers are 384 / 480 / 720 px.
    for (const size of ['24rem', '30rem', '45rem'])
      expect(css).toContain(`--lumi-ui-drawer-size: ${size};`)
  })

  it('sizes dialogs to their content and renders a bodiless dialog as a compact confirmation', async () => {
    const standard = await mount(<LumiDialog open title="Edit" confirmText="Save">Body</LumiDialog>)
    const content = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
    expect(content.getAttribute('data-size')).toBe('md')
    expect(content.hasAttribute('data-layout')).toBe(false)
    expect(content.querySelector('[data-slot="dialog-close"]')).not.toBeNull()
    await act(async () => standard.root.unmount())
    standard.container.remove()

    const confirm = await mount(
      <LumiDialog open title="Discard unsaved changes?" description="Leave and discard them?" tone="danger" confirmText="Discard and leave" cancelText="Keep editing" />,
    )
    const compact = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
    expect(compact.getAttribute('data-layout')).toBe('confirm')
    expect(compact.hasAttribute('data-size')).toBe(false)
    expect(Array.from(compact.children).map(child => child.getAttribute('data-slot'))).toEqual(['dialog-header', 'dialog-footer'])
    // The decision buttons are the way out, so no corner close icon competes with them.
    expect(compact.querySelector('[data-slot="dialog-close"]')).toBeNull()
    const buttons = Array.from(compact.querySelectorAll<HTMLElement>('[data-slot="dialog-footer"] button'))
    expect(buttons.map(button => [button.textContent, button.getAttribute('data-variant')])).toEqual([['Keep editing', 'outline'], ['Discard and leave', 'destructive']])
    await act(async () => confirm.root.unmount())
    confirm.container.remove()

    // The tone picks the confirmation's icon; a name overrides it and false drops it.
    const shapes = (html: string) => html.match(/ d="[^"]+"/g)?.join('')
    for (const [props, Glyph, tint] of [
      [{ tone: 'danger', cancelText: 'Keep' }, WarningIcon, 'bg-(--lumi-danger)/10'],
      [{ tone: 'warning', cancelText: 'Keep' }, WarningIcon, 'bg-(--lumi-warning)/14'],
      [{ tone: 'info', cancelText: 'Keep' }, InfoIcon, 'bg-(--lumi-info)/10'],
      [{ tone: 'success' }, CheckCircleIcon, 'bg-(--lumi-success)/10'],
      [{ cancelText: 'Keep' }, HelpCircleIcon, 'bg-muted'],
      [{}, InfoIcon, 'bg-muted'],
      [{ tone: 'danger', icon: 'delete-02', cancelText: 'Keep' }, TrashIcon, 'bg-(--lumi-danger)/10'],
    ] as const) {
      const toned = await mount(<LumiDialog open title="Delete product?" confirmText="OK" {...props} />)
      const header = document.body.querySelector<HTMLElement>('[data-slot="dialog-header"]')!
      const media = header.firstElementChild as HTMLElement
      expect(media.getAttribute('data-slot')).toBe('dialog-media')
      expect(media.getAttribute('aria-hidden')).toBe('true')
      expect(media.className).toContain(tint)
      expect(shapes(media.innerHTML)).toBe(shapes(renderToStaticMarkup(<Glyph />)))
      // Title and description stack in one block that is at least the icon's height,
      // so short text centres on the icon and taller text hangs from its top.
      const heading = media.nextElementSibling as HTMLElement
      expect(heading.getAttribute('data-slot')).toBe('dialog-heading')
      expect(heading.className).toContain('min-h-10')
      expect(heading.className).toContain('justify-center')
      expect(heading.firstElementChild?.getAttribute('data-slot')).toBe('dialog-title')
      await act(async () => toned.root.unmount())
      toned.container.remove()
    }
    const plain = await mount(<LumiDialog open title="Delete product?" tone="danger" icon={false} confirmText="Delete" cancelText="Keep" />)
    expect(document.body.querySelector('[data-slot="dialog-media"]')).toBeNull()
    await act(async () => plain.root.unmount())
    plain.container.remove()
    const form = await mount(<LumiDialog open title="Edit" description="3 of 128 rows shown." tone="danger" confirmText="Save">Body</LumiDialog>)
    expect(document.body.querySelector('[data-slot="dialog-media"]')).toBeNull()
    // The description belongs to the header, under the title, apart from the body.
    const formHeader = document.body.querySelector<HTMLElement>('[data-slot="dialog-header"]')!
    expect(Array.from(formHeader.children).map(child => child.getAttribute('data-slot'))).toEqual(['dialog-title', 'dialog-description'])
    expect(document.body.querySelector('[data-slot="lumi-overlay-body"]')!.textContent).toBe('Body')
    await act(async () => form.root.unmount())
    form.container.remove()
    const drawer = await mount(<LumiDrawer open title="Order" description="Paid by card.">Body</LumiDrawer>)
    const drawerHeader = document.body.querySelector<HTMLElement>('[data-slot="drawer-header"]')!
    expect(Array.from(drawerHeader.children).map(child => child.getAttribute('data-slot'))).toEqual(['drawer-title', 'drawer-description'])
    expect(document.body.querySelector('[data-slot="drawer-content"] > [data-slot="drawer-close"]')).not.toBeNull()
    await act(async () => drawer.root.unmount())
    drawer.container.remove()

    // A bodiless dialog with nothing to press keeps the close icon as its exit.
    const bare = await mount(<LumiDialog open title="Notice" />)
    const bareContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
    expect(bareContent.hasAttribute('data-layout')).toBe(false)
    expect(bareContent.querySelector('[data-slot="dialog-close"]')).not.toBeNull()
    expect(bareContent.querySelector('[data-slot="lumi-overlay-body"]')).toBeNull()
    await act(async () => bare.root.unmount())
    bare.container.remove()

    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    // Width follows the content between three quarters of the ceiling and the
    // ceiling; a confirmation without a size tops out at 448px.
    expect(css).toContain('width: max-content;')
    expect(css).toContain('min-width: min(var(--lumi-ui-dialog-max, 28rem) * 0.75, 100% - 2rem);')
    expect(css).toContain('max-width: min(var(--lumi-ui-dialog-max, 28rem), 100% - 2rem);')
    for (const [size, ceiling] of [['sm', '24rem'], ['md', '32rem'], ['lg', '42rem'], ['xl', '56rem']])
      expect(css).toContain(`[data-slot="dialog-content"][data-size="${size}"] { --lumi-ui-dialog-max: ${ceiling}; }`)
  })

  it('restores focus after an uncontrolled default-open dialog closes', async () => {
    const focusTarget = document.createElement('button')
    document.body.append(focusTarget)
    focusTarget.focus()
    const { container, root } = await mount(<LumiDialog defaultOpen title="Default open">Body</LumiDialog>)
    const close = document.body.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!
    await act(async () => {
      close.click()
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(focusTarget)
    await act(async () => root.unmount())
    container.remove()
    focusTarget.remove()
  })

  it('keeps chips single-select while tags remain multi-select', async () => {
    const chipChanges: Array<Record<string, unknown>> = []
    const tagChanges: Array<Record<string, unknown>> = []
    const chips = await mount(<LumiFilters applyMode="immediate" schema={{ fields: [{ field: 'status', label: 'Status', widget: 'chips', options: [{ label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }] }] }} onChange={next => chipChanges.push(next)} />)
    // The row leads with an All chip, so the unfiltered state is a position in
    // the row rather than something the reader has to know how to get back to.
    const [all, ...radios] = Array.from(chips.container.querySelectorAll<HTMLElement>('[role="radio"]'))
    expect(all!.textContent).toBe('All')
    expect(all!.getAttribute('data-state')).toBe('checked')
    await act(async () => radios[0]!.click())
    await act(async () => radios[1]!.click())
    expect(chipChanges).toEqual([{ status: 'active' }, { status: 'draft' }])
    expect(radios[0]!.getAttribute('data-state')).toBe('unchecked')
    expect(radios[1]!.getAttribute('data-state')).toBe('checked')
    await act(async () => all!.click())
    expect(chipChanges.at(-1)).toEqual({})
    expect(all!.getAttribute('data-state')).toBe('checked')
    await act(async () => radios[1]!.click())
    const clear = Array.from(chips.container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Reset')!
    await act(async () => clear.click())
    expect(chipChanges.at(-1)).toEqual({})
    expect(radios[0]!.getAttribute('data-state')).toBe('unchecked')
    expect(radios[1]!.getAttribute('data-state')).toBe('unchecked')
    await act(async () => chips.root.unmount())
    chips.container.remove()

    const tags = await mount(<LumiFilters applyMode="immediate" schema={{ fields: [{ field: 'status', label: 'Status', widget: 'tags', options: [{ label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }] }] }} onChange={next => tagChanges.push(next)} />)
    const checkboxes = Array.from(tags.container.querySelectorAll<HTMLElement>('[role="checkbox"]'))
    await act(async () => checkboxes[0]!.click())
    await act(async () => checkboxes[1]!.click())
    expect(tagChanges).toEqual([{ status: ['active'] }, { status: ['active', 'draft'] }])
    await act(async () => tags.root.unmount())
    tags.container.remove()
  })

  it('lays a range field out as All plus presets ahead of the exact bounds', async () => {
    const changes: Array<Record<string, unknown>> = []
    const { container, root } = await mount(
      <LumiFilters
        applyMode="immediate"
        schema={{ fields: [
          { field: 'name', label: 'Search', widget: 'search', primary: true },
          { field: 'price', label: 'Price', widget: 'numberRange', presets: [{ label: '< $20', value: [0, 20] }, { label: '$20 – $50', value: [20, 50] }] },
        ] }}
        onChange={next => changes.push(next)}
      />,
    )
    await act(async () => container.querySelector<HTMLButtonElement>('[data-slot="filters-advanced-toggle"]')!.click())
    const presets = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-slot="filters-field-presets"] button'))
    expect(presets.map(button => button.textContent)).toEqual(['All', '< $20', '$20 – $50'])
    // An unset range reads as All, and picking a preset moves the mark onto it
    // — the same feedback an enumeration gives, because it is the same control.
    expect(presets[0]!.getAttribute('data-state')).toBe('checked')
    await act(async () => presets[2]!.click())
    expect(changes.at(-1)).toEqual({ price: [20, 50] })
    expect(presets[2]!.getAttribute('data-state')).toBe('checked')
    expect(presets[0]!.getAttribute('data-state')).toBe('unchecked')
    await act(async () => presets[0]!.click())
    expect(changes.at(-1)).toEqual({})
    await act(async () => root.unmount())
    container.remove()
  })

  it('gives a sized control a height class the primitive cannot outrank', async () => {
    const { container, root } = await mount(<LumiInput size="sm" ariaLabel="Minimum" />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('data-lumi-control-size')).toBe('sm')
    // `Input` bakes in `h-control-md`; the size only lands if `twMerge` drops it, since a
    // `@layer components` rule loses to any utility whatever its specificity.
    expect(input.className).toContain('h-control-sm')
    expect(input.className).not.toContain('h-control-md')
    await act(async () => root.unmount())
    container.remove()
  })
})
