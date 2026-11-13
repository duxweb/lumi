import type { TokenStorage } from '../../src/core'
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, createSimpleAuthProvider } from '../../src/core'

function storage(): TokenStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: key => void map.delete(key) }
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Sent { url: string, init: RequestInit & { headers: Record<string, string> } }

/** A fetch that records each request and answers with `answer`. */
function recorder(answer: (url: string, init: RequestInit) => Response) {
  const sent: Sent[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({ url: String(input), init: init as Sent['init'] })
    return answer(String(input), init)
  })
  return { sent, http: createHttpClient({ fetcher: fetcher as unknown as typeof fetch }) }
}

describe('createSimpleAuthProvider', () => {
  it('stores the token on login, signs later requests with it and grants resource permissions', async () => {
    const store = storage()
    const { sent, http } = recorder(() => json(200, { data: { token: 't1', user: { id: 1 }, permissions: ['orders:*', 'products:list'] } }))
    const auth = createSimpleAuthProvider({ apiUrl: 'https://api.test/', storage: store, http })
    await expect(auth.authProvider.login({ username: 'a', password: 'b' })).resolves.toEqual({ success: true })
    expect(sent[0]).toMatchObject({ url: 'https://api.test/login', init: { method: 'POST', body: JSON.stringify({ username: 'a', password: 'b' }) } })
    expect(sent[0]!.init.headers.Authorization).toBeUndefined()
    expect(store.map.get('lumi_token')).toBe('t1')
    expect(await auth.authProvider.authorizeRequest!({ url: '/orders', method: 'GET' })).toEqual({ headers: { Authorization: 'Bearer t1' } })
    await expect(auth.accessProvider.can({ resource: 'orders', action: 'delete' })).resolves.toEqual({ can: true })
    await expect(auth.accessProvider.can({ resource: 'products', action: 'delete' })).resolves.toEqual({ can: false })
  })

  it('reports the backend message when login fails', async () => {
    const { http } = recorder(() => json(422, { message: 'Wrong password' }))
    const auth = createSimpleAuthProvider({ apiUrl: '/api', storage: storage(), http })
    const result = await auth.authProvider.login({})
    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Wrong password')
  })

  it('restores the session through me and signs out on an expired token', async () => {
    const store = storage()
    store.setItem('k', 'old')
    let ok = true
    const { sent, http } = recorder(url => url.endsWith('/whoami') && ok ? json(200, { data: { user: { id: 7 }, permissions: ['*:*'] } }) : json(401, {}))
    const auth = createSimpleAuthProvider({ apiUrl: '/api', tokenKey: 'k', endpoints: { me: '/whoami' }, loginPath: '/signin', storage: store, http })
    await expect(auth.authProvider.check()).resolves.toEqual({ authenticated: true })
    expect(sent[0]!.init.headers.Authorization).toBe('Bearer old')
    await expect(auth.authProvider.getIdentity!()).resolves.toEqual({ id: 7 })
    ok = false
    auth.getSession().user = null
    await expect(auth.authProvider.check()).resolves.toMatchObject({ authenticated: false, redirectTo: '/signin' })
    expect(store.map.has('k')).toBe(false)
    await expect(auth.authProvider.onError!({ status: 401 })).resolves.toEqual({ logout: true, redirectTo: '/signin' })
  })

  it('keeps no token in cookie mode: requests include the cookie and writes echo the CSRF cookie', async () => {
    const store = storage()
    const { sent, http } = recorder(url => url.endsWith('/me') ? json(200, { data: { user: { id: 3 }, permissions: [] } }) : json(200, { data: { user: { id: 3 }, permissions: [] } }))
    const auth = createSimpleAuthProvider({ apiUrl: '/api', mode: 'cookie', csrf: { cookie: 'XSRF-TOKEN', header: 'X-XSRF-TOKEN' }, readCookie: name => (name === 'XSRF-TOKEN' ? 'c1' : undefined), storage: store, http })
    await expect(auth.authProvider.login({ username: 'a' })).resolves.toEqual({ success: true })
    expect(store.map.size).toBe(0)
    expect(sent[0]!.init).toMatchObject({ credentials: 'include', headers: { 'X-XSRF-TOKEN': 'c1' } })
    expect(await auth.authProvider.authorizeRequest!({ url: '/orders', method: 'GET' })).toEqual({ credentials: 'include' })
    expect(await auth.authProvider.authorizeRequest!({ url: '/orders', method: 'POST' })).toEqual({ credentials: 'include', headers: { 'X-XSRF-TOKEN': 'c1' } })
    // `me` says whether the invisible cookie session exists.
    await expect(auth.authProvider.check()).resolves.toEqual({ authenticated: true })
    expect(sent.at(-1)).toMatchObject({ url: '/api/me', init: { credentials: 'include' } })
  })

  it('refreshes an expired token once for concurrent 401s and sends the requests again', async () => {
    const store = storage()
    store.setItem('lumi_token', 'old')
    let refreshes = 0
    const answer = (url: string, init: RequestInit): Response => {
      if (url.endsWith('/refresh')) {
        refreshes++
        return json(200, { data: { token: 'new' } })
      }
      const header = (init.headers as Record<string, string>).Authorization
      return header === 'Bearer new' ? json(200, { data: { ok: true } }) : json(401, {})
    }
    const raw = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => answer(String(input), init))
    const base = createHttpClient({ fetcher: raw as unknown as typeof fetch })
    const auth = createSimpleAuthProvider({ apiUrl: '/api', endpoints: { refresh: '/refresh' }, storage: store, http: base })
    const app = base.extend({ baseUrl: '/api', authProvider: auth.authProvider })
    const results = await Promise.all([app.request('/a'), app.request('/b'), app.request('/c')])
    expect(results).toEqual([{ data: { ok: true } }, { data: { ok: true } }, { data: { ok: true } }])
    expect(refreshes).toBe(1)
    expect(store.map.get('lumi_token')).toBe('new')
  })

  it('signs the reader out when the refresh is refused', async () => {
    const store = storage()
    store.setItem('lumi_token', 'old')
    const raw = vi.fn(async () => json(401, { message: 'expired' }))
    const base = createHttpClient({ fetcher: raw as unknown as typeof fetch })
    const auth = createSimpleAuthProvider({ apiUrl: '/api', endpoints: { refresh: '/refresh' }, storage: store, http: base })
    const app = base.extend({ baseUrl: '/api', authProvider: auth.authProvider })
    await expect(app.request('/a')).rejects.toMatchObject({ status: 401, message: 'expired' })
    // The request, the refresh, and no second try.
    expect(raw).toHaveBeenCalledTimes(2)
  })
})

