import { z } from 'zod'

const record = z.record(z.string(), z.unknown())
const statePath = z.string().startsWith('/')

export const agentSessionPropsSchema = z.strictObject({
  /** The state path the session projects `{ id, messages, status, error, streaming }` to; actions name it as `session`. */
  statePath,
  /** The chat endpoint; defaults to the configured `agent.endpoint`, then `/agent/chat`. Relative paths resolve against the DataProvider API URL. */
  endpoint: z.string().optional(),
  /** The conversation to open; empty starts a new one with a generated id. */
  sessionId: z.string().nullable().optional(),
  /** A DataProvider resource, e.g. `agent-sessions`: its `getOne` loads a conversation's messages and it is refreshed after each reply. */
  resource: z.string().optional(),
  dataProviderName: z.string().optional(),
  /** Extra fields sent with every request, e.g. the model. */
  body: record.optional(),
})

export type AgentSessionComponentProps = z.input<typeof agentSessionPropsSchema>

const contextItem = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['page', 'record', 'file', 'selection', 'data']).optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
})
const attachment = z.looseObject({
  id: z.string().optional(),
  name: z.string(),
  url: z.string().optional(),
  mediaType: z.string().optional(),
  size: z.number().optional(),
})

const sessionParam = { session: statePath }

export const agentSendParamsSchema = z.strictObject({
  ...sessionParam,
  text: z.string().optional(),
  context: z.array(contextItem).optional(),
  attachments: z.array(attachment).optional(),
  /** State paths emptied once the message is accepted, e.g. the PromptInput value, context and attachments. */
  clear: z.array(statePath).optional(),
})
export const agentSessionParamsSchema = z.strictObject(sessionParam)
export const agentEventParamsSchema = z.strictObject({
  ...sessionParam,
  /** A ChatThread `activeEvent`: `{ type, messageId?, partId?, value? }`. */
  event: z.looseObject({
    type: z.string(),
    messageId: z.string().optional(),
    partId: z.string().optional(),
    value: z.unknown().optional(),
  }),
})

export const agentComponentDefinitions = {
  AgentSession: {
    props: agentSessionPropsSchema,
    slots: ['default'],
    events: [],
    description: 'Connects a conversation to an agent endpoint that answers with an AI SDK UI message stream (SSE). Projects `{ id, messages, status, error, streaming }` to statePath: bind ChatThread `messages` and PromptInput `streaming` to it, send with `agentSend`, stop with `agentStop`, and pass ChatThread events to `agentEvent` (approve, reject, answer, skip, regenerate, edit, suggestion). With `resource` the conversation named by `sessionId` loads through the DataProvider and the resource refreshes after each reply.',
  },
}

export const agentActionDefinitions = {
  agentSend: { params: agentSendParamsSchema, description: 'Send a message in the AgentSession at `session`. Ignored while a reply is under way or when there is nothing to send; `clear` paths are emptied only once the message is accepted.' },
  agentStop: { params: agentSessionParamsSchema, description: 'Stop the reply under way; what arrived so far stays.' },
  agentRetry: { params: agentSessionParamsSchema, description: 'Ask again for the answer to the last user message.' },
  agentEvent: { params: agentEventParamsSchema, description: 'Apply a ChatThread event to the session: approve and reject decide an approval, answer and skip a question (the reply goes on once nothing waits), regenerate retries, edit rewrites a user message, suggestion sends it.' },
}
