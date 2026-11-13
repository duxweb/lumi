// @vitest-environment jsdom
import type { ReactNode } from 'react'
import type { LumiKanbanCard, LumiKanbanMove } from '../src/react/pages/LumiKanban.js'
import { createLumi, createSimpleDataProvider, LumiProvider } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { dropIndex, keyboardTarget, moveCard, rankBetween } from '../src/react/pages/kanbanModel.js'
import { LumiKanban } from '../src/react/pages/LumiKanban.js'
import { LumiScheduleCalendar } from '../src/react/pages/LumiScheduleCalendar.js'
import { eventsOnDay, layoutTimedEvents, localeWeekStart, monthGrid, parseScheduleDate, placeEvents, weekDays } from '../src/react/pages/scheduleModel.js'

async function render(children: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<LumiProvider context={createLumi({ dataProvider: createSimpleDataProvider({ apiUrl: 'https://example.test' }) })} registry={{}}>{children}</LumiProvider>))
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

const cards = [
  { id: 1, status: 'todo', rank: 1024, title: 'A' },
  { id: 2, status: 'todo', rank: 2048, title: 'B' },
  { id: 3, status: 'doing', rank: 1024, title: 'C' },
  { id: 4, status: 'todo', rank: 3072, title: 'D' },
]
const order = (list: readonly { id: number, status: string }[], column: string): number[] => list.filter(card => card.status === column).map(card => card.id)

describe('kanban move logic', () => {
  it('reorders inside a column and ranks the card between its new neighbours', () => {
    const result = moveCard(cards, 1, 'todo', 1)!
    expect(order(result.cards, 'todo')).toEqual([2, 1, 4])
    expect(result.move).toEqual({ id: 1, from: 'todo', to: 'todo', index: 1, rank: 2560 })
  })

  it('moves across columns, clamping the index and ranking past the ends', () => {
    const top = moveCard(cards, 4, 'doing', 0)!
    expect(order(top.cards, 'doing')).toEqual([4, 3])
    expect(order(top.cards, 'todo')).toEqual([1, 2])
    expect(top.move).toMatchObject({ from: 'todo', to: 'doing', index: 0, rank: 0 })

    const end = moveCard(cards, 1, 'doing', 99)!
    expect(order(end.cards, 'doing')).toEqual([3, 1])
    expect(end.move).toMatchObject({ index: 1, rank: 2048 })
  })

  it('drops into an empty column and ignores unknown cards', () => {
    const result = moveCard(cards, 2, 'done', 0)!
    expect(order(result.cards, 'done')).toEqual([2])
    expect(result.move.rank).toBe(1024)
    expect(moveCard(cards, 99, 'done', 0)).toBeUndefined()
  })

  it('honours custom column and rank fields, and falls back to positions without ranks', () => {
    const rows = [{ id: 'a', lane: 'x' }, { id: 'b', lane: 'x' }, { id: 'c', lane: 'y' }]
    const result = moveCard(rows, 'c', 'x', 1, { columnField: 'lane', rankField: 'sort' })!
    expect(result.cards.map(row => row.id)).toEqual(['a', 'c', 'b'])
    expect(result.cards[1]).toMatchObject({ lane: 'x', sort: 512 })
  })

  it('computes ranks, pointer slots and keyboard targets', () => {
    expect(rankBetween(undefined, undefined)).toBe(1024)
    expect(rankBetween(10, 20)).toBe(15)
    expect(dropIndex([100, 200, 300], 50)).toBe(0)
    expect(dropIndex([100, 200, 300], 250)).toBe(2)
    expect(dropIndex([100, 200, 300], 900)).toBe(3)

    const columns = [{ value: 'todo', size: 2 }, { value: 'doing', size: 0 }, { value: 'done', size: 5 }]
    expect(keyboardTarget({ column: 'todo', index: 0 }, 'ArrowUp', columns)).toEqual({ column: 'todo', index: 0 })
    expect(keyboardTarget({ column: 'todo', index: 2 }, 'ArrowDown', columns)).toEqual({ column: 'todo', index: 2 })
    expect(keyboardTarget({ column: 'todo', index: 2 }, 'ArrowRight', columns)).toEqual({ column: 'doing', index: 0 })
    expect(keyboardTarget({ column: 'doing', index: 0 }, 'ArrowRight', columns)).toEqual({ column: 'done', index: 0 })
    expect(keyboardTarget({ column: 'done', index: 3 }, 'ArrowRight', columns)).toEqual({ column: 'done', index: 3 })
    expect(keyboardTarget({ column: 'todo', index: 1 }, 'ArrowLeft', columns)).toEqual({ column: 'todo', index: 1 })
  })
})

