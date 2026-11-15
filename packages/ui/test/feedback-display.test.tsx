// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/definitions.js'
import { LumiCalendar } from '../src/components/calendar.js'
import { LumiTable } from '../src/components/display.js'
import { LumiEmpty } from '../src/components/empty.js'
import { LumiKbd } from '../src/components/kbd.js'
import { LumiListbox } from '../src/components/listbox.js'
import { LumiScrollArea } from '../src/components/scroll-area.js'
import { LumiSkeleton } from '../src/components/skeleton.js'
import { LumiLoading, LumiSpinner } from '../src/components/spinner.js'
import { LumiTag, LumiTagGroup } from '../src/components/tag.js'
import { uiRegistry } from '../src/react/index.js'
import { uiCatalog } from '../src/react/registry.js'

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

function key(target: Element, name: string): Promise<void> {
  return act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  })
}

describe('skeleton and loading', () => {
  it('draws text lines of natural widths with a short last line, inside a named status', async () => {
    const host = await mount(<LumiSkeleton lines={4} label="Loading orders" />)
    const status = host.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toBe('Loading orders')
    const widths = Array.from(host.querySelectorAll<HTMLElement>('[data-skeleton]'), node => node.style.width)
    expect(widths).toHaveLength(4)
    expect(new Set(widths).size).toBeGreaterThan(2)
    expect(widths.at(-1)).toBe('62%')
  })

  it('composes a list-row preset and can stay still', async () => {
    const host = await mount(<LumiSkeleton variant="list-row" lines={2} animated={false} />)
    expect(host.querySelectorAll('[data-slot="skeleton-row"]')).toHaveLength(2)
    expect(host.querySelector('[data-skeleton="shimmer"]')).toBeNull()
  })

  it('reuses the skeleton shape in the table loading rows', async () => {
    const host = await mount(<LumiTable aria-label="Rows" columns={[{ field: 'name', label: 'Name' }]} rows={[]} loading />)
    const cells = host.querySelectorAll('[data-slot="table-skeleton"]')
    expect(cells).toHaveLength(5)
    expect(cells[0]!.getAttribute('data-skeleton')).toBe('shimmer')
  })

  it('speaks a spinner label and shows it only when asked', async () => {
    const hidden = await mount(<LumiSpinner label="Saving" />)
    expect(hidden.querySelector('[role="status"] .sr-only')?.textContent).toBe('Saving')
    const shown = await mount(<LumiSpinner label="Saving" showLabel size="lg" tone="brand" />)
    expect(shown.querySelector('.sr-only')).toBeNull()
    expect(shown.textContent).toBe('Saving')
    expect(shown.querySelector('svg')?.getAttribute('class')).toContain('text-brand')
  })

  it('centres a loading block with a minimum height', async () => {
    const host = await mount(<LumiLoading label="Loading report" description="Crunching" minHeight={180} />)
    const block = host.querySelector<HTMLElement>('[data-slot="loading"]')!
    expect(block.getAttribute('role')).toBe('status')
    expect(block.style.minHeight).toBe('180px')
    expect(block.textContent).toContain('Crunching')
  })
})

