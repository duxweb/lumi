import type { StateStore } from '@json-render/core'
import { createStateStore, defineCatalog } from '@json-render/core'
import { Renderer } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../../../ui/src/catalog/index.js'
import { uiRegistry } from '../../../ui/src/react/registry.js'
import { lumiActionDefinitions, lumiComponentDefinitions } from '../../src/catalog/index.js'
import { createLumi, formatAgentStream, validateDocument } from '../../src/index.js'
import { LumiProvider, lumiRegistry } from '../../src/react/index.js'

const catalog = defineCatalog(schema, {
  components: { ...uiComponentDefinitions, ...lumiComponentDefinitions },
  actions: lumiActionDefinitions,
})
const registry = { ...uiRegistry, ...lumiRegistry }
const roots: ReturnType<typeof createRoot>[] = []
afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach(root => root.unmount())
  })
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function settle() {
  return act(async () => {
    for (let i = 0; i < 5; i++)
      await new Promise(resolve => setTimeout(resolve, 60))
  })
}

const spec = {
  root: 'session',
  elements: {
    session: {
      type: 'AgentSession',
      props: { statePath: '/chat', endpoint: '/agent/chat', sessionId: { $state: '/current' }, resource: 'agent-sessions' },
      children: ['send', 'approve'],
    },
    send: {
      type: 'Button',
      props: { label: 'Send' },
      children: [],
      on: { press: { action: 'agentSend', params: { session: '/chat', text: { $state: '/input' }, clear: ['/input'] } } },
    },
    approve: {
      type: 'Button',
      props: { label: 'Approve' },
      children: [],
      on: { press: { action: 'agentEvent', params: { session: '/chat', event: { type: 'approve', partId: 'ap1' } } } },
    },
  },
}

function mount(store: StateStore, dataProvider: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  const context = createLumi({ dataProvider: dataProvider as never, agent: { headers: { Authorization: 'token' } } })
  return {
    host,
    render: () => act(async () => root.render(
      <LumiProvider context={context} registry={registry} store={store} queryClient={new QueryClient()}>
        <Renderer registry={registry} spec={spec as never} />
      </LumiProvider>,
    )),
    press: (label: string) => act(async () => {
      [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click()
    }),
  }
}

describe('agentSession', () => {
  it('validates as a native Spec', () => {
    expect(validateDocument(spec, catalog)).toMatchObject({ valid: true })
  })

  it('loads a conversation, sends from page state, clears the box and continues after an approval', async () => {
    const bodies: Record<string, unknown>[] = []
    const replies = [
      [
        { type: 'start', messageId: 'a2' },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'Remind 3 customers?' },
        { type: 'text-end', id: 't' },
        { type: 'data-approval', id: 'ap1', data: { title: 'Send reminders', status: 'pending' } },
        { type: 'finish' },
      ],
      [{ type: 'data-approval', id: 'ap1', data: { title: 'Send reminders', status: 'approved' } }, { type: 'finish' }],
    ]
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string))
      return new Response(formatAgentStream(replies[bodies.length - 1] as never))
    })
    vi.stubGlobal('fetch', fetch)
    const getOne = vi.fn(async () => ({ data: { id: 's1', messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Earlier' }] }] } }))
    const getList = vi.fn(async () => ({ data: [], total: 0 }))
    const store = createStateStore({ current: 's1', input: 'Remind late customers' })
    const view = mount(store, { getList, getOne, create: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), getApiUrl: () => 'http://api.test' })
    await view.render()
    await settle()
    expect(getOne).toHaveBeenCalledWith(expect.objectContaining({ resource: 'agent-sessions', id: 's1' }))
    expect(store.get('/chat')).toMatchObject({ id: 's1', status: 'ready', streaming: false, messages: [{ id: 'u1' }] })

    await view.press('Send')
    expect(store.get('/input')).toBe('')
    await settle()
    expect(fetch.mock.calls[0]![0]).toBe('http://api.test/agent/chat')
    expect(fetch.mock.calls[0]![1].headers).toMatchObject({ Authorization: 'token' })
    expect(bodies[0]).toMatchObject({ id: 's1', trigger: 'submit-message' })
    expect((bodies[0]!.messages as unknown[]).length).toBe(2)
    const chat = store.get('/chat') as { messages: { id: string, parts: { type: string, status?: string }[] }[], status: string }
    expect(chat.status).toBe('ready')
    expect(chat.messages.at(-1)).toMatchObject({ id: 'a2', parts: [{ type: 'text', text: 'Remind 3 customers?' }, { type: 'approval', status: 'pending' }] })

    // An empty box sends nothing.
    await view.press('Send')
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)

    await view.press('Approve')
    await settle()
    expect(bodies[1]).toMatchObject({ trigger: 'approval-response', messageId: 'a2' })
    expect((store.get('/chat') as typeof chat).messages.at(-1)!.parts[1]).toMatchObject({ status: 'approved' })
  })
})
