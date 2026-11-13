import type { AgentApprovalMode, AgentClientTool } from './bridge.js'
import type { AgentChatAttachment, AgentChatContextItem, AgentChatMessage, AgentChatPart, AgentMergeState } from './merge.js'
import type { AgentChunk } from './stream.js'
import { applyAgentChunk, createAgentMergeState } from './merge.js'

/** Why a request is sent: names follow the AI SDK chat request where one exists. */
export type AgentRequestTrigger = 'submit-message' | 'regenerate-message' | 'approval-response' | 'question-answer' | 'tool-output'

export interface AgentRequest {
  sessionId: string
  /** The whole conversation, the reader's decisions on approvals and questions included. */
  messages: AgentChatMessage[]
  trigger: AgentRequestTrigger
  /** The assistant message a regeneration replaces, or the one a decision continues. */
  messageId?: string
  signal: AbortSignal
}

/** Sends a request and returns the stream of chunks that answers it. */
export interface AgentTransport {
  send: (request: AgentRequest) => Promise<AsyncIterable<AgentChunk>>
}

/**
 * `ready` waits for the reader, `submitted` waits for the first chunk,
 * `streaming` receives the answer, `error` keeps the last failure until the
 * next request.
 */
export type AgentChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

export interface AgentChatSnapshot {
  /** The conversation's id. */
  id: string
  /** The conversation so far. */
  messages: AgentChatMessage[]
  /** `ready`, `submitted` while a reply is requested, `streaming` while it arrives, or `error`. */
  status: AgentChatStatus
  /** Why the last reply failed. */
  error: string | null
}

export interface AgentSendInput {
  text?: string
  context?: AgentChatContextItem[]
  attachments?: AgentChatAttachment[]
}

export interface AgentFinishEvent {
  sessionId: string
  message: AgentChatMessage
  /** `interrupted` after stop; otherwise the server's reason, e.g. `stop` or `tool-calls`. */
  finishReason?: string
}

export interface AgentChatSessionOptions {
  id?: string | null
  messages?: AgentChatMessage[]
  transport: AgentTransport
  generateId?: () => string
  now?: () => number
  /** Every `data-*` chunk as it arrives, transient ones included. */
  onData?: (chunk: AgentChunk) => void
  onFinish?: (event: AgentFinishEvent) => void
  onError?: (error: Error) => void
  /**
   * Tools the front end runs, by name. A call to one stays running when its
   * reply ends; the session runs it (asking first in `ask` mode when the tool
   * wants approval), records the output and lets the reply go on.
   */
  clientTools?: () => Record<string, AgentClientTool>
  approvalMode?: () => AgentApprovalMode
}

export interface AgentChatSession {
  getSnapshot: () => AgentChatSnapshot
  subscribe: (listener: () => void) => () => void
  /** Resolves false without sending while a reply is under way or the message is empty. */
  send: (input: AgentSendInput) => Promise<boolean>
  stop: () => void
  /** Asks again for the answer to the last user message. */
  retry: () => Promise<boolean>
  /** Rewrites a user message and asks again from there; later messages are dropped. */
  edit: (messageId: string, text: string) => Promise<boolean>
  /** Decides an approval; the reply goes on once nothing in the message waits for the reader. */
  approve: (approvalId: string, approved: boolean, reason?: string) => Promise<boolean>
  answer: (questionId: string, answer: string | string[]) => Promise<boolean>
  skip: (questionId: string) => Promise<boolean>
  /** Switches to another conversation (or a new one), stopping any reply under way. */
  reset: (next?: { id?: string | null, messages?: AgentChatMessage[] }) => void
}

