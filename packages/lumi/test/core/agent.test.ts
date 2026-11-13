import type { AgentChatMessage, AgentChunk, AgentRequest, AgentTransport } from '../../src/core/index.js'
import { describe, expect, it, vi } from 'vitest'
import {
  AgentRequestError,
  applyAgentChunk,
  createAgentMergeState,
  createAgentSession,
  createHttpAgentTransport,
  formatAgentStream,
  parseAgentStream,
} from '../../src/core/index.js'

function bytes(...pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces)
        controller.enqueue(encoder.encode(piece))
      controller.close()
    },
  })
}

async function collect(stream: AsyncIterable<AgentChunk>): Promise<AgentChunk[]> {
  const out: AgentChunk[] = []
  for await (const chunk of stream)
    out.push(chunk)
  return out
}

function merge(chunks: AgentChunk[], start = 0): AgentChatMessage {
  let state = createAgentMergeState({ id: 'm1', role: 'assistant', parts: [], status: 'streaming' })
  chunks.forEach((chunk, index) => {
    state = applyAgentChunk(state, chunk, start + index * 100)
  })
  return state.message
}

/** A transport whose replies are pushed by the test, chunk by chunk. */
function controlled() {
  const requests: AgentRequest[] = []
  let push!: (chunk: AgentChunk | null) => void
  const transport: AgentTransport = {
    async send(request) {
      requests.push(request)
      const queue: (AgentChunk | null)[] = []
      let wake: (() => void) | undefined
      push = (chunk) => {
        queue.push(chunk)
        wake?.()
      }
      return (async function* () {
        while (true) {
          if (!queue.length) {
            await new Promise<void>((resolve) => {
              wake = resolve
              request.signal.addEventListener('abort', () => resolve(), { once: true })
            })
          }
          if (request.signal.aborted)
            return
          const next = queue.shift()
          if (next === null)
            return
          if (next)
            yield next
        }
      })()
    },
  }
  return { transport, requests, push: (chunk: AgentChunk | null) => push(chunk) }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('agent stream', () => {
  it('parses SSE frames split across reads, joins multi-line data and stops at [DONE]', async () => {
    const chunks = await collect(parseAgentStream(bytes(
      ': keep-alive\n\ndata: {"type":"text-start",',
      '"id":"t1"}\r',
      '\n\r\nevent: ignored\ndata: {"type":"text-delta","id":"t1",\ndata: "delta":"Hi"}\n\n',
      'data: [DONE]\n\ndata: {"type":"text-end","id":"t1"}\n\n',
    )))
    expect(chunks).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hi' },
    ])
  })

  it('dispatches a last event without its blank line and round-trips formatAgentStream', async () => {
    expect(await collect(parseAgentStream(bytes('data: {"type":"start"}')))).toEqual([{ type: 'start' }])
    const sent: AgentChunk[] = [{ type: 'start', messageId: 'a' }, { type: 'finish' }]
    expect(await collect(parseAgentStream(bytes(formatAgentStream(sent))))).toEqual(sent)
  })
})

