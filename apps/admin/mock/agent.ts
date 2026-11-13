/**
 * A scripted agent for the demo: it answers `POST /agent/chat` with an AI SDK
 * UI message stream and keeps the conversations behind the `agent-sessions`
 * resource. The script reads the last user message:
 * - "remind" / "提醒": searches orders, then asks to approve the reminders and
 *   goes on once the reader decides;
 * - "which" / "哪" / "ask": asks a question first;
 * - "fail" / "error" / "失败": fails half way;
 * - anything else: thinks, searches and answers with sources and follow-ups.
 * Each piece arrives after a short delay so stopping can be tried.
 */

type Chunk = { type: string } & Record<string, unknown>
type Part = { type: string } & Record<string, unknown>
interface Message { id: string, role: string, parts: Part[], status?: string, errorText?: string, suggestions?: unknown[], createdAt?: string }
interface Session { id: string, title: string, messages: Message[], updatedAt: string, status: 'idle' | 'waiting' | 'error' }

const MARKDOWN_RE = /[*_`#>[\]]|\(\S+\)/g

/** A list preview: the last text block of the reply, without Markdown marks. */
function preview(message: Message | undefined): string {
  const text = message?.parts.findLast(part => part.type === 'text')?.text
  return String(text ?? '').replace(MARKDOWN_RE, '').trim().slice(0, 80)
}

let STEP_MS = 60

/** Sets the delay between streamed pieces; the Node server reads it from `MOCK_AGENT_STEP_MS`. */
export function configureAgent(options: { stepMs?: number }): void {
  if (options.stepMs !== undefined && Number.isFinite(options.stepMs))
    STEP_MS = options.stepMs
}
const NOW = Date.parse('2026-08-10T08:00:00.000Z')

function seed(): Map<string, Session> {
  const sessions: Session[] = [
    {
      id: 'chat-late-orders',
      title: 'Late orders this week',
      updatedAt: new Date(NOW - 3_600_000).toISOString(),
      status: 'idle',
      messages: [
        { id: 'seed-u1', role: 'user', parts: [{ type: 'text', text: 'Which orders are late this week?' }] },
        { id: 'seed-a1', role: 'assistant', status: 'done', parts: [{ type: 'text', text: 'Three orders are past their ship date: **#1042**, **#1047** and **#1051**.', state: 'done' }] },
      ],
    },
    {
      id: 'chat-refunds',
      title: 'Refund policy summary',
      updatedAt: new Date(NOW - 86_400_000 * 2).toISOString(),
      status: 'idle',
      messages: [
        { id: 'seed-u2', role: 'user', parts: [{ type: 'text', text: 'Summarise our refund policy' }] },
        { id: 'seed-a2', role: 'assistant', status: 'done', parts: [{ type: 'text', text: 'Refunds are accepted within **30 days** of delivery for unused items.', state: 'done' }] },
      ],
    },
  ]
  return new Map(sessions.map(session => [session.id, session]))
}

let sessions = seed()
// Each stored reply moves its conversation to the top of the list.
let clock = NOW

export function resetAgent(): void {
  sessions = seed()
  clock = NOW
}

function textOf(message: Message | undefined): string {
  return message?.parts.filter(part => part.type === 'text').map(part => String(part.text ?? '')).join(' ') ?? ''
}

function group(updatedAt: string): string {
  const days = Math.floor((NOW - Date.parse(updatedAt)) / 86_400_000)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : 'Earlier'
}

/** `GET /agent-sessions` and `GET /agent-sessions/:id`; undefined for other paths. */
export function handleAgentSessions(url: URL, reply: (status: number, body: unknown) => Response): Response | undefined {
  const [resource, id] = url.pathname.split('/').filter(Boolean)
  if (resource !== 'agent-sessions')
    return undefined
  if (id) {
    const session = sessions.get(decodeURIComponent(id))
    return reply(session ? 200 : 404, session ? { data: { id: session.id, title: session.title, messages: session.messages } } : { message: 'agent session not found' })
  }
  const search = (url.searchParams.get('title') ?? url.searchParams.get('q') ?? url.searchParams.get('keyword') ?? '').toLowerCase()
  const rows = [...sessions.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter(session => !search || session.title.toLowerCase().includes(search))
    .map(session => ({
      id: session.id,
      title: session.title,
      preview: preview(session.messages.findLast(message => message.role === 'assistant')),
      time: new Date(session.updatedAt).toISOString().slice(11, 16),
      group: group(session.updatedAt),
      status: session.status === 'idle' ? undefined : session.status,
    }))
  return reply(200, { data: rows, meta: { total: rows.length, page: 1, pageSize: rows.length } })
}

/** Folds what the script sends into the stored reply, so a reloaded conversation shows it. */
function fold(message: Message, chunk: Chunk): void {
  const find = (type: string, key: string, id: unknown): Part | undefined => message.parts.find(part => part.type === type && part[key] === id)
  switch (chunk.type) {
    case 'start':
      if (typeof chunk.messageId === 'string')
        message.id = chunk.messageId
      break
    case 'text-start':
    case 'reasoning-start':
      message.parts.push({ type: chunk.type.slice(0, -'-start'.length), id: chunk.id, text: '', state: 'done' })
      break
    case 'text-delta':
    case 'reasoning-delta': {
      const part = find(chunk.type.slice(0, -'-delta'.length), 'id', chunk.id)
      if (part)
        part.text = String(part.text) + String(chunk.delta)
      break
    }
    case 'tool-input-available':
      message.parts.push({ type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, title: chunk.title, input: chunk.input, status: 'running' })
      break
    case 'tool-output-available': {
      const part = find('tool-call', 'toolCallId', chunk.toolCallId)
      if (part)
        Object.assign(part, { output: chunk.output, status: 'success' })
      break
    }
    case 'source-url':
      message.parts.push({ type: 'source', sourceId: chunk.sourceId, title: chunk.title, url: chunk.url, kind: 'web' })
      break
    case 'data-suggestions':
      message.suggestions = chunk.data as unknown[]
      break
    case 'error':
      message.status = 'error'
      message.errorText = String(chunk.errorText)
      break
    default:
      if (chunk.type.startsWith('data-')) {
        const type = chunk.type.slice('data-'.length)
        const part = { ...(chunk.data as Record<string, unknown>), type, id: chunk.id }
        const index = message.parts.findIndex(entry => entry.type === type && entry.id === chunk.id)
        if (index === -1)
          message.parts.push(part)
        else message.parts[index] = part
      }
  }
}

const WORD_RE = /\S+\s*/g
const FAIL_RE = /fail|error|失败/
const ASK_RE = /which|ask|哪/
const REMIND_RE = /remind|提醒/

const NAV_RE = /^(?:open|go to|打开|跳转到?|进入)\s*(\S.*)$/
const FILTER_RE = /^(?:search|filter|搜索|筛选|查找)\s*(\S.*)$/
const HIGHLIGHT_RE = /^(?:highlight|mark|point at|高亮|标出|指一下)\s*(\S.*)$/
const KEY_RE = /[\w-]+/g
const CLICK_RE = /^(?:click|press|点击|点)\s*(\S.*)$/
const SUBMIT_RE = /^(?:submit|save|提交|保存)/
const TRIM_RE = /[\s。.!！?？"“”'‘’]+$/
const QUOTE_RE = /^["“'‘]+/

const words = (text: string): string[] => text.match(WORD_RE) ?? []

interface UiElement { id: string, type: string, label?: string, bind?: Record<string, string>, events?: string[], writes?: string[] }
interface UiSnapshot {
  route?: { path: string, title?: string }
  routes?: { path: string, title?: string, group?: string }[]
  page?: { title?: string, elements: UiElement[], state: unknown }
  approvalMode?: string
}

function readPath(state: unknown, path: string): unknown {
  return path.split('/').slice(1).reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), state)
}

/** One client tool call: the front end runs it and the reply goes on with trigger `tool-output`. */
function uiCall(name: string, title: string, input: Record<string, unknown>, lead: string): Chunk[] {
  const toolCallId = `call-${name}-${Date.now().toString(36)}`
  return [
    ...answer(lead),
    { type: 'tool-input-start', toolCallId, toolName: name, title },
    { type: 'tool-input-available', toolCallId, toolName: name, title, input },
    { type: 'finish', finishReason: 'tool-calls' },
  ]
}

/**
 * Acting on the page through the UI snapshot every request carries: open a
 * route by its menu title, write the search box of a Filters element, or
 * submit a form. A real model reads the same snapshot and tool definitions.
 */
function operate(text: string, ui: UiSnapshot | undefined): Chunk[] | undefined {
  const clean = (value: string): string => value.replace(QUOTE_RE, '').replace(TRIM_RE, '').trim()
  const nav = NAV_RE.exec(text)
  if (nav) {
    const wanted = clean(nav[1]!).toLowerCase()
    const route = ui?.routes?.find(entry => entry.title?.toLowerCase() === wanted)
      ?? ui?.routes?.find(entry => entry.title?.toLowerCase().includes(wanted) || entry.path.toLowerCase().includes(wanted))
    if (!route)
      return answer(`I could not find a page called “${clean(nav[1]!)}” in the menu.`)
    return uiCall('ui_navigate', `Open ${route.title ?? route.path}`, { path: route.path }, `Opening ${route.title ?? route.path}.`)
  }
  const filter = FILTER_RE.exec(text)
  if (filter) {
    const term = clean(filter[1]!)
    const filters = ui?.page?.elements.find(element => element.type === 'Filters' && element.bind)
    const path = filters ? Object.values(filters.bind!)[0]! : undefined
    if (!path)
      return answer('This page has no filters I can set.')
    const current = readPath(ui?.page?.state, path)
    const value = { ...(current && typeof current === 'object' ? current : {}), q: term }
    return uiCall('ui_set_state', `Search “${term}”`, { path, value }, `Searching this page for “${term}”.`)
  }
  const byLabel = (wanted: string, has: (element: UiElement) => boolean): UiElement | undefined =>
    ui?.page?.elements.find(element => has(element) && element.label?.toLowerCase() === wanted)
    ?? ui?.page?.elements.find(element => has(element) && element.label?.toLowerCase().includes(wanted))
  const mark = HIGHLIGHT_RE.exec(text)
  if (mark) {
    const control = byLabel(clean(mark[1]!).toLowerCase(), element => Boolean(element.label))
    if (control)
      return uiCall('ui_highlight', `Point at ${control.label}`, { element: control.id }, `Here is “${control.label}”.`)
    const keys = clean(mark[1]!).match(KEY_RE) ?? []
    return uiCall('ui_highlight', `Highlight ${keys.join(', ')}`, { keys }, `Pointing at ${keys.join(', ')}.`)
  }
  const click = CLICK_RE.exec(text)
  if (click) {
    const wanted = clean(click[1]!).toLowerCase()
    const button = byLabel(wanted, element => Boolean(element.events?.length))
    // A button that changes data stays the reader's: point at it instead.
    const write = button ? undefined : byLabel(wanted, element => Boolean(element.writes?.length))
    if (write)
      return uiCall('ui_highlight', `Point at ${write.label}`, { element: write.id }, `“${write.label}” changes data, so it is yours to press. Here it is.`)
    if (!button)
      return answer(`I could not find “${clean(click[1]!)}” on this page.`)
    const event = button.events!.includes('press') ? 'press' : button.events![0]!
    return uiCall('ui_trigger', `Press ${button.label}`, { element: button.id, event }, `Pressing “${button.label}”.`)
  }
  if (SUBMIT_RE.test(text)) {
    const form = ui?.page?.elements.find(element => element.writes?.includes('submit') || element.events?.includes('submit'))
    if (!form)
      return answer('There is no form on this page to submit.')
    return answer('I only fill in forms. Check the values, then press Submit yourself.')
  }
  return undefined
}

/** After the front end ran the calls: says what happened. */
function afterUi(message: Message | undefined): Chunk[] {
  const calls = (message?.parts ?? []).filter(part => part.type === 'tool-call' && String(part.toolName).startsWith('ui_'))
  const call = calls.at(-1)
  if (!call)
    return answer('Done.', 'text-after')
  if (call.status === 'error')
    return answer(`That did not work: ${String(call.errorText ?? 'unknown error')}`, 'text-after')
  const input = (call.input ?? {}) as Record<string, unknown>
  if (call.toolName === 'ui_navigate')
    return answer(`You are on ${String(input.path)} now. Tell me what to look for.`, 'text-after')
  if (call.toolName === 'ui_highlight')
    return answer(input.element ? 'It is flashing on the page.' : 'Those rows are marked on the page.', 'text-after')
  if (call.toolName === 'ui_set_state')
    return answer('The list is filtered. Want me to narrow it further?', 'text-after')
  return answer(input.event === 'submit' ? 'Submitted.' : 'Done, it ran on the page.', 'text-after')
}

function approvalCard(status: string, reason?: string): Chunk {
  return {
    type: 'data-approval',
    id: 'approval-remind',
    data: {
      title: 'Send payment reminders',
      description: 'Email the customers of 3 overdue orders.',
      action: 'orders.remind',
      tone: 'warning',
      items: [
        { id: '1042', label: 'Order #1042', description: 'Ada Lin · $328.00' },
        { id: '1047', label: 'Order #1047', description: 'Kai Zhou · $96.50' },
        { id: '1051', label: 'Order #1051', description: 'Mia Chen · $1,204.00' },
      ],
      status,
      ...(reason ? { reason } : {}),
    },
  }
}

function questionCard(status: string, answer?: unknown): Chunk {
  return {
    type: 'data-question',
    id: 'question-range',
    data: {
      title: 'Which period should I look at?',
      options: [
        { label: 'This week', value: 'week' },
        { label: 'This month', value: 'month' },
        { label: 'This quarter', value: 'quarter' },
      ],
      skippable: true,
      status,
      ...(answer !== undefined ? { answer } : {}),
    },
  }
}

function answer(text: string, id = 'text'): Chunk[] {
  return [{ type: 'text-start', id }, ...words(text).map(delta => ({ type: 'text-delta', id, delta })), { type: 'text-end', id }]
}

function search(): Chunk[] {
  return [
    { type: 'reasoning-start', id: 'think' },
    ...words('Looking for orders past their ship date, then checking which are still unpaid.').map(delta => ({ type: 'reasoning-delta', id: 'think', delta })),
    { type: 'reasoning-end', id: 'think' },
    { type: 'tool-input-start', toolCallId: 'call-search', toolName: 'orders.search', title: 'Search orders' },
    { type: 'tool-input-available', toolCallId: 'call-search', toolName: 'orders.search', title: 'Search orders', input: { status: 'late', range: 'week' } },
    { type: 'tool-output-available', toolCallId: 'call-search', output: { total: 3, ids: [1042, 1047, 1051] } },
  ]
}

function script(body: Record<string, unknown>, messages: Message[]): Chunk[] {
  const trigger = body.trigger
  const last = messages.at(-1)
  if (trigger === 'tool-output')
    return afterUi(last)
  if (trigger === 'approval-response' || trigger === 'question-answer') {
    const decided = last?.parts.find(part => part.type === 'approval' || part.type === 'question')
    if (decided?.type === 'approval') {
      if (decided.status !== 'approved')
        return [approvalCard('rejected', 'Nothing was sent'), ...answer('Okay, I did not send any reminders.', 'text-after')]
      return [
        approvalCard('running'),
        { type: 'tool-input-available', toolCallId: 'call-remind', toolName: 'orders.remind', title: 'Send reminders', input: { ids: [1042, 1047, 1051] } },
        { type: 'tool-output-available', toolCallId: 'call-remind', output: { sent: 3 } },
        approvalCard('approved', 'Sent 3 reminders'),
        ...answer('Done — all three customers have been reminded.', 'text-after'),
      ]
    }
    const range = decided?.status === 'skipped' ? 'this week' : `the ${String(decided?.answer ?? 'week')}`
    return [questionCard(String(decided?.status ?? 'answered'), decided?.answer), ...search(), ...answer(`For ${range} there are **3 late orders** worth $1,628.50 in total.`)]
  }
  const text = textOf(last).trim().toLowerCase()
  const ui = body.ui as UiSnapshot | undefined
  const acted = operate(text, ui)
  if (acted)
    return acted
  if (FAIL_RE.test(text))
    return [...answer('Let me check that'), { type: 'error', errorText: 'The model is overloaded. Try again in a moment.' }]
  if (ASK_RE.test(text))
    return [questionCard('pending'), { type: 'finish', finishReason: 'other' }]
  // Full access: the backend skips its own approval card as well.
  if (REMIND_RE.test(text) && body.approvalMode === 'auto') {
    return [
      ...search(),
      { type: 'tool-input-available', toolCallId: 'call-remind', toolName: 'orders.remind', title: 'Send reminders', input: { ids: [1042, 1047, 1051] } },
      { type: 'tool-output-available', toolCallId: 'call-remind', output: { sent: 3 } },
      ...answer('Done — I reminded the customers of the 3 overdue orders.'),
    ]
  }
  if (REMIND_RE.test(text))
    return [...search(), ...answer('I found 3 overdue orders. Shall I email their customers?'), approvalCard('pending'), { type: 'finish', finishReason: 'tool-calls' }]
  // The page the reader shares comes as a context part; the answer names it.
  const page = last?.parts.find(part => part.type === 'context') as { items?: { kind?: string, label?: string }[] } | undefined
  const viewing = page?.items?.find(item => item.kind === 'page')?.label
  const records = page?.items?.filter(item => item.kind === 'record') ?? []
  if (records.length)
    return answer(`You referenced ${records.length} ${records.length === 1 ? 'record' : 'records'}: ${records.map(item => item.label).join(', ')}.`)
  return [
    ...search(),
    ...answer(`${viewing ? `From ${viewing}: ` : ''}Three orders are past their ship date: **#1042**, **#1047** and **#1051** [1]. Two of them are also unpaid.`),
    { type: 'source-url', sourceId: 'source-orders', url: 'https://example.com/orders?status=late', title: 'Late orders report' },
    { type: 'data-suggestions', data: [{ label: 'Remind these customers' }, { label: 'Which are unpaid?' }] },
  ]
}

