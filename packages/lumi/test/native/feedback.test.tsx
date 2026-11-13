// @vitest-environment jsdom
import type { ActionBinding } from '@json-render/core'
import type { ReactNode } from 'react'
import type { NotificationParams } from '../../src/index'
import { createLumi } from '@duxweb/lumi'
import { useActions, useStateStore } from '@json-render/react'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiProvider } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function setup() {
  const toast = { open: vi.fn(() => 'toast') }
  const notice = { open: vi.fn((_params: NotificationParams) => 'notice') }
  const custom = vi.fn(async () => {
    throw new Error('service offline')
  })
  const dataProvider = { getList: vi.fn(), getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), custom }
  const context = createLumi({ dataProvider, toastProvider: toast, notificationProvider: notice })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let execute!: (binding: ActionBinding) => Promise<void>
  let read!: (path: string) => unknown

  function Probe(): ReactNode {
    execute = useActions().execute
    const store = useStateStore()
    read = path => store.get(path)
    return null
  }

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const mount = () => act(async () => {
    root.render(<LumiProvider context={context} registry={{}} queryClient={queryClient}><Probe /></LumiProvider>)
  })
  const run = (binding: ActionBinding) => act(async () => {
    await execute(binding).catch(() => {})
  })
  const unmount = async () => {
    await act(async () => root.unmount())
    queryClient.clear()
  }
  return { toast, notice, mount, run, read: (path: string) => read(path), unmount }
}

describe('automatic feedback', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('toasts an action failure that the binding does not handle', async () => {
    const { toast, mount, run, unmount } = setup()
    await mount()
    await run({ action: 'request', params: { url: '/notes' } })
    expect(toast.open).toHaveBeenCalledWith({ tone: 'danger', message: 'service offline' })
    await unmount()
  })

  it('stays quiet when the binding handles the failure with onError', async () => {
    const { toast, mount, run, read, unmount } = setup()
    await mount()
    await run({ action: 'request', params: { url: '/notes' }, onError: { action: 'setState', params: { statePath: '/failed', value: true } } })
    expect(read('/failed')).toBe(true)
    expect(toast.open).not.toHaveBeenCalled()
    await unmount()
  })

  it('runs a notice button binding through the renderer', async () => {
    const { toast, notice, mount, run, unmount } = setup()
    await mount()
    await run({ action: 'notify', params: { title: 'Order archived', actions: [{ label: 'Undo', action: 'toast', params: { message: 'Order restored', tone: 'success' } }] } })
    const [{ actions }] = notice.open.mock.calls[0]!
    await act(async () => {
      actions![0]!.onPress()
    })
    await vi.waitFor(() => expect(toast.open).toHaveBeenCalledWith({ message: 'Order restored', tone: 'success' }))
    await unmount()
  })
})
