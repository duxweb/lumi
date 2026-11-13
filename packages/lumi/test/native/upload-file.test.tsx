// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { UseUploadReturn } from '../../src/react/upload.js'
import { createLumi } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUpload } from '../../src/react/upload.js'

/** Holds every request open until the test answers it. */
class HeldXhr {
  static sent: HeldXhr[] = []
  url = ''
  status = 0
  statusText = ''
  responseText = ''
  body?: FormData
  upload: { onprogress?: (event: ProgressEvent) => void } = {}
  onerror?: () => void
  onabort?: () => void
  onload?: () => void
  withCredentials = false
  open(_method: string, url: string): void {
    this.url = url
  }

  getAllResponseHeaders(): string {
    return ''
  }

  setRequestHeader(): void {}
  send(body: FormData): void {
    this.body = body
    HeldXhr.sent.push(this)
  }

  abort(): void {
    this.onabort?.()
  }

  progress(loaded: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total: 100 } as ProgressEvent)
  }

  finish(url: string): void {
    this.status = 201
    this.responseText = JSON.stringify({ data: { url } })
    this.onload?.()
  }
}

const dataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  create: async () => ({ data: {} }),
  update: async () => ({ data: {} }),
  deleteOne: async () => ({ data: {} }),
  getApiUrl: () => 'https://api.example.com',
}

const roots: Array<ReturnType<typeof createRoot>> = []

async function renderUpload(): Promise<{ current: () => UseUploadReturn }> {
  const context = createLumi({ dataProvider })
  let latest!: UseUploadReturn
  function Probe() {
    latest = useUpload({ context, url: '/upload' })
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  await act(async () => root.render(<Probe />))
  return { current: () => latest }
}

afterEach(async () => {
  for (const root of roots.splice(0))
    await act(async () => root.unmount())
  vi.unstubAllGlobals()
  HeldXhr.sent = []
})

describe('useUpload().uploadFile', () => {
  it('sends files side by side with their own progress and leaves the shared status alone', async () => {
    vi.stubGlobal('XMLHttpRequest', HeldXhr)
    const upload = await renderUpload()
    const progress: Record<string, number[]> = { a: [], b: [] }
    const first = upload.current().uploadFile(new File(['a'], 'a.png'), { onProgress: value => progress.a!.push(value) })
    const second = upload.current().uploadFile(new File(['b'], 'b.png'), { onProgress: value => progress.b!.push(value) })
    await vi.waitFor(() => expect(HeldXhr.sent).toHaveLength(2))

    HeldXhr.sent[0]!.progress(40)
    HeldXhr.sent[1]!.progress(75)
    expect(progress).toEqual({ a: [40], b: [75] })
    expect(upload.current().uploading).toBe(false)

    HeldXhr.sent[1]!.finish('/uploads/b.png')
    HeldXhr.sent[0]!.finish('/uploads/a.png')
    await expect(second).resolves.toMatchObject({ url: '/uploads/b.png', name: 'b.png' })
    await expect(first).resolves.toMatchObject({ url: '/uploads/a.png' })
    expect(upload.current().error).toBeNull()
  })

  it('cancels one file through its signal without touching the others', async () => {
    vi.stubGlobal('XMLHttpRequest', HeldXhr)
    const upload = await renderUpload()
    const controller = new AbortController()
    const cancelled = upload.current().uploadFile(new File(['a'], 'a.png'), { signal: controller.signal })
    const kept = upload.current().uploadFile(new File(['b'], 'b.png'))
    await vi.waitFor(() => expect(HeldXhr.sent).toHaveLength(2))

    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    HeldXhr.sent[1]!.finish('/uploads/b.png')
    await expect(kept).resolves.toMatchObject({ url: '/uploads/b.png' })
  })
})
