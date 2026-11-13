import type { HttpClient } from '../http.js'
import type { AgentRequest, AgentTransport } from './session.js'
import type { AgentChunk } from './stream.js'
import { parseAgentStream } from './stream.js'

export type AgentHeaders = Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)

export interface HttpAgentTransportOptions {
  /** The chat endpoint, e.g. `/agent/chat`; a function is read on every request. */
  url: string | (() => string)
  /**
   * Sends through this client, so the auth provider signs the request and a
   * 401 refreshes once; without one the request goes out unsigned.
   */
  http?: HttpClient
  /** Extra headers; the auth provider's credentials come through `http`. */
  headers?: AgentHeaders
  credentials?: RequestCredentials
  /** Extra fields sent with every request, e.g. the model. */
  body?: Record<string, unknown> | (() => Record<string, unknown>)
  /**
   * Replaces the default request body `{ id, messages, trigger, messageId, ...body }`,
   * e.g. to send only the last message to a server that keeps the history.
   */
  prepareBody?: (request: AgentRequest, body: Record<string, unknown>) => Record<string, unknown>
  fetch?: typeof fetch
}

/** A failed agent request; `status` lets the auth provider react to 401 and 403. */
export class AgentRequestError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'AgentRequestError'
    this.status = status
    this.data = data
  }
}

async function failure(response: Response): Promise<AgentRequestError> {
  const text = await response.text().catch(() => '')
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : undefined
  }
  catch {}
  const body = typeof data === 'object' && data !== null ? data as { message?: unknown, error?: unknown } : undefined
  const message = typeof body?.message === 'string'
    ? body.message
    : typeof body?.error === 'string'
      ? body.error
      : typeof data === 'string' && data
        ? data
        : `Agent request failed with ${response.status}`
  return new AgentRequestError(response.status, message, data)
}

/**
 * Posts the conversation as JSON and reads the reply as an AI SDK UI message
 * stream. The body follows the AI SDK chat request: `id`, `messages`,
 * `trigger` and, for regeneration and decisions, `messageId`.
 */
export function createHttpAgentTransport(options: HttpAgentTransportOptions): AgentTransport {
  return {
    async send(request): Promise<AsyncIterable<AgentChunk>> {
      const url = typeof options.url === 'function' ? options.url() : options.url
      const extra = typeof options.body === 'function' ? options.body() : options.body
      const base: Record<string, unknown> = {
        ...extra,
        id: request.sessionId,
        messages: request.messages,
        trigger: request.trigger,
        ...(request.messageId ? { messageId: request.messageId } : {}),
      }
      const body = options.prepareBody ? options.prepareBody(request, base) : base
      const headers = typeof options.headers === 'function' ? await options.headers() : options.headers
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', ...headers },
        body: JSON.stringify(body),
        signal: request.signal,
        ...(options.credentials ? { credentials: options.credentials } : {}),
      }
      const response = options.http ? await options.http.fetch(url, init) : await (options.fetch ?? fetch)(url, init)
      if (!response.ok) {
        const error = await failure(response)
        throw options.http ? options.http.own(error) : error
      }
      if (!response.body)
        throw new AgentRequestError(response.status, 'Agent response has no body')
      return parseAgentStream(response.body, request.signal)
    },
  }
}
