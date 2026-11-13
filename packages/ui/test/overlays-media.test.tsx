// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/index.js'
import { LumiBreadcrumb, LumiButton, LumiCarousel, LumiImage, LumiImageGrid, LumiLightbox, LumiPopconfirm, LumiPopover, uiRegistry } from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return host
}

async function click(element: Element | null | undefined): Promise<void> {
  expect(element).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}

async function key(target: EventTarget, value: string): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  })
}

const panel = (): HTMLElement | null => document.querySelector('[data-lumi-popover]')

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  document.body.innerHTML = ''
})

describe('lumiPopover', () => {
  it('opens a titled glass panel from its button and closes after a footer action', async () => {
    const onConfirm = vi.fn()
    const host = await mount(
      <LumiPopover label="Filters" title="Quick filters" description="Narrow the list." confirmText="Apply" cancelText="Reset" onConfirm={onConfirm}>
        <p>Body</p>
      </LumiPopover>,
    )
    const trigger = host.querySelector('button')!
    expect(trigger.textContent).toContain('Filters')
    await click(trigger)
    const content = panel()!
    expect(content.getAttribute('role')).toBe('dialog')
    expect(content.classList.contains('lumi-glass-panel')).toBe(true)
    expect(content.style.zIndex).toBe('var(--lumi-z-popover)')
    expect(document.getElementById(content.getAttribute('aria-labelledby')!)?.textContent).toBe('Quick filters')
    expect(content.textContent).toContain('Body')
    await click(Array.from(content.querySelectorAll('button')).find(button => button.textContent === 'Apply'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(panel()).toBeNull()
  })

  it('anchors to a slot trigger and mirrors the open state onto it', async () => {
    const host = await mount(<LumiPopover trigger={<LumiButton label="Owner" />} title="Ada">Card</LumiPopover>)
    const button = host.querySelector('button')!
    const wrapper = host.querySelector('[data-slot="popover-trigger"]')!
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await click(button)
    expect(panel()).not.toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-controls')).toBe(panel()!.id)
    // A role-less wrapper may not carry popup state; only the button does.
    expect(['aria-haspopup', 'aria-expanded', 'aria-controls'].filter(name => wrapper.hasAttribute(name))).toEqual([])
  })

  it('makes a static slot trigger a keyboard button', async () => {
    const host = await mount(<LumiPopover trigger={<span>Ada Lovelace</span>} title="Ada" aria-label="Ada profile">Card</LumiPopover>)
    const trigger = host.querySelector<HTMLElement>('[data-slot="popover-trigger"]')!
    expect(trigger.getAttribute('role')).toBe('button')
    expect(trigger.tabIndex).toBe(0)
    expect(trigger.getAttribute('aria-label')).toBe('Ada profile')
    await key(trigger, 'Enter')
    expect(panel()).not.toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('follows a controlled open state', async () => {
    const changes: boolean[] = []
    await mount(<LumiPopover label="Info" open title="Pinned" onOpenChange={value => changes.push(value)} />)
    expect(panel()?.textContent).toContain('Pinned')
    await key(document, 'Escape')
    expect(changes).toEqual([false])
  })
})

describe('lumiPopconfirm', () => {
  it('focuses cancel, and confirming reports confirm only', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const host = await mount(<LumiPopconfirm title="Delete this row?" confirmText="Delete" onConfirm={onConfirm} onCancel={onCancel}><LumiButton label="Delete" appearance="danger" /></LumiPopconfirm>)
    await click(host.querySelector('button'))
    const content = panel()!
    expect(content.getAttribute('role')).toBe('alertdialog')
    expect(content.dataset.tone).toBe('danger')
    expect(document.activeElement?.textContent).toBe('Cancel')
    await click(Array.from(content.querySelectorAll('button')).find(button => button.textContent === 'Delete'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    expect(panel()).toBeNull()
  })

  it('treats Escape as cancel', async () => {
    const onCancel = vi.fn()
    const host = await mount(<LumiPopconfirm title="Archive?" label="Archive" onCancel={onCancel} />)
    await click(host.querySelector('button'))
    await key(document.activeElement!, 'Escape')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(panel()).toBeNull()
  })

  it('stays shut while disabled', async () => {
    const host = await mount(<LumiPopconfirm title="Delete?" label="Delete" disabled />)
    await click(host.querySelector('button'))
    expect(panel()).toBeNull()
  })
})

describe('lumiImage and lightbox', () => {
  it('shimmers while loading and falls back when the image fails', async () => {
    const host = await mount(<LumiImage src="/missing.jpg" alt="Desk" aspectRatio="16/9" />)
    const figure = host.querySelector<HTMLElement>('[data-slot="image"]')!
    expect(figure.dataset.status).toBe('loading')
    expect(host.querySelector('[data-slot="image-skeleton"]')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('[data-slot="image-frame"]')!.style.aspectRatio).toBe('16 / 9')
    await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')))
    expect(figure.dataset.status).toBe('error')
    expect(host.querySelector('[data-slot="image-fallback"]')?.getAttribute('aria-label')).toBe('Desk')
  })

  it('opens the viewer from a preview image', async () => {
    const host = await mount(<LumiImage src="/a.jpg" alt="Desk" caption="Studio desk" preview />)
    const trigger = host.querySelector<HTMLButtonElement>('[data-slot="image-preview-trigger"]')!
    expect(trigger.getAttribute('aria-label')).toBe('Preview Studio desk')
    await click(trigger)
    expect(document.querySelector('[data-slot="lightbox"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="lightbox-caption"]')?.textContent).toBe('Studio desk')
  })

  it('steps, zooms and closes from the keyboard', async () => {
    const items = [{ url: '/1.jpg', caption: 'One' }, { url: '/2.jpg', caption: 'Two' }, { url: '/3.jpg', caption: 'Three' }]
    const onOpenChange = vi.fn()
    await mount(<LumiLightbox items={items} open onOpenChange={onOpenChange} />)
    const viewer = document.querySelector<HTMLElement>('[data-slot="lightbox"]')!
    expect(viewer.textContent).toContain('1 / 3')
    await key(viewer, 'ArrowRight')
    expect(viewer.textContent).toContain('2 / 3')
    expect(document.querySelector('[data-slot="lightbox-caption"]')?.textContent).toBe('Two')
    await key(viewer, 'ArrowLeft')
    await key(viewer, 'ArrowLeft')
    expect(viewer.textContent).toContain('1 / 3')
    await key(viewer, '+')
    expect(document.querySelector('[data-slot="lightbox-zoom"]')?.textContent).toBe('150%')
    expect(document.querySelector<HTMLElement>('[data-slot="lightbox-image"]')!.style.transform).toContain('scale(1.5)')
    await key(viewer, '0')
    expect(document.querySelector('[data-slot="lightbox-zoom"]')?.textContent).toBe('100%')
    await click(document.querySelector('[aria-label="Next image"]'))
    expect(viewer.textContent).toContain('2 / 3')
    await key(viewer, 'Escape')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('wraps around with loop', async () => {
    await mount(<LumiLightbox items={[{ url: '/1.jpg' }, { url: '/2.jpg' }]} open loop />)
    const viewer = document.querySelector<HTMLElement>('[data-slot="lightbox"]')!
    await key(viewer, 'ArrowLeft')
    expect(viewer.textContent).toContain('2 / 2')
  })

  it('previews an ImageGrid tile while its remove button still removes', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiImageGrid defaultValue={[{ url: '/a.jpg', alt: 'Front' }, { url: '/b.jpg' }]} onChange={onChange} />)
    await click(host.querySelector('[data-slot="image-grid-preview"]'))
    expect(document.querySelector('[data-slot="lightbox"]')?.textContent).toContain('1 / 2')
    await key(document.querySelector('[data-slot="lightbox"]')!, 'Escape')
    await click(host.querySelector('[data-action="remove"]'))
    expect(onChange).toHaveBeenCalledWith([{ url: '/b.jpg' }])
    expect(document.querySelector('[data-slot="lightbox"]')).toBeNull()
  })
})

describe('lumiCarousel', () => {
  const width = 300
  let restore: Array<() => void> = []

  // jsdom has no layout: give each slide a width and let scrollTo move the track.
  beforeEach(() => {
    const define = (proto: object, name: string, get: (this: HTMLElement) => number): void => {
      const original = Object.getOwnPropertyDescriptor(proto, name)
      Object.defineProperty(proto, name, { configurable: true, get })
      restore.push(() => original && Object.defineProperty(proto, name, original))
    }
    define(HTMLElement.prototype, 'offsetLeft', function () {
      return this.dataset.slot === 'carousel-item' ? Array.from(this.parentElement!.children).indexOf(this) * width : 0
    })
    define(HTMLElement.prototype, 'clientWidth', function () {
      return this.dataset.slot === 'carousel-content' ? width : 0
    })
    define(HTMLElement.prototype, 'scrollWidth', function () {
      return this.dataset.slot === 'carousel-content' ? this.querySelectorAll('[data-slot="carousel-item"]').length * width : 0
    })
    const scrollTo = vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
      this.scrollLeft = options.left ?? 0
      this.dispatchEvent(new Event('scroll'))
    })
    ;(Element.prototype as unknown as { scrollTo: unknown }).scrollTo = scrollTo
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    restore.push(() => vi.unstubAllGlobals())
  })
  afterEach(() => {
    restore.forEach(undo => undo())
    restore = []
  })

  const items = [{ url: '/1.jpg', title: 'One' }, { url: '/2.jpg', title: 'Two' }, { url: '/3.jpg', title: 'Three' }]

  it('labels slides, moves with the arrows and dots and reports the index', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiCarousel items={items} aria-label="Highlights" onChange={onChange} />)
    const region = host.querySelector<HTMLElement>('[data-slot="carousel"]')!
    expect(region.getAttribute('role')).toBe('region')
    expect(region.getAttribute('aria-roledescription')).toBe('carousel')
    expect(region.getAttribute('aria-label')).toBe('Highlights')
    expect(host.querySelectorAll('[data-slot="carousel-item"]')[1]?.getAttribute('aria-label')).toBe('2 of 3')
    const dots = host.querySelectorAll('[data-slot="carousel-dot"]')
    expect(dots).toHaveLength(3)
    expect(dots[0]?.getAttribute('aria-current')).toBe('true')
    expect(host.querySelector<HTMLButtonElement>('[data-slot="carousel-previous"]')!.disabled).toBe(true)
    await click(host.querySelector('[data-slot="carousel-next"]'))
    expect(onChange).toHaveBeenLastCalledWith(1)
    expect(host.querySelectorAll('[data-slot="carousel-dot"]')[1]?.getAttribute('aria-current')).toBe('true')
    await click(dots[2])
    expect(onChange).toHaveBeenLastCalledWith(2)
    expect(host.querySelector<HTMLButtonElement>('[data-slot="carousel-next"]')!.disabled).toBe(true)
    await key(region, 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('autoplays, pauses on hover and stops from its button', async () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const host = await mount(<LumiCarousel items={items} autoplay interval={2000} loop onChange={onChange} />)
      await act(async () => vi.advanceTimersByTime(2100))
      expect(onChange).toHaveBeenLastCalledWith(1)
      const region = host.querySelector<HTMLElement>('[data-slot="carousel"]')!
      await act(async () => region.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })))
      await act(async () => vi.advanceTimersByTime(4100))
      expect(onChange).toHaveBeenCalledTimes(1)
      await act(async () => region.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })))
      const toggle = host.querySelector<HTMLButtonElement>('[data-slot="carousel-autoplay"]')!
      expect(toggle.getAttribute('aria-label')).toBe('Pause autoplay')
      await act(async () => toggle.click())
      expect(toggle.getAttribute('aria-label')).toBe('Start autoplay')
      await act(async () => vi.advanceTimersByTime(6000))
      expect(onChange).toHaveBeenCalledTimes(1)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('takes children as slides', async () => {
    const host = await mount(
      <LumiCarousel>
        <p>A</p>
        <p>B</p>
      </LumiCarousel>,
    )
    expect(Array.from(host.querySelectorAll('[data-slot="carousel-item"]'), node => node.textContent)).toEqual(['A', 'B'])
  })
})

