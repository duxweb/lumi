import type { AgentSuggestion } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { UseAgentConversationOptions } from '../agent-conversation.js'
import {
  LumiAgentSessionList as AgentSessionList,
  LumiChatThread as ChatThread,
  LumiPromptInput as PromptInput,
  useUiText,
} from '@duxweb/lumi-ui'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { useAgentConversation } from '../agent-conversation.js'
import { useHideShellAssistant } from '../components/ShellContext.js'
import { useShellContextPanel } from '../components/ShellContextPanel.js'

export interface LumiAgentWorkspaceProps {
  /** The chat endpoint; defaults to the configured `agent.endpoint`, then `/agent/chat`. */
  endpoint?: string
  /** The DataProvider resource of the conversations: its list fills the session list, `getOne` loads one. */
  resource?: string
  dataProviderName?: string
  /** Extra fields sent with every request, e.g. the model. */
  body?: Record<string, unknown>
  /** The query parameter that holds the open conversation, so it survives a reload and can be linked. */
  param?: string
  placeholder?: string
  emptyTitle?: string
  emptyDescription?: string
  /** Prompts offered while the conversation is empty. */
  suggestions?: AgentSuggestion[]
  /** @ references in the composer; `sources` searches one DataProvider resource per tab. */
  mentions?: UseAgentConversationOptions['mentions']
  /** Slash commands; one with a `prompt` fills the composer, others are sent as their label. */
  commands?: UseAgentConversationOptions['commands']
  ariaLabel?: string
}

const NARROW = '(width < 768px)'

/** On a narrow screen the conversations lie over the thread, so they start closed. */
function narrow(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches
}

/**
 * A full-page conversation with an agent: the conversations, the thread and
 * the composer, over one Lumi agent session. In the dual layout the
 * conversations take the shell's context column, where the module menu was;
 * elsewhere the page draws them in a column of its own.
 */
export function LumiAgentWorkspace(props: LumiAgentWorkspaceProps): ReactElement {
  const { endpoint, resource, dataProviderName, body, param = 'session', placeholder, emptyTitle, emptyDescription, suggestions, mentions, commands, ariaLabel } = props
  const { t } = useUiText()
  const [params, setParams] = useSearchParams()
  const [listOpen, setListOpen] = useState(() => !narrow())
  const column = useShellContextPanel()
  // The page is the conversation: the shell's assistant panel would only repeat it.
  useHideShellAssistant()
  const conversation = useAgentConversation({
    ...(endpoint ? { endpoint } : {}),
    ...(resource ? { resource } : {}),
    ...(dataProviderName ? { dataProviderName } : {}),
    ...(body ? { body } : {}),
    ...(mentions ? { mentions } : {}),
    ...(commands ? { commands } : {}),
    // The address keeps the open conversation, so a reload or a link opens it again.
    sessionId: params.get(param),
    onSessionChange: (id) => {
      if (narrow())
        setListOpen(false)
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (id)
          next.set(param, id)
        else next.delete(param)
        return next
      })
    },
  })
  const { chat, title } = conversation
  const sessionList = <AgentSessionList {...conversation.sessions} searchable creatable ariaLabel={t('lumi.agent.sessions', 'Chats')} />

  return (
    <div className="lumi-agent-workspace" data-slot="agent-workspace" data-agent-surface aria-label={ariaLabel} data-list={column ? 'shell' : listOpen ? 'open' : 'closed'}>
      {column ? createPortal(<div className="lumi-agent-workspace__column">{sessionList}</div>, column) : listOpen && <aside className="lumi-agent-workspace__aside">{sessionList}</aside>}
      <section className="lumi-agent-workspace__main" aria-label={title ?? t('lumi.agent.conversation', 'Conversation')} aria-busy={chat.loading || undefined}>
        {!column && (
          <header className="lumi-agent-workspace__head">
            <button type="button" className="lumi-agent-workspace__toggle" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
              {t('lumi.agent.sessions', 'Chats')}
            </button>
            {title && <span className="lumi-agent-workspace__title">{title}</span>}
          </header>
        )}
        <ChatThread
          {...conversation.thread}
          // Each conversation starts at its own end, not where the last one was scrolled.
          key={chat.id}
          className="lumi-agent-workspace__thread"
          emptyTitle={emptyTitle ?? t('lumi.agent.workspaceEmpty', 'What can I help with?')}
          {...(emptyDescription ? { emptyDescription } : {})}
        />
        <div className="lumi-agent-workspace__composer">
          <PromptInput
            {...conversation.prompt}
            placeholder={placeholder ?? t('lumi.agent.workspacePlaceholder', 'Ask anything')}
            ariaLabel={t('lumi.agent.message', 'Message')}
            {...(suggestions && !chat.messages.length ? { suggestions } : {})}
          />
        </div>
      </section>
    </div>
  )
}
