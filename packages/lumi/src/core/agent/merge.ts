import type { AgentChunk } from './stream.js'

/**
 * The agent message contract shared with Lumi UI's ChatThread. Lumi keeps its
 * own structural copy so the services never depend on the UI package; parts
 * the stream does not build are passed through as they are.
 */
export type AgentChatToolStatus = 'pending' | 'running' | 'success' | 'error'
export type AgentChatApprovalStatus = 'pending' | 'running' | 'approved' | 'rejected' | 'expired' | 'failed'
export type AgentChatQuestionStatus = 'pending' | 'answered' | 'skipped'

export interface AgentChatContextItem {
  id: string
  label: string
  kind?: 'page' | 'record' | 'file' | 'selection' | 'data'
  icon?: string
  description?: string
  /** The referenced record's fields, sent to the agent and not shown. */
  data?: Record<string, unknown>
}

export interface AgentChatAttachment {
  id?: string
  name: string
  url?: string
  mediaType?: string
  size?: number
}

export type AgentChatPart
  = | { type: 'text', id?: string, text: string, state?: 'streaming' | 'done' }
    | { type: 'reasoning', id?: string, text?: string, state?: 'streaming' | 'done', label?: string, steps?: unknown[], duration?: number }
    | {
      type: 'tool-call'
      id?: string
      toolCallId: string
      toolName: string
      title?: string
      icon?: string
      status: AgentChatToolStatus
      input?: unknown
      output?: unknown
      errorText?: string
      summary?: string
      duration?: number
    }
    | { type: 'approval', id: string, title: string, status: AgentChatApprovalStatus, toolCallId?: string, action?: string, reason?: string, [field: string]: unknown }
    | { type: 'question', id: string, title: string, status: AgentChatQuestionStatus, answer?: string | string[] | null, [field: string]: unknown }
    | { type: 'plan' | 'diff', id?: string, [field: string]: unknown }
    | { type: 'source', sourceId: string, title: string, url?: string, snippet?: string, icon?: string, kind?: string }
    | { type: 'file', id?: string, mediaType: string, filename?: string, url?: string, size?: number }
    | { type: 'context', id?: string, items: AgentChatContextItem[] }

export interface AgentChatSuggestion {
  label: string
  value?: string
  [field: string]: unknown
}

export interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: AgentChatPart[]
  status?: 'streaming' | 'done' | 'error'
  errorText?: string
  createdAt?: string
  feedback?: 'up' | 'down' | null
  suggestions?: AgentChatSuggestion[]
}

/** Data parts that become message parts: `data-approval` adds or replaces an approval card by id. */
const DATA_PARTS = new Set(['approval', 'question', 'plan', 'diff', 'context', 'reasoning'])

/** What a merge keeps between chunks besides the message itself. */
export interface AgentMergeState {
  message: AgentChatMessage
  /** When each reasoning block and tool call started, for its duration. */
  started: Record<string, number>
  /**
   * Text and reasoning ids of this stream mapped to part ids. Servers number
   * blocks per request, so a reply that goes on after a decision may reuse
   * an id the message already has; such a block gets a fresh part id.
   */
  ids: Record<string, string>
  finishReason?: string
  /** Tools the front end runs: their calls stay running when the stream ends. */
  clientTool?: (toolName: string) => boolean
}