describe('empty state', () => {
  it('leads with a tinted glyph, says why and what next, and keeps the way forward below', async () => {
    const host = await mount(
      <LumiEmpty size="md" tone="danger" title="Orders unavailable" description="Try again in a moment." headingLevel={2} role="alert">
        <button type="button">Retry</button>
      </LumiEmpty>,
    )
    const empty = host.querySelector<HTMLElement>('[data-slot="empty"]')!
    expect(empty.getAttribute('role')).toBe('alert')
    expect(empty.dataset.size).toBe('md')
    expect(empty.dataset.tone).toBe('danger')
    const media = empty.querySelector('[data-slot="empty-icon"]')!
    expect(media.getAttribute('aria-hidden')).toBe('true')
    expect(media.getAttribute('data-variant')).toBe('icon')
    expect(media.querySelector('svg')).not.toBeNull()
    const title = empty.querySelector('[data-slot="empty-title"]')!
    expect(title.getAttribute('role')).toBe('heading')
    expect(title.getAttribute('aria-level')).toBe('2')
    expect(title.textContent).toBe('Orders unavailable')
    expect(empty.querySelector('[data-slot="empty-description"]')?.textContent).toBe('Try again in a moment.')
    expect(empty.querySelector('[data-slot="empty-content"] button')?.textContent).toBe('Retry')
  })

  it('defaults to a plain sm figure with the inbox glyph and no live region', async () => {
    const host = await mount(<LumiEmpty />)
    const empty = host.querySelector<HTMLElement>('[data-slot="empty"]')!
    expect(empty.hasAttribute('role')).toBe(false)
    expect(empty.dataset.size).toBe('sm')
    expect(empty.querySelector('[data-slot="empty-title"]')?.textContent).toBe('No data')
    expect(empty.querySelector('[data-slot="empty-title"]')?.hasAttribute('role')).toBe(false)
    expect(empty.querySelector('[data-slot="empty-icon"] svg')).not.toBeNull()
    expect(empty.querySelector('[data-slot="empty-description"]')).toBeNull()
    expect(empty.querySelector('[data-slot="empty-content"]')).toBeNull()
  })

  it('keeps the one-line size free of the tinted tile', async () => {
    const host = await mount(<LumiEmpty size="xs" title="No matches" />)
    expect(host.querySelector('[data-slot="empty-icon"]')?.getAttribute('data-variant')).toBe('default')
  })

  it('fills an empty table with the sm figure from a title or a full description', async () => {
    const titled = await mount(<LumiTable columns={[{ field: 'name', label: 'Name' }]} rows={[]} empty="No orders yet" />)
    const cell = titled.querySelector('[data-slot="table-empty"]')!
    expect(cell.getAttribute('colspan')).toBe('1')
    expect(cell.querySelector('[data-slot="empty"]')?.getAttribute('data-size')).toBe('sm')
    expect(cell.querySelector('[role="status"]')?.textContent).toBe('No orders yet')
    const described = await mount(<LumiTable columns={[{ field: 'name', label: 'Name' }]} rows={[]} empty={{ title: 'No records match this filter', description: 'Try clearing the filters.', icon: 'search' }} />)
    expect(described.querySelector('[data-slot="empty-title"]')?.textContent).toBe('No records match this filter')
    expect(described.querySelector('[data-slot="empty-description"]')?.textContent).toBe('Try clearing the filters.')
    const hostDrawn = await mount(<LumiTable columns={[{ field: 'name', label: 'Name' }]} rows={[]} empty="" />)
    expect(hostDrawn.querySelector('[data-slot="table-empty"]')).toBeNull()
  })

  it('renders from a native Spec with a child action and validates the Table object form', async () => {
    const spec: Spec = {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['empty', 'table'] },
        empty: { type: 'Empty', props: { title: 'No orders yet', description: 'Orders show up here.', size: 'md' }, children: ['create'] },
        create: { type: 'Button', props: { label: 'Create order' }, children: [] },
        table: { type: 'Table', props: { columns: [{ field: 'name', label: 'Name' }], rows: [], empty: { title: 'Nothing here', description: 'Clear the filters.' } }, children: [] },
      },
    }
    expect(uiCatalog.validate(spec).success).toBe(true)
    expect(uiComponentDefinitions.Table.props.safeParse(spec.elements.table!.props).success).toBe(true)
    expect(uiComponentDefinitions.Table.props.safeParse({ columns: [], rows: [], empty: { description: 'Missing title' } }).success).toBe(false)
    const host = await mount(
      <JSONUIProvider registry={uiRegistry}>
        <Renderer spec={spec} registry={uiRegistry} />
      </JSONUIProvider>,
    )
    const empties = host.querySelectorAll('[data-slot="empty"]')
    expect(empties).toHaveLength(2)
    expect(empties[0]!.querySelector('[data-slot="empty-content"] button')?.textContent).toBe('Create order')
    expect(empties[1]!.querySelector('[data-slot="empty-description"]')?.textContent).toBe('Clear the filters.')
  })
})

