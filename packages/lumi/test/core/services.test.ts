import type { NotificationParams } from '../../src/core/providers/notification.js'
import { createStateStore } from '@json-render/core'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, vi } from 'vitest'
import { createLumiHandlers, formStatusPath } from '../../src/core/actions.js'
import { createLumi } from '../../src/core/context.js'
import { FormBusyError, toastError } from '../../src/core/feedback.js'
import { createTenantProvider } from '../../src/core/providers/tenant.js'
import { executeAuthAction, executeRequest } from '../../src/core/services.js'
import { FormValidationError } from '../../src/core/validation.js'

function fixture() {
  const provider = {
    getList: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteOne: vi.fn(),
    custom: vi.fn(),
  }
  const context = createLumi({
    dataProvider: provider,
    authProvider: {
      login: async () => ({ success: true }),
      logout: async () => ({ success: true }),
      check: async () => ({ authenticated: true }),
    },
  })
  const client = new QueryClient()
  const store = createStateStore({ form: { email: 'taken@example.com' } })
  return {
    provider,
    context,
    client,
    store,
    handlers: createLumiHandlers(context, client, store),
  }
}
describe('shared request lifecycle', () => {
  it('does not project an old session response after login succeeds', async () => {
    const { provider, context, client, store, handlers } = fixture()
    let complete!: (value: unknown) => void
    provider.custom.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const request = handlers.request!({
      url: '/secret',
      resultPath: '/secret',
    })
    await executeAuthAction(context, client, 'login')
    complete({ data: 'old private response' })
    await request
    expect(store.get('/secret')).toBeUndefined()
    client.clear()
  })
  it('clears cached private data and rejects old writes after automatic logout', async () => {
    const { provider, context, client, store, handlers } = fixture()
    const logout = vi.spyOn(context.authProvider!, 'logout')
    context.authProvider!.onError = async () => ({ logout: true })
    client.setQueryData(['lumi', 'private'], 'secret')
    client.setQueryData(['host'], 'keep')
    let complete!: (value: unknown) => void
    provider.custom.mockReturnValue(new Promise((resolve) => {
      complete = resolve
    }))
    const old = handlers.request!({ url: '/secret', resultPath: '/secret' })
    await expect(executeRequest(context, async () => {
      throw new Error('expired')
    }, client)).rejects.toThrow('expired')
    expect(logout).toHaveBeenCalledOnce()
    expect(client.getQueryData(['lumi', 'private'])).toBeUndefined()
    expect(client.getQueryData(['host'])).toBe('keep')
    complete({ data: 'previous session' })
    await old
    expect(store.get('/secret')).toBeUndefined()
    client.clear()
  })
  it('does not apply a deferred auth error to a newer successful login', async () => {
    const { context, client } = fixture()
    let complete!: (value: { logout: boolean }) => void
    context.authProvider!.onError = () => new Promise((resolve) => {
      complete = resolve
    })
    const logout = vi.spyOn(context.authProvider!, 'logout')
    const pending = executeRequest(context, async () => {
      throw new Error('old request')
    }, client)
    const rejected = expect(pending).rejects.toThrow('old request')
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'))
    await executeAuthAction(context, client, 'login')
    client.setQueryData(['lumi', 'new'], 'new user')
    complete({ logout: true })
    await rejected
    expect(logout).not.toHaveBeenCalled()
    expect(client.getQueryData(['lumi', 'new'])).toBe('new user')
    client.clear()
  })
  it('preserves structured server field errors without closing the form', async () => {
    const { provider, handlers, store, client } = fixture()
    provider.create.mockRejectedValue(
      new FormValidationError([
        {
          path: 'email',
          code: 'taken',
          message: 'Email is already registered',
        },
      ]),
    )
    await expect(
      handlers.submitForm!({
        resource: 'users',
        valuesPath: '/form',
        successState: { '/open': false },
      }),
    ).rejects.toBeInstanceOf(FormValidationError)
    expect(store.get(formStatusPath('/form'))).toMatchObject({
      pending: false,
      fieldErrors: { email: 'Email is already registered' },
    })
    expect(store.get('/open')).toBeUndefined()
    client.clear()
  })
  it('maps a provider error carrying an errors array onto fields', async () => {
    const { provider, handlers, store, client } = fixture()
    // The shape createSimpleDataProvider throws for `422 { message, errors: [...] }`.
    provider.create.mockRejectedValue(Object.assign(new Error('Validation failed'), {
      status: 422,
      errors: [{ path: 'email', code: 'taken', message: 'Email is already registered' }, { bogus: true }],
    }))
    await expect(handlers.submitForm!({ resource: 'users', valuesPath: '/form', successState: { '/open': false } })).rejects.toThrow('Validation failed')
    expect(store.get(formStatusPath('/form'))).toMatchObject({
      pending: false,
      fieldErrors: { email: 'Email is already registered' },
      errors: [{ path: 'email', code: 'taken', message: 'Email is already registered' }],
    })
    expect(store.get('/open')).toBeUndefined()
    client.clear()
  })

  it('hands toast and notify to their providers and tolerates having none', async () => {
    const bare = fixture()
    await bare.handlers.toast!({ message: 'Saved' })
    await bare.handlers.notify!({ title: 'Saved' })
    await bare.handlers.closeNotice!({ key: 'sync' })

    const toast = { open: vi.fn(() => 'toast-1') }
    const notice = { open: vi.fn(() => 'notice-1'), close: vi.fn() }
    const context = createLumi({ toastProvider: toast, notificationProvider: notice })
    const handlers = createLumiHandlers(context, new QueryClient(), createStateStore({}))
    await handlers.toast!({ tone: 'success', message: 'Saved', key: 'save', duration: 0 })
    expect(toast.open).toHaveBeenCalledWith({ tone: 'success', message: 'Saved', key: 'save', duration: 0 })
    await handlers.notify!({ tone: 'info', title: 'Export ready', description: 'orders.csv', duration: 0 })
    expect(notice.open).toHaveBeenCalledWith({ tone: 'info', title: 'Export ready', description: 'orders.csv', duration: 0, actions: undefined })
    await handlers.closeNotice!({ key: 'sync' })
    expect(notice.close).toHaveBeenCalledWith('sync')
    await expect(handlers.toast!({ message: '' })).rejects.toThrow()
    await expect(handlers.notify!({ description: 'no title' })).rejects.toThrow()
  })

  it('runs a notice action binding through the renderer when its button is pressed', async () => {
    const notice = { open: vi.fn((_params: NotificationParams) => 'notice-1') }
    const execute = vi.fn(async () => {})
    const context = createLumi({ notificationProvider: notice })
    const handlers = createLumiHandlers(context, new QueryClient(), createStateStore({}), { execute })
    await handlers.notify!({
      title: 'Order archived',
      actions: [{ label: 'Undo', action: 'toast', params: { message: 'Order restored' } }],
    })
    const [{ actions }] = notice.open.mock.calls[0]!
    expect(actions?.map(action => action.label)).toEqual(['Undo'])
    actions![0]!.onPress()
    expect(execute).toHaveBeenCalledWith({ action: 'toast', params: { message: 'Order restored' } })
  })
})