/** The starting state for merging a reply's stream chunks into `message`. */
export function createAgentMergeState(message: AgentChatMessage, clientTool?: (toolName: string) => boolean): AgentMergeState {
  return { message, started: {}, ids: {}, ...(clientTool ? { clientTool } : {}) }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function replacePart(parts: AgentChatPart[], index: number, next: AgentChatPart): AgentChatPart[] {
  const copy = parts.slice()
  copy[index] = next
  return copy
}

function partIndex(parts: AgentChatPart[], type: AgentChatPart['type'], id: string): number {
  return parts.findIndex(part => part.type === type && (part.type === 'tool-call' ? part.toolCallId : part.type === 'source' ? part.sourceId : part.id) === id)
}

/**
 * Closes what is still open: streaming text settles, unfinished tool calls
 * fail. With `awaiting`, a call the reader has yet to approve stays open: the
 * reply ended to wait for that answer, not because the call broke.
 */
function settle(parts: AgentChatPart[], now: number, state: AgentMergeState, awaiting = false): AgentChatPart[] {
  let changed = false
  const waiting = awaiting
    ? new Set(parts.flatMap(part => (part.type === 'approval' && part.status === 'pending' && part.toolCallId ? [part.toolCallId] : [])))
    : undefined
  const next = parts.map((part) => {
    if ((part.type === 'text' || part.type === 'reasoning') && part.state === 'streaming') {
      changed = true
      const started = part.id ? state.started[`reasoning:${part.id}`] : undefined
      return part.type === 'reasoning' && started !== undefined && part.duration === undefined
        ? { ...part, state: 'done' as const, duration: now - started }
        : { ...part, state: 'done' as const }
    }
    if (part.type === 'tool-call' && (part.status === 'pending' || part.status === 'running') && !(part.status === 'running' && state.clientTool?.(part.toolName)) && !waiting?.has(part.toolCallId)) {
      changed = true
      return { ...part, status: 'error' as const }
    }
    return part
  })
  return changed ? next : parts
}

function updateTool(state: AgentMergeState, toolCallId: string, update: (part: Extract<AgentChatPart, { type: 'tool-call' }>) => AgentChatPart, create?: () => AgentChatPart): AgentChatPart[] {
  const parts = state.message.parts
  const index = partIndex(parts, 'tool-call', toolCallId)
  const part = parts[index]
  if (part?.type === 'tool-call')
    return replacePart(parts, index, update(part))
  return create ? [...parts, create()] : parts
}

/**
 * Folds one stream chunk into the message being built and returns the next
 * merge state. Unchanged chunks return the same message object, so a renderer
 * can skip work; changed ones copy only the message and the part that moved.
 */
export function applyAgentChunk(state: AgentMergeState, chunk: AgentChunk, now = Date.now()): AgentMergeState {
  const { message } = state
  const with_ = (patch: Partial<AgentChatMessage>): AgentMergeState => ({ ...state, message: { ...message, ...patch } })
  const parts = message.parts

  switch (chunk.type) {
    case 'start':
      return chunk.messageId && chunk.messageId !== message.id ? with_({ id: chunk.messageId, status: 'streaming' }) : with_({ status: 'streaming' })
    case 'text-start':
    case 'reasoning-start': {
      const type = chunk.type === 'text-start' ? 'text' : 'reasoning'
      // A start for a block still streaming repeats it; one already ended opens another.
      const open = parts[partIndex(parts, type, state.ids[`${type}:${chunk.id}`] ?? '')]
      if (open && (open.type === 'text' || open.type === 'reasoning') && open.state === 'streaming')
        return state
      let id = chunk.id
      for (let n = 2; partIndex(parts, type, id) !== -1; n++)
        id = `${chunk.id}~${n}`
      const started = type === 'reasoning' ? { ...state.started, [`reasoning:${id}`]: now } : state.started
      return { ...state, started, ids: { ...state.ids, [`${type}:${chunk.id}`]: id }, message: { ...message, parts: [...parts, { type, id, text: '', state: 'streaming' }] } }
    }
    case 'text-delta':
    case 'reasoning-delta': {
      const type = chunk.type === 'text-delta' ? 'text' : 'reasoning'
      const id = state.ids[`${type}:${chunk.id}`]
      const index = id ? partIndex(parts, type, id) : -1
      const part = parts[index]
      if (!part) {
        // A delta without its start still shows: open the part on the fly.
        const opened = applyAgentChunk(state, { type: type === 'text' ? 'text-start' : 'reasoning-start', id: chunk.id }, now)
        return applyAgentChunk(opened, chunk, now)
      }
      if (part.type !== 'text' && part.type !== 'reasoning')
        return state
      return with_({ parts: replacePart(parts, index, { ...part, text: (part.text ?? '') + chunk.delta }) })
    }
    case 'text-end':
    case 'reasoning-end': {
      const type = chunk.type === 'text-end' ? 'text' : 'reasoning'
      const id = state.ids[`${type}:${chunk.id}`]
      const index = id ? partIndex(parts, type, id) : -1
      const part = parts[index]
      if (!part || (part.type !== 'text' && part.type !== 'reasoning'))
        return state
      const started = state.started[`reasoning:${id}`]
      const done: AgentChatPart = part.type === 'reasoning' && started !== undefined
        ? { ...part, state: 'done', duration: now - started }
        : { ...part, state: 'done' }
      return with_({ parts: replacePart(parts, index, done) })
    }
    case 'tool-input-start':
      return {
        ...state,
        started: { ...state.started, [`tool:${chunk.toolCallId}`]: now },
        message: {
          ...message,
          parts: updateTool(state, chunk.toolCallId, part => part, () => ({
            type: 'tool-call',
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            ...(chunk.title ? { title: chunk.title } : {}),
            status: 'pending',
          })),
        },
      }
    case 'tool-input-delta':
      // The call shows its input once complete; partial JSON is not drawn.
      return state
    case 'tool-input-available': {
      const started = state.started[`tool:${chunk.toolCallId}`] ?? now
      return {
        ...state,
        started: { ...state.started, [`tool:${chunk.toolCallId}`]: started },
        message: {
          ...message,
          parts: updateTool(
            state,
            chunk.toolCallId,
            part => ({ ...part, toolName: chunk.toolName, ...(chunk.title ? { title: chunk.title } : {}), input: chunk.input, status: 'running' }),
            () => ({ type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, ...(chunk.title ? { title: chunk.title } : {}), input: chunk.input, status: 'running' }),
          ),
        },
      }
    }
    case 'tool-input-error':
      return with_({
        parts: updateTool(
          state,
          chunk.toolCallId,
          part => ({ ...part, status: 'error', errorText: chunk.errorText }),
          () => ({ type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, input: chunk.input, status: 'error', errorText: chunk.errorText }),
        ),
      })
    case 'tool-output-available':
    case 'tool-output-error':
    case 'tool-output-denied': {
      const started = state.started[`tool:${chunk.toolCallId}`]
      const duration = started === undefined ? {} : { duration: now - started }
      return with_({
        parts: updateTool(state, chunk.toolCallId, (part) => {
          if (chunk.type === 'tool-output-available')
            return { ...part, output: chunk.output, status: chunk.preliminary ? 'running' : 'success', ...(chunk.preliminary ? {} : duration) }
          if (chunk.type === 'tool-output-error')
            return { ...part, status: 'error', errorText: chunk.errorText, ...duration }
          return { ...part, status: 'error' }
        }),
      })
    }
    case 'tool-approval-request': {
      if (partIndex(parts, 'approval', chunk.approvalId) !== -1)
        return state
      const tool = parts.find(part => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId)
      const name = tool?.type === 'tool-call' ? tool.toolName : chunk.toolCallId
      const title = tool?.type === 'tool-call' ? tool.title ?? tool.toolName : chunk.toolCallId
      return with_({ parts: [...parts, { type: 'approval', id: chunk.approvalId, toolCallId: chunk.toolCallId, action: name, title, status: 'pending' }] })
    }
    case 'source-url':
    case 'source-document': {
      if (partIndex(parts, 'source', chunk.sourceId) !== -1)
        return state
      const source: AgentChatPart = chunk.type === 'source-url'
        ? { type: 'source', sourceId: chunk.sourceId, title: chunk.title ?? chunk.url, url: chunk.url, kind: 'web' }
        : { type: 'source', sourceId: chunk.sourceId, title: chunk.title, kind: 'document' }
      return with_({ parts: [...parts, source] })
    }
    case 'file':
      return with_({ parts: [...parts, { type: 'file', url: chunk.url, mediaType: chunk.mediaType }] })
    case 'error':
      return { ...state, message: { ...message, parts: settle(parts, now, state), status: 'error', errorText: chunk.errorText } }
    case 'abort':
      return { ...state, finishReason: 'interrupted', message: { ...message, parts: settle(parts, now, state), status: 'done' } }
    case 'finish':
      return {
        ...state,
        ...(chunk.finishReason ? { finishReason: chunk.finishReason } : {}),
        message: { ...message, parts: settle(parts, now, state, true), status: message.status === 'error' ? 'error' : 'done' },
      }
    case 'start-step':
    case 'finish-step':
    case 'message-metadata':
      return state
    default:
      return applyDataChunk(state, chunk)
  }
}

function applyDataChunk(state: AgentMergeState, chunk: AgentChunk): AgentMergeState {
  if (!chunk.type.startsWith('data-') || !('data' in chunk) || ('transient' in chunk && chunk.transient))
    return state
  const name = chunk.type.slice('data-'.length)
  const { message } = state
  if (name === 'suggestions') {
    return Array.isArray(chunk.data) ? { ...state, message: { ...message, suggestions: chunk.data as AgentChatSuggestion[] } } : state
  }
  const data = record(chunk.data)
  if (!DATA_PARTS.has(name) || !data)
    return state
  const id = chunk.id ?? (typeof data.id === 'string' ? data.id : undefined)
  const part = { ...data, type: name, ...(id ? { id } : {}) } as AgentChatPart
  // A data part with a known id replaces the earlier one: the server moves an
  // approval to `approved` or a plan step to `done` by sending it again.
  const index = id ? partIndex(message.parts, part.type, id) : -1
  return { ...state, message: { ...message, parts: index === -1 ? [...message.parts, part] : replacePart(message.parts, index, part) } }
}
