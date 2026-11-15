// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/definitions.js'
import { LumiButton } from '../src/components/base.js'
import { LumiTagsInput } from '../src/components/controls.js'
import { LumiBadge } from '../src/components/display.js'
import { LumiTimeline } from '../src/components/extensions.js'
import { LumiForm, LumiFormField } from '../src/components/form.js'
import { LumiImageGrid } from '../src/components/upload.js'
import { resolveOutlineIcon } from '../src/icons.js'
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

async function type(input: HTMLInputElement, text: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function press(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  await act(async () => {
    input.dispatchEvent(event)
  })
  return event
}

const chips = (host: HTMLElement): string[] => Array.from(host.querySelectorAll('[data-slot="tags-input-chip"]'), chip => chip.textContent ?? '')
const field = (host: HTMLElement): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-slot="tags-input-field"]')!

function Tags(props: { initial?: string[], max?: number }): ReactNode {
  const [value, setValue] = useState(props.initial ?? [])
  return <LumiTagsInput ariaLabel="Tags" placeholder="Add a tag" max={props.max} value={value} onChange={setValue} />
}

// WCAG contrast of the oklch steps the soft badge pins; hue comes from the theme's brand.
function luminance(l: number, c: number, hue: number): number {
  const a = c * Math.cos(hue * Math.PI / 180)
  const b = c * Math.sin(hue * Math.PI / 180)
  const [lm, m, s] = [(l + 0.3963377774 * a + 0.2158037573 * b) ** 3, (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, (l - 0.0894841775 * a - 1.291485548 * b) ** 3] as const
  const clip = (value: number): number => Math.min(1, Math.max(0, value))
  return 0.2126 * clip(4.0767416621 * lm - 3.3077115913 * m + 0.2309699292 * s)
    + 0.7152 * clip(-1.2684380046 * lm + 2.6097574011 * m - 0.3413193965 * s)
    + 0.0722 * clip(-0.0041960863 * lm - 0.7034186147 * m + 1.707614701 * s)
}

function contrast(one: number, two: number): number {
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

describe('lumiBadge brand tone', () => {
  it('is accepted by the catalog and renders as a tone in both appearances', () => {
    expect(uiComponentDefinitions.Badge.props.safeParse({ tone: 'brand', appearance: 'solid' }).success).toBe(true)
    for (const appearance of ['soft', 'solid'] as const) {
      const html = renderToStaticMarkup(<LumiBadge label="Agent ready" tone="brand" appearance={appearance} />)
      expect(html).toContain('data-tone="brand"')
      expect(html).toContain(`data-appearance="${appearance}"`)
    }
  })

  it('holds 4.5:1 for soft text at every brand hue in light and dark', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    const rule = css.match(/\[data-slot="badge"\]\[data-tone="brand"\] \{([^}]*)\}/)![1]!
    expect(rule).toContain('--lumi-ui-current-tone: var(--lumi-ui-tone-brand)')
    expect(rule).toContain('--lumi-ui-current-tone-foreground: var(--lumi-ui-tone-brand-foreground)')
    expect(rule).toContain('--lumi-ui-tone-text-l: var(--lumi-ui-tone-brand-text-l)')
    const number = (source: string, name: string): number => Number(source.match(new RegExp(`${name}: ([\\d.]+)`))![1])
    const surfaceC = number(rule, '--lumi-ui-tone-surface-c')
    const textC = number(rule, '--lumi-ui-tone-text-c')
    const dark = css.indexOf('--lumi-ui-tone-surface-l: 0.29')
    const modes = [
      [number(css, '--lumi-ui-tone-surface-l'), number(css, '--lumi-ui-tone-brand-text-l')],
      [number(css.slice(dark), '--lumi-ui-tone-surface-l'), number(css.slice(dark), '--lumi-ui-tone-brand-text-l')],
    ] as const
    expect(modes[0]).not.toEqual(modes[1])
    for (const [surfaceL, textL] of modes) {
      for (let hue = 0; hue < 360; hue += 2)
        expect(contrast(luminance(textL, textC, hue), luminance(surfaceL, surfaceC, hue))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('badge appearances', () => {
  it('keeps white type at 4.5:1 on dark solid fills at every hue', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    const solid = css.match(/\[data-theme="dark"\] :is\(\[data-slot="badge"\], \[data-slot="tag"\]\)\[data-appearance="solid"\] \{\s*background: oklch\(from var\(--lumi-ui-current-tone\) ([\d.]+) min\(c, var\(--lumi-ui-tone-text-c\)\) h\);/)
    expect(solid).not.toBeNull()
    const fillL = Number(solid![1])
    const chromas = Array.from(css.matchAll(/\[data-slot="badge"\]\[data-tone="\w+"\][^{]*\{[^}]*--lumi-ui-tone-text-c: ([\d.]+)/g), match => Number(match[1]))
    expect(chromas.length).toBeGreaterThanOrEqual(7)
    for (const chroma of chromas) {
      for (let hue = 0; hue < 360; hue += 2)
        expect(contrast(1, luminance(fillL, chroma, hue))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives Badge and Tag one set of appearance rules', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
    const tagCss = readFileSync(resolve(import.meta.dirname, '../src/styles/feedback-display.css'), 'utf8')
    for (const appearance of ['soft', 'solid', 'outline'])
      expect(css).toContain(`:is([data-slot="badge"], [data-slot="tag"])[data-appearance="${appearance}"] {`)
    expect(tagCss).not.toMatch(/\[data-slot="tag"\]\[data-appearance=/)
  })
})

describe('lumiButton icon names', () => {
  const names = ['sliders', 'sliders-horizontal', 'eye', 'upload', 'truck', 'printer', 'sparkles', 'download', 'refresh', 'edit', 'pencil', 'plus', 'search', 'x', 'close', 'more-horizontal', 'undo', 'rotate-ccw', 'clock', 'check', 'filter']

  it.each(names)('renders %s', (name) => {
    expect(renderToStaticMarkup(<LumiButton label="Go" icon={name} />)).toContain('data-lumi-icon="hugeicons"')
  })

  it('keeps aliases on one glyph, accepts the prefixed form, and stays a finite map', () => {
    expect(resolveOutlineIcon('sliders')).toBe(resolveOutlineIcon('sliders-horizontal'))
    expect(resolveOutlineIcon('close')).toBe(resolveOutlineIcon('x'))
    expect(resolveOutlineIcon('hugeicons:eye')).toBe(resolveOutlineIcon('eye'))
    for (const unknown of ['nope', 'constructor', 'toString', undefined])
      expect(resolveOutlineIcon(unknown)).toBeUndefined()
  })
})

describe('lumiTimeline dot marker', () => {
  it('draws per-item tones with the title above its time and no invented status', () => {
    for (const tone of ['brand', 'neutral', 'success', 'warning'])
      expect(uiComponentDefinitions.Timeline.props.safeParse({ marker: 'dot', items: [{ key: 'a', title: 'A', tone }] }).success).toBe(true)
    const html = renderToStaticMarkup(
      <LumiTimeline marker="dot" items={[{ key: 'a', title: 'Agent found orders', timestamp: '20:15', tone: 'brand' }, { key: 'b', title: 'Declared', tone: 'success', status: 'complete' }]} />,
    )
    expect(html).toContain('data-marker="dot"')
    expect(html).toContain('data-tone="brand"')
    expect(html).toContain('aria-label="Tone: Brand"')
    expect(html).toContain('dateTime="20:15"')
    expect(html.indexOf('Agent found orders')).toBeLessThan(html.indexOf('20:15</time>'))
    expect(html).not.toContain('Status: Upcoming')
    expect(html).toContain('Status: Complete')
    expect(readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')).toMatch(/\[data-marker="dot"\] :is\(\[data-tone="primary"\], \[data-tone="brand"\]\) \[data-slot="timeline-indicator"\]/)
  })
})

describe('lumiTagsInput', () => {
  it('adds a trimmed tag on Enter, ignores duplicates, and clears the text', async () => {
    const host = await mount(<Tags initial={['Gift']} />)
    await type(field(host), '  Bestseller ')
    const enter = await press(field(host), 'Enter')
    expect(enter.defaultPrevented).toBe(true)
    expect(chips(host)).toEqual(['Gift', 'Bestseller'])
    expect(field(host).value).toBe('')
    await type(field(host), 'Gift')
    await press(field(host), 'Enter')
    expect(chips(host)).toEqual(['Gift', 'Bestseller'])
    expect(field(host).value).toBe('')
  })

  it('leaves Enter to an IME that is composing', async () => {
    const host = await mount(<Tags />)
    await type(field(host), 'yang')
    await press(field(host), 'Enter', { isComposing: true })
    expect(chips(host)).toEqual([])
    expect(field(host).value).toBe('yang')
  })

  it('removes through the chip button and Backspace on an empty field', async () => {
    const host = await mount(<Tags initial={['One', 'Two', 'Three']} />)
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Remove Two"]')!.click())
    expect(chips(host)).toEqual(['One', 'Three'])
    expect(document.activeElement).toBe(field(host))
    await press(field(host), 'Backspace')
    expect(chips(host)).toEqual(['One'])
    await type(field(host), 'x')
    await press(field(host), 'Backspace')
    expect(chips(host)).toEqual(['One'])
  })

  it('stops taking text at max and resumes after a removal', async () => {
    const host = await mount(<Tags initial={['One']} max={2} />)
    expect(field(host).placeholder).toBe('Add a tag')
    await type(field(host), 'Two')
    await press(field(host), 'Enter')
    expect(chips(host)).toEqual(['One', 'Two'])
    expect(field(host).readOnly).toBe(true)
    expect(field(host).placeholder).toBe('')
    await press(field(host), 'Backspace')
    expect(field(host).readOnly).toBe(false)
  })

  it('offers no removal when disabled or read-only', async () => {
    for (const lock of [{ disabled: true }, { readonly: true }]) {
      const host = await mount(<LumiTagsInput {...lock} value={['One']} onChange={vi.fn()} />)
      expect(host.querySelector('[aria-label="Remove One"]')).toBeNull()
    }
  })

  it('works as a FormField widget: label target, description, invalid state, and form data', async () => {
    const changes: unknown[] = []
    const submitted = vi.fn()
    const host = await mount(
      <LumiForm onSubmit={submitted}>
        <LumiFormField name="tags" label="Tags" widget="TagsInput" help="Used in search" error="Add a tag" max={3} placeholder="Add" value={['One']} onChange={value => changes.push(value)} />
      </LumiForm>,
    )
    const input = field(host)
    expect(host.querySelector('label')!.getAttribute('for')).toBe(input.id)
    expect(input.getAttribute('aria-label')).toBe('Tags')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('-help')
    expect(input.getAttribute('aria-describedby')).toContain('-error')
    expect(host.querySelector<HTMLInputElement>('input[type="hidden"][name="tags"]')!.value).toBe('["One"]')
    await type(input, 'Two')
    await press(input, 'Enter')
    expect(changes).toEqual([['One', 'Two']])
    expect(submitted).not.toHaveBeenCalled()
  })

  it('binds through native state in a JSON spec and runs its change action', async () => {
    const store = createStateStore({ tags: ['One'] })
    const changed = vi.fn()
    const spec: Spec = {
      root: 'tags',
      elements: {
        tags: {
          type: 'TagsInput',
          props: { value: { $bindState: '/tags' }, ariaLabel: 'Tags' },
          on: { change: { action: 'changed' } },
          children: [],
        },
      },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ changed }}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    await type(field(host), 'Two')
    await press(field(host), 'Enter')
    expect(store.get('/tags')).toEqual(['One', 'Two'])
    expect(changed).toHaveBeenCalledTimes(1)
  })
})

describe('lumiImageGrid', () => {
  const images = [{ url: '/a.jpg', alt: 'Front' }, { url: '/b.jpg' }, { url: '/c.jpg' }]
  const tiles = (host: HTMLElement): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>('[data-slot="image-grid-tile"]'))

  it('labels only the first tile as the cover', async () => {
    const host = await mount(<LumiImageGrid coverLabel="Main" value={images} />)
    expect(tiles(host)).toHaveLength(3)
    expect(tiles(host)[0]!.querySelector('figcaption')!.textContent).toBe('Main')
    expect(host.querySelectorAll('figcaption')).toHaveLength(1)
    expect(host.querySelector('img')!.getAttribute('alt')).toBe('Front')
    expect((await mount(<LumiImageGrid value={images} />)).querySelector('figcaption')!.textContent).toBe('Cover')
  })

  it('removes one tile and leaves the others mounted', async () => {
    const changes: unknown[] = []
    function Grid(): ReactNode {
      const [value, setValue] = useState(images)
      return (
        <LumiImageGrid
          value={value}
          onChange={(next) => {
            changes.push(next)
            setValue(next as typeof images)
          }}
        />
      )
    }
    const host = await mount(<Grid />)
    const kept = tiles(host)[2]!
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Remove image 2"]')!.click())
    expect(changes).toEqual([[images[0], images[2]]])
    expect(tiles(host)).toHaveLength(2)
    expect(tiles(host)[1]).toBe(kept)
    expect(host.querySelector('[aria-label="Remove Front"]')).not.toBeNull()
  })

  it('opens its own image picker from the upload tile', async () => {
    const host = await mount(<LumiImageGrid addLabel="Add photo" value={images} />)
    const add = host.querySelector<HTMLButtonElement>('[data-slot="image-grid-add"]')!
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
    const opened = vi.spyOn(input, 'click')
    expect(add.textContent).toContain('Add photo')
    expect(input.accept).toBe('image/*')
    expect(input.multiple).toBe(true)
    await act(async () => add.click())
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('hides the upload tile at max and locks when disabled or read-only', async () => {
    const add = '[data-slot="image-grid-add"]'
    const remove = '[data-action="remove"]'
    expect((await mount(<LumiImageGrid max={3} value={images} />)).querySelector(add)).toBeNull()
    expect((await mount(<LumiImageGrid max={4} value={images} />)).querySelector(add)).not.toBeNull()
    const disabled = await mount(<LumiImageGrid disabled value={images} />)
    expect(disabled.querySelector<HTMLButtonElement>(add)!.disabled).toBe(true)
    expect(disabled.querySelector(remove)).toBeNull()
    const readonly = await mount(<LumiImageGrid readonly value={images} />)
    expect(readonly.querySelector(add)).toBeNull()
    expect(readonly.querySelector(remove)).toBeNull()
  })

  it('falls back to a neutral swatch when an image fails to load', async () => {
    const host = await mount(<LumiImageGrid value={images} />)
    const tile = tiles(host)[0]!
    await act(async () => {
      tile.querySelector('img')!.dispatchEvent(new Event('error'))
    })
    expect(tile.querySelector('img')).toBeNull()
    const swatch = tile.querySelector('[data-slot="image-grid-swatch"]')!
    expect(swatch.getAttribute('aria-label')).toBe('Front')
    expect(tile.querySelector('figcaption')!.textContent).toBe('Cover')
    expect(tiles(host)[1]!.querySelector('img')).not.toBeNull()
  })

  it('binds through native state in a JSON spec, keeping picked files as local previews without a service', async () => {
    const store = createStateStore({ images: [{ url: '/a.jpg' }, { url: '/b.jpg' }] })
    const changed = vi.fn()
    const spec: Spec = {
      root: 'grid',
      elements: {
        grid: {
          type: 'ImageGrid',
          props: { value: { $bindState: '/images' }, max: 9, ariaLabel: 'Images' },
          on: { change: { action: 'changed' } },
          children: [],
        },
      },
    }
    expect(uiComponentDefinitions.ImageGrid.events).toEqual(['change'])
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ changed }}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['c'], 'c.png', { type: 'image/png' })] })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    // jsdom has no object URLs, so the local preview falls back to the file name.
    expect(store.get('/images')).toEqual([{ url: '/a.jpg' }, { url: '/b.jpg' }, { url: 'c.png' }])
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Remove image 1"]')!.click())
    expect(store.get('/images')).toEqual([{ url: '/b.jpg' }, { url: 'c.png' }])
    expect(changed).toHaveBeenCalledTimes(2)
  })
})

describe('unbound registry controls', () => {
  it('keep their defaultValue when the Spec binds no value', async () => {
    const spec: Spec = {
      root: 'stack',
      elements: {
        stack: { type: 'Stack', props: {}, children: ['radios', 'checks'] },
        radios: { type: 'RadioGroup', props: { ariaLabel: 'Plan', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }], defaultValue: 'pro' }, children: [] },
        checks: { type: 'CheckboxGroup', props: { ariaLabel: 'Channels', options: [{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }], defaultValue: ['sms'] }, children: [] },
      },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={createStateStore({})}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    const checked = [...host.querySelectorAll('[role="radio"],[role="checkbox"]')].filter(node => node.getAttribute('aria-checked') === 'true' || node.getAttribute('data-state') === 'checked')
    expect(checked).toHaveLength(2)
    expect(host.querySelector('[role="radiogroup"] [data-state="checked"]')?.getAttribute('value')).toMatch(/pro$/)
  })
})

describe('icon-only buttons', () => {
  it('name a circle or square button by its label without drawing the text', async () => {
    const host = await mount(<LumiButton label="Settings" icon="search" shape="square" />)
    const button = host.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Settings')
    expect(button.textContent).toBe('')
  })
})