describe('automatic error toasts', () => {
  it('reports failures as danger toasts and keeps cancellations and busy submits silent', () => {
    const open = vi.fn(() => 'toast')
    const context = createLumi({ toastProvider: { open } })
    toastError(context, new Error('service offline'))
    expect(open).toHaveBeenLastCalledWith({ tone: 'danger', message: 'service offline' })
    toastError(context, new FormValidationError([{ path: 'a', code: 'x' }, { path: 'b', code: 'y' }]))
    expect(open).toHaveBeenLastCalledWith({ tone: 'danger', message: 'Check the 2 highlighted fields' })
    toastError(context, {})
    expect(open).toHaveBeenLastCalledWith({ tone: 'danger', message: 'Something went wrong. Try again' })
    open.mockClear()
    toastError(context, new FormBusyError())
    toastError(context, new DOMException('stopped', 'AbortError'))
    expect(open).not.toHaveBeenCalled()
  })

  it('throws a busy error for a duplicate submit without reporting it', async () => {
    const { provider, handlers, client } = fixture()
    provider.create.mockReturnValue(new Promise(() => {}))
    void handlers.submitForm!({ resource: 'users', valuesPath: '/form' })
    await expect(handlers.submitForm!({ resource: 'users', valuesPath: '/form' })).rejects.toBeInstanceOf(FormBusyError)
    client.clear()
  })
})

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => {
    resolve = a
    reject = b
  })
  return { promise, resolve, reject }
}

it('submit must stop when tenant changes during async validation', async () => {
  const tenant = createTenantProvider({ initial: 'A' })
  const validation = deferred<[]>()
  const writes: string[] = []
  const context = createLumi({ tenantProvider: tenant, validator: { validate: () => validation.promise }, dataProvider: { getList: async () => ({ data: [], total: 0 }), create: async () => {
    writes.push(tenant.get()!)
    return { data: {} }
  } } as never })
  const client = new QueryClient()
  const handlers = createLumiHandlers(context, client, createStateStore({ form: { name: 'A-only' } }))
  const pending = handlers.submitForm!({ resource: 'orders', valuesPath: '/form' }).catch(() => {})
  tenant.set('B')
  validation.resolve([])
  await pending
  client.clear()
  expect(writes).toEqual([])
})

it('a translated page context must share the auth session generation', async () => {
  let logouts = 0
  const context = createLumi({ authProvider: { login: async () => ({ success: true }), logout: async () => {
    logouts++
    return { success: true }
  }, onError: async () => ({ logout: true }) } as never })
  const pageContext = { ...context, config: { ...context.config } }
  const client = new QueryClient()
  const d = deferred<never>()
  const pending = executeRequest(pageContext, () => d.promise, client).catch(() => {})
  await executeAuthAction(context, client, 'login')
  d.reject(new Error('old page 401'))
  await pending
  client.clear()
  expect(logouts).toBe(0)
})

it('jSON delete values must reach the provider like the hook variables', async () => {
  let received: unknown
  const context = createLumi({ dataProvider: { getList: async () => ({ data: [], total: 0 }), deleteOne: async (params: unknown) => {
    received = params
    return { data: {} }
  } } as never })
  const client = new QueryClient()
  const handlers = createLumiHandlers(context, client, createStateStore({}))
  await handlers.delete!({ resource: 'orders', id: 1, values: { reason: 'duplicate' } })
  client.clear()
  expect(received).toMatchObject({ variables: { reason: 'duplicate' } })
})