describe('lumiBreadcrumb', () => {
  const items = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'catalog', label: 'Catalog' },
    { key: 'shoes', label: 'Shoes' },
    { key: 'running', label: 'Running' },
    { key: 'trail', label: 'Trail runner X' },
  ]

  it('links, reports and marks the current page', async () => {
    const onSelect = vi.fn()
    const host = await mount(<LumiBreadcrumb items={items.slice(0, 3)} onSelect={onSelect} />)
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Breadcrumb')
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/')
    await click(host.querySelector('button'))
    expect(onSelect).toHaveBeenCalledWith('catalog')
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('Shoes')
    expect(host.querySelectorAll('[data-slot="breadcrumb-separator"]')).toHaveLength(2)
  })

  it('folds the middle of a long path into a menu', async () => {
    const host = await mount(<LumiBreadcrumb items={items} maxItems={4} separator="slash" />)
    const labels = Array.from(host.querySelectorAll('[data-slot="breadcrumb-item"]'), node => node.textContent)
    expect(labels).toEqual(['Home', '', 'Running', 'Trail runner X'])
    expect(host.querySelector('[data-slot="breadcrumb-overflow"]')?.getAttribute('aria-label')).toBe('Show 2 more')
    expect(host.querySelector('[data-slot="breadcrumb-separator"]')?.textContent).toBe('/')
  })
})

