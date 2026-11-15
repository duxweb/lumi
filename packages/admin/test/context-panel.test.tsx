// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { ReactElement } from 'react'
import { createLumi, LumiProvider } from '@duxweb/lumi'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiAdminDualShell } from '../src/react/components/LumiAdminDualShell.js'
import { LumiAdminShellProvider } from '../src/react/components/ShellContext.js'
import { ShellContextPanel } from '../src/react/components/ShellContextPanel.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dataProvider = { getList: async () => ({ data: [], total: 0 }), getOne: async () => ({ data: {} }), create: async () => ({ data: {} }), update: async () => ({ data: {} }), deleteOne: async () => ({ data: {} }) } as unknown as DataProvider

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

let show!: (value: boolean) => void
function Page(): ReactElement {
  const [claimed, setClaimed] = useState(true)
  show = setClaimed
  return claimed
    ? <ShellContextPanel fallback={<p data-testid="inline-list">Inline</p>}><p data-testid="column-list">Chats</p></ShellContextPanel>
    : <p>Other page</p>
}

async function mount(): Promise<{ container: HTMLElement, cleanup: () => Promise<void> }> {
  const router = createMemoryRouter([{
    path: '/',
    element: (
      <LumiAdminShellProvider app={{ id: 'panel', title: 'Panel', layout: 'dual', tabs: false }} menu={[{ name: 'home', path: '/', label: 'Home' }]} routePatterns={['/']}>
        <LumiAdminDualShell><Page /></LumiAdminDualShell>
      </LumiAdminShellProvider>
    ),
  }])
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<LumiProvider context={createLumi({ dataProvider })} registry={{}}><RouterProvider router={router} /></LumiProvider>))
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount())
      await router.dispose()
    },
  }
}

describe('shell context panel', () => {
  it('puts a claiming page\'s content in the dual context column and gives the menu back when it leaves', async () => {
    // jsdom lays nothing out; a shown column has a box.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(240)
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    const view = await mount()
    const column = view.container.querySelector('[data-testid="admin-context-panel"]')!
    expect(column.querySelector('[data-testid="column-list"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="admin-sidebar"]')).toBeNull()
    expect(view.container.querySelector('[data-testid="inline-list"]')).toBeNull()

    await act(async () => show(false))
    expect(view.container.querySelector('[data-testid="admin-context-panel"]')).toBeNull()
    expect(view.container.querySelector('[data-testid="admin-sidebar"]')).not.toBeNull()
    await view.cleanup()
  })

  it('falls back to the page\'s own content when the column is not shown', async () => {
    const view = await mount()
    expect(view.container.querySelector('[data-testid="inline-list"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="column-list"]')).toBeNull()
    await view.cleanup()
  })
})
