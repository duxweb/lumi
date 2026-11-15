// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/definitions.js'
import { LumiCheckboxCards, LumiRadioCards } from '../src/components/choice-cards.js'
import { hexToHsv, hsvToHex } from '../src/components/color-area.js'
import { normalizeHex } from '../src/components/color-panel.js'
import { LumiColorPicker } from '../src/components/color-picker.js'
import { LumiColorSwatches } from '../src/components/color-swatches.js'
import { LumiInput } from '../src/components/controls.js'
import { LumiIconPicker } from '../src/components/icon-picker.js'
import { LumiInputOTP } from '../src/components/input-otp.js'
import { applyMask } from '../src/components/mask.js'
import { LumiRating } from '../src/components/rating.js'
import { LumiSignaturePad } from '../src/components/signature-pad.js'
import { LumiSlider } from '../src/components/slider.js'
import { LumiTagSelect } from '../src/components/tag-select.js'
import { uiRegistry } from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

beforeAll(() => {
  // Radix measures thumbs, and jsdom has neither observers nor a canvas.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

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

/** Edits a focused input the way a browser does: change the text at the selection, then fire `input`. */
async function edit(input: HTMLInputElement, text: string, inputType = 'insertText', start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start): Promise<void> {
  await act(async () => {
    input.focus()
    // The mask reads the selection on a timer while focused.
    await new Promise(resolve => setTimeout(resolve, 0))
    const deleting = inputType.startsWith('delete')
    const from = deleting && start === end ? start - 1 : start
    const next = input.value.slice(0, from) + text + input.value.slice(end)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, next)
    input.setSelectionRange(from + text.length, from + text.length)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: deleting ? null : text }))
  })
}

async function typeKeys(input: HTMLInputElement, text: string): Promise<void> {
  for (const char of text)
    await edit(input, char)
}

async function press(target: Element, key: string): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

async function click(target: Element): Promise<void> {
  await act(async () => {
    (target as HTMLElement).click()
  })
}

describe('catalog', () => {
  it('registers every new control with a renderer', () => {
    const names = ['Slider', 'RadioCards', 'CheckboxCards', 'TagSelect', 'Rating', 'ColorPicker', 'ColorSwatches', 'InputOTP', 'SignaturePad', 'IconPicker'] as const
    for (const name of names) {
      expect(uiComponentDefinitions[name].events).toContain('change')
      expect(Object.keys(uiRegistry)).toContain(name)
    }
    expect(uiComponentDefinitions.InputOTP.events).toEqual(['change', 'complete'])
    expect(uiComponentDefinitions.Slider.props.safeParse({ value: [10, 20], min: 0, max: 100, step: 5, marks: [{ value: 10, label: 'Ten' }] }).success).toBe(true)
    expect(uiComponentDefinitions.Rating.props.safeParse({ count: 0 }).success).toBe(false)
    expect(uiComponentDefinitions.Input.props.safeParse({ mask: '999-9999', unmask: true }).success).toBe(true)
  })
})