describe('agent message merge', () => {
  it('builds text, reasoning with its duration, tool calls, sources and suggestions', () => {
    const message = merge([
      { type: 'start', messageId: 'server-1' },
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'Looking up' },
      { type: 'reasoning-end', id: 'r1' },
      { type: 'tool-input-start', toolCallId: 'c1', toolName: 'orders.search', title: 'Search orders' },
      { type: 'tool-input-delta', toolCallId: 'c1', inputTextDelta: '{"q":' },
      { type: 'tool-input-available', toolCallId: 'c1', toolName: 'orders.search', input: { q: 'late' } },
      { type: 'tool-output-available', toolCallId: 'c1', output: { total: 3 } },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Three ' },
      { type: 'text-delta', id: 't1', delta: 'orders [1]' },
      { type: 'source-url', sourceId: 's1', url: 'https://example.com/o/1', title: 'Order 1' },
      { type: 'data-suggestions', data: [{ label: 'Remind them' }] },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: 'stop' },
    ])
    expect(message).toMatchObject({ id: 'server-1', status: 'done', suggestions: [{ label: 'Remind them' }] })
    expect(message.parts).toEqual([
      { type: 'reasoning', id: 'r1', text: 'Looking up', state: 'done', duration: 200 },
      { type: 'tool-call', toolCallId: 'c1', toolName: 'orders.search', title: 'Search orders', input: { q: 'late' }, output: { total: 3 }, status: 'success', duration: 300 },
      { type: 'text', id: 't1', text: 'Three orders [1]', state: 'done' },
      { type: 'source', sourceId: 's1', title: 'Order 1', url: 'https://example.com/o/1', kind: 'web' },
    ])
  })

  it('maps data parts to cards, replacing by id, and drops transient and unknown data', () => {
    const message = merge([
      { type: 'data-approval', id: 'a1', data: { title: 'Send reminders', status: 'pending' } },
      { type: 'data-plan', data: { id: 'p1', steps: [{ label: 'Find', status: 'running' }] } },
      { type: 'data-plan', data: { id: 'p1', steps: [{ label: 'Find', status: 'done' }] } },
      { type: 'data-progress', data: { value: 1 } },
      { type: 'data-question', id: 'q1', data: { title: 'Which?' }, transient: true },
    ])
    expect(message.parts).toEqual([
      { type: 'approval', id: 'a1', title: 'Send reminders', status: 'pending' },
      { type: 'plan', id: 'p1', steps: [{ label: 'Find', status: 'done' }] },
    ])
  })

  it('turns a tool approval request into an approval card for that call', () => {
    const message = merge([
      { type: 'tool-input-available', toolCallId: 'c1', toolName: 'orders.remind', title: 'Send reminders', input: { ids: [1] } },
      { type: 'tool-approval-request', approvalId: 'ap1', toolCallId: 'c1' },
    ])
    expect(message.parts[1]).toEqual({ type: 'approval', id: 'ap1', toolCallId: 'c1', action: 'orders.remind', title: 'Send reminders', status: 'pending' })
  })

  it('leaves a call open while the reader has yet to approve it, and fails other unfinished calls', () => {
    const message = merge([
      { type: 'tool-input-available', toolCallId: 'c1', toolName: 'orders.remind', title: 'Send reminders', input: { ids: [1] } },
      { type: 'tool-approval-request', approvalId: 'ap1', toolCallId: 'c1' },
      { type: 'tool-input-available', toolCallId: 'c2', toolName: 'orders.count', input: {} },
      { type: 'finish' },
    ])
    const status = (id: string): unknown => message.parts.find(part => part.type === 'tool-call' && part.toolCallId === id && 'status' in part)?.status
    // The reply ended to wait for the answer; the call did not break.
    expect(status('c1')).not.toBe('error')
    expect(status('c2')).toBe('error')
    expect(message.parts.find(part => part.type === 'approval')).toMatchObject({ status: 'pending', toolCallId: 'c1' })
  })

  it('gives a block that reuses an id of the message a part id of its own', () => {
    let state = createAgentMergeState({ id: 'm', role: 'assistant', status: 'done', parts: [{ type: 'text', id: '0', text: 'Before', state: 'done' }] })
    for (const chunk of [
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'After' },
      { type: 'text-end', id: '0' },
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'Again' },
    ] as AgentChunk[]) {
      state = applyAgentChunk(state, chunk, 0)
    }
    expect(state.message.parts).toEqual([
      { type: 'text', id: '0', text: 'Before', state: 'done' },
      { type: 'text', id: '0~2', text: 'After', state: 'done' },
      { type: 'text', id: '0~3', text: 'Again', state: 'streaming' },
    ])
  })

  it('settles open parts on abort and error', () => {
    const open: AgentChunk[] = [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Partial' },
      { type: 'tool-input-available', toolCallId: 'c1', toolName: 'x', input: {} },
    ]
    const aborted = merge([...open, { type: 'abort' }])
    expect(aborted.status).toBe('done')
    expect(aborted.parts).toMatchObject([{ state: 'done', text: 'Partial' }, { status: 'error' }])
    const failed = merge([...open, { type: 'error', errorText: 'Model overloaded' }, { type: 'finish' }])
    expect(failed).toMatchObject({ status: 'error', errorText: 'Model overloaded' })
  })
})