describe('createPermissionMatcher', () => {
  it('reads colon permissions with per-segment and trailing wildcards', async () => {
    const { createPermissionMatcher } = await import('../../src/core')
    const can = createPermissionMatcher()
    expect(can(['system:users:delete'], { resource: 'system/users', action: 'delete' })).toBe(true)
    expect(can(['system:users:list'], { resource: '/system/users/', action: 'delete' })).toBe(false)
    expect(can(['system:*'], { resource: 'system/users', action: 'delete' })).toBe(true)
    expect(can(['*:users:delete'], { resource: 'system/users', action: 'delete' })).toBe(true)
    expect(can(['*:users:delete'], { resource: 'system/roles', action: 'delete' })).toBe(false)
    expect(can(['orders:*'], { resource: 'orders', action: 'edit' })).toBe(true)
    expect(can(['*:*'], { resource: 'shop/orders', action: 'edit' })).toBe(true)
    expect(can(['*'], { resource: 'anything', action: 'list' })).toBe(true)
    // No implicit prefix: a bare resource grants nothing below it.
    expect(can(['system'], { resource: 'system/users', action: 'list' })).toBe(false)
    expect(can(['system:users:list'], { resource: 'system/users', action: 'field:email' })).toBe(true)
    expect(can(['system:roles:list'], { resource: 'system/users', action: 'field:email' })).toBe(false)
  })

  it('reads dotted permissions and a custom order', async () => {
    const { createPermissionMatcher } = await import('../../src/core')
    const dotted = createPermissionMatcher({ separator: '.' })
    expect(dotted(['system.users.delete'], { resource: 'system/users', action: 'delete' })).toBe(true)
    expect(dotted(['system.*'], { resource: 'system/users', action: 'edit' })).toBe(true)
    expect(dotted(['system:users:delete'], { resource: 'system/users', action: 'delete' })).toBe(false)
    const actionFirst = createPermissionMatcher({ format: '{action}{separator}{resource}' })
    expect(actionFirst(['delete:system:users'], { resource: 'system/users', action: 'delete' })).toBe(true)
  })

  it('is what the simple access provider checks', async () => {
    const auth = createSimpleAuthProvider({ apiUrl: '/api', storage: storage(), permission: { separator: '.' } })
    auth.getSession().permissions = ['shop.orders.*']
    await expect(auth.accessProvider.can({ resource: 'shop/orders', action: 'delete' })).resolves.toEqual({ can: true })
    await expect(auth.accessProvider.can({ resource: 'shop/products', action: 'delete' })).resolves.toEqual({ can: false })
  })
})