describe('input mask', () => {
  it('inserts literals before the next typed character and keeps raw input apart', () => {
    expect(applyMask('13812345678', '999 9999 9999')).toEqual({ masked: '138 1234 5678', raw: '13812345678' })
    expect(applyMask('138', '999 9999 9999').masked).toBe('138')
    expect(applyMask('1384', '999 9999 9999').masked).toBe('138 4')
    expect(applyMask('a1b2', '9999').masked).toBe('12')
    expect(applyMask('+86 1', '+86 999').masked).toBe('+86 1')
    expect(applyMask('861', '+86 999', true).masked).toBe('+86 861')
    expect(applyMask('b12', 'A-*\\9').masked).toBe('b-1')
    expect(applyMask('13800000000', '999 9999 9999').masked).toBe('138 0000 0000')
  })

  it('masks what is typed and can store only the typed characters', async () => {
    const masked = vi.fn()
    const raw = vi.fn()
    const host = await mount(
      <>
        <LumiInput ariaLabel="Phone" mask="999-9999" placeholder="555-0100" onChange={masked} />
        <LumiInput ariaLabel="Code" mask="99-99" unmask onChange={raw} />
      </>,
    )
    const [phone, code] = Array.from(host.querySelectorAll('input'))
    expect(phone!.placeholder).toBe('555-0100')
    expect(code!.placeholder).toBe('')
    expect(phone!.inputMode).toBe('numeric')
    await typeKeys(phone!, '12a345')
    expect(masked).toHaveBeenLastCalledWith('123-45')
    expect(phone!.value).toBe('123-45')
    await typeKeys(code!, '1234')
    expect(raw).toHaveBeenLastCalledWith('1234')
    expect(code!.value).toBe('12-34')
  })

  it('formats a paste and keeps the caret on a deletion in the middle', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiInput ariaLabel="Phone" mask="999 9999 9999" onChange={onChange} />)
    const input = host.querySelector('input')!
    await edit(input, '138-1234 5678', 'insertFromPaste')
    expect(input.value).toBe('138 1234 5678')
    expect(onChange).toHaveBeenLastCalledWith('138 1234 5678')
    // Backspace after "13" pulls the rest left; the caret stays where it was.
    await edit(input, '', 'deleteContentBackward', 2, 2)
    expect(input.value).toBe('181 2345 678')
    expect(input.selectionStart).toBe(1)
    expect(onChange).toHaveBeenLastCalledWith('181 2345 678')
  })

  it('shows a value from state masked, and a typed-only value in unmask mode', async () => {
    const host = await mount(
      <>
        <LumiInput ariaLabel="Phone" mask="999 9999 9999" value="13800000000" />
        <LumiInput ariaLabel="Card" mask="9999 9999" unmask value="12345678" />
      </>,
    )
    expect(Array.from(host.querySelectorAll('input'), input => input.value)).toEqual(['138 0000 0000', '1234 5678'])
  })
})

describe('lumiSlider', () => {
  it('labels range thumbs, speaks mark labels and moves with keys', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiSlider ariaLabel="Price" defaultValue={[20, 60]} step={10} marks={[{ value: 20, label: 'Low' }]} onChange={onChange} />)
    const thumbs = Array.from(host.querySelectorAll('[role="slider"]'))
    expect(thumbs.map(thumb => thumb.getAttribute('aria-label'))).toEqual(['Price start', 'Price end'])
    expect(thumbs[0]!.getAttribute('aria-valuetext')).toBe('Low')
    await act(async () => (thumbs[1] as HTMLElement).focus())
    await press(thumbs[1]!, 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith([20, 70])
    expect(host.querySelector('[data-slot="slider-mark"]')!.hasAttribute('data-active')).toBe(true)
  })

  it('ignores input while readonly and reports a check error', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiSlider ariaLabel="Level" defaultValue={5} readonly invalid error="Too low" onChange={onChange} />)
    await press(host.querySelector('[role="slider"]')!, 'ArrowRight')
    expect(onChange).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Too low')
    expect(host.querySelector('[data-slot="lumi-slider"]')!.hasAttribute('data-invalid')).toBe(true)
  })
})

describe('choice cards', () => {
  const options = [
    { value: 'a', label: 'Alpha', description: 'First', badge: 'New', extra: '$1' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma', disabled: true },
  ]

  it('selects one radio card and describes it', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiRadioCards ariaLabel="Plan" name="plan" options={options} defaultValue="a" onChange={onChange} />)
    const cards = Array.from(host.querySelectorAll('[role="radio"]'))
    expect(cards).toHaveLength(3)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('true')
    expect(document.getElementById(cards[0]!.getAttribute('aria-describedby')!.split(' ')[0]!)!.textContent).toBe('First')
    await click(cards[1]!)
    expect(onChange).toHaveBeenLastCalledWith('b')
    expect((cards[2] as HTMLButtonElement).disabled).toBe(true)
    expect(host.querySelector<HTMLInputElement>('input[type="hidden"][name="plan"]')!.value).toBe('b')
  })

  it('marks readonly radio cards on the group, where ARIA allows it, and ignores clicks', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiRadioCards ariaLabel="Plan" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} defaultValue="a" readonly onChange={onChange} />)
    expect(host.querySelector('[role="radiogroup"]')!.getAttribute('aria-readonly')).toBe('true')
    const cards = Array.from(host.querySelectorAll<HTMLElement>('[role="radio"]'))
    expect(cards.every(card => !card.hasAttribute('aria-readonly') && card.hasAttribute('data-readonly'))).toBe(true)
    await click(cards[1]!)
    expect(onChange).not.toHaveBeenCalled()
    expect(cards[0]!.getAttribute('aria-checked')).toBe('true')
  })

  it('toggles checkbox cards in option order', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiCheckboxCards ariaLabel="Extras" options={options} defaultValue={['b']} onChange={onChange} />)
    await click(host.querySelectorAll('[role="checkbox"]')[0]!)
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    await click(host.querySelectorAll('[role="checkbox"]')[1]!)
    expect(onChange).toHaveBeenLastCalledWith(['a'])
  })
})