/** A random id for a message or a conversation. */
export function generateAgentId(): string {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

function waiting(message: AgentChatMessage | undefined): boolean {
  return Boolean(message?.parts.some(part => (part.type === 'approval' || part.type === 'question') && part.status === 'pending'))
}

/** The approval card a client tool call waits on. */
function clientApprovalId(toolCallId: string): string {
  return `client:${toolCallId}`
}

/**
 * A conversation with an agent endpoint: the messages, whether a reply is
 * under way, and the reader's actions on it. Framework-free; the React hook
 * and the JSON AgentChatSession component share one instance per conversation.
 */
export function createAgentSession(options: AgentChatSessionOptions): AgentChatSession {
  const generateId = options.generateId ?? generateAgentId
  const now = options.now ?? Date.now
  const listeners = new Set<() => void>()
  let snapshot: AgentChatSnapshot = { id: options.id ?? generateId(), messages: options.messages ?? [], status: 'ready', error: null }
  let controller: AbortController | null = null
  let merge: AgentMergeState | null = null

  const commit = (patch: Partial<AgentChatSnapshot>): void => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners)
      listener()
  }
  const busy = (): boolean => snapshot.status === 'submitted' || snapshot.status === 'streaming'
  // Where the reply being streamed sits in `messages`.
  let slot = -1
  // A decision taken while its reply still streams; sent once that reply ends.
  let deferred: { trigger: AgentRequestTrigger } | null = null
  // The pass running client tool calls, if any; replaced or cleared to abandon it.
  let toolRun: object | null = null
  const clientTools = (): Record<string, AgentClientTool> => options.clientTools?.() ?? {}
  const isClientTool = (name: string): boolean => Object.hasOwn(clientTools(), name)
  const withMessage = (message: AgentChatMessage): AgentChatMessage[] => {
    const next = snapshot.messages.slice()
    next[slot] = message
    return next
  }

  /**
   * Streams one reply into `target` after `history`: a new assistant message,
   * or (with `continued`) the last one when a decision lets it go on, which
   * is then sent too so the server sees the decision. A new reply joins
   * `messages` with its first chunk, so a thread can show that it is waiting.
   */
  const run = async (trigger: AgentRequestTrigger, history: AgentChatMessage[], target: AgentChatMessage, continued: boolean, messageId?: string): Promise<boolean> => {
    const own = new AbortController()
    controller = own
    merge = createAgentMergeState(target, isClientTool)
    slot = history.length
    commit({ messages: continued ? [...history, target] : history, status: 'submitted', error: null })
    const current = (): boolean => controller === own && !own.signal.aborted
    try {
      const stream = await options.transport.send({
        sessionId: snapshot.id,
        messages: continued ? [...history, { ...target, status: 'done' }] : history,
        trigger,
        ...(messageId ? { messageId } : {}),
        signal: own.signal,
      })
      for await (const chunk of stream) {
        if (!current())
          break
        if (chunk.type.startsWith('data-'))
          options.onData?.(chunk)
        merge = applyAgentChunk(merge, chunk, now())
        if (merge.message !== snapshot.messages[slot]) {
          commit({ messages: withMessage(merge.message), status: 'streaming' })
        }
        else if (snapshot.status === 'submitted') {
          commit({ status: 'streaming' })
        }
      }
      if (!current())
        return true
      // A stream that ends without `finish` still settles its message.
      if (merge.message.status === 'streaming') {
        merge = applyAgentChunk(merge, { type: 'finish' }, now())
        commit({ messages: withMessage(merge.message) })
      }
      const failed = merge.message.status === 'error'
      commit({ status: failed ? 'error' : 'ready', error: failed ? merge.message.errorText ?? null : null })
      options.onFinish?.({ sessionId: snapshot.id, message: merge.message, ...(merge.finishReason ? { finishReason: merge.finishReason } : {}) })
      const next = deferred
      deferred = null
      const last = snapshot.messages.at(-1)
      if (next && !failed && last && last.role === 'assistant' && !waiting(last))
        void run(next.trigger, snapshot.messages.slice(0, -1), { ...last, status: 'streaming' }, true, last.id)
      else if (!failed)
        void runClientTools()
      return true
    }
    catch (cause) {
      if (!current() || isAbort(cause))
        return true
      deferred = null
      const error = cause instanceof Error ? cause : new Error(String(cause))
      const message: AgentChatMessage = { ...(merge?.message ?? target), status: 'error', errorText: error.message }
      merge = merge ? { ...merge, message } : createAgentMergeState(message)
      commit({ messages: withMessage(message), status: 'error', error: error.message })
      options.onError?.(error)
      return true
    }
    finally {
      if (controller === own)
        controller = null
    }
  }

  /**
   * Runs the client tool calls the last reply left running: each asks first
   * in `ask` mode when its tool wants approval, a rejected one fails, and the
   * reply goes on once every call has its output and nothing waits.
   */
  async function runClientTools(): Promise<boolean> {
    // One pass at a time: the pass under way looks again after each call, so a
    // decision taken meanwhile is picked up there and no call runs twice.
    if (toolRun)
      return true
    const index = snapshot.messages.length - 1
    const tools = clientTools()
    const first = snapshot.messages[index]
    if (!first || first.role !== 'assistant' || busy())
      return false
    const runnable = (): Array<Extract<AgentChatPart, { type: 'tool-call' }>> => (snapshot.messages[index]?.parts ?? []).filter((part): part is Extract<AgentChatPart, { type: 'tool-call' }> =>
      part.type === 'tool-call' && part.status === 'running' && Object.hasOwn(tools, part.toolName))
    if (!runnable().length)
      return false
    const update = (toolCallId: string, change: (part: AgentChatPart) => AgentChatPart): void => {
      const current = snapshot.messages[index]
      if (!current)
        return
      const messages = snapshot.messages.slice()
      messages[index] = { ...current, parts: current.parts.map(part => part.type === 'tool-call' && part.toolCallId === toolCallId ? change(part) : part) }
      commit({ messages })
    }
    const ask = (options.approvalMode?.() ?? 'ask') === 'ask'
    const token = {}
    toolRun = token
    // Sending, stopping or switching the conversation ends this pass: what a
    // call answers afterwards belongs to nothing.
    const live = (): boolean => toolRun === token
    try {
      for (let ran = true; ran;) {
        ran = false
        for (const call of runnable()) {
          const tool = tools[call.toolName]!
          const approvalId = clientApprovalId(call.toolCallId)
          const card = snapshot.messages[index]?.parts.find(part => part.type === 'approval' && part.id === approvalId)
          if (card?.type === 'approval' && card.status === 'pending')
            continue
          if (card?.type === 'approval' && card.status === 'rejected') {
            update(call.toolCallId, part => ({ ...part, status: 'error', errorText: 'The reader declined.' }) as AgentChatPart)
            continue
          }
          const approval = !card && ask ? tool.approval?.(call.input) : undefined
          if (approval) {
            const current = snapshot.messages[index]!
            const messages = snapshot.messages.slice()
            messages[index] = { ...current, parts: [...current.parts, { type: 'approval', id: approvalId, toolCallId: call.toolCallId, status: 'pending', client: true, ...approval }] }
            commit({ messages })
            continue
          }
          // The reply is still being worked on: nothing else may be sent meanwhile.
          if (snapshot.status !== 'streaming')
            commit({ status: 'streaming' })
          ran = true
          const started = now()
          let change: (part: AgentChatPart) => AgentChatPart
          try {
            const output = await tool.execute(call.input)
            change = part => ({ ...part, status: 'success', output, duration: now() - started }) as AgentChatPart
          }
          catch (cause) {
            change = part => ({ ...part, status: 'error', errorText: cause instanceof Error ? cause.message : String(cause), duration: now() - started }) as AgentChatPart
          }
          if (!live())
            return true
          update(call.toolCallId, change)
        }
      }
    }
    finally {
      if (live())
        toolRun = null
    }
    const settled = snapshot.messages[index]
    if (!settled || waiting(settled) || runnable().length) {
      if (snapshot.status === 'streaming')
        commit({ status: 'ready' })
      return true
    }
    return run('tool-output', snapshot.messages.slice(0, index), { ...settled, status: 'streaming' }, true, settled.id)
  }

  const reply = (): AgentChatMessage => ({ id: generateId(), role: 'assistant', parts: [], status: 'streaming', createdAt: new Date(now()).toISOString() })

  /** Changes a part of the last assistant message, then lets the reply go on if nothing else waits. */
  const decide = async (trigger: AgentRequestTrigger, id: string, type: 'approval' | 'question', change: (part: AgentChatPart) => AgentChatPart): Promise<boolean> => {
    const index = snapshot.messages.findLastIndex(message => message.parts.some(part => part.type === type && part.id === id))
    const message = snapshot.messages[index]
    if (!message)
      return false
    const part = message.parts.find(entry => entry.type === type && entry.id === id)
    if (!part || (part.type !== 'approval' && part.type !== 'question') || part.status !== 'pending')
      return false
    const decided: AgentChatMessage = { ...message, parts: message.parts.map(entry => entry === part ? change(entry) : entry) }
    if (busy()) {
      // The card can arrive before its reply ends: keep the decision in the
      // streaming message and send it when the reply is done.
      if (index !== slot || !merge)
        return false
      merge = { ...merge, message: decided }
      commit({ messages: withMessage(decided) })
      if (!waiting(decided))
        deferred = { trigger }
      return true
    }
    const messages = snapshot.messages.slice()
    messages[index] = decided
    commit({ messages })
    // A client tool's card: the front end runs the call itself, then the reply goes on.
    if (part.type === 'approval' && part.client === true)
      return index === messages.length - 1 ? runClientTools() : true
    if (waiting(decided) || index !== messages.length - 1)
      return true
    return run(trigger, messages.slice(0, -1), { ...decided, status: 'streaming' }, true, decided.id)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async send(input) {
      const text = input.text?.trim() ?? ''
      if (busy() || (!text && !input.attachments?.length))
        return false
      const parts: AgentChatPart[] = []
      if (input.context?.length)
        parts.push({ type: 'context', items: input.context })
      for (const file of input.attachments ?? []) {
        parts.push({
          type: 'file',
          mediaType: file.mediaType ?? 'application/octet-stream',
          filename: file.name,
          ...(file.url ? { url: file.url } : {}),
          ...(file.size !== undefined ? { size: file.size } : {}),
        })
      }
      if (text)
        parts.push({ type: 'text', text })
      const user: AgentChatMessage = { id: generateId(), role: 'user', parts, createdAt: new Date(now()).toISOString() }
      return run('submit-message', [...snapshot.messages, user], reply(), false)
    },
    stop() {
      const own = controller
      deferred = null
      if (!own) {
        // Stopped while the front end runs the reply's tool calls: they end with it.
        if (toolRun) {
          toolRun = null
          const tools = clientTools()
          const messages = snapshot.messages.slice()
          const last = messages.at(-1)
          if (last)
            messages[messages.length - 1] = { ...last, parts: last.parts.map(part => part.type === 'tool-call' && part.status === 'running' && Object.hasOwn(tools, part.toolName) ? { ...part, status: 'error' as const, errorText: 'Stopped.' } : part) }
          commit({ messages, status: 'ready', error: null })
        }
        return
      }
      controller = null
      own.abort()
      if (!merge)
        return
      // Stopped before anything arrived: there is no reply to keep.
      if (snapshot.messages.length <= slot) {
        commit({ status: 'ready', error: null })
        return
      }
      // Stopped calls the front end would have run end with the reply.
      merge = applyAgentChunk({ ...merge, clientTool: undefined }, { type: 'abort' }, now())
      commit({ messages: withMessage(merge.message), status: 'ready', error: null })
      options.onFinish?.({ sessionId: snapshot.id, message: merge.message, finishReason: 'interrupted' })
    },
    async retry() {
      if (busy())
        return false
      const last = snapshot.messages.findLastIndex(message => message.role === 'user')
      if (last === -1)
        return false
      const replaced = snapshot.messages[last + 1]
      return run('regenerate-message', snapshot.messages.slice(0, last + 1), reply(), false, replaced?.role === 'assistant' ? replaced.id : undefined)
    },
    async edit(messageId, text) {
      const index = snapshot.messages.findIndex(message => message.id === messageId && message.role === 'user')
      const message = snapshot.messages[index]
      if (busy() || !message || !text.trim())
        return false
      const kept = message.parts.filter(part => part.type !== 'text')
      const edited: AgentChatMessage = { ...message, parts: [...kept, { type: 'text', text: text.trim() }] }
      return run('submit-message', [...snapshot.messages.slice(0, index), edited], reply(), false)
    },
    approve: (approvalId, approved, reason) => decide('approval-response', approvalId, 'approval', part => ({
      ...part,
      status: approved ? 'approved' : 'rejected',
      ...(reason ? { reason } : {}),
    }) as AgentChatPart),
    answer: (questionId, answer) => decide('question-answer', questionId, 'question', part => ({ ...part, status: 'answered', answer }) as AgentChatPart),
    skip: questionId => decide('question-answer', questionId, 'question', part => ({ ...part, status: 'skipped', answer: null }) as AgentChatPart),
    reset(next = {}) {
      deferred = null
      toolRun = null
      const own = controller
      controller = null
      own?.abort()
      merge = null
      slot = -1
      commit({ id: next.id ?? generateId(), messages: next.messages ?? [], status: 'ready', error: null })
    },
  }
}
