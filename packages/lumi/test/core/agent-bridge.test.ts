import type { AgentClientTool, AgentPageHandle, AgentPageSpec, AgentUiRoute } from '../../src/core/agent/bridge.js'
import type { AgentRequest, AgentTransport } from '../../src/core/agent/session.js'
import type { AgentChunk } from '../../src/core/agent/stream.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compactAgentState, createAgentBridge, describeAgentElements } from '../../src/core/agent/bridge.js'
import { createAgentSession } from '../../src/core/agent/session.js'

const spec: AgentPageSpec = {
  root: 'page',
  elements: {
    page: { type: 'Page', props: { title: 'Orders' }, children: ['filters', 'table', 'form', 'note'] },
    filters: { type: 'Filters', props: { value: { $bindState: '/filters' }, schema: { fields: [{ field: 'q', label: { $t: 'Search' }, widget: 'search' }] } } },
    table: { type: 'Table', props: { resource: 'orders', selectedKeys: { $bindState: '/selection' }, columns: [{ field: 'no', label: 'No.' }] } },
    form: { type: 'Form', props: { statePath: '/draft', title: 'New note' }, on: { submit: { action: 'create', params: { resource: 'notes' } } } },
    note: { type: 'Text', props: { text: 'Plain' } },
    refresh: { type: 'Button', props: { label: 'Refresh' }, on: { press: [{ action: 'invalidate' }, { action: 'toast' }] } },
    archive: { type: 'Button', props: { label: 'Archive' }, on: { press: { action: 'setState', confirm: { title: 'Sure?' } } } },
  },
}

