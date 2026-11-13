// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import { createHttpClient, createLumi, createSimpleDataProvider, mergeUploadOptions } from '@duxweb/lumi'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadFiles } from '../../src/core/upload-transport.js'

class UploadXhr {
  static instance: UploadXhr | undefined
  method = ''
  url = ''
  withCredentials = false
  headers: Record<string, string> = {}
  body?: FormData
  responseText = JSON.stringify({ data: { url: '/uploads/photo.png' } })
  status = 201
  statusText = 'Created'
  upload: { onprogress?: (event: ProgressEvent) => void } = {}
  onerror?: () => void
  onabort?: () => void
  onload?: () => void

  constructor() {
    UploadXhr.instance = this
  }

  open(method: string, url: string): void {
    this.method = method
    this.url = url
  }

  getAllResponseHeaders(): string {
    return 'content-type: application/json\r\nx-sign: ok\r\n'
  }

  setRequestHeader(key: string, value: string): void {
    this.headers[key] = value
  }

  send(body: FormData): void {
    this.body = body
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded: 1,
      total: 1,
    } as ProgressEvent)
    this.onload?.()
  }
}

class InvalidUploadXhr extends UploadXhr {
  responseText = JSON.stringify({ data: { id: 1 } })
}

const dataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  create: async () => ({ data: {} }),
  update: async () => ({ data: {} }),
  deleteOne: async () => ({ data: {} }),
  getApiUrl: () => 'https://api.example.com/v1',
}

describe('upload runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    UploadXhr.instance = undefined
  })

  it('merges upload options and executes one browser upload request', async () => {
    vi.stubGlobal('XMLHttpRequest', UploadXhr)
    const progress: number[] = []
    const context = createLumi({ dataProvider })
    const options = mergeUploadOptions(
      {
        headers: { Authorization: 'Bearer token' },
        trustedOrigins: ['https://injected.example.com'],
      },
      {
        headers: { 'X-Default': 'default' },
        trustedOrigins: ['https://defaults.example.com'],
      },
      {
        url: '/assets',
        method: 'PUT',
        fieldName: 'asset',
        data: { folder: 'gallery' },
        headers: { 'X-Upload': 'schema' },
        withCredentials: true,
        trustedOrigins: ['https://schema.example.com'],
      },
    )
    const file = new File(['image'], 'photo.png', { type: 'image/png' })

    await expect(
      uploadFiles(context, file, options, value => progress.push(value)),
    ).resolves.toEqual([
      expect.objectContaining({ url: '/uploads/photo.png', name: 'photo.png' }),
    ])
    expect(UploadXhr.instance).toMatchObject({
      method: 'PUT',
      url: 'https://api.example.com/v1/assets',
      withCredentials: true,
      headers: {
        'Authorization': 'Bearer token',
        'X-Default': 'default',
        'X-Upload': 'schema',
      },
    })
    expect(UploadXhr.instance?.body?.get('folder')).toBe('gallery')
    expect(UploadXhr.instance?.body?.get('asset')).toMatchObject({
      name: 'photo.png',
    })
    expect(options.trustedOrigins).toEqual([
      'https://injected.example.com',
      'https://defaults.example.com',
      'https://schema.example.com',
    ])
    expect(progress).toEqual([100, 100])
  })

  it('rejects successful responses that omit the uploaded URL', async () => {
    vi.stubGlobal('XMLHttpRequest', InvalidUploadXhr)
    const file = new File(['image'], 'photo.png', { type: 'image/png' })

    await expect(uploadFiles(undefined, file)).rejects.toThrow(
      'Upload response must include a url',
    )
  })

  it('does not send files or host headers to an untrusted upload origin', async () => {
    vi.stubGlobal('XMLHttpRequest', UploadXhr)
    const context = createLumi({ dataProvider })
    const file = new File(['secret'], 'private.txt', { type: 'text/plain' })

    await expect(
      uploadFiles(context, file, {
        url: 'https://uploads.invalid/files',
        headers: { Authorization: 'Bearer token' },
      }),
    ).rejects.toThrow(
      'Upload target origin "https://uploads.invalid" is not trusted',
    )

    // Refused before any request exists.
    expect(UploadXhr.instance).toBeUndefined()
  })

  it('allows host headers for an explicitly trusted upload origin', async () => {
    vi.stubGlobal('XMLHttpRequest', UploadXhr)
    const context = createLumi({ dataProvider })
    const file = new File(['image'], 'photo.png', { type: 'image/png' })

    await expect(
      uploadFiles(context, file, {
        url: 'https://uploads.example.com/files',
        headers: { Authorization: 'Bearer token' },
        trustedOrigins: ['https://uploads.example.com'],
      }),
    ).resolves.toHaveLength(1)

    expect(UploadXhr.instance?.headers).toEqual({
      Authorization: 'Bearer token',
    })
  })
})