describe('lumiTagSelect', () => {
  const options = [{ value: 'day', label: 'Day', count: 2 }, { value: 'week', label: 'Week' }]

  it('keeps a single choice unless clearable, and toggles several', async () => {
    const single = vi.fn()
    const multiple = vi.fn()
    const host = await mount(
      <>
        <LumiTagSelect ariaLabel="Period" options={options} defaultValue="day" onChange={single} />
        <LumiTagSelect ariaLabel="Days" options={options} multiple defaultValue={['day']} onChange={multiple} />
      </>,
    )
    const [first, second] = Array.from(host.querySelectorAll('[role="group"]'))
    const tags = (group: Element): HTMLButtonElement[] => Array.from(group.querySelectorAll('button'))
    await click(tags(first!)[0]!)
    expect(single).not.toHaveBeenCalled()
    await click(tags(first!)[1]!)
    expect(single).toHaveBeenLastCalledWith('week')
    await click(tags(second!)[1]!)
    expect(multiple).toHaveBeenLastCalledWith(['day', 'week'])
    expect(tags(first!)[0]!.textContent).toContain('2')
  })
})

describe('lumiRating', () => {
  it('steps by halves from the keyboard and clears', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiRating ariaLabel="Score" defaultValue={2} allowHalf clearable onChange={onChange} />)
    const slider = host.querySelector('[role="slider"]')!
    expect(slider.getAttribute('aria-valuetext')).toBe('2 of 5')
    await press(slider, 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith(2.5)
    await press(slider, 'End')
    expect(onChange).toHaveBeenLastCalledWith(5)
    await press(slider, 'Delete')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('shows a readonly score as an image with partial fills', async () => {
    const host = await mount(<LumiRating ariaLabel="Average" value={3.5} allowHalf readonly count={4} />)
    expect(host.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Average: 3.5 of 4')
    expect(Array.from(host.querySelectorAll('[data-slot="rating-item"]'), item => item.getAttribute('data-fill'))).toEqual(['full', 'full', 'full', 'half'])
  })
})

describe('lumiInputOTP', () => {
  const boxes = (host: HTMLElement): HTMLInputElement[] => Array.from(host.querySelectorAll('[data-slot="input-otp-boxes"] input'))

  it('fills boxes in order, advances, pastes and completes', async () => {
    const onChange = vi.fn()
    const onComplete = vi.fn()
    const host = await mount(<LumiInputOTP length={4} onChange={onChange} onComplete={onComplete} />)
    await type(boxes(host)[0]!, '1')
    expect(onChange).toHaveBeenLastCalledWith('1')
    expect(document.activeElement).toBe(boxes(host)[1])
    await type(boxes(host)[1]!, 'x')
    expect(onChange).toHaveBeenCalledTimes(1)
    await act(async () => {
      const paste = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown }
      paste.clipboardData = { getData: () => '2-3 4 5' }
      boxes(host)[1]!.dispatchEvent(paste)
    })
    expect(onChange).toHaveBeenLastCalledWith('1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
    expect(boxes(host).map(box => box.value)).toEqual(['1', '2', '3', '4'])
  })

  it('deletes backwards from an empty box and masks characters', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiInputOTP length={4} mask defaultValue="12" onChange={onChange} />)
    expect(boxes(host).map(box => box.value)).toEqual(['•', '•', '', ''])
    await press(boxes(host)[2]!, 'Backspace')
    expect(onChange).toHaveBeenLastCalledWith('1')
    expect(document.activeElement).toBe(boxes(host)[1])
  })
})

