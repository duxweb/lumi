// @vitest-environment jsdom
import type { AuthProvider } from '@duxweb/lumi'
import { createLumi, createSimpleDataProvider, listQueryKey } from '@duxweb/lumi'
import { notifyManager, QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LumiProvider, useCan, useCheck, useIdentity, useList, useLogin, useLogout, usePermissions } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void | Promise<void>> = []

beforeEach(() => {
  notifyManager.setNotifyFunction(callback => act(callback))
})

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse())
    await cleanup()
  notifyManager.setNotifyFunction(callback => callback())
})

type Action = 'login' | 'logout'
type Outcome = 'success' | 'rejected' | 'thrown'
const oldIdentity = { id: 'alice', name: 'Alice' }
const newIdentity = { id: 'bob', name: 'Bob' }
const privateDataKey = listQueryKey('invoices', {}, 'finance')
const privateAccessKey = ['lumi', 'access', { resource: 'invoices', action: 'delete' }]
const hostKey = ['host', 'public-preferences']
const disabledDataKey = listQueryKey('restricted-members', {})
const disabledAccessParams = { resource: 'restricted-members', action: 'edit' }
const disabledAccessKey = ['lumi', 'access', disabledAccessParams]

function createSession(outcome: Outcome, oldRequest?: Promise<void>) {
  let identity: typeof oldIdentity | null = oldIdentity
  const change = async (next: typeof oldIdentity | null) => {
    if (outcome === 'thrown')
      throw new Error('Session change unavailable')
    if (outcome === 'rejected')
      return { success: false }
    identity = next
    return { success: true }
  }
  const authProvider: AuthProvider = {
    login: async () => change(newIdentity),
    logout: async () => change(null),
    check: async () => ({ authenticated: identity !== null }),
    getIdentity: async <T,>() => identity as T | null,
    getPermissions: async () => identity ? [identity.id] : [],
  }
  let requestCount = 0
  const dataProvider = createSimpleDataProvider({ apiUrl: 'https://unused.test' })
  dataProvider.getList = async <T,>() => {
    const record = identity
    if (++requestCount === 1)
      await oldRequest
    return { data: (record ? [record] : []) as T[], total: record ? 1 : 0 }
  }
  return createLumi({
    dataProvider,
    authProvider,
    accessProvider: { can: async () => ({ can: identity?.id === 'alice' }) },
  })
}

async function mountSession(outcome: Outcome = 'success', oldRequest?: Promise<void>) {
  const context = createSession(outcome, oldRequest)
  const dataRequests = vi.spyOn(context.getDataProvider(), 'getList')
  const accessRequests = vi.spyOn(context.accessProvider!, 'can')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  queryClient.setQueryData(privateDataKey, { data: ['alice-private-invoice'], total: 1 })
  queryClient.setQueryData(privateAccessKey, { can: true })
  queryClient.setQueryData(hostKey, { density: 'compact' })
  queryClient.setQueryData(disabledDataKey, { data: [oldIdentity], total: 1 })
  queryClient.setQueryData(disabledAccessKey, { can: true })
  let login!: ReturnType<typeof useLogin>
  let logout!: ReturnType<typeof useLogout>
  const container = document.createElement('div')
  const root = createRoot(container)
  function Probe() {
    login = useLogin()
    logout = useLogout()
    const identity = useIdentity<typeof oldIdentity>()
    const check = useCheck()
    const permissions = usePermissions()
    const access = useCan({ resource: 'projects', action: 'edit' })
    const records = useList({ resource: 'members' })
    const disabledRecords = useList({ resource: 'restricted-members', enabled: false })
    const disabledAccess = useCan(disabledAccessParams, false)
    return (
      <>
        <output data-testid="session">{JSON.stringify({ identity: identity.data, authenticated: check.data?.authenticated, permissions: permissions.data, can: access.data?.can })}</output>
        <output data-testid="records">{JSON.stringify(records.data?.data ?? null)}</output>
        <output data-testid="disabled">{JSON.stringify({ records: disabledRecords.data?.data ?? null, access: disabledAccess.data ?? null })}</output>
      </>
    )
  }
  cleanups.push(async () => {
    await act(async () => root.unmount())
    queryClient.clear()
  })
  await act(async () => root.render(
    <LumiProvider context={context} registry={{}} queryClient={queryClient}>
      <Probe />
    </LumiProvider>,
  ))
  const read = () => JSON.parse(container.querySelector('[data-testid="session"]')?.textContent || '{}')
  await vi.waitFor(async () => {
    await act(async () => {})
    expect(read()).toEqual({ identity: oldIdentity, authenticated: true, permissions: ['alice'], can: true })
  })
  return {
    queryClient,
    authProvider: context.authProvider!,
    startChange: (action: Action) => (action === 'login' ? login : logout).mutateAsync(undefined),
    run: async (callback: () => Promise<void>) => act(callback),
    dataRequests,
    accessRequests,
    read,
    readRecords: () => JSON.parse(container.querySelector('[data-testid="records"]')?.textContent || 'null'),
    readDisabled: () => JSON.parse(container.querySelector('[data-testid="disabled"]')?.textContent || '{}'),
    change: async (action: Action) => {
      let result: Awaited<ReturnType<typeof login.mutateAsync>> | undefined
      await act(async () => {
        result = await (action === 'login' ? login : logout).mutateAsync(undefined)
      })
      return result
    },
    flush: async () => act(async () => {}),
  }
}

