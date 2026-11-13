import type { AgentContextItem } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { UseAgentConversationOptions } from '../agent-conversation.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useAgentConversation } from '../agent-conversation.js'
import { useAssistantContextItems } from '../assistant-context.js'
import { useShell } from '../components/ShellContext.js'
import { useShellText } from '../components/ShellParts.js'
import { LumiAssistantPanel } from './LumiAssistantPanel.js'

export interface LumiAgentPanelProps extends Pick<UseAgentConversationOptions, 'endpoint' | 'resource' | 'dataProviderName' | 'body' | 'mentions' | 'commands' | 'onCommand'> {
  title?: string
  placeholder?: string
  /** Prompts offered while the conversation is empty; `prompt` is the text sent, the label by default. */
  suggestions?: readonly { key: string, label: string, prompt?: string, icon?: string }[]
  /** Whether the page being viewed is shared with the agent before the reader changes it; defaults to true. */
  shareContext?: boolean
}

/**
 * The Shell's assistant panel connected to an agent endpoint: the open
 * conversation, earlier ones under the history button, and the composer. The
 * page being viewed goes with each message as context while it is shared.
 * Put it in the `assistant` slot of mountAdmin or createAdmin.
 */
export function LumiAgentPanel(props: LumiAgentPanelProps): ReactElement {
  const { title, placeholder, suggestions, shareContext = true, ...service } = props
  const shell = useShell()
  const text = useShellText()
  const { pathname } = useLocation()
  const [shared, setShared] = useState(shareContext)
  const [historyOpen, setHistoryOpen] = useState(false)
  const label = shell.active.item ? text(shell.active.item.label) : shell.app.title
  const context = useMemo<AgentContextItem[]>(() => (shared ? [{ id: `page:${pathname}`, label, kind: 'page' }] : []), [shared, pathname, label])
  const conversation = useAgentConversation({ ...service, context })
  const { chat, sessions, thread, prompt } = conversation
  // What pages registered with useAssistantContext joins the references as
  // removable chips: new items are added once, and items whose page let go
  // of them leave again unless the reader picked them too.
  const registered = useAssistantContextItems()
  const offered = useRef(new Set<string>())
  const latest = useRef(prompt)
  latest.current = prompt
  useEffect(() => {
    const { context: picked, onContextChange } = latest.current
    const ids = new Set(registered.map(item => item.id))
    const kept = picked.filter(item => ids.has(item.id) || !offered.current.has(item.id))
    const added = registered.filter(item => !offered.current.has(item.id) && !kept.some(entry => entry.id === item.id))
    for (const id of offered.current) {
      if (!ids.has(id))
        offered.current.delete(id)
    }
    for (const item of added)
      offered.current.add(item.id)
    if (added.length || kept.length !== picked.length)
      onContextChange([...kept, ...added])
  }, [registered])
  // Sending or starting over clears the picked references; what pages still
  // register is offered again for the next message.
  const offerAgain = (): void => {
    offered.current = new Set(registered.map(item => item.id))
    if (registered.length)
      prompt.onContextChange([...registered])
  }

  return (
    <LumiAssistantPanel
      {...(title ? { title } : {})}
      {...(placeholder ? { placeholder } : {})}
      messages={thread.messages}
      streaming={chat.streaming}
      onStop={prompt.onStop}
      draft={conversation.draft}
      onDraftChange={conversation.setDraft}
      onSend={(text) => {
        conversation.send(text)
        // A message that was not accepted keeps its references.
        if (chat.session.getSnapshot().status === 'submitted')
          offerAgain()
      }}
      references={prompt.context}
      onReferencesChange={prompt.onContextChange}
      composer={{
        ...(prompt.mentions ? { mentions: prompt.mentions, mentionPicker: prompt.mentionPicker } : {}),
        ...(prompt.commands ? { commands: prompt.commands } : {}),
        onCommand: prompt.onCommand,
        approvalMode: prompt.approvalMode,
        onApprovalModeChange: prompt.onApprovalModeChange,
      }}
      context={{ label, shared, onSharedChange: setShared }}
      {...(suggestions && !chat.messages.length
        ? { suggestions, onSuggestion: (key: string) => {
            const item = suggestions.find(entry => entry.key === key)
            conversation.send(item?.prompt ?? item?.label ?? key)
            if (chat.session.getSnapshot().status === 'submitted')
              offerAgain()
          } }
        : {})}
      onNew={() => {
        setHistoryOpen(false)
        conversation.reset()
        offerAgain()
      }}
      onClose={shell.assistant.toggle}
      history={{
        open: historyOpen,
        onToggle: () => setHistoryOpen(!historyOpen),
        items: sessions.sessions.map(session => ({
          key: session.id,
          label: session.title,
          onSelect: () => {
            setHistoryOpen(false)
            conversation.open(session.id)
          },
        })),
      }}
      thread={{
        onApprove: thread.onApprove,
        onReject: thread.onReject,
        onAnswer: thread.onAnswer,
        onSkip: thread.onSkip,
        onRegenerate: thread.onRegenerate,
        onEditMessage: thread.onEditMessage,
        onSuggestion: thread.onSuggestion,
      }}
    />
  )
}
