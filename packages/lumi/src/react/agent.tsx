import type { BaseComponentProps } from '@json-render/react'
import type { ReactNode } from 'react'
import type { AgentSessionComponentProps } from '../catalog/agent.js'
import type {
  AgentApprovalMode,
  AgentChatMessage,
  AgentChatSession,
  AgentChatSnapshot,
  AgentChunk,
  AgentFinishEvent,
  AgentHeaders,
  AgentRequest,
  AgentTransport,
  HttpAgentTransportOptions,
} from '../core/index.js'
import { useStateStore } from '@json-render/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { agentSessionPropsSchema } from '../catalog/agent.js'
import {
  createAgentSession,
  createHttpAgentTransport,
  dataProviderHttp,
  dataProviderPath,
  executeRequest,
  invalidateResourceQueries,
  registerAgentSession,
} from '../core/index.js'
import { useLumi } from './context.js'

export interface UseAgentChatOptions {
  /** Defaults to the configured `agent.endpoint`, then `/agent/chat`. */
  endpoint?: string
  /** The conversation to open; a change switches to it, empty starts a new one. */
  sessionId?: string | null
  /** A DataProvider resource whose `getOne` returns a conversation's messages; refreshed after each reply. */
  resource?: string
  /** The data provider whose API root and request client the chat uses. */
  dataProviderName?: string
  /** Extra request headers; the reader's credentials are added by the request client. */
  headers?: AgentHeaders
  /** Extra fields sent with every request, e.g. the model. */
  body?: Record<string, unknown>
  /** Last change to the request body before it is sent. */
  prepareBody?: HttpAgentTransportOptions['prepareBody']
  /** Replaces the HTTP transport, e.g. for a WebSocket or an in-page agent. */
  transport?: AgentTransport
  /** Called for each `data-*` chunk of the stream. */
  onData?: (chunk: AgentChunk) => void
  /** Called when a reply ends, however it ended. */
  onFinish?: (event: AgentFinishEvent) => void
  /** Called when a reply fails. */
  onError?: (error: Error) => void
  /**
   * Lets the agent see and act on the front end through the Lumi agent bridge:
   * each request carries the UI snapshot (`ui`), the client tools
   * (`clientTools`) and the approval mode (`approvalMode`), and calls to those
   * tools run here. Defaults to true.
   */
  ui?: boolean
}

export interface AgentChat extends AgentChatSnapshot {
  /** True while a reply is requested or streaming. */
  streaming: boolean
  /** True while the conversation's earlier messages load. */
  loading: boolean
  /** The session behind the chat, for calls the hook does not surface. */
  session: AgentChatSession
  /** Sends a message; ignored while a reply is under way or when it is empty. */
  send: AgentChatSession['send']
  /** Stops the reply under way, keeping what arrived. */
  stop: AgentChatSession['stop']
  /** Asks again for an answer to the last user message. */
  retry: AgentChatSession['retry']
  /** Rewrites a user message and answers from there. */
  edit: AgentChatSession['edit']
  /** Answers an approval request, accepting or refusing it. */
  approve: AgentChatSession['approve']
  /** Answers a question the agent asked. */
  answer: AgentChatSession['answer']
  /** Skips a question the agent asked. */
  skip: AgentChatSession['skip']
  /** Starts a new, empty conversation. */
  reset: AgentChatSession['reset']
}

function messagesOf(data: unknown): AgentChatMessage[] {
  if (Array.isArray(data))
    return data as AgentChatMessage[]
  const messages = typeof data === 'object' && data !== null ? (data as { messages?: unknown }).messages : undefined
  return Array.isArray(messages) ? messages as AgentChatMessage[] : []
}

/**
 * A conversation with an agent endpoint. The reply streams in as an AI SDK UI
 * message stream; requests are signed by the auth provider through the data
 * provider's HttpClient, carry the configured agent headers and go through
 * the auth provider's error handling like any other Lumi request. One session
 * serves the hook and the JSON AgentSession component.
 */