/** `POST /agent/chat`: streams the scripted reply and stores the conversation. */
export function handleAgentChat(req: Request, body: Record<string, unknown>): Response {
  const messages = Array.isArray(body.messages) ? body.messages as Message[] : []
  const id = typeof body.id === 'string' ? body.id : `chat-${Date.now()}`
  const continued = body.trigger === 'approval-response' || body.trigger === 'question-answer' || body.trigger === 'tool-output'
  const reply: Message = continued && messages.at(-1)?.role === 'assistant'
    ? { ...messages.at(-1)!, parts: structuredClone(messages.at(-1)!.parts), status: 'done' }
    : { id: `msg-${Date.now().toString(36)}`, role: 'assistant', parts: [], status: 'done' }
  const history = continued ? messages.slice(0, -1) : messages
  const chunks: Chunk[] = [{ type: 'start', messageId: reply.id }, ...script(body, messages)]
  if (!chunks.some(chunk => chunk.type === 'finish' || chunk.type === 'error'))
    chunks.push({ type: 'finish', finishReason: 'stop' })

  const encoder = new TextEncoder()
  let closed = req.signal.aborted
  req.signal.addEventListener('abort', () => {
    closed = true
  }, { once: true })

  const store = (): void => {
    const firstUser = messages.find(message => message.role === 'user')
    const title = textOf(firstUser).slice(0, 48) || 'New chat'
    const waiting = reply.parts.some(part => (part.type === 'approval' || part.type === 'question') && part.status === 'pending')
    sessions.set(id, {
      id,
      title: sessions.get(id)?.title ?? title,
      messages: [...history, reply],
      updatedAt: new Date(clock += 1000).toISOString(),
      status: reply.status === 'error' ? 'error' : waiting ? 'waiting' : 'idle',
    })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        if (closed)
          break
        fold(reply, chunk)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        await new Promise(resolve => setTimeout(resolve, chunk.type.endsWith('-delta') ? STEP_MS / 2 : STEP_MS * 3))
      }
      if (!closed) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
      // A stopped reply is still stored with what was sent before the stop.
      store()
    },
    cancel() {
      closed = true
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