describe('kanban board', () => {
  const columns = [{ value: 'todo', title: 'To do' }, { value: 'doing', title: 'Doing', limit: 0 }, { value: 'done', title: 'Done', done: true }]
  const value: LumiKanbanCard[] = [
    { id: 1, status: 'todo', rank: 1024, title: 'Write spec', dueDate: '2026-08-01', priority: 'urgent', tags: [{ label: 'Docs' }] },
    { id: 2, status: 'todo', rank: 2048, title: 'Review', assignee: { name: 'Ava Lin' } },
    { id: 3, status: 'done', rank: 1024, title: 'Ship', dueDate: '2026-08-01' },
  ]
  const key = async (target: Element, name: string) => act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  })
  const card = (container: HTMLElement, id: number) => container.querySelector<HTMLElement>(`[data-card-key="number:${id}"]`)!

  it('renders columns, counts, limits, overdue dates and priorities', async () => {
    const view = await render(<LumiKanban columns={columns} value={value} today="2026-08-10" onAdd={() => {}} />)
    const sections = view.container.querySelectorAll('.lumi-kanban__column')
    expect(sections).toHaveLength(3)
    expect(sections[0]!.querySelector('h3')?.textContent).toBe('To do')
    expect(sections[0]!.querySelector('.lumi-kanban__count')?.textContent).toBe('2')
    expect(sections[1]!.querySelector('.lumi-kanban__count')?.textContent).toBe('0 / 0')
    expect(sections[1]!.querySelector('.lumi-kanban__empty')?.textContent).toBe('No cards')
    expect(card(view.container, 1).querySelector('.lumi-kanban__due')?.hasAttribute('data-overdue')).toBe(true)
    expect(card(view.container, 3).querySelector('.lumi-kanban__due')?.hasAttribute('data-overdue')).toBe(false)
    expect(card(view.container, 1).querySelector('.lumi-kanban__priority')?.getAttribute('data-tone')).toBe('danger')
    expect(view.container.querySelector('button[aria-label="Add card to Doing"]')).not.toBeNull()
    await view.cleanup()
  })

  it('keeps the assignee on the last meta line and draws no empty rows', async () => {
    const view = await render(<LumiKanban columns={columns} value={[{ id: 7, status: 'todo', title: 'Contract', tags: [{ label: 'Finance' }], assignee: { name: 'Mia Chen' } }, { id: 8, status: 'todo', title: 'Bare' }]} />)
    const footer = card(view.container, 7).querySelector('.lumi-kanban__footer')!
    expect(footer.querySelector('.lumi-kanban__tags')?.textContent).toBe('Finance')
    expect(footer.querySelector('.lumi-kanban__assignee [role="img"]')?.getAttribute('aria-label')).toBe('Mia Chen')
    expect(footer.querySelector('.lumi-kanban__due')).toBeNull()
    expect(card(view.container, 8).children).toHaveLength(1)
    expect(card(view.container, 8).querySelector('.lumi-kanban__description')).toBeNull()
    await view.cleanup()
  })

  it('moves a card from the keyboard and announces each step', async () => {
    const onMove = vi.fn<(move: LumiKanbanMove) => void>()
    const onValueChange = vi.fn()
    const view = await render(<LumiKanban columns={columns} value={value} onMove={onMove} onValueChange={onValueChange} />)
    const first = card(view.container, 1)
    first.focus()
    await key(first, ' ')
    expect(first.getAttribute('data-active')).toBe('keyboard')
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain('Picked up Write spec.')
    await key(first, 'ArrowRight')
    expect(view.container.querySelector('[role="status"]')?.textContent).toBe('Doing, position 1 of 1.')
    expect(view.container.querySelectorAll('.lumi-kanban__column')[1]!.querySelector('.lumi-kanban__indicator')).not.toBeNull()
    await key(first, ' ')
    expect(onMove).toHaveBeenCalledWith({ id: 1, from: 'todo', to: 'doing', index: 0, rank: 1024 })
    expect(onValueChange.mock.calls[0]![0].find((item: LumiKanbanCard) => item.id === 1).status).toBe('doing')
    expect(view.container.querySelectorAll('.lumi-kanban__column')[1]!.contains(card(view.container, 1))).toBe(true)
    expect(document.activeElement).toBe(card(view.container, 1))
    await view.cleanup()
  })

  it('cancels with Escape and does not emit for a drop in place', async () => {
    const onMove = vi.fn()
    const view = await render(<LumiKanban columns={columns} value={value} onMove={onMove} />)
    const first = card(view.container, 1)
    await key(first, ' ')
    await key(first, 'ArrowDown')
    await key(first, 'Escape')
    expect(first.hasAttribute('data-active')).toBe(false)
    expect(view.container.querySelector('[role="status"]')?.textContent).toBe('Move cancelled. Write spec stays in To do.')
    await key(first, ' ')
    await key(first, 'Enter')
    expect(onMove).not.toHaveBeenCalled()
    await view.cleanup()
  })

  it('collapses a column and keeps a readonly board still', async () => {
    const onMove = vi.fn()
    const view = await render(<LumiKanban columns={columns} value={value} onMove={onMove} readonly />)
    const toggle = view.container.querySelector<HTMLButtonElement>('.lumi-kanban__toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(view.container.querySelector('.lumi-kanban__column')?.hasAttribute('data-collapsed')).toBe(true)
    const done = card(view.container, 3)
    expect(done.getAttribute('draggable')).toBe('false')
    await key(done, ' ')
    expect(done.hasAttribute('data-active')).toBe(false)
    expect(view.container.querySelector('.lumi-kanban__menu')).toBeNull()
    await view.cleanup()
  })

  it('takes a new value from the page over its optimistic order', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const lumi = createLumi({ dataProvider: createSimpleDataProvider({ apiUrl: 'https://example.test' }) })
    const draw = (cards: LumiKanbanCard[]) => act(async () => root.render(<LumiProvider context={lumi} registry={{}}><LumiKanban columns={columns} value={cards} /></LumiProvider>))
    await draw(value)
    const first = card(container, 1)
    await key(first, ' ')
    await key(first, 'ArrowRight')
    await key(first, ' ')
    expect(container.querySelectorAll('.lumi-kanban__column')[1]!.querySelectorAll('[data-card-key]')).toHaveLength(1)
    await draw([...value])
    expect(container.querySelectorAll('.lumi-kanban__column')[1]!.querySelectorAll('[data-card-key]')).toHaveLength(0)
    await act(async () => root.unmount())
    container.remove()
  })
})