export function useAgentChat(options: UseAgentChatOptions = {}): AgentChat {
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const latest = useRef(options)
  latest.current = options
  const [session] = useState(() => {
    const http = (): AgentTransport => {
      const current = latest.current
      const config = lumi.config.agent ?? {}
      const endpoint = current.endpoint ?? config.endpoint ?? '/agent/chat'
      // The data provider's client carries its credentials; the app's otherwise.
      const providerName = current.dataProviderName ?? config.dataProviderName
      const client = dataProviderHttp(lumi, providerName)
      const url = dataProviderPath(lumi, providerName, endpoint)
      const headers = current.headers ?? config.headers
      const bridge = current.ui === false ? undefined : lumi.agentBridge
      return createHttpAgentTransport({
        url,
        http: client,
        ...(headers ? { headers } : {}),
        // The UI snapshot is read when the request leaves, so it shows the page as it is now.
        ...(current.body || bridge
          ? {
              body: () => ({
                ...current.body,
                ...(bridge ? { ui: bridge.snapshot(), clientTools: bridge.toolDefinitions(), approvalMode: bridge.getApprovalMode() } : {}),
              }),
            }
          : {}),
        ...(current.prepareBody ? { prepareBody: current.prepareBody } : {}),
      })
    }
    const bridge = (): typeof lumi.agentBridge => (latest.current.ui === false ? undefined : lumi.agentBridge)
    return createAgentSession({
      id: options.sessionId ?? null,
      transport: {
        send: (request: AgentRequest) => {
          const transport = latest.current.transport ?? http()
          return executeRequest(lumi, () => transport.send(request), queryClient)
        },
      },
      clientTools: () => bridge()?.tools() ?? {},
      approvalMode: () => bridge()?.getApprovalMode() ?? 'ask',
      onData: chunk => latest.current.onData?.(chunk),
      onError: error => latest.current.onError?.(error),
      onFinish: (event) => {
        const { resource, dataProviderName } = latest.current
        if (resource)
          void invalidateResourceQueries(queryClient, lumi, resource, dataProviderName).catch(() => {})
        latest.current.onFinish?.(event)
      },
    })
  })
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [loading, setLoading] = useState(false)
  const { sessionId, resource, dataProviderName } = options

  // A new conversation id switches the session and loads its messages; the id
  // of the conversation already shown (say one this session started and the
  // host then selected) keeps what is there.
  const shown = useRef<{ id: string | undefined } | null>(null)
  useEffect(() => {
    const current = session.getSnapshot()
    // An unnamed conversation stays as it is when only something around it
    // changed (the context, the resource): there is nothing to switch to.
    const unnamedKept = !sessionId && shown.current !== null && shown.current.id === undefined
    shown.current = { id: sessionId ?? undefined }
    if (unnamedKept)
      return
    if (sessionId && sessionId === current.id && current.messages.length)
      return
    if (!sessionId || sessionId !== current.id)
      session.reset({ id: sessionId ?? null })
    if (!sessionId || !resource)
      return
    const controller = new AbortController()
    setLoading(true)
    executeRequest(lumi, () => lumi.getDataProvider(dataProviderName).getOne({ resource, id: sessionId, signal: controller.signal }), queryClient)
      .then((result) => {
        if (!controller.signal.aborted && session.getSnapshot().id === sessionId && !session.getSnapshot().messages.length)
          session.reset({ id: sessionId, messages: messagesOf(result.data) })
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted)
          setLoading(false)
      })
    return () => {
      controller.abort()
      setLoading(false)
    }
  }, [session, sessionId, resource, dataProviderName, lumi, queryClient])

  // A reply under way stops when its conversation unmounts.
  useEffect(() => () => session.stop(), [session])

  return {
    ...snapshot,
    streaming: snapshot.status === 'submitted' || snapshot.status === 'streaming',
    loading,
    session,
    send: session.send,
    stop: session.stop,
    retry: session.retry,
    edit: session.edit,
    approve: session.approve,
    answer: session.answer,
    skip: session.skip,
    reset: session.reset,
  }
}

const noBridge = (): (() => void) => () => {}

/**
 * The approval mode every agent conversation shares: `ask` waits for the
 * reader before changes, `auto` acts at once. It is sent with each request so
 * the server applies the same rule to its own approvals, and kept between visits.
 */
export function useAgentApprovalMode(): [AgentApprovalMode, (mode: AgentApprovalMode) => void] {
  const bridge = useLumi().agentBridge
  const mode = useSyncExternalStore(bridge?.subscribe ?? noBridge, () => bridge?.getApprovalMode() ?? 'ask', () => bridge?.getApprovalMode() ?? 'ask')
  const set = useCallback((next: AgentApprovalMode) => bridge?.setApprovalMode(next), [bridge])
  return [mode, set]
}

/** How often streamed text is written to page state. */
const STREAM_WRITE_MS = 50

export function AgentSession({ props, children }: BaseComponentProps<AgentSessionComponentProps>): ReactNode {
  const options = agentSessionPropsSchema.parse(props)
  const { set, getSnapshot } = useStateStore()
  const chat = useAgentChat({
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    sessionId: options.sessionId ?? null,
    ...(options.resource ? { resource: options.resource } : {}),
    ...(options.dataProviderName ? { dataProviderName: options.dataProviderName } : {}),
    ...(options.body ? { body: options.body } : {}),
  })
  const { session, loading } = chat
  const { statePath } = options

  useEffect(() => registerAgentSession(getSnapshot, statePath, session), [getSnapshot, statePath, session])

  // Every status change is written at once; streamed text at most every 50ms.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = 0
    let status = session.getSnapshot().status
    const write = (): void => {
      timer = undefined
      last = Date.now()
      const current = session.getSnapshot()
      status = current.status
      set(statePath, {
        id: current.id,
        messages: current.messages,
        status: current.status,
        error: current.error,
        streaming: current.status === 'submitted' || current.status === 'streaming',
        loading,
      })
    }
    write()
    const off = session.subscribe(() => {
      if (session.getSnapshot().status !== status || session.getSnapshot().status !== 'streaming') {
        clearTimeout(timer)
        write()
      }
      else {
        timer ??= setTimeout(write, Math.max(0, STREAM_WRITE_MS - (Date.now() - last)))
      }
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [session, statePath, set, loading])

  return children
}
