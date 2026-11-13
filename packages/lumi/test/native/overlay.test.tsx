// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { createLumi } from '@duxweb/lumi'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOverlayController, LumiOverlayHost, LumiOverlayProvider, LumiProvider, useDialog } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('react overlays', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('resolves useDialog.confirm true when the dialog confirms', async () => {
    let result!: Promise<boolean>
    const context = createLumi({ dataProvider: {} as any })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    function Probe(): ReactNode {
      const dialog = useDialog()
      return (
        <>
          <button
            type="button"
            data-testid="open"
            onClick={() => {
              result = dialog.confirm({ title: 'Confirm', message: 'Continue?' })
            }}
          >
            Open
          </button>
          <LumiOverlayHost render={(entry, close) => <div data-testid="dialog"><button type="button" data-testid="confirm" onClick={() => void close('confirm', true)}>Confirm</button></div>} />
        </>
      )
    }

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <LumiProvider context={context} registry={{}} queryClient={queryClient}>
          <LumiOverlayProvider controller={createOverlayController()}><Probe /></LumiOverlayProvider>
        </LumiProvider>,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open"]')?.click()
    })
    expect(container.querySelector('[data-testid="dialog"]')).toBeTruthy()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="confirm"]')?.click()
    })

    await expect(result).resolves.toBe(true)
    await act(async () => {
      root.unmount()
    })
    queryClient.clear()
  })

  it('resolves open overlays when disposed', async () => {
    const controller = createOverlayController()
    const handle = controller.open({ type: 'dialog', title: 'Pending' })
    controller.dispose()

    await expect(handle.result).resolves.toBeUndefined()
    expect(controller.getSnapshot()).toEqual([])
  })

  it('guards every close reason and deduplicates concurrent close requests', async () => {
    const controller = createOverlayController()
    const handle = controller.open({ type: 'drawer', title: 'Edit product' })
    let resolve!: (allowed: boolean) => void
    const guard = vi.fn(() => new Promise<boolean>(done => resolve = done))
    controller.registerCloseGuard(handle.id, guard)

    const first = controller.requestClose(handle.id, { reason: 'dismiss' })
    const second = handle.close()
    expect(first).toBe(second)
    await Promise.resolve()
    expect(guard).toHaveBeenCalledOnce()
    resolve(false)
    await expect(first).resolves.toBe(false)
    expect(controller.getSnapshot()).toHaveLength(1)

    const allowed = controller.requestClose(handle.id, { reason: 'cancel', value: false })
    await Promise.resolve()
    resolve(true)
    await expect(allowed).resolves.toBe(true)
    await expect(handle.result).resolves.toBe(false)
    expect(guard).toHaveBeenCalledTimes(2)
  })

  it('cleans settled and thrown close attempts before a retry', async () => {
    const controller = createOverlayController()
    const unguarded = controller.open({ type: 'dialog', title: 'Unguarded' })
    await expect(unguarded.close()).resolves.toBe(true)
    await expect(unguarded.close()).resolves.toBe(false)

    const guarded = controller.open({ type: 'drawer', title: 'Guarded' })
    const guard = vi.fn()
      .mockImplementationOnce(() => { throw new Error('guard failed') })
      .mockReturnValue(true)
    controller.registerCloseGuard(guarded.id, guard)
    await expect(guarded.close()).resolves.toBe(false)
    await expect(guarded.close()).resolves.toBe(true)
    expect(guard).toHaveBeenCalledTimes(2)
  })
})