it('runs the data provider\'s request and response hooks on an upload', async () => {
  vi.stubGlobal('XMLHttpRequest', UploadXhr)
  const seen: string[] = []
  const context = createLumi({
    dataProvider: createSimpleDataProvider({
      apiUrl: 'https://api.example.com',
      http: createHttpClient(),
      onRequest: (request) => {
        seen.push(request.body instanceof FormData ? 'form' : 'other')
        request.headers['X-Sign'] = `${request.method} ${request.url}`
      },
      onResponse: (response) => {
        seen.push(response.headers.get('x-sign') ?? 'missing')
      },
    }),
  })
  await expect(uploadFiles(context, new File(['x'], 'x.png'), { headers: { 'X-Extra': 'e' } })).resolves.toHaveLength(1)
  expect(UploadXhr.instance?.headers).toEqual({ 'X-Extra': 'e', 'X-Sign': 'POST https://api.example.com/upload' })
  expect(seen).toEqual(['form', 'ok'])

  const rejecting = createLumi({
    dataProvider: createSimpleDataProvider({
      apiUrl: 'https://api.example.com',
      onResponse: () => {
        throw new Error('Bad signature')
      },
    }),
  })
  await expect(uploadFiles(rejecting, new File(['x'], 'x.png'))).rejects.toThrow('Bad signature')
  vi.unstubAllGlobals()
})

it('cancels immediately while waiting for host credentials and never sends later', async () => {
  class PendingXhr extends UploadXhr {
    abort(): void {}
  }
  vi.stubGlobal('XMLHttpRequest', PendingXhr)
  let resolveHeaders!: (headers: Record<string, string>) => void
  const headers = new Promise<Record<string, string>>((resolve) => {
    resolveHeaders = resolve
  })
  const controller = new AbortController()
  const context = createLumi({ dataProvider })
  const request = uploadFiles(context, new File(['x'], 'x.png'), {
    headers: () => headers,
    signal: controller.signal,
  })
  controller.abort()
  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  resolveHeaders({ Authorization: 'Bearer example' })
  await Promise.resolve()
  expect(UploadXhr.instance?.body).toBeUndefined()
  vi.unstubAllGlobals()
})