describe('schedule layout', () => {
  it('parses bare dates and local times as local wall-clock values', () => {
    expect(parseScheduleDate('2026-08-10')).toEqual(new Date(2026, 7, 10))
    expect(parseScheduleDate('2026-08-10T09:30')).toEqual(new Date(2026, 7, 10, 9, 30))
    expect(parseScheduleDate('nope')).toBeUndefined()
  })

  it('builds whole weeks from the first day of the week', () => {
    const monday = monthGrid(new Date(2026, 7, 10), 1)
    expect(monday[0]![0]).toEqual(new Date(2026, 6, 27))
    expect(monday).toHaveLength(6)
    expect(monday.at(-1)!.at(-1)).toEqual(new Date(2026, 8, 6))
    const sunday = monthGrid(new Date(2026, 1, 1), 0)
    expect(sunday).toHaveLength(4)
    expect(sunday[0]![0]).toEqual(new Date(2026, 1, 1))
    expect(weekDays(new Date(2026, 7, 13), 1).map(day => day.getDate())).toEqual([10, 11, 12, 13, 14, 15, 16])
  })

  it('reads the first day of the week from the locale', () => {
    expect(localeWeekStart('en-US')).toBe(0)
    expect(localeWeekStart('zh-CN')).toBe(1)
    expect(localeWeekStart('en-GB')).toBe(1)
  })

  it('spans all-day ranges inclusively and defaults timed events to an hour', () => {
    const placed = placeEvents([
      { id: 1, title: 'Shoot', start: '2026-08-12', end: '2026-08-14', allDay: true },
      { id: 2, title: 'Call', start: '2026-08-12T10:00' },
      { id: 3, title: 'Overnight', start: '2026-08-12T00:00', end: '2026-08-13T00:00', allDay: true },
      { id: 4, title: 'Broken', start: 'later' },
    ])
    expect(placed.map(item => item.event.id)).toEqual([1, 3, 2])
    expect(placed[0]!.end).toEqual(new Date(2026, 7, 15))
    expect(placed[1]!.end).toEqual(new Date(2026, 7, 13))
    expect(placed[2]!.end).toEqual(new Date(2026, 7, 12, 11))
    expect(eventsOnDay(placed, new Date(2026, 7, 14)).map(item => item.event.id)).toEqual([1])
    expect(eventsOnDay(placed, new Date(2026, 7, 12)).map(item => item.allDay)).toEqual([true, true, false])
  })

  it('lays overlapping events side by side and keeps separate groups full width', () => {
    const placed = placeEvents([
      { id: 'a', title: 'A', start: '2026-08-10T09:00', end: '2026-08-10T11:00' },
      { id: 'b', title: 'B', start: '2026-08-10T10:00', end: '2026-08-10T12:00' },
      { id: 'c', title: 'C', start: '2026-08-10T11:00', end: '2026-08-10T11:30' },
      { id: 'd', title: 'D', start: '2026-08-10T14:00', end: '2026-08-10T15:00' },
      { id: 'e', title: 'E', start: '2026-08-10T06:00', end: '2026-08-10T08:30' },
    ])
    const layout = Object.fromEntries(layoutTimedEvents(placed, new Date(2026, 7, 10), 8, 18).map(item => [item.event.id, item]))
    expect(layout.a).toMatchObject({ lane: 0, lanes: 2, top: 0.1, height: 0.2 })
    expect(layout.b).toMatchObject({ lane: 1, lanes: 2 })
    expect(layout.c).toMatchObject({ lane: 0, lanes: 2 })
    expect(layout.d).toMatchObject({ lane: 0, lanes: 1, top: 0.6 })
    expect(layout.e).toMatchObject({ lane: 0, top: 0, height: 0.05 })
  })
})