describe('agent session', () => {
  it('streams a reply, refuses a second send while busy and stops keeping what arrived', async () => {
    const { transport, requests, push } = controlled()
    let id = 0
    const session = createAgentSession({ id: 's1', transport, generateId: () => `id${++id}` })
    const statuses: string[] = []
    session.subscribe(() => statuses.push(session.getSnapshot().status))

    const sending = session.send({ text: '  Find late orders ', context: [{ id: 'order:1', label: 'Order 1' }] })
    expect(session.getSnapshot().status).toBe('submitted')
    // The reply joins the conversation with its first chunk.
    expect(session.getSnapshot().messages).toHaveLength(1)
    expect(await session.send({ text: 'again' })).toBe(false)
    expect(await session.send({ text: '   ' })).toBe(false)
    await tick()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ sessionId: 's1', trigger: 'submit-message' })
    expect(requests[0]!.messages).toEqual([
      expect.objectContaining({ role: 'user', parts: [{ type: 'context', items: [{ id: 'order:1', label: 'Order 1' }] }, { type: 'text', text: 'Find late orders' }] }),
    ])

    push({ type: 'text-start', id: 't1' })
    push({ type: 'text-delta', id: 't1', delta: 'Looking' })
    await tick()
    expect(session.getSnapshot().status).toBe('streaming')
    session.stop()
    expect(session.getSnapshot().status).toBe('ready')
    push({ type: 'text-delta', id: 't1', delta: ' late' })
    expect(await sending).toBe(true)
    const reply = session.getSnapshot().messages[1]!
    expect(reply).toMatchObject({ role: 'assistant', status: 'done', parts: [{ type: 'text', text: 'Looking', state: 'done' }] })
    expect(statuses).toContain('streaming')
  })

  it('drops a reply stopped before anything arrived', async () => {
    const { transport } = controlled()
    const session = createAgentSession({ transport })
    const sending = session.send({ text: 'Hi' })
    await tick()
    session.stop()
    expect(await sending).toBe(true)
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', messages: [{ role: 'user' }] })
  })

  it('shows a failed request as an error reply that retry replaces', async () => {
    let calls = 0
    const replies: AgentChunk[][] = [[{ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Fixed' }, { type: 'finish' }]]
    const requests: AgentRequest[] = []
    const transport: AgentTransport = {
      async send(request) {
        requests.push(request)
        if (calls++ === 0)
          throw new AgentRequestError(500, 'Upstream down')
        return (async function* () {
          yield* replies[0]!
        })()
      },
    }
    const session = createAgentSession({ transport })
    await session.send({ text: 'Hi' })
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: 'Upstream down' })
    const failed = session.getSnapshot().messages[1]!
    expect(failed).toMatchObject({ role: 'assistant', status: 'error', errorText: 'Upstream down' })
    expect(await session.retry()).toBe(true)
    expect(requests[1]).toMatchObject({ trigger: 'regenerate-message', messageId: failed.id })
    expect(requests[1]!.messages).toHaveLength(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', error: null })
    expect(session.getSnapshot().messages).toHaveLength(2)
    expect(session.getSnapshot().messages[1]!.parts).toEqual([{ type: 'text', id: 't', text: 'Fixed', state: 'done' }])
  })

  it('goes on after the last pending approval is decided, sending the decision', async () => {
    const replies: AgentChunk[][] = [
      [
        { type: 'start', messageId: 'a1' },
        { type: 'data-approval', id: 'ap1', data: { title: 'Remind', status: 'pending' } },
        { type: 'data-question', id: 'q1', data: { title: 'Channel?', status: 'pending', options: [{ label: 'Email', value: 'email' }] } },
        { type: 'finish', finishReason: 'tool-calls' },
      ],
      [
        { type: 'data-approval', id: 'ap1', data: { title: 'Remind', status: 'approved', reason: 'Sent 3 reminders' } },
        { type: 'text-start', id: 't2' },
        { type: 'text-delta', id: 't2', delta: 'Done.' },
        { type: 'finish' },
      ],
    ]
    const requests: AgentRequest[] = []
    const transport: AgentTransport = {
      async send(request) {
        requests.push(structuredClone({ ...request, signal: undefined }) as unknown as AgentRequest)
        const reply = replies[requests.length - 1]!
        return (async function* () {
          yield* reply
        })()
      },
    }
    const session = createAgentSession({ transport })
    await session.send({ text: 'Remind late customers' })
    expect(await session.approve('missing', true)).toBe(false)
    expect(await session.approve('ap1', true)).toBe(true)
    // The question still waits, so nothing is sent yet.
    expect(requests).toHaveLength(1)
    expect(await session.approve('ap1', false)).toBe(false)
    expect(await session.answer('q1', 'email')).toBe(true)
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({ trigger: 'question-answer', messageId: 'a1' })
    const sent = requests[1]!.messages.at(-1)!
    expect(sent.parts).toEqual([
      { type: 'approval', id: 'ap1', title: 'Remind', status: 'approved' },
      { type: 'question', id: 'q1', title: 'Channel?', status: 'answered', answer: 'email', options: [{ label: 'Email', value: 'email' }] },
    ])
    const { messages } = session.getSnapshot()
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({ id: 'a1', status: 'done' })
    expect(messages[1]!.parts.map(part => part.type)).toEqual(['approval', 'question', 'text'])
    expect(messages[1]!.parts[0]).toMatchObject({ status: 'approved', reason: 'Sent 3 reminders' })
  })

  it('keeps a decision taken before its reply ends and sends it once the reply is done', async () => {
    const { transport, requests, push } = controlled()
    const session = createAgentSession({ transport })
    const sending = session.send({ text: 'Remind them' })
    await tick()
    push({ type: 'start', messageId: 'a1' })
    push({ type: 'data-approval', id: 'ap1', data: { title: 'Remind', status: 'pending' } })
    await tick()
    expect(session.getSnapshot().status).toBe('streaming')
    expect(await session.approve('ap1', true)).toBe(true)
    expect(session.getSnapshot().messages[1]!.parts[0]).toMatchObject({ status: 'approved' })
    expect(requests).toHaveLength(1)
    push({ type: 'finish' })
    push(null)
    await sending
    await tick()
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({ trigger: 'approval-response', messageId: 'a1' })
    expect(requests[1]!.messages.at(-1)!.parts[0]).toMatchObject({ status: 'approved' })
  })

  it('edits a user message, dropping what followed, and resets to another conversation', async () => {
    const requests: AgentRequest[] = []
    const transport: AgentTransport = {
      async send(request) {
        requests.push(request)
        return (async function* () {
          yield { type: 'finish' } as AgentChunk
        })()
      },
    }
    const session = createAgentSession({ transport })
    await session.send({ text: 'First' })
    await session.send({ text: 'Second' })
    const first = session.getSnapshot().messages[0]!
    expect(await session.edit(first.id, 'First, edited')).toBe(true)
    expect(requests[2]!.messages).toEqual([{ ...first, parts: [{ type: 'text', text: 'First, edited' }] }])
    expect(session.getSnapshot().messages).toHaveLength(2)
    session.reset({ id: 'other', messages: [first] })
    expect(session.getSnapshot()).toMatchObject({ id: 'other', status: 'ready', messages: [first] })
  })
})