describe('kbd and scroll area', () => {
  it('nests one key per chip and names modifier glyphs', async () => {
    const host = await mount(<LumiKbd keys={['⌘', 'K']} />)
    const group = host.querySelector('kbd[data-slot="kbd-group"]')!
    expect(group.querySelectorAll('kbd[data-slot="kbd"]')).toHaveLength(2)
    expect(group.textContent).toBe('⌘CommandK')
    const joined = await mount(<LumiKbd keys={['Ctrl', 'Shift', 'P']} separator="+" />)
    expect(joined.querySelectorAll('[data-slot="kbd-separator"]')).toHaveLength(2)
  })

  it('makes the viewport a named, focusable region with a max height', async () => {
    const host = await mount(<LumiScrollArea ariaLabel="Log" maxHeight={120}><p>Line</p></LumiScrollArea>)
    const viewport = host.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!
    expect(viewport.getAttribute('role')).toBe('region')
    expect(viewport.getAttribute('aria-label')).toBe('Log')
    expect(viewport.tabIndex).toBe(0)
    expect(viewport.style.maxHeight).toBe('120px')
  })
})

describe('tags', () => {
  it('carries badge tone attributes and a named remove button', async () => {
    const onClose = vi.fn()
    const host = await mount(<LumiTag label="Design" tone="success" appearance="outline" closable dot onClose={onClose} />)
    const tag = host.querySelector('[data-slot="tag"]')!
    expect(tag.getAttribute('data-tone')).toBe('success')
    expect(tag.getAttribute('data-appearance')).toBe('outline')
    const close = host.querySelector<HTMLButtonElement>('[data-slot="tag-close"]')!
    expect(close.getAttribute('aria-label')).toBe('Remove Design')
    await act(async () => close.click())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('toggles a checkable tag through aria-pressed', async () => {
    const onCheckedChange = vi.fn()
    const host = await mount(<LumiTag label="Urgent" checkable checked={false} onCheckedChange={onCheckedChange} />)
    const button = host.querySelector('button')!
    expect(button.getAttribute('aria-pressed')).toBe('false')
    await act(async () => button.click())
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('removes a value from a tag group and moves focus to the next tag', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiTagGroup defaultValue={['a', 'b', 'c']} labels={{ a: 'Alpha' }} onChange={onChange} />)
    expect(host.textContent).toContain('Alpha')
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[data-slot="tag-close"]')[0]!.click())
    expect(onChange).toHaveBeenLastCalledWith(['b', 'c'])
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove b')
  })

  it('selects chips from options, singly when multiple is false', async () => {
    const onChange = vi.fn()
    const options = [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }]
    const host = await mount(<LumiTagGroup options={options} multiple={false} value={['open']} onChange={onChange} />)
    const [open, closed] = host.querySelectorAll('button')
    expect(open!.getAttribute('aria-pressed')).toBe('true')
    await act(async () => closed!.click())
    expect(onChange).toHaveBeenLastCalledWith(['closed'])
  })

  it('keeps several picked chips in option order', async () => {
    const onChange = vi.fn()
    const options = [{ label: 'Web', value: 'web' }, { label: 'Market', value: 'market' }, { label: 'Retail', value: 'retail' }]
    const host = await mount(<LumiTagGroup options={options} value={['web', 'retail']} onChange={onChange} />)
    await act(async () => host.querySelectorAll('button')[1]!.click())
    expect(onChange).toHaveBeenLastCalledWith(['web', 'market', 'retail'])
  })
})

describe('calendar', () => {
  it('writes the picked day and blocks disabled dates and weekdays', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiCalendar month="2026-11" disabledDates={['2026-11-10']} disabledWeekdays={[0]} onChange={onChange} />)
    const day = (n: string): HTMLButtonElement => Array.from(host.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(button => button.textContent?.trim() === n && !button.closest('[data-outside]'))!
    expect(day('10').disabled).toBe(true)
    expect(day('8').disabled).toBe(true)
    await act(async () => day('12').click())
    expect(onChange).toHaveBeenLastCalledWith('2026-11-12')
  })

  it('completes a range on the second press and draws event dots', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiCalendar mode="range" month="2026-11" marks={[{ date: '2026-11-03', tone: 'danger', label: 'Release' }]} onChange={onChange} />)
    const day = (n: string): HTMLButtonElement => Array.from(host.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(button => button.textContent?.trim().startsWith(n) && !button.closest('[data-outside]'))!
    expect(day('3').querySelector('[data-slot="calendar-mark"]')?.getAttribute('data-tone')).toBe('danger')
    expect(day('3').textContent).toContain('Release')
    await act(async () => day('20').click())
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => day('14').click())
    expect(onChange).toHaveBeenLastCalledWith(['2026-11-14', '2026-11-20'])
  })
})

