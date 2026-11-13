import { handleMockRequest } from '../mock/handler.ts'

/**
 * Browser mode (`VITE_LUMI_ADMIN_MOCK=browser`): the demo backend runs in the
 * page. Requests for the configured API origin are answered by the same
 * handler the Node mock serves, through the two transports the app uses:
 * fetch (data, auth, live stream, assistant chat) and XMLHttpRequest (uploads,
 * for progress). Everything else goes to the network as usual.
 */

const DEMO_TOKEN_RE = /^lumi-admin-(\w+)$/

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function installFetch(isMock: (url: string) => boolean): void {
  const nativeFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    if (!isMock(new URL(url, location.href).href))
      return nativeFetch(input, init)
    const request = new Request(input, init)
    if (request.signal.aborted)
      throw abortError()
    return new Promise<Response>((resolve, reject) => {
      const onAbort = (): void => reject(abortError())
      request.signal.addEventListener('abort', onAbort, { once: true })
      handleMockRequest(request).then(resolve, reject).finally(() => request.signal.removeEventListener('abort', onAbort))
    })
  }
}

function installXhr(isMock: (url: string) => boolean): void {
  const NativeXhr = globalThis.XMLHttpRequest

  /** Answers mock-origin requests in-page; any other URL runs the native request. */
  class MockableXhr extends NativeXhr {
    #mock: { method: string, url: string, headers: Headers, aborted: boolean } | undefined
    #status = 0
    #statusText = ''
    #responseText = ''
    #readyState: number = NativeXhr.UNSENT
    #responseHeaders = new Headers()

    override open(method: string, url: string | URL, async = true, username?: string | null, password?: string | null): void {
      const href = new URL(String(url), location.href).href
      if (!isMock(href)) {
        this.#mock = undefined
        super.open(method, url, async, username, password)
        return
      }
      this.#mock = { method: method.toUpperCase(), url: href, headers: new Headers(), aborted: false }
      this.#readyState = NativeXhr.OPENED
    }

    override setRequestHeader(name: string, value: string): void {
      if (this.#mock)
        this.#mock.headers.append(name, value)
      else super.setRequestHeader(name, value)
    }

    override send(body?: Document | XMLHttpRequestBodyInit | null): void {
      const mock = this.#mock
      if (!mock) {
        super.send(body)
        return
      }
      const payload = body instanceof Document ? undefined : body ?? undefined
      const request = new Request(mock.url, { method: mock.method, headers: mock.headers, body: mock.method === 'GET' || mock.method === 'HEAD' ? undefined : payload })
      const size = payload instanceof Blob ? payload.size : 0
      const fire = (target: EventTarget, type: string, loaded = 0, total = 0): void => {
        target.dispatchEvent(new ProgressEvent(type, { lengthComputable: total > 0, loaded, total }))
      }
      void (async () => {
        // Upload progress first, so the uploader shows its bar the way it does over the network.
        const bytes = size || (await request.clone().arrayBuffer()).byteLength
        if (mock.aborted)
          return
        fire(this.upload, 'loadstart', 0, bytes)
        fire(this.upload, 'progress', bytes, bytes)
        fire(this.upload, 'load', bytes, bytes)
        fire(this.upload, 'loadend', bytes, bytes)
        try {
          const response = await handleMockRequest(request)
          const text = await response.text()
          if (mock.aborted)
            return
          this.#status = response.status
          this.#statusText = response.statusText
          this.#responseHeaders = response.headers
          this.#responseText = text
          this.#readyState = NativeXhr.DONE
          this.dispatchEvent(new Event('readystatechange'))
          fire(this, 'load', text.length, text.length)
        }
        catch {
          if (mock.aborted)
            return
          this.#readyState = NativeXhr.DONE
          this.dispatchEvent(new Event('readystatechange'))
          fire(this, 'error')
        }
        fire(this, 'loadend')
      })()
    }

    override abort(): void {
      const mock = this.#mock
      if (!mock) {
        super.abort()
        return
      }
      if (mock.aborted || this.#readyState === NativeXhr.DONE)
        return
      mock.aborted = true
      this.#readyState = NativeXhr.UNSENT
      this.dispatchEvent(new ProgressEvent('abort'))
      this.dispatchEvent(new ProgressEvent('loadend'))
    }

    override getResponseHeader(name: string): string | null {
      return this.#mock ? this.#responseHeaders.get(name) : super.getResponseHeader(name)
    }

    override getAllResponseHeaders(): string {
      if (!this.#mock)
        return super.getAllResponseHeaders()
      return Array.from(this.#responseHeaders, ([name, value]) => `${name}: ${value}\r\n`).join('')
    }

    override get status(): number {
      return this.#mock ? this.#status : super.status
    }

    override get statusText(): string {
      return this.#mock ? this.#statusText : super.statusText
    }

    override get readyState(): number {
      return this.#mock ? this.#readyState : super.readyState
    }

    override get responseText(): string {
      return this.#mock ? this.#responseText : super.responseText
    }

    override get response(): unknown {
      if (!this.#mock)
        return super.response
      return this.responseType === 'json' ? JSON.parse(this.#responseText || 'null') as unknown : this.#responseText
    }
  }

  globalThis.XMLHttpRequest = MockableXhr
}

/**
 * Routes requests under `apiUrl` to the in-page backend. A demo token kept from
 * an earlier visit is signed in again, since the backend's sessions do not
 * survive a reload; a first visit starts signed in as the admin, so the demo
 * opens on its dashboard (signing out still shows the login page).
 */
export async function installBrowserMock(apiUrl: string, tokenKey?: string): Promise<void> {
  const root = new URL(apiUrl, location.href)
  const isMock = (url: string): boolean => new URL(url).origin === root.origin
  installFetch(isMock)
  installXhr(isMock)

  if (tokenKey && localStorage.getItem(tokenKey) === null)
    localStorage.setItem(tokenKey, 'lumi-admin-admin')
  const role = DEMO_TOKEN_RE.exec((tokenKey && localStorage.getItem(tokenKey)) || '')?.[1]
  if (role) {
    await handleMockRequest(new Request(new URL('/login', root), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: role, password: 'admin' }),
    }))
  }
}
