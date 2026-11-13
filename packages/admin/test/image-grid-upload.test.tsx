// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { Spec } from '@json-render/core'
import { createLumi, LumiProvider } from '@duxweb/lumi'
import { createStateStore } from '@json-render/core'
import { Renderer } from '@json-render/react'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminRegistry } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Holds every request open until the test answers it. */
class HeldXhr {
  static sent: HeldXhr[] = []
  url = ''
  status = 0
  statusText = ''
  responseText = ''
  upload: { onprogress?: (event: ProgressEvent) => void } = {}
  onerror?: () => void
  onabort?: () => void
  onload?: () => void
  onloadend?: () => void
  withCredentials = false
  aborted = false
  open(_method: string, url: string): void {
    this.url = url
  }

  getAllResponseHeaders(): string {
    return ''
  }

  setRequestHeader(): void {}
  send(): void {
    HeldXhr.sent.push(this)
  }

  abort(): void {
    this.aborted = true
    this.onabort?.()
  }

  progress(loaded: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total: 100 } as ProgressEvent)
  }

  answer(status: number, body: unknown): void {
    this.status = status
    this.responseText = JSON.stringify(body)
    this.onload?.()
    this.onloadend?.()
  }
}

const dataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  create: async () => ({ data: {} }),
  update: async () => ({ data: {} }),
  deleteOne: async () => ({ data: {} }),
  getApiUrl: () => 'https://api.example.com',
} as unknown as DataProvider

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  vi.unstubAllGlobals()
  HeldXhr.sent = []
})

async function settle(check: () => boolean): Promise<void> {
  for (let step = 0; step < 40 && !check(); step++)
    await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
  expect(check()).toBe(true)
}

describe('connected ImageGrid', () => {
  it('uploads through the Lumi service with per-tile progress, and the bound state keeps only image items', async () => {
    vi.stubGlobal('XMLHttpRequest', HeldXhr)
    const store = createStateStore({ product: { images: [{ url: '/media/kept.svg' }] } })
    const spec: Spec = {
      root: 'grid',
      elements: {
        grid: {
          type: 'ImageGrid',
          props: { value: { $bindState: '/product/images' }, ariaLabel: 'Product images', max: 4, upload: { url: '/upload' } },
          children: [],
        },
      },
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    roots.push({ root, host })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => root.render(
      <LumiProvider context={createLumi({ dataProvider })} queryClient={queryClient} registry={adminRegistry} store={store}>
        <Renderer spec={spec} registry={adminRegistry} />
      </LumiProvider>,
    ))

    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })] })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    await settle(() => HeldXhr.sent.length === 2)
    expect(HeldXhr.sent[0]!.url).toBe('https://api.example.com/upload')

    await act(async () => HeldXhr.sent[0]!.progress(60))
    expect(host.querySelector('[aria-label="Uploading a.png"]')?.getAttribute('aria-valuenow')).toBe('60')

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Cancel upload of b.png"]')!.click())
    expect(HeldXhr.sent[1]!.aborted).toBe(true)

    await act(async () => HeldXhr.sent[0]!.answer(201, { data: { url: '/uploads/a.png' } }))
    await settle(() => (store.get('/product/images') as unknown[]).length === 2)
    expect(store.get('/product/images')).toEqual([{ url: '/media/kept.svg' }, { url: '/uploads/a.png' }])
    expect(host.querySelector('[data-status="uploading"]')).toBeNull()
  })
})