describe('a session that changes hands while a request is out', () => {
  /** A fetch whose `/me` and `/refresh` answers the test releases by hand. */
  function gated() {
    const waiting: Array<{ url: string, answer: (response: Response) => void }> = []
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/login'))
        return json(200, { data: { token: 'new', user: { id: 2, name: 'New' }, permissions: ['orders:list'] } })
      if (url.endsWith('/logout'))
        return json(200, {})
      return new Promise<Response>(resolve => waiting.push({ url, answer: resolve }))
    }) as typeof fetch
    return { waiting, http: createHttpClient({ fetcher }) }
  }
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 5; turn++)
      await Promise.resolve()
  }

  it('keeps a new sign-in when the old token\'s `me` is refused late', async () => {
    const store = storage()
    store.setItem('lumi_token', 'stale')
    const { waiting, http } = gated()
    const auth = createSimpleAuthProvider({ apiUrl: 'https://api.test', storage: store, http })
    const checking = auth.authProvider.check()
    await settle()
    await auth.authProvider.login({ username: 'a', password: 'b' })
    waiting[0]!.answer(json(401, {}))
    await expect(checking).resolves.toEqual({ authenticated: true })
    expect(store.map.get('lumi_token')).toBe('new')
    expect(auth.getSession().user).toEqual({ id: 2, name: 'New' })
  })

  it('does not put the old reader\'s identity under the new token', async () => {
    const store = storage()
    store.setItem('lumi_token', 'stale')
    const { waiting, http } = gated()
    const auth = createSimpleAuthProvider({ apiUrl: 'https://api.test', storage: store, http })
    const identity = auth.authProvider.getIdentity!()
    await settle()
    await auth.authProvider.login({ username: 'a', password: 'b' })
    waiting[0]!.answer(json(200, { data: { user: { id: 1, name: 'Old' }, permissions: ['*'] } }))
    await expect(identity).resolves.toEqual({ id: 2, name: 'New' })
    expect(auth.getSession()).toEqual({ user: { id: 2, name: 'New' }, permissions: ['orders:list'] })
    await expect(auth.accessProvider.can({ resource: 'orders', action: 'delete' })).resolves.toEqual({ can: false })
  })

  it('drops a refresh that finishes after the reader signed out', async () => {
    const store = storage()
    store.setItem('lumi_token', 'old')
    const { waiting, http } = gated()
    const auth = createSimpleAuthProvider({ apiUrl: 'https://api.test', storage: store, http, endpoints: { refresh: '/refresh' } })
    const refreshing = auth.authProvider.refresh!()
    await settle()
    await auth.authProvider.logout()
    waiting[0]!.answer(json(200, { data: { token: 'renewed' } }))
    await expect(refreshing).resolves.toBe(false)
    expect(store.map.has('lumi_token')).toBe(false)
  })
})

describe('field checks and the permission format', () => {
  it('pass with any permission on the resource, wherever the format puts it', async () => {
    const { createPermissionMatcher } = await import('../../src/core')
    const resourceFirst = createPermissionMatcher()
    expect(resourceFirst(['system:users:list'], { resource: 'system/users', action: 'field:email' })).toBe(true)
    expect(resourceFirst(['system:*'], { resource: 'system/users', action: 'field:email' })).toBe(true)
    expect(resourceFirst(['system:roles:list'], { resource: 'system/users', action: 'field:email' })).toBe(false)
    const actionFirst = createPermissionMatcher({ format: '{action}{separator}{resource}' })
    expect(actionFirst(['list:system:users'], { resource: 'system/users', action: 'field:email' })).toBe(true)
    expect(actionFirst(['*'], { resource: 'system/users', action: 'field:email' })).toBe(true)
    expect(actionFirst(['list:system:roles'], { resource: 'system/users', action: 'field:email' })).toBe(false)
    // Plain actions keep their exact match.
    expect(actionFirst(['list:system:users'], { resource: 'system/users', action: 'delete' })).toBe(false)
    expect(actionFirst(['delete:system:users'], { resource: 'system/users', action: 'delete' })).toBe(true)
  })
})