describe('lumiColorPicker', () => {
  it('normalizes hex values', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('12ab9F')).toBe('#12ab9f')
    expect(normalizeHex('red')).toBeUndefined()
  })

  it('picks a preset and takes a typed hex', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiColorPicker ariaLabel="Tint" presets={['#FF0000', '#00ff00', 'nope']} onChange={onChange} />)
    await click(host.querySelector('[data-slot="select-trigger"]')!)
    const swatches = Array.from(document.querySelectorAll('[data-slot="color-picker-presets"] button'))
    expect(swatches.map(swatch => swatch.getAttribute('aria-label'))).toEqual(['#ff0000', '#00ff00'])
    await click(swatches[1]!)
    expect(onChange).toHaveBeenLastCalledWith('#00ff00')
    expect(swatches[1]!.getAttribute('aria-pressed')).toBe('true')
    await type(document.querySelector<HTMLInputElement>('input[aria-label="Hex value"]')!, '#123456')
    expect(onChange).toHaveBeenLastCalledWith('#123456')
  })

  it('converts between hex and hsv', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00')
    for (const hex of ['#3b82f6', '#e8590c', '#000000', '#ffffff', '#808080'])
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
  })

  it('drives the area and hue by keyboard, with shift for bigger steps', async () => {
    const onChange = vi.fn()
    await mount(<LumiColorPicker ariaLabel="Tint" defaultValue="#ff0000" presets={[]} onChange={onChange} />)
    await click(document.querySelector('[data-slot="select-trigger"]')!)
    const area = document.querySelector<HTMLElement>('[data-slot="color-area-thumb"]')!
    expect(area.getAttribute('role')).toBe('slider')
    expect(area.getAttribute('aria-valuetext')).toBe('Saturation 100%, brightness 100%')
    await act(async () => {
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith('#e60000')
    expect(area.getAttribute('aria-valuetext')).toBe('Saturation 100%, brightness 90%')
    const hue = document.querySelector<HTMLElement>('[data-slot="color-hue-thumb"]')!
    await press(hue, 'End')
    expect(hue.getAttribute('aria-valuenow')).toBe('360')
    await press(hue, 'Home')
    await act(async () => {
      hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(hue.getAttribute('aria-valuetext')).toBe('10 degrees')
    expect(onChange).toHaveBeenLastCalledWith(hsvToHex({ h: 10, s: 1, v: 0.9 }))
  })

  it('offers the eyedropper only where the browser has one', async () => {
    await mount(<LumiColorPicker ariaLabel="Tint" presets={[]} />)
    await click(document.querySelector('[data-slot="select-trigger"]')!)
    expect(document.querySelector('[aria-label="Pick a color from the screen"]')).toBeNull()
    const first = roots.splice(0)[0]!
    await act(async () => first.root.unmount())
    first.host.remove()
    const onChange = vi.fn()
    ;(window as { EyeDropper?: unknown }).EyeDropper = class { open = async () => ({ sRGBHex: '#ABCDEF' }) }
    try {
      await mount(<LumiColorPicker ariaLabel="Tint" presets={[]} onChange={onChange} />)
      await click(document.querySelector('[data-slot="select-trigger"]')!)
      await click(document.querySelector('[aria-label="Pick a color from the screen"]')!)
      expect(onChange).toHaveBeenLastCalledWith('#abcdef')
    }
    finally {
      delete (window as { EyeDropper?: unknown }).EyeDropper
    }
  })
})

describe('lumiColorSwatches', () => {
  const radios = (host: ParentNode): HTMLButtonElement[] => Array.from(host.querySelectorAll('[role="radio"]'))

  it('is a radio group: arrows move and select with wrap, and the chosen swatch holds the tab stop', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiColorSwatches ariaLabel="Tag color" swatches={['#FF0000', { value: '#00ff00', label: 'Green' }, '#0000ff', 'nope']} defaultValue="#00ff00" onChange={onChange} />)
    const group = host.querySelector('[role="radiogroup"]')!
    expect(group.getAttribute('aria-label')).toBe('Tag color')
    expect(radios(host).map(radio => radio.getAttribute('aria-label'))).toEqual(['#ff0000', 'Green', '#0000ff'])
    expect(radios(host).map(radio => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios(host).map(radio => radio.tabIndex)).toEqual([-1, 0, -1])
    expect(radios(host)[1]!.querySelector('svg')).not.toBeNull()
    await act(async () => radios(host)[1]!.focus())
    await press(radios(host)[1]!, 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('#0000ff')
    expect(document.activeElement).toBe(radios(host)[2])
    expect(radios(host).map(radio => radio.tabIndex)).toEqual([-1, -1, 0])
    await press(radios(host)[2]!, 'ArrowDown')
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
    expect(document.activeElement).toBe(radios(host)[0])
    await press(radios(host)[0]!, 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('#0000ff')
    await press(radios(host)[2]!, 'Home')
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
    await press(radios(host)[0]!, 'End')
    expect(onChange).toHaveBeenLastCalledWith('#0000ff')
    expect(radios(host)[2]!.getAttribute('aria-checked')).toBe('true')
  })

  it('moves focus but keeps the value while readonly', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiColorSwatches ariaLabel="Tint" swatches={['#ff0000', '#00ff00']} value="#ff0000" readonly onChange={onChange} />)
    expect(host.querySelector('[role="radiogroup"]')!.getAttribute('aria-readonly')).toBe('true')
    await press(radios(host)[0]!, 'ArrowRight')
    expect(document.activeElement).toBe(radios(host)[1])
    await click(radios(host)[1]!)
    expect(onChange).not.toHaveBeenCalled()
    expect(radios(host)[0]!.getAttribute('aria-checked')).toBe('true')
  })

  it('offers a "no color" swatch first when clearable', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiColorSwatches ariaLabel="Tint" swatches={['#ff0000']} defaultValue="#ff0000" clearable name="tint" onChange={onChange} />)
    const [none] = radios(host)
    expect(none!.getAttribute('aria-label')).toBe('No color')
    expect(none!.dataset.kind).toBe('none')
    await click(none!)
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(none!.getAttribute('aria-checked')).toBe('true')
    expect(none!.querySelector('svg')).toBeNull()
    expect(host.querySelector<HTMLInputElement>('input[type="hidden"][name="tint"]')!.value).toBe('')
  })

  it('adds a custom color from the full picker, shows it selected and keeps offering it', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiColorSwatches ariaLabel="Tint" swatches={['#ff0000', '#00ff00']} allowCustom onChange={onChange} />)
    const add = host.querySelector<HTMLButtonElement>('[data-slot="color-swatch-add"]')!
    expect(add.getAttribute('aria-label')).toBe('Custom color')
    expect(add.getAttribute('aria-haspopup')).toBe('dialog')
    await click(add)
    expect(add.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-slot="color-picker-panel"] [data-slot="color-area-thumb"]')).not.toBeNull()
    await type(document.querySelector<HTMLInputElement>('[data-slot="color-picker-panel"] input[aria-label="Hex value"]')!, '#123456')
    expect(onChange).toHaveBeenLastCalledWith('#123456')
    const custom = radios(host)[2]!
    expect(custom.getAttribute('aria-label')).toBe('Custom color #123456')
    expect(custom.getAttribute('aria-checked')).toBe('true')
    expect(custom.tabIndex).toBe(0)
    await click(radios(host)[0]!)
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
    expect(radios(host).map(radio => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(radios(host)[2]!.getAttribute('aria-label')).toBe('Custom color #123456')
  })

  it('shows a bound value outside the palette, and locks everything when disabled', async () => {
    const host = await mount(<LumiColorSwatches ariaLabel="Tint" swatches={['#ff0000']} value="#ABCDEF" allowCustom disabled />)
    expect(radios(host).map(radio => [radio.dataset.kind, radio.getAttribute('aria-checked'), radio.disabled])).toEqual([['swatch', 'false', true], ['custom', 'true', true]])
    expect(host.querySelector<HTMLButtonElement>('[data-slot="color-swatch-add"]')!.disabled).toBe(true)
  })

  it('draws the check light on dark swatches and dark on light ones', async () => {
    const host = await mount(<LumiColorSwatches ariaLabel="Tint" swatches={['#ffffff', '#000000', '#2d5bff', '#ffd43b', '#16a34a', '#22c55e']} />)
    expect(radios(host).map(radio => radio.dataset.mark)).toEqual(['dark', 'light', 'light', 'dark', 'light', 'dark'])
  })

  it('binds to state through the registry', async () => {
    const store = createStateStore({ tint: '#ff0000' })
    const spec: Spec = {
      root: 'tint',
      elements: { tint: { type: 'ColorSwatches', props: { value: { $bindState: '/tint' }, swatches: ['#ff0000', '#00ff00'], clearable: true, ariaLabel: 'Tint' }, children: [] } },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    await press(radios(host)[1]!, 'ArrowRight')
    expect(store.get('/tint')).toBe('#00ff00')
    await press(radios(host)[2]!, 'Home')
    expect(store.get('/tint')).toBe('')
  })
})