describe('http agent transport', () => {
  it('posts the AI SDK chat body with headers and reads the stream', async () => {
    const calls: { url: string, init: RequestInit }[] = []
    const transport = createHttpAgentTransport({
      url: '/agent/chat',
      headers: async () => ({ Authorization: 'token' }),
      body: { model: 'fast' },
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init! })
        return new Response(formatAgentStream([{ type: 'start' }, { type: 'finish' }]), { headers: { 'x-vercel-ai-ui-message-stream': 'v1' } })
      },
    })
    const signal = new AbortController().signal
    const chunks = await collect(await transport.send({ sessionId: 's', messages: [], trigger: 'submit-message', signal }))
    expect(chunks).toEqual([{ type: 'start' }, { type: 'finish' }])
    expect(calls[0]!.url).toBe('/agent/chat')
    expect(calls[0]!.init.headers).toMatchObject({ 'Authorization': 'token', 'Content-Type': 'application/json' })
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ model: 'fast', id: 's', messages: [], trigger: 'submit-message' })
  })

  it('raises the server message and status on a failed response', async () => {
    const transport = createHttpAgentTransport({
      url: '/agent/chat',
      fetch: async () => new Response(JSON.stringify({ message: 'Sign in again' }), { status: 401 }),
    })
    await expect(transport.send({ sessionId: 's', messages: [], trigger: 'submit-message', signal: new AbortController().signal }))
      .rejects
      .toMatchObject({ name: 'AgentRequestError', status: 401, message: 'Sign in again' })
  })
})

