import type { AgentChat, AgentChatContextItem } from '@duxweb/lumi'
import type { AgentCommand, AgentContextItem, AgentMessage, AgentMessageCallbacks, AgentSession, AgentSuggestion, PromptMentionPickerProps } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { AdminPromptMentions } from './agent-mention.js'
import { useAgentApprovalMode, useAgentChat, useList, useLumi } from '@duxweb/lumi'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminPromptMentionPicker } from './agent-mention.js'

export interface UseAgentConversationOptions {
  /** The chat endpoint; defaults to the configured `agent.endpoint`, then `/agent/chat`. */
  endpoint?: string
  /** The DataProvider resource of the conversations: its list feeds `sessions`, `getOne` loads one. */
  resource?: string
  dataProviderName?: string
  /** Extra fields sent with every request, e.g. the model. */
  body?: Record<string, unknown>
  /** The open conversation, when the host keeps it (say in the address); leave it out to keep it here. */
  sessionId?: string | null
  /** Called with the conversation to open: one picked from the list, a new one (`null`), or a started one's id. */
  onSessionChange?: (id: string | null) => void
  /** Context sent with every message, e.g. the page being viewed. */
  context?: AgentContextItem[]
  /** Milliseconds the conversation search waits for typing to pause. */
  searchDelay?: number
  /** @ references in the composer; `sources` searches one DataProvider resource per tab. Picks go with the next message. */
  mentions?: AdminPromptMentions
  /** Slash commands in the composer. One with a `prompt` fills the box; others reach `onCommand`. */
  commands?: AgentCommand[]
  /** A command without a `prompt` was picked; without this handler its label is sent as a message. */
  onCommand?: (command: AgentCommand) => void
}

export interface AgentConversation {
  chat: AgentChat
  /** The open conversation's id, `null` for a new one not yet sent. */
  sessionId: string | null
  /** The open conversation's title, from the list. */
  title: string | undefined
  draft: string
  setDraft: (draft: string) => void
  /** Sends `text`, or the draft, with the context; the draft clears once the message is accepted. */
  send: (text?: string) => void
  open: (id: string | null) => void
  /** Starts a new conversation. */
  reset: () => void
  /** The conversations, as AgentSessionList takes them. */
  sessions: {
    sessions: AgentSession[]
    value: string | null
    query: string
    loading: boolean
    remote: true
    onQueryChange: (query: string) => void
    onChange: (id: string) => void
    onCreate: () => void
  }
  /** The messages and every reader action, as ChatThread takes them. */
  thread: Required<Pick<AgentMessageCallbacks, 'onApprove' | 'onReject' | 'onAnswer' | 'onSkip' | 'onRegenerate' | 'onEditMessage' | 'onSuggestion'>> & {
    messages: AgentMessage[]
    streaming: boolean
  }
  /** The composer, as PromptInput takes it. */
  prompt: {
    value: string
    streaming: boolean
    onChange: (value: string) => void
    onSubmit: (value: string) => void
    onStop: () => void
    onSuggestion: (suggestion: AgentSuggestion) => void
    /** What the reader referenced with @ for the next message. */
    context: AgentContextItem[]
    onContextChange: (context: AgentContextItem[]) => void
    mentions?: AdminPromptMentions
    mentionPicker?: (props: PromptMentionPickerProps) => ReactElement
    commands?: AgentCommand[]
    onCommand: (command: AgentCommand) => void
    /** Whether the agent asks before changing data, kept by the Lumi agent bridge. */
    approvalMode: 'ask' | 'auto'
    onApprovalModeChange: (mode: 'ask' | 'auto') => void
  }
}

/**
 * One conversation with an agent and the list it belongs to, ready to spread
 * onto Lumi UI's ChatThread, PromptInput and AgentSessionList. The Admin
 * AgentWorkspace and AgentPanel are drawn from it; hosts with their own
 * layout use it the same way.
 */