function mount(overrides: Partial<AgentPageHandle> = {}) {
  const state: Record<string, unknown> = { filters: { status: 'paid' }, selection: [], draft: { title: '' } }
  const fired: string[] = []
  const handle: AgentPageHandle = {
    id: 'p1',
    title: 'Orders',
    spec,
    // Like the StateStore, each read is its own value: later changes do not reach an earlier one.
    getState: () => ({ ...state }),
    setState: (path, value) => {
      state[path.slice(1).split('/')[0]!] = path.split('/').length > 2 ? { ...(state[path.split('/')[1]!] as object), [path.split('/')[2]!]: value } : value
    },
    trigger: async (element, event) => {
      fired.push(`${element}.${event}`)
    },
    ...overrides,
  }
  return { handle, state, fired }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('agent bridge', () => {
  it('describes the elements with bound state or events, labelled and with what they work on', () => {
    const elements = describeAgentElements(spec, key => `T:${key}`)
    expect(elements.map(element => element.id)).toEqual(['filters', 'table', 'form', 'refresh', 'archive'])
    expect(elements[0]).toEqual({ id: 'filters', type: 'Filters', bind: { value: '/filters' }, info: { fields: [{ field: 'q', label: 'T:Search', widget: 'search' }] } })
    expect(elements[1]).toMatchObject({ bind: { selectedKeys: '/selection' }, info: { resource: 'orders', columns: [{ field: 'no', label: 'No.' }] } })
    // Events that change data are listed apart: the front end only fills and points.
    expect(elements[2]).toMatchObject({ label: 'New note', bind: { statePath: '/draft' }, writes: ['submit'] })
    expect(elements[2]!.events).toBeUndefined()
    expect(elements[3]).toMatchObject({ id: 'refresh', events: ['press'] })
    expect(elements[4]).toMatchObject({ id: 'archive', writes: ['press'] })
  })

  it('shortens long lists, text and deep values in the page state', () => {
    const compact = compactAgentState({ rows: Array.from({ length: 12 }, (_, index) => index), text: 'x'.repeat(320), deep: { a: { b: { c: { d: { e: { f: 1 } } } } } } }) as Record<string, unknown>
    expect(compact.rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '…2 more'])
    expect(String(compact.text)).toHaveLength(301)
    expect(JSON.stringify(compact.deep)).toContain('"{…}"')
  })

  it('snapshots the route, the routes and the page in front, and forgets a page once unmounted', () => {
    const bridge = createAgentBridge()
    const routes: AgentUiRoute[] = [{ path: '/orders', title: 'Orders' }, { path: '/notes', title: 'Notes' }]
    bridge.registerNavigation({ current: () => routes[0], routes: () => routes, navigate: () => {} })
    const { handle } = mount()
    const off = bridge.registerPage(handle)
    const snapshot = bridge.snapshot()
    expect(snapshot).toMatchObject({ route: routes[0], routes, approvalMode: 'ask', page: { id: 'p1', title: 'Orders', state: { filters: { status: 'paid' } } } })
    expect(snapshot.page!.elements).toHaveLength(5)
    expect(bridge.toolDefinitions().map(tool => tool.name)).toEqual(['ui_navigate', 'ui_set_state', 'ui_highlight', 'ui_trigger'])
    off()
    expect(bridge.snapshot().page).toBeUndefined()
  })

  it('sets only bound paths or below, and fires only light events', async () => {
    const bridge = createAgentBridge()
    const { handle, state, fired } = mount()
    bridge.registerPage(handle)
    const tools = bridge.tools()
    expect(await tools.ui_set_state!.execute({ path: '/filters/q', value: '1042' })).toEqual({ set: '/filters/q', value: '1042' })
    expect(state.filters).toEqual({ status: 'paid', q: '1042' })
    expect(() => tools.ui_set_state!.execute({ path: '/secret', value: 1 })).toThrow('/secret is not bound')
    await tools.ui_trigger!.execute({ element: 'refresh', event: 'press' })
    expect(fired).toEqual(['refresh.press'])
    // Saving, deleting or anything with a confirm is the reader's or a backend tool's.
    await expect(tools.ui_trigger!.execute({ element: 'form', event: 'submit' })).rejects.toThrow('changes data')
    await expect(tools.ui_trigger!.execute({ element: 'archive', event: 'press' })).rejects.toThrow('changes data')
    await expect(tools.ui_trigger!.execute({ element: 'note', event: 'press' })).rejects.toThrow('note has no press event')
    expect(fired).toEqual(['refresh.press'])
    expect(tools.ui_trigger!.approval).toBeUndefined()
  })

  it('refuses calls meant for a page the reader has left', async () => {
    const bridge = createAgentBridge()
    bridge.registerPage(mount().handle)
    bridge.snapshot()
    const { handle, state } = mount({ id: 'p2' })
    bridge.registerPage(handle)
    expect(() => bridge.tools().ui_set_state!.execute({ path: '/filters/q', value: 'x' })).toThrow('another page')
    await expect(bridge.tools().ui_trigger!.execute({ element: 'refresh', event: 'press' })).rejects.toThrow('another page')
    expect(state.filters).toEqual({ status: 'paid' })
    // The next request shows the new page, and calls answering it land.
    bridge.snapshot()
    expect(bridge.tools().ui_set_state!.execute({ path: '/filters/q', value: 'x' })).toMatchObject({ value: 'x' })
  })

  it('keeps what the reader changed since the snapshot and the field they are typing in', () => {
    let focused: string | undefined
    const bridge = createAgentBridge()
    const { handle, state } = mount({ focused: () => focused })
    bridge.registerPage(handle)
    state.draft = { title: '', note: '' }
    bridge.snapshot()
    // While the agent thinks, the reader filters by status and types a title.
    state.filters = { status: 'late' }
    state.draft = { title: 'Mine', note: '' }
    const tools = bridge.tools()
    expect(tools.ui_set_state!.execute({ path: '/filters', value: { status: 'paid', q: '1042' } })).toEqual({
      set: '/filters',
      value: { status: 'late', q: '1042' },
      kept: ['/filters/status'],
      note: expect.any(String),
    })
    expect(tools.ui_set_state!.execute({ path: '/draft/title', value: 'Agent' })).toMatchObject({ value: 'Mine', kept: ['/draft/title'] })
    // A field in focus stays the reader's even before they type.
    focused = 'note'
    expect(tools.ui_set_state!.execute({ path: '/draft', value: { title: 'Mine', note: 'Agent note' } })).toMatchObject({ value: { title: 'Mine', note: '' }, kept: ['/draft/note'] })
    focused = undefined
    // The agent's own earlier write is not mistaken for the reader's.
    expect(tools.ui_set_state!.execute({ path: '/filters/q', value: '1047' })).toEqual({ set: '/filters/q', value: '1047' })
    expect(tools.ui_set_state!.execute({ path: '/draft/note', value: 'Agent note' })).toEqual({ set: '/draft/note', value: 'Agent note' })
  })

  it('waits for the next page after navigating so the reply sees it', async () => {
    let path = '/orders'
    const bridge = createAgentBridge()
    bridge.registerNavigation({
      current: () => ({ path }),
      routes: () => [],
      navigate: (next) => {
        setTimeout(() => {
          path = next
          bridge.registerPage({ ...mount().handle, id: 'p2', title: 'Notes' })
        }, 120)
      },
    })
    bridge.registerPage(mount().handle)
    expect(await bridge.tools().ui_navigate!.execute({ path: '/notes' })).toEqual({ opened: '/notes', title: 'Notes' })
    expect(bridge.snapshot().page?.id).toBe('p2')
    await expect(bridge.tools().ui_navigate!.execute({ path: 'notes' })).rejects.toThrow('Cannot open notes')
  })

  it('says so when a move is held, e.g. by unsaved changes', async () => {
    vi.useFakeTimers()
    const bridge = createAgentBridge()
    bridge.registerNavigation({ current: () => ({ path: '/orders/7/edit' }), routes: () => [], navigate: () => {} })
    bridge.registerPage(mount().handle)
    const moved = bridge.tools().ui_navigate!.execute({ path: '/orders' }) as Promise<unknown>
    const outcome = expect(moved).rejects.toThrow('did not open')
    await vi.advanceTimersByTimeAsync(2000)
    await outcome
    vi.useRealTimers()
  })

  it('passes references to the open conversation, keeping them until one listens', () => {
    const bridge = createAgentBridge()
    bridge.reference([{ id: 'row:1', label: 'Lamp', kind: 'record', data: { id: 1 } }])
    const heard: string[][] = []
    const off = bridge.onReference(items => heard.push(items.map(item => item.label)))
    expect(heard).toEqual([['Lamp']])
    bridge.reference([{ id: 'row:2', label: 'Shade' }])
    bridge.reference([])
    expect(heard).toEqual([['Lamp'], ['Shade']])
    off()
  })

  it('points at rows or controls through the page and reports the workspace read only', () => {
    const highlight = vi.fn()
    const flash = vi.fn((label: string) => label === 'Refresh')
    const bridge = createAgentBridge()
    bridge.registerNavigation({ current: () => ({ path: '/orders' }), routes: () => [], navigate: () => {}, workspace: () => ({ value: 'north', label: 'North store' }) })
    bridge.registerPage(mount({ highlight, flash }).handle)
    expect(bridge.snapshot().workspace).toEqual({ value: 'north', label: 'North store' })
    const tool = bridge.tools().ui_highlight!
    expect(tool.execute({ keys: [1042, '1047', null] })).toEqual({ highlighted: [1042, '1047'] })
    expect(highlight).toHaveBeenCalledWith([1042, '1047'])
    expect(tool.execute({ element: 'refresh' })).toEqual({ highlighted: 'refresh' })
    expect(flash).toHaveBeenCalledWith('Refresh')
    expect(() => tool.execute({ element: 'archive' })).toThrow('not on screen')
    expect(tool.approval).toBeUndefined()
    bridge.registerPage(mount().handle)
    bridge.snapshot()
    expect(() => tool.execute({ keys: [1] })).toThrow('Nothing to highlight')
  })

  it('keeps the approval mode between visits', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) })
    const bridge = createAgentBridge({ storageKey: 'mode' })
    const listener = vi.fn()
    bridge.subscribe(listener)
    bridge.setApprovalMode('auto')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.get('mode')).toBe('auto')
    expect(createAgentBridge({ storageKey: 'mode' }).getApprovalMode()).toBe('auto')
    // Blocked storage leaves the default, and is not touched until the mode is read.
    const getItem = vi.fn(() => {
      throw new Error('blocked')
    })
    vi.stubGlobal('localStorage', { getItem, setItem: getItem })
    const blocked = createAgentBridge({ storageKey: 'mode', approvalMode: 'auto' })
    expect(getItem).not.toHaveBeenCalled()
    expect(blocked.getApprovalMode()).toBe('auto')
    blocked.setApprovalMode('ask')
    expect(blocked.getApprovalMode()).toBe('ask')
  })
})

