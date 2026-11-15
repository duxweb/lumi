// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiTable } from '../src/components/display.js'
import { LumiAccordion, LumiMenu, LumiTooltip } from '../src/components/interactive.js'
import { createNotifier, LumiNotifierViewport } from '../src/components/notice.js'
import { LumiSegmentBar } from '../src/components/segments.js'
import { createToaster, LumiToasterViewport } from '../src/components/toast.js'

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
  vi.useRealTimers()
})

describe('toaster', () => {
  it('replaces a toast with the same key and caps the stack, oldest out first', () => {
    const queue = createToaster()
    queue.open({ key: 'job', message: 'Importing' })
    queue.open({ key: 'job', message: 'Imported', tone: 'success' })
    expect(queue.getSnapshot()).toHaveLength(1)
    expect(queue.getSnapshot()[0]).toMatchObject({ message: 'Imported', tone: 'success', duration: 3000, version: 2 })
    for (let index = 0; index < 6; index++)
      queue.open({ message: `Toast ${index}` })
    expect(queue.getSnapshot().map(entry => entry.message)).toEqual(['Toast 1', 'Toast 2', 'Toast 3', 'Toast 4', 'Toast 5'])
  })

  it('closes after its duration, and a duration of 0 stays until closed by key', async () => {
    vi.useFakeTimers()
    const queue = createToaster()
    await mount(<LumiToasterViewport toaster={queue} />)
    await act(async () => {
      queue.open({ key: 'short', message: 'Short', duration: 1000 })
      queue.open({ key: 'sticky', message: 'Sticky', duration: 0, tone: 'danger' })
    })
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(2)
    await act(async () => vi.advanceTimersByTime(1100))
    expect(queue.getSnapshot().map(entry => entry.key)).toEqual(['sticky'])
    await act(async () => queue.close('sticky'))
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(0)
  })

  it('announces each toast once through a list that is a live region from the start', async () => {
    const queue = createToaster()
    await mount(<LumiToasterViewport toaster={queue} />)
    const list = document.querySelector('[data-slot="toast-live"]')!
    expect(list.getAttribute('role')).toBe('status')
    expect(list.getAttribute('aria-live')).toBe('polite')
    await act(async () => {
      queue.open({ key: 'job', message: 'Saved' })
      queue.open({ message: 'Upload failed', tone: 'danger' })
    })
    // One copy of each message; a danger one interrupts.
    expect(Array.from(document.querySelectorAll('[data-slot="toast-message"]'), node => node.textContent)).toEqual(['Upload failed', 'Saved'])
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Upload failed')
    // A keyed toast that reopens is added again, so it is read again.
    const before = document.querySelector('[data-slot="toast"][data-tone="neutral"] [data-slot="toast-message"]')
    await act(async () => queue.open({ key: 'job', message: 'Saved again' }))
    const after = Array.from(document.querySelectorAll('[data-slot="toast-message"]')).find(node => node.textContent === 'Saved again')
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
  })

  it('closes from its close button and holds its timer while hovered or focused', async () => {
    vi.useFakeTimers()
    const queue = createToaster()
    await mount(<LumiToasterViewport toaster={queue} />)
    await act(async () => {
      queue.open({ key: 'sticky', message: 'Sticky', duration: 0 })
      queue.open({ key: 'timed', message: 'Timed', duration: 1000 })
    })
    const toast = (key: string): HTMLElement => Array.from(document.querySelectorAll<HTMLElement>('[data-slot="toast"]')).find(node => node.textContent === key)!
    const close = toast('Timed').querySelector<HTMLButtonElement>('[data-slot="toast-close"]')!
    expect(close.getAttribute('aria-label')).toBe('Close')
    expect(close.getAttribute('type')).toBe('button')
    // Focus inside holds the timer even after the pointer leaves.
    await act(async () => close.focus())
    toast('Timed').dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
    toast('Timed').dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    await act(async () => vi.advanceTimersByTime(1500))
    expect(queue.getSnapshot().map(entry => entry.key)).toContain('timed')
    await act(async () => close.blur())
    await act(async () => vi.advanceTimersByTime(1100))
    expect(queue.getSnapshot().map(entry => entry.key)).toEqual(['sticky'])
    // A toast without a duration closes from its button.
    await act(async () => toast('Sticky').querySelector<HTMLButtonElement>('[data-slot="toast-close"]')!.click())
    expect(queue.getSnapshot()).toHaveLength(0)
  })

  it('stacks one-line messages from the top centre of the viewport, newest first', async () => {
    const queue = createToaster()
    await mount(<LumiToasterViewport toaster={queue} />)
    await act(async () => {
      queue.open({ message: 'First' })
      queue.open({ message: 'Second' })
    })
    expect(Array.from(document.querySelectorAll('[data-slot="toast-message"]'), node => node.textContent)).toEqual(['Second', 'First'])
    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    const rule = css.match(/\[data-slot="toaster"\] \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/top: max\(16px, env\(safe-area-inset-top/)
    expect(rule).toMatch(/right: 0;[\s\S]*left: 0;[\s\S]*margin-inline: auto;/)
    expect(rule).not.toMatch(/bottom:/)
    expect(css).toMatch(/@keyframes lumi-toast-in \{\s*from \{[^}]*translateY\(-8px\)/)
  })
})

describe('notifier', () => {
  it('shows a closable card with title, description and actions at the top right', async () => {
    const queue = createNotifier()
    const onPress = vi.fn()
    await mount(<LumiNotifierViewport notifier={queue} />)
    await act(async () => {
      queue.open({ tone: 'success', title: 'Order archived', description: 'ORD-1 moved to the archive.', actions: [{ label: 'Undo', onPress }] })
    })
    const notice = document.querySelector<HTMLElement>('[data-slot="notice"]')!
    expect(notice.classList.contains('lumi-glass-panel')).toBe(true)
    // The live role sits inside the item, so the list keeps only list items.
    expect(notice.tagName).toBe('LI')
    expect(notice.getAttribute('role')).toBeNull()
    expect(notice.querySelector('[data-slot="notice-body"]')?.getAttribute('aria-live')).toBe('polite')
    expect(notice.querySelector('[data-slot="notice-body"]')?.getAttribute('role')).toBe('status')
    expect(notice.querySelector('[data-slot="notice-title"]')?.textContent).toBe('Order archived')
    expect(notice.querySelector('[data-slot="notice-description"]')?.textContent).toBe('ORD-1 moved to the archive.')
    await act(async () => notice.querySelector<HTMLElement>('[data-slot="notice-actions"] button')!.click())
    expect(onPress).toHaveBeenCalledOnce()
    expect(queue.getSnapshot()).toEqual([])

    await act(async () => {
      queue.open({ tone: 'danger', title: 'Payment failed', duration: 0 })
    })
    expect(document.querySelector('[data-slot="notice"] [data-slot="notice-body"]')?.getAttribute('aria-live')).toBe('assertive')
    await act(async () => document.querySelector<HTMLElement>('[data-slot="notice-close"]')!.click())
    expect(queue.getSnapshot()).toEqual([])

    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    const rule = css.match(/\[data-slot="notifier"\] \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/top: max\(16px, env\(safe-area-inset-top/)
    expect(rule).toMatch(/right: max\(16px, env\(safe-area-inset-right/)
    expect(rule).toMatch(/width: min\(360px/)
  })

  it('updates by key, pauses while hovered, stays when sticky and collapses older notices', async () => {
    vi.useFakeTimers()
    const queue = createNotifier()
    await mount(<LumiNotifierViewport notifier={queue} />)
    await act(async () => {
      queue.open({ key: 'sync', title: 'Syncing', description: '0 of 3', duration: 0 })
      queue.open({ key: 'sync', title: 'Syncing', description: '2 of 3', duration: 0 })
      queue.open({ key: 'export', title: 'Export ready', duration: 1000 })
    })
    expect(document.querySelectorAll('[data-slot="notice"]')).toHaveLength(2)
    expect(document.querySelector('[data-slot="notice-description"]')?.textContent).toBe('2 of 3')
    const exported = document.querySelector<HTMLElement>('[data-slot="notice"]')!
    await act(async () => {
      exported.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      vi.advanceTimersByTime(5000)
    })
    expect(queue.getSnapshot().map(entry => entry.key)).toEqual(['sync', 'export'])
    await act(async () => {
      exported.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
      vi.advanceTimersByTime(1100)
    })
    expect(queue.getSnapshot().map(entry => entry.key)).toEqual(['sync'])

    await act(async () => {
      for (let index = 0; index < 4; index++)
        queue.open({ title: `Notice ${index}`, duration: 0 })
    })
    expect(Array.from(document.querySelectorAll('[data-slot="notice"]'), node => node.hasAttribute('data-collapsed'))).toEqual([false, false, false, true, true])
  })
})

describe('lumiSegmentBar', () => {
  it('fills segments in proportion and keeps the requested minimum for a small value', async () => {
    const host = await mount(<LumiSegmentBar value={50} max={100} count={10} />)
    expect(host.querySelectorAll('i')).toHaveLength(10)
    expect(host.querySelectorAll('i[data-filled]')).toHaveLength(5)
    const small = await mount(<LumiSegmentBar value={0} max={100} count={10} minFilled={1} />)
    expect(small.querySelectorAll('i[data-filled]')).toHaveLength(1)
  })
})

describe('lumiTable header and footer', () => {
  const columns = [{ field: 'name', label: 'Name' }]
  const rows = [{ id: 1, name: 'Ada' }]

  it('hides the header visually but keeps it for screen readers', async () => {
    const host = await mount(<LumiTable aria-label="Team" columns={columns} rows={rows} showHeader={false} />)
    const header = host.querySelector('thead')
    expect(header?.className).toContain('sr-only')
    expect(header?.textContent).toContain('Name')
  })

  it('prints the summary and total in a footer, not a caption', async () => {
    const host = await mount(<LumiTable aria-label="Team" columns={columns} rows={rows} summary="Filtered" total={12} />)
    expect(host.querySelector('caption')).toBeNull()
    const footer = host.querySelector('[data-slot="table-summary"]')
    expect(footer?.textContent).toContain('Filtered')
    expect(footer?.textContent).toContain('12 total')
  })
})

describe('interactive surfaces', () => {
  it('names an icon-only menu by its label and trails a chevron on a labelled one', async () => {
    const icon = await mount(<LumiMenu label="More" icon="more-horizontal" shape="square" items={[{ key: 'a', label: 'A' }]} />)
    expect(icon.querySelector('button')?.getAttribute('aria-label')).toBe('More')
    const labelled = await mount(<LumiMenu label="Actions" items={[{ key: 'a', label: 'A' }]} />)
    const button = labelled.querySelector('button')
    expect(button?.textContent).toContain('Actions')
    expect(button?.querySelector('[data-icon="inline-end"]')).not.toBeNull()
  })

  it('opens the default accordion section and folds it on demand', async () => {
    const items = [{ key: 'a', title: 'First', content: 'One' }, { key: 'b', title: 'Second', content: 'Two' }]
    const host = await mount(<LumiAccordion items={items} defaultOpen={['a']} />)
    expect(host.textContent).toContain('One')
    expect(host.textContent).not.toContain('Two')
    const triggers = host.querySelectorAll('button')
    await act(async () => triggers[1]!.click())
    expect(host.textContent).toContain('Two')
    expect(host.textContent).not.toContain('One')
  })

  it('keeps a tooltip target as its only child', async () => {
    const host = await mount(<LumiTooltip content="Hint"><button type="button">Target</button></LumiTooltip>)
    expect(host.querySelector('[data-slot="tooltip-trigger"] button')?.textContent).toBe('Target')
    expect(host.textContent).not.toContain('Hint')
  })
})