describe('listbox', () => {
  const options = [
    { label: 'Apple', value: 'apple', group: 'Fruit' },
    { label: 'Banana', value: 'banana', group: 'Fruit', disabled: true },
    { label: 'Carrot', value: 'carrot', group: 'Vegetable', description: 'Orange root' },
  ]

  it('moves with arrow keys past disabled options and picks with Enter', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiListbox ariaLabel="Food" options={options} onChange={onChange} />)
    const list = host.querySelector<HTMLElement>('[role="listbox"]')!
    await act(async () => list.focus())
    expect(list.getAttribute('aria-activedescendant')).toBe(host.querySelectorAll('[role="option"]')[0]!.id)
    await key(list, 'ArrowDown')
    expect(list.getAttribute('aria-activedescendant')).toBe(host.querySelectorAll('[role="option"]')[2]!.id)
    await key(list, 'Enter')
    expect(onChange).toHaveBeenLastCalledWith('carrot')
    expect(host.querySelectorAll('[role="group"]')).toHaveLength(2)
  })

  it('toggles values in multiple mode and finds options by typing', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiListbox options={options} multiple defaultValue={['apple']} onChange={onChange} />)
    const list = host.querySelector<HTMLElement>('[role="listbox"]')!
    expect(list.getAttribute('aria-multiselectable')).toBe('true')
    await act(async () => list.focus())
    await key(list, 'c')
    await key(list, ' ')
    expect(onChange).toHaveBeenLastCalledWith(['apple', 'carrot'])
  })
})

describe('json bindings', () => {
  it('binds tag checked, tag group, listbox and calendar values to state', async () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Stack', props: {}, children: ['tag', 'group', 'list', 'calendar', 'out'] },
        tag: { type: 'Tag', props: { label: 'Urgent', checkable: true, checked: { $bindState: '/urgent' } }, children: [] },
        group: { type: 'TagGroup', props: { value: { $bindState: '/tags' } }, children: [] },
        list: { type: 'Listbox', props: { ariaLabel: 'Pick', options: [{ label: 'One', value: 'one' }], value: { $bindState: '/pick' } }, children: [] },
        calendar: { type: 'Calendar', props: { value: { $bindState: '/day' }, month: '2026-11' }, children: [] },
        // eslint-disable-next-line no-template-curly-in-string
        out: { type: 'Text', props: { text: { $template: '${/urgent}|${/tags}|${/pick}|${/day}' } }, children: [] },
      },
    } as unknown as Spec
    expect(uiCatalog.validate(spec).success).toBe(true)
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} initialState={{ urgent: false, tags: ['a', 'b'], pick: null, day: null }}>
        <Renderer spec={spec} registry={uiRegistry} />
      </JSONUIProvider>,
    )
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-pressed]')!.click())
    await act(async () => host.querySelector<HTMLButtonElement>('[data-slot="tag-close"]')!.click())
    await act(async () => host.querySelector<HTMLElement>('[role="option"]')!.click())
    const day = Array.from(host.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(button => button.textContent?.trim() === '5' && !button.closest('[data-outside]'))!
    await act(async () => day.click())
    expect(host.querySelector('[data-slot="text"]')?.textContent).toBe('true|b|one|2026-11-05')
  })
})