describe('agent session client tools', () => {
  function setup(mode: 'ask' | 'auto', after: AgentChunk[] = [{ type: 'text-start', id: 't2' }, { type: 'text-delta', id: 't2', delta: 'Done.' }, { type: 'finish' }]) {
    const ran: unknown[] = []
    // A host's own client tool that wants the reader's go-ahead.
    const tools: Record<string, AgentClientTool> = {
      print_labels: {
        description: 'Print shipping labels on the local printer.',
        inputSchema: { type: 'object' },
        execute: (input) => {
          ran.push(input)
          return { printed: 2 }
        },
        approval: () => ({ title: 'Print 2 labels', tone: 'warning' }),
      },
    }
    const replies: AgentChunk[][] = [
      [
        { type: 'start', messageId: 'a1' },
        { type: 'tool-input-available', toolCallId: 'c1', toolName: 'print_labels', input: { ids: [7, 8] } },
        { type: 'finish', finishReason: 'tool-calls' },
      ],
      after,
    ]
    const requests: AgentRequest[] = []
    const transport: AgentTransport = {
      async send(request) {
        requests.push(structuredClone({ ...request, signal: undefined }) as unknown as AgentRequest)
        const reply = replies[requests.length - 1] ?? []
        return (async function* () {
          yield* reply
        })()
      },
    }
    const session = createAgentSession({ transport, clientTools: () => tools, approvalMode: () => mode })
    return { session, requests, ran }
  }

  it('asks first in ask mode, runs the call once approved and goes on with its output', async () => {
    const { session, requests, ran } = setup('ask')
    await session.send({ text: 'Print them' })
    await vi.waitFor(() => expect(session.getSnapshot().messages[1]!.parts.some(part => part.type === 'approval')).toBe(true))
    const card = session.getSnapshot().messages[1]!.parts.find(part => part.type === 'approval')!
    expect(card).toMatchObject({ id: 'client:c1', toolCallId: 'c1', status: 'pending', client: true, title: 'Print 2 labels' })
    expect(ran).toEqual([])
    expect(requests).toHaveLength(1)
    expect(await session.approve('client:c1', true)).toBe(true)
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(ran).toEqual([{ ids: [7, 8] }])
    expect(requests[1]).toMatchObject({ trigger: 'tool-output', messageId: 'a1' })
    expect(requests[1]!.messages.at(-1)!.parts.find(part => part.type === 'tool-call')).toMatchObject({ status: 'success', output: { printed: 2 } })
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe('ready'))
    expect(session.getSnapshot().messages[1]!.parts.map(part => part.type)).toEqual(['tool-call', 'approval', 'text'])
  })

  it('reports a declined call to the model as a failure', async () => {
    const { session, requests, ran } = setup('ask')
    await session.send({ text: 'Print them' })
    await vi.waitFor(() => expect(session.getSnapshot().messages[1]!.parts.some(part => part.type === 'approval')).toBe(true))
    await session.approve('client:c1', false)
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(ran).toEqual([])
    expect(requests[1]!.messages.at(-1)!.parts.find(part => part.type === 'tool-call')).toMatchObject({ status: 'error', errorText: 'The reader declined.' })
  })

  it('runs the call at once in auto mode', async () => {
    const { session, requests, ran } = setup('auto')
    await session.send({ text: 'Print them' })
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(ran).toEqual([{ ids: [7, 8] }])
    expect(session.getSnapshot().messages[1]!.parts.some(part => part.type === 'approval')).toBe(false)
  })

  it('runs the bridge tools without asking, as they only fill and point', async () => {
    const bridge = createAgentBridge({ approvalMode: 'ask' })
    const page = mount()
    bridge.registerPage(page.handle)
    const requests: AgentRequest[] = []
    const replies: AgentChunk[][] = [
      [
        { type: 'start', messageId: 'a1' },
        { type: 'tool-input-available', toolCallId: 'c1', toolName: 'ui_set_state', input: { path: '/filters/q', value: '1042' } },
        { type: 'finish', finishReason: 'tool-calls' },
      ],
      [{ type: 'finish' }],
    ]
    const transport: AgentTransport = {
      async send(request) {
        requests.push(request)
        bridge.snapshot()
        const reply = replies[requests.length - 1] ?? []
        return (async function* () {
          yield* reply
        })()
      },
    }
    const session = createAgentSession({ transport, clientTools: () => bridge.tools(), approvalMode: () => bridge.getApprovalMode() })
    await session.send({ text: 'Find 1042' })
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(page.state.filters).toEqual({ status: 'paid', q: '1042' })
    expect(session.getSnapshot().messages[1]!.parts.some(part => part.type === 'approval')).toBe(false)
  })
})

it.each(['onSuccess', 'onError'])('refuses nested writes in %s before triggering any part of the event', async (branch) => {
  const bridge = createAgentBridge()
  const trigger = vi.fn()
  const binding = { action: 'toast', [branch]: { action: 'toast', onSuccess: { action: 'delete' } } }
  const { handle } = mount({
    trigger,
    spec: { root: 'b', elements: { b: { type: 'Button', props: { label: 'Remove' }, on: { press: binding } } } },
  })
  bridge.registerPage(handle)
  expect(bridge.snapshot().page?.elements[0]).toMatchObject({ writes: ['press'] })
  await expect(bridge.tools().ui_trigger!.execute({ element: 'b', event: 'press' })).rejects.toThrow('changes data')
  expect(trigger).not.toHaveBeenCalled()
})