describe('authentication session cache isolation', () => {
  it('serializes concurrent login and logout through the completed session cache reset', async () => {
    const session = await mountSession()
    let completeLogin!: () => void
    let completeReset!: () => void
    const loginGate = new Promise<void>((resolve) => {
      completeLogin = resolve
    })
    const resetGate = new Promise<void>((resolve) => {
      completeReset = resolve
    })
    const provider = session.authProvider
    const originalLogin = provider.login
    const originalLogout = provider.logout
    const originalCheck = provider.check
    let loginCompleted = false
    let resetStarted = false
    let stateAtLogout: unknown
    const login = vi.spyOn(provider, 'login').mockImplementation(async (params) => {
      await loginGate
      const response = await originalLogin(params)
      loginCompleted = true
      return response
    })
    vi.spyOn(provider, 'check').mockImplementation(async () => {
      if (loginCompleted) {
        resetStarted = true
        await resetGate
      }
      return originalCheck()
    })
    const logout = vi.spyOn(provider, 'logout').mockImplementation(async (params) => {
      stateAtLogout = {
        identity: session.queryClient.getQueryData(['lumi', 'auth', 'identity']),
        privateData: session.queryClient.getQueryData(privateDataKey),
      }
      return originalLogout(params)
    })

    await session.run(async () => {
      const pending = Promise.all([session.startChange('login'), session.startChange('logout')])
      try {
        await vi.waitFor(() => expect(login).toHaveBeenCalledOnce())
        expect(logout).not.toHaveBeenCalled()
        completeLogin()
        await vi.waitFor(() => expect(resetStarted).toBe(true))
        expect(logout).not.toHaveBeenCalled()
      }
      finally {
        completeLogin()
        completeReset()
        await pending
      }
    })

    expect(stateAtLogout).toEqual({ identity: newIdentity, privateData: undefined })
    await vi.waitFor(async () => {
      await session.flush()
      expect(session.read()).toEqual({ identity: null, authenticated: false, permissions: [], can: false })
    })
  })

  it.each(['login', 'logout'] as const)('%s clears disabled mounted queries without requesting restricted data', async (action) => {
    const session = await mountSession()
    expect(session.readDisabled()).toEqual({ records: [oldIdentity], access: { can: true } })

    await session.change(action)

    await vi.waitFor(async () => {
      await session.flush()
      expect(session.readDisabled()).toEqual({ records: null, access: null })
    })
    expect(session.dataRequests.mock.calls.some(([params]) => params.resource === 'restricted-members')).toBe(false)
    expect(session.accessRequests.mock.calls.some(([params]) => params.resource === 'restricted-members')).toBe(false)
  })

  it.each(['login', 'logout'] as const)('%s replaces a mounted list request and ignores its previous-session response', async (action) => {
    let finish!: () => void
    const oldRequest = new Promise<void>((resolve) => {
      finish = resolve
    })
    const session = await mountSession('success', oldRequest)
    expect(session.readRecords()).toBeNull()

    await session.change(action)
    finish()
    await oldRequest

    await vi.waitFor(async () => {
      await session.flush()
      expect(session.readRecords()).toEqual(action === 'login' ? [newIdentity] : [])
    })
  })

  it.each(['login', 'logout'] as const)('%s refreshes mounted auth and access queries and discards previous private data', async (action) => {
    const session = await mountSession()

    await session.change(action)

    await vi.waitFor(async () => {
      await session.flush()
      expect(session.read()).toEqual({
        identity: action === 'login' ? newIdentity : null,
        authenticated: action === 'login',
        permissions: action === 'login' ? ['bob'] : [],
        can: false,
      })
    })
    expect(session.queryClient.getQueryData(privateDataKey)).toBeUndefined()
    expect(session.queryClient.getQueryData(privateAccessKey)).toBeUndefined()
    expect(session.queryClient.getQueryData(hostKey)).toEqual({ density: 'compact' })
  })

  it.each(['login', 'logout'] as const)('%s prevents an in-flight private request from restoring the previous session cache', async (action) => {
    const session = await mountSession()
    const slowKey = listQueryKey('slow-invoices', {}, 'finance')
    let finish!: (value: string[]) => void
    const pending = session.queryClient.fetchQuery({
      queryKey: slowKey,
      queryFn: () => new Promise<string[]>((resolve) => { finish = resolve }),
    }).catch(() => undefined)

    await session.change(action)
    finish(['alice-private-invoice'])
    await pending
    await session.flush()

    expect(session.queryClient.getQueryData(slowKey)).toBeUndefined()
  })

  it.each([
    ['login', 'rejected'],
    ['logout', 'rejected'],
    ['login', 'thrown'],
    ['logout', 'thrown'],
  ] as const)('%s preserves the existing session when the provider returns %s', async (action, outcome) => {
    const session = await mountSession(outcome)

    if (outcome === 'thrown')
      await expect(session.change(action)).rejects.toThrow('Session change unavailable')
    else
      await expect(session.change(action)).resolves.toEqual({ success: false })
    await session.flush()

    expect(session.read()).toEqual({ identity: oldIdentity, authenticated: true, permissions: ['alice'], can: true })
    expect(session.queryClient.getQueryData(privateDataKey)).toEqual({ data: ['alice-private-invoice'], total: 1 })
    expect(session.queryClient.getQueryData(privateAccessKey)).toEqual({ can: true })
    expect(session.queryClient.getQueryData(hostKey)).toEqual({ density: 'compact' })
  })
})
