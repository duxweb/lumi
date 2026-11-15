// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LumiCalendar } from '../src/components/calendar.js'
import { LumiDateRangePicker, LumiDateTimePicker } from '../src/components/datetime.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return host
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 6, 9, 0))
})

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  vi.useRealTimers()
})

const click = (target: Element): Promise<void> => act(async () => (target as HTMLElement).click())
const dayButton = (date: string, root: ParentNode = document): HTMLButtonElement => root.querySelector<HTMLButtonElement>(`.rdp-day:not(.rdp-outside) button[data-day="${new Date(`${date}T00:00`).toLocaleDateString()}"]`)!
const rangeClasses = (button: Element): string[] => Array.from(button.closest('td')!.classList).filter(name => name.startsWith('rdp-range'))

describe('calendar day states', () => {
  it('marks today apart from the selection and keeps the ring for keyboard focus', async () => {
    const host = await mount(<LumiCalendar month="2026-11" defaultValue="2026-11-10" />)
    expect(dayButton('2026-11-06', host).dataset.todayMark).toBe('true')
    expect(dayButton('2026-11-10', host).dataset.todayMark).toBeUndefined()
    expect(dayButton('2026-11-10', host).dataset.selectedSingle).toBe('true')
    const classes = dayButton('2026-11-10', host).className
    expect(classes).toContain('focus-visible:ring-2')
    expect(classes).not.toMatch(/focused=true|ring-\[3px\]|ring-3/)

    await click(dayButton('2026-11-06', host))
    expect(dayButton('2026-11-06', host).dataset.todayMark).toBeUndefined()
    expect(dayButton('2026-11-06', host).dataset.selectedSingle).toBe('true')
  })

  it('splits a range into end chips and middle cells, and a one-day range into a lone chip', async () => {
    const host = await mount(<LumiCalendar mode="range" month="2026-11" defaultValue={['2026-11-03', '2026-11-12']} />)
    expect(rangeClasses(dayButton('2026-11-03', host))).toEqual(['rdp-range_start'])
    expect(dayButton('2026-11-03', host).dataset.rangeStart).toBe('true')
    expect(rangeClasses(dayButton('2026-11-07', host))).toEqual(['rdp-range_middle'])
    expect(dayButton('2026-11-07', host).dataset.rangeMiddle).toBe('true')
    expect(rangeClasses(dayButton('2026-11-12', host))).toEqual(['rdp-range_end'])
    // Today inside the band keeps its outline.
    expect(dayButton('2026-11-06', host).dataset.todayMark).toBe('true')

    const single = await mount(<LumiCalendar mode="range" month="2026-11" defaultValue={['2026-11-18', '2026-11-18']} />)
    expect(rangeClasses(dayButton('2026-11-18', single)).sort()).toEqual(['rdp-range_end', 'rdp-range_start'])
    expect(single.querySelectorAll('.rdp-range_middle')).toHaveLength(0)
  })

  it('keeps chips apart in multiple mode', async () => {
    const host = await mount(<LumiCalendar mode="multiple" month="2026-11" defaultValue={['2026-11-09', '2026-11-10']} />)
    for (const date of ['2026-11-09', '2026-11-10']) {
      expect(dayButton(date, host).dataset.selectedSingle).toBe('true')
      expect(rangeClasses(dayButton(date, host))).toEqual([])
    }
  })
})

describe('date-time and date-range panels', () => {
  it('heads each time column and sizes it beside the calendar', async () => {
    await mount(<LumiDateTimePicker ariaLabel="Start" defaultValue="2026-11-06T14:35:20" seconds />)
    await click(document.querySelector('[aria-label="Start"]')!)
    const time = document.querySelector('[data-slot="datetime-panel"] [data-slot="datetime-time"]')!
    const columns = time.querySelector<HTMLElement>('[data-slot="time-columns"]')!
    expect(columns.dataset.fill).toBe('true')
    expect(Array.from(columns.querySelectorAll('[data-slot="time-column"] > [aria-hidden]'), node => node.textContent)).toEqual(['Hr', 'Min', 'Sec'])
    expect(Array.from(columns.querySelectorAll('[role="listbox"]'), node => node.getAttribute('aria-label'))).toEqual(['Hours', 'Minutes', 'Seconds'])
    expect(Array.from(columns.querySelectorAll('[aria-selected="true"]'), node => node.textContent)).toEqual(['14', '35', '20'])
    expect(columns.querySelector('[data-slot="time-column-list"]')!.className).not.toMatch(/\bh-56\b/)
  })

  it('places presets in their own column ahead of the months', async () => {
    await mount(<LumiDateRangePicker ariaLabel="Stay" defaultValue={['2026-11-03', '2026-11-05']} presets={[{ label: 'Today', value: ['2026-11-06', '2026-11-06'] }]} />)
    await click(document.querySelector('[aria-label="Stay"]')!)
    const panel = document.querySelector('[data-slot="date-range-panel"]')!
    expect(panel.firstElementChild!.getAttribute('data-slot')).toBe('date-range-presets')
    expect(panel.querySelectorAll('.rdp-month')).toHaveLength(2)
    expect(panel.querySelector('.rdp-months')!.className).not.toMatch(/flex-col|sm:flex-row/)
  })
})