export function useAgentConversation(options: UseAgentConversationOptions = {}): AgentConversation {
  const { endpoint, resource = 'agent-sessions', dataProviderName, body, context, searchDelay = 250, onSessionChange, mentions, commands, onCommand } = options
  const controlled = options.sessionId !== undefined
  const [own, setOwn] = useState<string | null>(null)
  const sessionId = controlled ? options.sessionId ?? null : own
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<AgentContextItem[]>([])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [approvalMode, setApprovalMode] = useAgentApprovalMode()

  // Records the page puts into the conversation (e.g. selected table rows)
  // join what the reader picked with @, each once.
  const bridge = useLumi().agentBridge
  useEffect(() => bridge?.onReference((items) => {
    setPicked(current => [...current, ...(items as AgentContextItem[]).filter(item => !current.some(entry => entry.id === item.id))])
  }), [bridge])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), searchDelay)
    return () => clearTimeout(timer)
  }, [query, searchDelay])

  const chat = useAgentChat({
    ...(endpoint ? { endpoint } : {}),
    sessionId,
    resource,
    ...(dataProviderName ? { dataProviderName } : {}),
    ...(body ? { body } : {}),
  })
  const list = useList<AgentSession>({
    resource,
    ...(dataProviderName ? { dataProviderName } : {}),
    ...(search ? { filters: [{ field: 'q', operator: 'eq', value: search }] } : {}),
  })
  const sessions = list.data?.data ?? []

  // The latest callback, so a host passing an inline function does not re-run effects.
  const changed = useRef(onSessionChange)
  changed.current = onSessionChange
  const open = useCallback((id: string | null): void => {
    if (!controlled)
      setOwn(id)
    changed.current?.(id)
  }, [controlled])

  // A new conversation gets its id from the session; once its first reply is
  // under way that id becomes the open one. Only a reply under way counts:
  // right after a reset the previous messages still show for a moment and
  // must not bring their id back.
  const started = !sessionId && chat.streaming
  useEffect(() => {
    if (started)
      open(chat.id)
  }, [started, chat.id, open])

  const send = (text = draft): void => {
    // The page context first, then what the reader referenced, each once.
    const all = [...(context ?? []), ...picked.filter(item => !context?.some(entry => entry.id === item.id))]
    void chat.send({ text, ...(all.length ? { context: all as AgentChatContextItem[] } : {}) })
    if (chat.session.getSnapshot().status === 'submitted') {
      setDraft('')
      setPicked([])
    }
  }
  const reset = (): void => {
    open(null)
    setDraft('')
    setPicked([])
  }
  const suggest = (suggestion: AgentSuggestion): void => send(suggestion.prompt ?? suggestion.label)

  return {
    chat,
    sessionId,
    title: sessions.find(session => session.id === chat.id)?.title,
    draft,
    setDraft,
    send,
    open,
    reset,
    sessions: {
      sessions,
      value: sessionId,
      query,
      loading: list.isFetching,
      remote: true,
      onQueryChange: setQuery,
      onChange: id => open(id),
      onCreate: reset,
    },
    thread: {
      messages: chat.messages as AgentMessage[],
      streaming: chat.streaming,
      onApprove: (_message, id) => void chat.approve(id, true),
      onReject: (_message, id) => void chat.approve(id, false),
      onAnswer: (_message, id, answer) => void chat.answer(id, answer),
      onSkip: (_message, id) => void chat.skip(id),
      onRegenerate: () => void chat.retry(),
      onEditMessage: (id, text) => void chat.edit(id, text),
      onSuggestion: suggest,
    },
    prompt: {
      value: draft,
      streaming: chat.streaming,
      onChange: setDraft,
      onSubmit: text => send(text),
      onStop: chat.stop,
      onSuggestion: suggest,
      context: picked,
      onContextChange: setPicked,
      ...(mentions ? { mentions, mentionPicker: AdminPromptMentionPicker } : {}),
      ...(commands?.length ? { commands } : {}),
      onCommand: command => (onCommand ? onCommand(command) : send(command.label)),
      approvalMode,
      onApprovalModeChange: setApprovalMode,
    },
  }
}