describe('json registry', () => {
  it('runs confirm actions from a Popconfirm and binds Popover open state', async () => {
    const store = createStateStore({ open: true, removed: false })
    const removed = vi.fn()
    const spec: Spec = {
      root: 'stack',
      elements: {
        stack: { type: 'Stack', props: {}, children: ['confirm', 'pop'] },
        confirm: {
          type: 'Popconfirm',
          props: { title: 'Remove?', label: 'Remove', confirmText: 'Remove' },
          on: { confirm: { action: 'removed' } },
          children: [],
        },
        pop: {
          type: 'Popover',
          props: { label: 'Details', title: 'Bound', open: { $bindState: '/open' } },
          children: [],
        },
      },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ removed }}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    expect(document.querySelector('[data-lumi-popover="panel"]')?.textContent).toContain('Bound')
    await key(document, 'Escape')
    expect(store.get('/open')).toBe(false)
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)))
    await click(host.querySelector('button'))
    await click(Array.from(document.querySelectorAll('[data-lumi-popover="confirm"] button')).find(button => button.textContent === 'Remove'))
    expect(removed).toHaveBeenCalledTimes(1)
  })

  it('declares every new component in the catalog', () => {
    for (const name of ['Popover', 'Popconfirm', 'Image', 'Lightbox', 'Carousel', 'Breadcrumb'] as const)
      expect(uiComponentDefinitions[name].description.length).toBeGreaterThan(40)
    expect(uiComponentDefinitions.Breadcrumb.props.safeParse({ items: [{ key: 'a', label: 'A' }], maxItems: 2 }).success).toBe(false)
  })

  it('keeps the lightbox scrim on theme tokens in both themes', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/styles/overlays-media.css'), 'utf8')
    expect(css).toMatch(/\[data-theme="dark"\] \{[^}]*--lumi-lightbox-scrim: color-mix\(in oklab, var\(--background\)/)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|\bblack\b|\bwhite\b/i)
    expect(readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')).toContain('@import "./styles/overlays-media.css";')
  })
})
