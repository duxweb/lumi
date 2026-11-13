// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import { createLumi } from '@duxweb/lumi'
import { createStateStore } from '@json-render/core'
import { defineRegistry, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiCanAccess, lumiCatalog, LumiProvider, lumiRegistry } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const can = vi.fn(async ({ action }: { action: string }) => action === 'delete' ? { can: false, reason: 'Managers only' } : { can: true })
const context = createLumi({ dataProvider: { getList: async () => ({ data: [], total: 0 }) } as never, accessProvider: { can } })

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(node))
  await act(async () => {
    await vi.waitFor(() => expect(can).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return host
}

describe('canAccess', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    can.mockClear()
  })

  it('shows children when allowed and the fallback when refused', async () => {
    const host = await mount(
      <LumiProvider context={context} registry={{}}>
        <LumiCanAccess resource="orders" action="edit"><button type="button">Edit</button></LumiCanAccess>
        <LumiCanAccess resource="orders" action="delete" fallback={<span>No access</span>}><button type="button">Delete</button></LumiCanAccess>
      </LumiProvider>,
    )
    expect(host.textContent).toBe('EditNo access')
  })

  it('renders the fallback slot in JSON and writes the result for other elements to bind', async () => {
    // A plain text element stands in for any UI component bound to the result.
    const { registry: text } = defineRegistry(lumiCatalog as never, { components: { Text: ({ props }: { props: { text?: unknown } }) => <i>{String(props.text)}</i> } } as never)
    const spec = {
      root: 'gate',
      elements: {
        gate: { type: 'CanAccess', props: { resource: 'orders', action: 'delete', resultPath: '/access/delete' }, children: ['remove'], slots: { fallback: ['locked'] } },
        remove: { type: 'Text', props: { text: 'Delete' }, children: [] },
        locked: { type: 'Text', props: { text: 'Locked' }, children: [] },
      },
    } as unknown as Spec
    const store = createStateStore({})
    const host = await mount(
      <LumiProvider context={context} registry={{ ...lumiRegistry, ...text }} store={store}>
        <Renderer spec={spec} registry={{ ...lumiRegistry, ...text }} />
      </LumiProvider>,
    )
    expect(host.textContent).toBe('Locked')
    expect(store.get('/access/delete')).toEqual({ can: false, loading: false, reason: 'Managers only' })
  })
})