describe('schedule calendar', () => {
  const events = [
    { id: 1, title: 'Sync', start: '2026-08-10T09:30', end: '2026-08-10T10:30' },
    { id: 2, title: 'Call', start: '2026-08-10T10:00', tone: 'info' as const },
    { id: 3, title: 'Count', start: '2026-08-10', allDay: true },
    { id: 4, title: 'Review', start: '2026-08-10T15:00' },
  ]

  it('draws the month with today, locale weekdays and folded extras', async () => {
    const onDayClick = vi.fn()
    const onEventClick = vi.fn()
    const view = await render(<LumiScheduleCalendar events={events} date="2026-08-10" today="2026-08-10" locale="en-GB" maxEvents={3} onDayClick={onDayClick} onEventClick={onEventClick} />)
    expect(view.container.querySelector('h3')?.textContent).toBe('August 2026')
    expect(view.container.querySelector('th abbr')?.textContent).toBe('Mon')
    const today = view.container.querySelector('td[data-today]')!
    expect(today.querySelector('[aria-current="date"]')?.textContent).toBe('10')
    expect(Array.from(today.querySelectorAll('.lumi-schedule__event-title')).map(node => node.textContent)).toEqual(['Count', 'Sync'])
    expect(today.querySelector('.lumi-schedule__more')?.textContent).toContain('+2 more')
    await act(async () => today.querySelector<HTMLButtonElement>('.lumi-schedule__day')!.click())
    expect(onDayClick).toHaveBeenCalledWith('2026-08-10')
    await act(async () => today.querySelector<HTMLButtonElement>('.lumi-schedule__event')!.click())
    expect(onEventClick).toHaveBeenCalledWith(events[2])
    await view.cleanup()
  })

  it('switches to the week grid and pages by week', async () => {
    const onDateChange = vi.fn()
    const view = await render(<LumiScheduleCalendar events={events} view="week" date="2026-08-10" today="2026-08-10" locale="en-US" startHour={8} endHour={18} onDateChange={onDateChange} />)
    expect(view.container.querySelectorAll('.lumi-schedule__column')).toHaveLength(7)
    expect(view.container.querySelector('.lumi-schedule__head .lumi-schedule__weekday')?.textContent).toBe('Sun')
    expect(view.container.querySelector('.lumi-schedule__column[data-today]')?.querySelectorAll('.lumi-schedule__slot')).toHaveLength(3)
    expect(view.container.querySelector('.lumi-schedule__all-day[data-today]')?.textContent).toContain('Count')
    await act(async () => view.container.querySelector<HTMLButtonElement>('button[aria-label="Next week"]')!.click())
    expect(onDateChange).toHaveBeenCalledWith('2026-08-17')
    await view.cleanup()
  })
})
