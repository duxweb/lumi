// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiCalendar, LumiDatePicker, LumiDateRangePicker } from '../src/react/index.js'

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

const click = (target: Element): Promise<void> => act(async () => (target as HTMLElement).click())
function key(target: Element, name: string): Promise<void> {
  return act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  })
}
const captions = (root: ParentNode = document): HTMLButtonElement[] => Array.from(root.querySelectorAll<HTMLButtonElement>('[data-slot="calendar-caption"]'))
const panelCaption = (root: ParentNode = document): Element => root.querySelector('[data-slot="calendar-panel-caption"]')!
const cells = (root: ParentNode = document): HTMLButtonElement[] => Array.from(root.querySelectorAll<HTMLButtonElement>('[data-slot="calendar-panel"] [role="radio"]'))
const cell = (name: string, root: ParentNode = document): HTMLButtonElement => cells(root).find(button => button.getAttribute('aria-label') === name)!
const enabled = (root: ParentNode = document): string[] => cells(root).filter(button => !button.disabled).map(button => button.getAttribute('aria-label')!)
const focused = (): string | null | undefined => document.activeElement?.getAttribute('aria-label')

describe('calendar month and year panels', () => {
  it('switches from the caption to months, then years, and returns to the picked month', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiCalendar month="2026-11" onChange={onChange} />)
    const [caption] = captions(host)
    expect(caption!.textContent).toBe('November 2026')
    expect(caption!.getAttribute('aria-label')).toBe('November 2026, choose the month')

    await click(caption!)
    expect(host.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Choose the month')
    expect(cells(host).map(button => button.textContent)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
    expect(cell('November 2026', host).getAttribute('aria-checked')).toBe('true')
    expect(cell('November 2026', host).dataset.selected).toBe('true')
    expect(focused()).toBe('November 2026')

    await click(panelCaption(host))
    expect(host.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Choose the year')
    expect(cells(host).map(button => button.textContent)).toEqual(['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'])
    expect(panelCaption(host).textContent).toBe('2016 – 2027')
    expect(cell('2026', host).getAttribute('aria-checked')).toBe('true')

    await click(host.querySelector('[aria-label="Go to the previous 12 years"]')!)
    expect(panelCaption(host).textContent).toBe('2004 – 2015')
    await click(cell('2010', host))
    expect(panelCaption(host).textContent).toBe('2010')
    expect(host.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Choose the month')

    await click(host.querySelector('[aria-label="Go to the next year"]')!)
    expect(panelCaption(host).textContent).toBe('2011')
    await click(cell('March 2011', host))
    expect(host.querySelector('[data-slot="calendar-panel"]')).toBeNull()
    expect(captions(host)[0]!.textContent).toBe('March 2011')
    expect(document.activeElement).toBe(captions(host)[0])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables months, years and paging outside min and max', async () => {
    const host = await mount(<LumiCalendar month="2026-11" min="2026-10-15" max="2027-02-10" />)
    await click(captions(host)[0]!)
    expect(enabled(host)).toEqual(['October 2026', 'November 2026', 'December 2026'])
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Go to the previous year"]')!.disabled).toBe(true)

    await click(host.querySelector('[aria-label="Go to the next year"]')!)
    expect(enabled(host)).toEqual(['January 2027', 'February 2027'])
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Go to the next year"]')!.disabled).toBe(true)

    await click(panelCaption(host))
    expect(enabled(host)).toEqual(['2026', '2027'])
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Go to the previous 12 years"]')!.disabled).toBe(true)
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Go to the next 12 years"]')!.disabled).toBe(true)
  })

  it('moves with the keyboard, turns the page at the edges and steps back with Escape inside the popover', async () => {
    await mount(<LumiDatePicker defaultValue="2026-01-15" ariaLabel="Due" />)
    await click(document.querySelector('[aria-label="Due"]')!)
    await click(captions()[0]!)
    expect(focused()).toBe('January 2026')

    await key(document.activeElement!, 'ArrowLeft')
    expect(panelCaption().textContent).toBe('2025')
    expect(focused()).toBe('December 2025')
    await key(document.activeElement!, 'ArrowRight')
    expect(focused()).toBe('January 2026')
    await key(document.activeElement!, 'ArrowDown')
    expect(focused()).toBe('April 2026')
    await key(document.activeElement!, 'PageDown')
    expect(focused()).toBe('April 2027')

    await click(panelCaption())
    expect(focused()).toBe('2027')
    await key(document.activeElement!, 'Escape')
    expect(document.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Choose the month')
    await key(document.activeElement!, 'Escape')
    expect(document.querySelector('[data-slot="calendar-panel"]')).toBeNull()
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull()
    expect(document.activeElement).toBe(captions()[0])
    expect(captions()[0]!.textContent).toBe('January 2026')
  })

  it('keeps both months of a range picker in step with the caption that opened the panel', async () => {
    await mount(<LumiDateRangePicker defaultValue={['2026-11-03', '2026-11-05']} ariaLabel="Stay" />)
    await click(document.querySelector('[aria-label="Stay"]')!)
    expect(captions().map(button => button.textContent)).toEqual(['November 2026', 'December 2026'])
    await click(captions()[1]!)
    expect(cell('December 2026').getAttribute('aria-checked')).toBe('true')
    await click(cell('May 2026'))
    expect(captions().map(button => button.textContent)).toEqual(['April 2026', 'May 2026'])
  })

  it('keeps a plain caption with captionLayout label', async () => {
    const host = await mount(<LumiCalendar month="2026-11" captionLayout="label" />)
    expect(captions(host)).toHaveLength(0)
    expect(host.querySelector('.rdp-caption_label')!.textContent).toBe('November 2026')
  })
})