describe('direct-to-storage upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    UploadXhr.instance = undefined
  })

  class StorageXhr extends UploadXhr {
    responseText = ''
    status = 204
    statusText = 'No Content'
  }

  function backend(ticket: Record<string, unknown>) {
    const asked: Array<{ url: string, body: unknown, authorization: string | null }> = []
    const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input)
      asked.push({ url, body: JSON.parse(String(init.body)), authorization: new Headers(init.headers).get('Authorization') })
      return new Response(JSON.stringify({ data: url.endsWith('/done') ? { url: 'https://cdn.test/final.png', name: 'final.png' } : ticket }), { headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    const authProvider = { login: async () => ({ success: true }), logout: async () => ({ success: true }), check: async () => ({ authenticated: true }), authorizeRequest: () => ({ headers: { Authorization: 'Bearer reader' } }) }
    const http = createHttpClient({ fetcher, authProvider })
    return { asked, context: createLumi({ authProvider, http, dataProvider: createSimpleDataProvider({ apiUrl: 'https://api.example.com', http }) }) }
  }
  const file = new File(['image'], 'photo.png', { type: 'image/png' })

  it('asks the backend for a ticket and PUTs the file to the presigned address without the reader\'s credentials', async () => {
    vi.stubGlobal('XMLHttpRequest', StorageXhr)
    const { asked, context } = backend({ url: 'https://bucket.s3.test/a/photo.png?X-Amz-Signature=s', headers: { 'Content-Type': 'image/png' }, fileUrl: 'https://cdn.test/a/photo.png' })
    const progress: number[] = []
    await expect(uploadFiles(context, file, { sign: { url: '/upload/sign', data: { folder: 'a' } } }, value => progress.push(value))).resolves.toEqual([
      expect.objectContaining({ url: 'https://cdn.test/a/photo.png', name: 'photo.png', size: 5, type: 'image/png' }),
    ])
    expect(asked).toEqual([{ url: 'https://api.example.com/upload/sign', body: { name: 'photo.png', size: 5, type: 'image/png', folder: 'a' }, authorization: 'Bearer reader' }])
    expect(UploadXhr.instance).toMatchObject({ method: 'PUT', url: 'https://bucket.s3.test/a/photo.png?X-Amz-Signature=s', withCredentials: false, headers: { 'Content-Type': 'image/png' } })
    expect(UploadXhr.instance?.body).toBe(file)
    expect(progress).toEqual([100, 100])
  })

  it('sends a policy form with the signed fields before the file, then tells the backend', async () => {
    vi.stubGlobal('XMLHttpRequest', StorageXhr)
    const { asked, context } = backend({ url: 'https://bucket.oss.test/', fields: { key: 'a/photo.png', policy: 'p', signature: 's' }, complete: { key: 'a/photo.png' } })
    await expect(uploadFiles(context, file, { sign: { url: '/upload/sign', complete: '/upload/done' } })).resolves.toEqual([
      expect.objectContaining({ url: 'https://cdn.test/final.png', name: 'final.png' }),
    ])
    const form = UploadXhr.instance!.body as FormData
    expect(UploadXhr.instance).toMatchObject({ method: 'POST', url: 'https://bucket.oss.test/', headers: {} })
    expect([...form.keys()]).toEqual(['key', 'policy', 'signature', 'file'])
    expect(asked[1]).toEqual({ url: 'https://api.example.com/upload/done', body: { name: 'photo.png', size: 5, type: 'image/png', key: 'a/photo.png' }, authorization: 'Bearer reader' })
  })

  it('reports a refusal by the storage and a ticket without an address', async () => {
    class RefusingXhr extends UploadXhr {
      responseText = '<Error>SignatureDoesNotMatch</Error>'
      status = 403
      statusText = 'Forbidden'
    }
    vi.stubGlobal('XMLHttpRequest', RefusingXhr)
    await expect(uploadFiles(backend({ url: 'https://bucket.s3.test/x', fileUrl: 'https://cdn.test/x' }).context, file, { sign: { url: '/upload/sign' } })).rejects.toMatchObject({ status: 403, message: expect.stringContaining('storage refused') })
    await expect(uploadFiles(backend({ fileUrl: 'https://cdn.test/x' }).context, file, { sign: { url: '/upload/sign' } })).rejects.toThrow('must include the storage url')
    vi.stubGlobal('XMLHttpRequest', StorageXhr)
    await expect(uploadFiles(backend({ url: 'https://bucket.s3.test/x' }).context, file, { sign: { url: '/upload/sign' } })).rejects.toThrow('must include fileUrl')
  })
})
