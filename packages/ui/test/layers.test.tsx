// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LumiMenu, LumiPopconfirm, LumiPopover, LumiSelect, LumiTooltip } from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return host
}

async function press(target: Element | null, key: string): Promise<void> {
  expect(target).toBeTruthy()
  await act(async () => {
    target!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  document.body.innerHTML = ''
})

const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
const layer = (name: string): number => Number(css.match(new RegExp(`--lumi-z-${name}: (\\d+);`))?.[1])
const follows = (a: Element, b: Element): boolean => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('stacking layers', () => {
  it('orders the scale from page chrome up to the full-screen viewer', () => {
    const scale = ['sticky', 'overlay', 'popover', 'tooltip', 'notice', 'toast', 'lightbox'].map(layer)
    expect(scale.every(Number.isFinite)).toBe(true)
    expect(scale).toEqual([...scale].sort((a, b) => a - b))
    expect(new Set(scale).size).toBe(scale.length)
  })

  it('keeps a select opened inside a popover on the same layer, portaled after its parent', async () => {
    await mount(
      <LumiPopover label="Quick filter" title="Quick filter" defaultOpen>
        <LumiSelect ariaLabel="Status" options={[{ label: 'Unpaid', value: 'unpaid' }, { label: 'Paid', value: 'paid' }]} />
      </LumiPopover>,
    )
    const panel = document.querySelector<HTMLElement>('[data-lumi-popover="panel"]')!
    await press(panel.querySelector('[data-slot="select-trigger"]'), 'Enter')
    const list = document.querySelector<HTMLElement>('[data-slot="select-content"]')
    expect(list).not.toBeNull()
    expect(panel.style.zIndex).toBe('var(--lumi-z-popover)')
    expect(list!.style.zIndex).toBe('var(--lumi-z-popover)')
    expect(follows(panel, list!)).toBe(true)
  })

  it('stacks a confirm bubble over the popover it opens from', async () => {
    await mount(
      <LumiPopover label="Item" title="Item" defaultOpen>
        <LumiPopconfirm title="Remove?" label="Remove" />
      </LumiPopover>,
    )
    const panel = document.querySelector<HTMLElement>('[data-lumi-popover="panel"]')!
    await act(async () => panel.querySelector<HTMLElement>('[data-slot="popover-trigger"], button')!.click())
    const confirm = document.querySelector<HTMLElement>('[data-lumi-popover="confirm"]')
    expect(confirm?.style.zIndex).toBe('var(--lumi-z-popover)')
    expect(follows(panel, confirm!)).toBe(true)
  })

  it('puts menus on the panel layer and tooltips above it', async () => {
    const host = await mount(
      <>
        <LumiMenu label="Actions" items={[{ key: 'a', label: 'A' }]} />
        <LumiTooltip content="Hint"><button type="button">Target</button></LumiTooltip>
      </>,
    )
    await press(host.querySelector('button'), 'Enter')
    expect(document.querySelector<HTMLElement>('[data-slot="menu"]')?.style.zIndex).toBe('var(--lumi-z-popover)')
    await act(async () => host.querySelector<HTMLElement>('[data-slot="tooltip-trigger"] button')!.focus())
    expect(document.querySelector<HTMLElement>('[data-slot="tooltip"]')?.style.zIndex).toBe('var(--lumi-z-tooltip)')
  })
})