describe('lumiIconPicker', () => {
  it('searches the full icon set and picks a name', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiIconPicker ariaLabel="Icon" onChange={onChange} />)
    await click(host.querySelector('[data-slot="select-trigger"]')!)
    await vi.waitFor(() => expect(document.querySelector('[data-slot="icon-picker-grid"]')).not.toBeNull(), { timeout: 10000 })
    expect(document.querySelectorAll('[data-slot="icon-picker-grid"] button').length).toBeLessThanOrEqual(96)
    await type(document.querySelector<HTMLInputElement>('input[aria-label="Search icons…"]')!, 'home 01')
    const cell = document.querySelector<HTMLButtonElement>('[data-icon-name="home-01"]')
    expect(cell).not.toBeNull()
    await click(cell!)
    expect(onChange).toHaveBeenLastCalledWith('home-01')
  }, 15000)
})

describe('lumiSignaturePad', () => {
  it('offers undo and clear only when they apply, and hides them when locked', async () => {
    const host = await mount(<LumiSignaturePad ariaLabel="Sign" />)
    expect(host.querySelector('canvas')!.getAttribute('aria-label')).toBe('Sign, not signed')
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Undo stroke"]')!.disabled).toBe(true)
    const locked = await mount(<LumiSignaturePad ariaLabel="Locked" disabled />)
    expect(locked.querySelector('[data-slot="signature-actions"]')).toBeNull()
  })

  it('draws a stored signature that finishes loading after the pad measured itself', async () => {
    const drawn: unknown[] = []
    const context = { setTransform: () => {}, clearRect: () => {}, drawImage: (image: unknown) => drawn.push(image) }
    const images: Array<{ onload: (() => void) | null, complete: boolean, naturalWidth: number, naturalHeight: number }> = []
    class DeferredImage {
      onload: (() => void) | null = null
      complete = false
      naturalWidth = 0
      naturalHeight = 0
      src = ''
      constructor() {
        images.push(this)
      }
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    vi.stubGlobal('Image', DeferredImage)
    try {
      const host = await mount(<LumiSignaturePad ariaLabel="Approved" readonly defaultValue="data:image/png;base64,AAAA" />)
      expect(host.querySelector('canvas')!.getAttribute('aria-label')).toBe('Approved, signed')
      expect(drawn).toEqual([])
      await act(async () => {
        Object.assign(images[0]!, { complete: true, naturalWidth: 300, naturalHeight: 96 })
        images[0]!.onload!()
      })
      expect(drawn).toEqual([images[0]])
    }
    finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})

describe('registry binding', () => {
  it('binds new controls to state, validates checks and emits complete', async () => {
    const store = createStateStore({ rating: 1, code: '', tags: [] })
    const completed = vi.fn()
    const spec: Spec = {
      root: 'form',
      elements: {
        form: { type: 'Stack', props: {}, children: ['rating', 'code', 'tags'] },
        rating: { type: 'Rating', props: { value: { $bindState: '/rating' }, ariaLabel: 'Rating' }, children: [] },
        code: {
          type: 'InputOTP',
          props: { value: { $bindState: '/code' }, length: 2, ariaLabel: 'Code', checks: [{ type: 'minLength', args: { min: 2 }, message: 'Two digits' }] },
          on: { complete: { action: 'completed' } },
          children: [],
        },
        tags: { type: 'TagSelect', props: { value: { $bindState: '/tags' }, multiple: true, options: [{ value: 'x', label: 'X' }], ariaLabel: 'Tags' }, children: [] },
      },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ completed }}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    await press(host.querySelector('[role="slider"]')!, 'ArrowRight')
    expect(store.get('/rating')).toBe(2)
    const otp = Array.from(host.querySelectorAll<HTMLInputElement>('[data-slot="input-otp-boxes"] input'))
    await type(otp[0]!, '7')
    expect(store.get('/code')).toBe('7')
    await type(otp[1]!, '8')
    expect(store.get('/code')).toBe('78')
    expect(completed).toHaveBeenCalledTimes(1)
    await click(host.querySelector('[role="group"][aria-label="Tags"] button')!)
    expect(store.get('/tags')).toEqual(['x'])
  })
})
