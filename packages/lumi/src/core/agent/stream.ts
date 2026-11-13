/**
 * The chunks of the AI SDK UI message stream protocol (v1) that a Lumi agent
 * session understands. Servers stream them as Server-Sent Events, one JSON
 * object per `data:` line, ending with `data: [DONE]`, and mark the response
 * with the `x-vercel-ai-ui-message-stream: v1` header.
 */
export type AgentChunk
  = | { type: 'start', messageId?: string, messageMetadata?: unknown }
    | { type: 'start-step' }
    | { type: 'finish-step' }
    | { type: 'finish', finishReason?: string, messageMetadata?: unknown }
    | { type: 'abort', reason?: string }
    | { type: 'error', errorText: string }
    | { type: 'message-metadata', messageMetadata?: unknown }
    | { type: 'text-start' | 'text-end' | 'reasoning-start' | 'reasoning-end', id: string }
    | { type: 'text-delta' | 'reasoning-delta', id: string, delta: string }
    | { type: 'tool-input-start', toolCallId: string, toolName: string, title?: string }
    | { type: 'tool-input-delta', toolCallId: string, inputTextDelta: string }
    | { type: 'tool-input-available', toolCallId: string, toolName: string, input: unknown, title?: string }
    | { type: 'tool-input-error', toolCallId: string, toolName: string, input?: unknown, errorText: string }
    | { type: 'tool-output-available', toolCallId: string, output: unknown, preliminary?: boolean }
    | { type: 'tool-output-error', toolCallId: string, errorText: string }
    | { type: 'tool-output-denied', toolCallId: string }
    | { type: 'tool-approval-request', approvalId: string, toolCallId: string }
    | { type: 'source-url', sourceId: string, url: string, title?: string }
    | { type: 'source-document', sourceId: string, mediaType: string, title: string, filename?: string }
    | { type: 'file', url: string, mediaType: string }
    | { type: `data-${string}`, id?: string, data: unknown, transient?: boolean }

export const AGENT_STREAM_HEADER = 'x-vercel-ai-ui-message-stream'
export const AGENT_STREAM_VERSION = 'v1'

const LINE_BREAK_RE = /\r\n|\r|\n/

function isChunk(value: unknown): value is AgentChunk {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'
}

/**
 * Reads Server-Sent Events from a byte stream and yields each `data:` payload
 * parsed as a chunk. Comments, `event:` and `id:` lines are ignored; a payload
 * spread over several `data:` lines is joined with line breaks, as in the SSE
 * specification. Stops at `[DONE]` or the end of the stream.
 */
export async function* parseAgentStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<AgentChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let data: string[] = []
  const release = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', release, { once: true })
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      // A trailing `\r` may be the first half of `\r\n`; hold it for the next read.
      const carry = !done && buffer.endsWith('\r') ? '\r' : ''
      const lines = (carry ? buffer.slice(0, -1) : buffer).split(LINE_BREAK_RE)
      buffer = done ? '' : (lines.pop() ?? '') + carry
      // The end of the stream dispatches an event that lacks its blank line.
      if (done)
        lines.push('')
      for (const line of lines) {
        if (line === '') {
          if (!data.length)
            continue
          const payload = data.join('\n')
          data = []
          if (payload === '[DONE]')
            return
          // A payload that is not JSON (a keep-alive word such as `ping`) is not a chunk.
          let chunk: unknown
          try {
            chunk = JSON.parse(payload)
          }
          catch {
            continue
          }
          if (isChunk(chunk))
            yield chunk
          continue
        }
        if (line.startsWith(':'))
          continue
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        if (field !== 'data')
          continue
        const raw = colon === -1 ? '' : line.slice(colon + 1)
        data.push(raw.startsWith(' ') ? raw.slice(1) : raw)
      }
      if (done)
        return
    }
  }
  finally {
    signal?.removeEventListener('abort', release)
    reader.releaseLock()
  }
}

/** Frames chunks as the SSE body a server sends; used by mocks and tests. */
export function formatAgentStream(chunks: Iterable<AgentChunk>): string {
  let out = ''
  for (const chunk of chunks)
    out += `data: ${JSON.stringify(chunk)}\n\n`
  return `${out}data: [DONE]\n\n`
}
