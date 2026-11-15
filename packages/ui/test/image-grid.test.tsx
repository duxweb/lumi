// @vitest-environment jsdom
import type { ReactNode } from 'react'
import type { ImageGridItem, UploadFileContext } from '../src/catalog/index.js'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LumiImageGrid } from '../src/components/upload.js'

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

interface Held { file: File, context: UploadFileContext, resolve: (url: string) => void, reject: (error: Error) => void }

/** A fake upload service: every file waits until the test answers it. */
function heldUploads(): { calls: Held[], onUploadFile: (file: File, context: UploadFileContext) => Promise<string> } {
  const calls: Held[] = []
  return {
    calls,
    onUploadFile: (file, context) => new Promise<string>((resolve, reject) => {
      context.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      calls.push({ file, context, resolve, reject })
    }),
  }
}

/** Keeps the value in React state, as a bound field would. */
function Grid(props: { initial?: ImageGridItem[], onValue?: (value: ImageGridItem[]) => void } & Omit<Parameters<typeof LumiImageGrid>[0], 'value' | 'onChange'>): ReactNode {
  const { initial = [], onValue, ...rest } = props
  const [value, setValue] = useState(initial)
  return (
    <LumiImageGrid
      {...rest}
      value={value}
      onChange={(next) => {
        onValue?.(next)
        setValue(next)
      }}
    />
  )
}

const png = (name: string, size = 1): File => new File(['x'.repeat(size)], name, { type: 'image/png' })

async function pick(host: HTMLElement, files: File[]): Promise<void> {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}