describe('client tools that take time', () => {
  function slowTool() {
    const requests: AgentRequest[] = []
    const transport: AgentTransport = {
      send(request) {
        requests.push(request)
        const chunks: AgentChunk[] = requests.length === 1
          ? [{ type: 'tool-input-available', toolCallId: 'c1', toolName: 'ui_wait', input: {} }, { type: 'finish' }]
          : [{ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Done' }, { type: 'text-end', id: 't' }, { type: 'finish' }]
        return (async function* () {
          yield* chunks
        })()
      },
    }
    let release!: (value: unknown) => void
    const execute = vi.fn(() => new Promise((resolve) => {
      release = resolve
    }))
    const session = createAgentSession({ transport, clientTools: () => ({ ui_wait: { execute } }), approvalMode: () => 'auto' })
    const settle = async (): Promise<void> => {
      for (let turn = 0; turn < 5; turn++)
        await new Promise(resolve => setTimeout(resolve, 0))
    }
    return { session, requests, execute, release: (value: unknown) => release(value), settle }
  }

  it('refuses another message until the call has answered, then lets the reply go on', async () => {
    const { session, requests, execute, release, settle } = slowTool()
    await session.send({ text: 'Open orders' })
    await settle()
    expect(execute).toHaveBeenCalledTimes(1)
    // Still the same reply being worked on.
    expect(session.getSnapshot().status).toBe('streaming')
    expect(await session.send({ text: 'And another thing' })).toBe(false)
    release({ ok: true })
    await settle()
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({ trigger: 'tool-output' })
    expect(session.getSnapshot().messages.map(message => message.role)).toEqual(['user', 'assistant'])
    expect(session.getSnapshot().status).toBe('ready')
  })

  it('leaves another conversation alone when the call answers after a switch', async () => {
    const { session, requests, release, settle } = slowTool()
    await session.send({ text: 'Open orders' })
    await settle()
    const other = [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'One' }] }, { id: 'm2', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'Two' }] }, { id: 'm3', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Three' }] }]
    session.reset({ id: 'B', messages: other })
    release({ ok: true })
    await settle()
    expect(requests).toHaveLength(1)
    expect(session.getSnapshot()).toMatchObject({ id: 'B', status: 'ready' })
    expect(session.getSnapshot().messages).toEqual(other)
  })

  it('ends the call with the reply when the reader stops', async () => {
    const { session, requests, release, settle } = slowTool()
    await session.send({ text: 'Open orders' })
    await settle()
    session.stop()
    expect(session.getSnapshot().status).toBe('ready')
    release({ ok: true })
    await settle()
    expect(requests).toHaveLength(1)
    expect(session.getSnapshot().messages[1]!.parts[0]).toMatchObject({ type: 'tool-call', status: 'error' })
  })
})