async function press(target: Element, key: string): Promise<void> {
  await act(async () => {
    (target as HTMLElement).focus()
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

const byLabel = (host: ParentNode, label: string): HTMLElement | null => host.querySelector<HTMLElement>(`[aria-label="${label}"]`)
const tiles = (host: HTMLElement, status?: string): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>(`[data-slot="image-grid-tile"]${status ? `[data-status="${status}"]` : ''}`))
const surfaces = (host: HTMLElement): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>('[data-slot="image-grid-preview"]'))
const announced = (host: HTMLElement): string => host.querySelector('[data-slot="image-grid-announcer"]')?.textContent ?? ''

const photos: ImageGridItem[] = [{ url: '/a.jpg', alt: 'Front' }, { url: '/b.jpg', alt: 'Side' }, { url: '/c.jpg', alt: 'Back' }]

describe('image grid uploads', () => {
  it('shows each file as a tile with its own progress and appends the uploaded URL', async () => {
    const uploads = heldUploads()
    const onValue = vi.fn()
    const host = await mount(<Grid initial={[{ url: '/kept.jpg' }]} onUploadFile={uploads.onUploadFile} onValue={onValue} />)
    await pick(host, [png('one.png'), png('two.png')])
    expect(uploads.calls.map(call => call.file.name)).toEqual(['one.png', 'two.png'])
    expect(tiles(host, 'uploading')).toHaveLength(2)

    await act(async () => uploads.calls[0]!.context.onProgress(42))
    const ring = tiles(host, 'uploading')[0]!.querySelector('[role="progressbar"]')!
    expect(ring.getAttribute('aria-valuenow')).toBe('42')
    expect(ring.getAttribute('aria-label')).toBe('Uploading one.png')
    expect(ring.textContent).toBe('42%')

    // Every byte sent but no answer yet: the ring stops counting and says so.
    await act(async () => uploads.calls[1]!.context.onProgress(100))
    expect(tiles(host, 'uploading')[1]!.querySelector('[role="progressbar"]')!.hasAttribute('aria-valuenow')).toBe(false)
    expect(tiles(host, 'uploading')[1]!.textContent).toContain('Processing…')

    await act(async () => uploads.calls[1]!.resolve('/uploads/two.png'))
    await act(async () => uploads.calls[0]!.resolve('/uploads/one.png'))
    expect(onValue).toHaveBeenLastCalledWith([{ url: '/kept.jpg' }, { url: '/uploads/two.png' }, { url: '/uploads/one.png' }])
    expect(tiles(host, 'uploading')).toHaveLength(0)
    expect(tiles(host, 'done')).toHaveLength(3)
    // The finished tile is named after its file for the rest of the session.
    expect(byLabel(host, 'Remove one.png')).not.toBeNull()
  })

  it('keeps a failed upload as a tile with retry, and cancels one in flight without writing it', async () => {
    const uploads = heldUploads()
    const onValue = vi.fn()
    const host = await mount(<Grid onUploadFile={uploads.onUploadFile} onValue={onValue} />)
    await pick(host, [png('a.png'), png('b.png')])

    await act(async () => uploads.calls[0]!.reject(new Error('File exceeds the 1 MB server limit.')))
    const failed = tiles(host, 'error')[0]!
    expect(failed.querySelector('[role="alert"]')!.textContent).toBe('File exceeds the 1 MB server limit.')
    await act(async () => byLabel(host, 'Retry a.png')!.click())
    expect(uploads.calls).toHaveLength(3)
    expect(tiles(host, 'error')).toHaveLength(0)

    await act(async () => byLabel(host, 'Cancel upload of b.png')!.click())
    expect(uploads.calls[1]!.context.signal.aborted).toBe(true)
    expect(host.querySelector('[title="b.png"]')).toBeNull()

    await act(async () => uploads.calls[2]!.resolve('/uploads/a.png'))
    expect(onValue).toHaveBeenCalledTimes(1)
    expect(onValue).toHaveBeenLastCalledWith([{ url: '/uploads/a.png' }])
  })

  it('refuses other types and oversize files before sending, without retry', async () => {
    const uploads = heldUploads()
    const host = await mount(<Grid maxSize={10} onUploadFile={uploads.onUploadFile} />)
    expect(host.querySelector('[data-slot="upload-hint"]')!.textContent).toBe('Images up to 10 B')
    await pick(host, [png('ok.png'), png('big.png', 20), new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' })])
    expect(uploads.calls.map(call => call.file.name)).toEqual(['ok.png'])
    const reasons = tiles(host, 'error').map(tile => tile.textContent)
    expect(reasons).toEqual([expect.stringContaining('Larger than 10 B'), expect.stringContaining('This file type is not accepted')])
    expect(byLabel(host, 'Retry big.png')).toBeNull()
    await act(async () => byLabel(host, 'Dismiss spec.pdf')!.click())
    expect(tiles(host, 'error')).toHaveLength(1)
  })

  it('counts files in flight against max, hides the upload tile when full and shows n/max', async () => {
    const uploads = heldUploads()
    const host = await mount(<Grid initial={[{ url: '/a.jpg' }]} max={3} onUploadFile={uploads.onUploadFile} />)
    expect(host.querySelector('[data-slot="image-grid-count"]')!.textContent).toContain('1/3')
    await pick(host, [png('b.png'), png('c.png'), png('d.png')])
    expect(uploads.calls.map(call => call.file.name)).toEqual(['b.png', 'c.png'])
    expect(tiles(host, 'error')[0]!.textContent).toContain('Only 3 files allowed')
    expect(host.querySelector('[data-slot="image-grid-add"]')).toBeNull()

    await act(async () => uploads.calls[0]!.resolve('/b.png'))
    expect(host.querySelector('[data-slot="image-grid-count"]')!.textContent).toContain('2/3')
    await act(async () => byLabel(host, 'Cancel upload of c.png')!.click())
    expect(host.querySelector('[data-slot="image-grid-add"]')).not.toBeNull()
  })

  it('takes files dropped on the grid, and only the first when not multiple', async () => {
    const uploads = heldUploads()
    const host = await mount(<Grid multiple={false} onUploadFile={uploads.onUploadFile} />)
    const grid = host.querySelector<HTMLElement>('[data-slot="image-grid"]')!
    const drag = (type: string, files: File[] = []): Event => Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer: { types: ['Files'], files, dropEffect: 'none' } })
    await act(async () => grid.dispatchEvent(drag('dragenter')))
    expect(grid.hasAttribute('data-dropping')).toBe(true)
    await act(async () => grid.dispatchEvent(drag('drop', [png('one.png'), png('two.png')])))
    expect(grid.hasAttribute('data-dropping')).toBe(false)
    expect(uploads.calls.map(call => call.file.name)).toEqual(['one.png'])
  })

  it('hands accepted files to a host that uploads them itself', async () => {
    const onFiles = vi.fn()
    const host = await mount(<Grid onFiles={onFiles} />)
    await pick(host, [png('a.png'), new File(['t'], 'notes.txt', { type: 'text/plain' })])
    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.png' })])
    expect(tiles(host, 'error')[0]!.textContent).toContain('This file type is not accepted')
    expect(tiles(host, 'done')).toHaveLength(0)
  })
})

describe('image grid ordering', () => {
  it('reorders from the keyboard: Space picks up, arrows move, Space drops, with announcements', async () => {
    const onValue = vi.fn()
    const host = await mount(<Grid initial={photos} onValue={onValue} />)
    const first = surfaces(host)[0]!
    expect(first.getAttribute('aria-roledescription')).toBe('sortable image')
    expect(document.getElementById(first.getAttribute('aria-describedby')!)!.textContent).toContain('Press Space to pick up')

    await press(first, ' ')
    expect(announced(host)).toBe('Picked up Front. Position 1 of 3.')
    expect(tiles(host)[0]!.hasAttribute('data-lifted')).toBe(true)
    await press(first, 'ArrowRight')
    await press(first, 'ArrowRight')
    expect(announced(host)).toBe('Position 3 of 3.')
    // While it is held the value is untouched; only the cover badge follows the new order.
    expect(onValue).not.toHaveBeenCalled()
    expect(tiles(host)[1]!.querySelector('figcaption')!.textContent).toBe('Cover')

    await press(first, ' ')
    expect(onValue).toHaveBeenLastCalledWith([photos[1], photos[2], photos[0]])
    expect(announced(host)).toBe('Moved Front to position 3 of 3.')
    expect(document.activeElement).toBe(surfaces(host)[2])
    expect(tiles(host)[0]!.querySelector('figcaption')!.textContent).toBe('Cover')
  })

  it('puts the tile back on Escape and previews on Enter', async () => {
    const onValue = vi.fn()
    const host = await mount(<Grid initial={photos} onValue={onValue} />)
    const second = surfaces(host)[1]!
    await press(second, ' ')
    await press(second, 'Home')
    await press(second, 'Escape')
    expect(onValue).not.toHaveBeenCalled()
    expect(announced(host)).toBe('Move cancelled. Side stays at position 2 of 3.')
    expect(tiles(host)[1]!.hasAttribute('data-lifted')).toBe(false)

    await press(second, 'Enter')
    expect(document.querySelector('[data-slot="lightbox"]')?.textContent).toContain('2 / 3')
  })

  it('moves a tile to the front with Set as cover', async () => {
    const onValue = vi.fn()
    const host = await mount(<Grid initial={photos} onValue={onValue} />)
    expect(byLabel(host, 'Set Front as cover')).toBeNull()
    await act(async () => byLabel(host, 'Set Back as cover')!.click())
    expect(onValue).toHaveBeenLastCalledWith([photos[2], photos[0], photos[1]])
    expect(announced(host)).toBe('Back is now the cover.')
  })

  it('does not sort, remove or add when read-only, but still previews', async () => {
    const host = await mount(<Grid initial={photos} readonly />)
    const first = surfaces(host)[0]!
    expect(first.hasAttribute('aria-roledescription')).toBe(false)
    expect(host.querySelector('[data-action]')).toBeNull()
    expect(host.querySelector('input[type="file"]')).toBeNull()
    await press(first, ' ')
    expect(document.querySelector('[data-slot="lightbox"]')?.textContent).toContain('1 / 3')
  })

  describe('with a pointer', () => {
    const restore: Array<() => void> = []
    // jsdom has no layout: tiles sit in one row, 100px wide with a 10px gap.
    beforeEach(() => {
      const define = (name: string, get: (this: HTMLElement) => number): void => {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
        Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get })
        restore.push(() => original && Object.defineProperty(HTMLElement.prototype, name, original))
      }
      const slot = (node: HTMLElement): number => Array.from(node.parentElement?.children ?? []).indexOf(node)
      define('offsetLeft', function () {
        return this.dataset.slot === 'image-grid-tile' ? slot(this) * 110 : 0
      })
      define('offsetTop', () => 0)
      define('offsetWidth', () => 100)
      define('offsetHeight', () => 100)
    })
    afterEach(() => restore.splice(0).forEach(undo => undo()))

    const pointer = (type: string, x: number, init: Record<string, unknown> = {}): Event =>
      Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 50, button: 0 }), { pointerId: 1, pointerType: 'mouse', isPrimary: true, ...init })

    it('drags a tile over a placeholder to a new slot, without opening the preview', async () => {
      const onValue = vi.fn()
      const host = await mount(<Grid initial={photos} onValue={onValue} />)
      const first = surfaces(host)[0]!
      await act(async () => first.dispatchEvent(pointer('pointerdown', 50)))
      await act(async () => window.dispatchEvent(pointer('pointermove', 56)))
      expect(tiles(host)[0]!.hasAttribute('data-dragging')).toBe(true)
      expect(host.querySelector('[data-slot="image-grid-placeholder"]')).not.toBeNull()

      await act(async () => window.dispatchEvent(pointer('pointermove', 270)))
      expect((host.querySelector('[data-slot="image-grid-placeholder"]') as HTMLElement).style.order).toBe('2')
      // A browser fires the click right after pointerup, in the same task.
      await act(async () => {
        window.dispatchEvent(pointer('pointerup', 270))
        first.click()
      })
      expect(onValue).toHaveBeenLastCalledWith([photos[1], photos[2], photos[0]])
      expect(host.querySelector('[data-slot="image-grid-placeholder"]')).toBeNull()
      expect(document.querySelector('[data-slot="lightbox"]')).toBeNull()
    })

    it('puts the tile back when Escape is pressed mid-drag', async () => {
      const onValue = vi.fn()
      const host = await mount(<Grid initial={photos} onValue={onValue} />)
      await act(async () => surfaces(host)[2]!.dispatchEvent(pointer('pointerdown', 270)))
      await act(async () => window.dispatchEvent(pointer('pointermove', 40)))
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
      await act(async () => window.dispatchEvent(pointer('pointerup', 40)))
      expect(onValue).not.toHaveBeenCalled()
      expect(host.querySelector('[data-dragging]')).toBeNull()
    })

    it('waits for a long press before a finger drags, so a swipe still scrolls', async () => {
      vi.useFakeTimers()
      try {
        const onValue = vi.fn()
        const host = await mount(<Grid initial={photos} onValue={onValue} />)
        const touch = { pointerType: 'touch' }
        await act(async () => surfaces(host)[0]!.dispatchEvent(pointer('pointerdown', 50, touch)))
        await act(async () => window.dispatchEvent(pointer('pointermove', 80, touch)))
        await act(async () => vi.advanceTimersByTime(400))
        expect(host.querySelector('[data-dragging]')).toBeNull()

        await act(async () => window.dispatchEvent(pointer('pointerup', 80, touch)))
        await act(async () => surfaces(host)[0]!.dispatchEvent(pointer('pointerdown', 50, touch)))
        await act(async () => vi.advanceTimersByTime(400))
        expect(host.querySelector('[data-dragging]')).not.toBeNull()
        await act(async () => window.dispatchEvent(pointer('pointermove', 160, touch)))
        await act(async () => window.dispatchEvent(pointer('pointerup', 160, touch)))
        expect(onValue).toHaveBeenLastCalledWith([photos[1], photos[0], photos[2]])
      }
      finally {
        vi.useRealTimers()
      }
    })
  })
})
