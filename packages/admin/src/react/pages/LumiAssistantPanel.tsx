import type { AgentAttachment, AgentContextItem, AgentMessage, LumiChatThreadProps, LumiPromptInputProps } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode, Ref } from 'react'
import { LumiChatThread as ChatThread, LumiContextChips as ContextChips, LumiEmpty as Empty, LumiPromptInput as PromptInput, useUiText } from '@duxweb/lumi-ui'
import { useMemo } from 'react'
import { ShellIcon } from '../components/ShellIcon.js'

/**
 * One message of the conversation: the agent message contract (`parts` with
 * text, reasoning, tool calls, approvals, plans, diffs and sources) plus an
 * optional host-rendered `content` shown after the parts.
 */
export interface LumiAssistantMessage extends Omit<AgentMessage, 'id' | 'parts'> {
  id: string | number
  parts?: AgentMessage['parts']
  content?: ReactNode
}

export interface LumiAssistantPanelProps {
  title?: string
  /** The mode label beside the title, or the chosen model when `models` is given. */
  model?: string
  /** Shows a model picker in the composer. */
  models?: readonly { label: string, value: string, description?: string }[]
  onModelChange?: (model: string) => void
  messages: readonly LumiAssistantMessage[]
  /** A reply is on its way: the composer's send button becomes stop. */
  streaming?: boolean
  onStop?: () => void
  /** What the user is looking at, and whether the panel may read it. */
  context?: { label: string, shared: boolean, onSharedChange: (shared: boolean) => void }
  /** Pages or records referenced in the next message, shown as removable chips. */
  references?: readonly AgentContextItem[]
  onReferencesChange?: (references: AgentContextItem[]) => void
  attachments?: readonly AgentAttachment[]
  onAttachmentsChange?: (attachments: AgentAttachment[]) => void
  suggestions?: readonly { key: string, label: string, icon?: string }[]
  onSuggestion?: (key: string) => void
  draft: string
  onDraftChange: (value: string) => void
  onSend: (text: string) => void
  placeholder?: string
  composerRef?: Ref<HTMLTextAreaElement>
  /** Shows the attach button; receives the picked files. */
  onAttach?: (files: File[]) => void
  /** Shows the mention button, e.g. to reference the current page. */
  onMention?: () => void
  /** The composer's @ picker and slash commands, as PromptInput takes them. */
  composer?: Pick<LumiPromptInputProps, 'mentions' | 'mentionPicker' | 'commands' | 'onCommand' | 'approvalMode' | 'onApprovalModeChange'>
  /** Header commands; each button appears only when its handler is given. */
  onNew?: () => void
  onClose?: () => void
  /** Earlier conversations. The header toggles it when `onToggle` is given. */
  history?: { open: boolean, onToggle: () => void, items: readonly { key: string, label: string, onSelect: () => void }[], emptyLabel?: string }
  /** Message actions, citations and approval decisions, as ChatThread takes them. */
  thread?: Omit<LumiChatThreadProps, 'messages' | 'streaming'>
}

function IconButton({ icon, label, onClick }: { icon: string, label: string, onClick?: () => void }): ReactElement {
  return (
    <button type="button" className="lumi-assistant__icon-button" aria-label={label} title={label} onClick={onClick}>
      <ShellIcon name={icon} />
    </button>
  )
}

/**
 * Generic assistant panel for the Shell `assistant` slot, composed from the
 * Lumi UI agent components: context chips, a chat thread and a prompt input.
 * The host owns the conversation, the model and which registered actions an
 * approval runs.
 */
export function LumiAssistantPanel(props: LumiAssistantPanelProps): ReactElement {
  const { t } = useUiText()
  const { title = t('lumi.assistant.title', 'Assistant'), model, models, onModelChange, messages, streaming, onStop, context, references, onReferencesChange, attachments, onAttachmentsChange, suggestions, onSuggestion, draft, onDraftChange, onSend, placeholder, composerRef, onAttach, onMention, composer, onNew, onClose, history, thread } = props
  const { data, content } = useMemo(() => {
    const bodies = new Map<string, ReactNode>()
    const list: AgentMessage[] = messages.map(({ id, parts, content: body, ...message }) => {
      if (body !== undefined)
        bodies.set(String(id), body)
      return { ...message, id: String(id), parts: parts ?? [] }
    })
    return { data: list, content: bodies }
  }, [messages])
  return (
    <div className="lumi-assistant" data-agent-surface>
      <header className="lumi-assistant__header">
        <strong>{title}</strong>
        {model && !models?.length && <span className="lumi-assistant__model">{model}</span>}
        <span className="lumi-assistant__spacer" />
        {history && <IconButton icon="clock" label={t('lumi.assistant.history', 'Conversation history')} onClick={history.onToggle} />}
        {onNew && <IconButton icon="plus" label={t('lumi.assistant.new', 'New conversation')} onClick={onNew} />}
        {onClose && <IconButton icon="x" label={t('lumi.assistant.close', 'Close assistant')} onClick={onClose} />}
      </header>
      {context && (
        <ContextChips className="lumi-assistant__context" data-testid="assistant-context" viewing={context.label} shared={context.shared} onSharedChange={context.onSharedChange} />
      )}
      {history?.open
        ? (
            <ul className="lumi-assistant__history" aria-label={t('lumi.assistant.history', 'Conversation history')}>
              {history.items.length
                ? history.items.map(item => (
                    <li key={item.key}>
                      <button type="button" onClick={item.onSelect}>
                        <ShellIcon name="clock" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))
                : <li><Empty size="sm" icon={<ShellIcon name="clock" />} title={history.emptyLabel ?? t('lumi.assistant.noHistory', 'No earlier conversations.')} /></li>}
            </ul>
          )
        : (
            <ChatThread
              {...thread}
              className="lumi-assistant__thread"
              messages={data}
              streaming={streaming}
              ariaLabel={t('lumi.assistant.conversation', 'Conversation')}
              emptyTitle={thread?.emptyTitle ?? t('lumi.assistant.emptyTitle', 'How can I help?')}
              emptyDescription={thread?.emptyDescription ?? t('lumi.assistant.emptyDescription', 'Ask about this page, or start from a suggestion below.')}
              renderContent={message => content.get(message.id) ?? thread?.renderContent?.(message)}
            />
          )}
      <div className="lumi-assistant__dock">
        <PromptInput
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSend}
          placeholder={placeholder}
          ariaLabel={t('lumi.assistant.message', 'Message')}
          textareaRef={composerRef}
          streaming={streaming}
          onStop={onStop}
          attachments={attachments ? [...attachments] : undefined}
          onAttachmentsChange={onAttachmentsChange}
          context={references ? [...references] : undefined}
          onContextChange={onReferencesChange}
          models={models ? [...models] : undefined}
          model={models?.length ? model : undefined}
          onModelChange={onModelChange}
          onAttach={onAttach}
          onMention={onMention}
          suggestions={suggestions?.map(item => ({ id: item.key, label: item.label, icon: item.icon }))}
          onSuggestion={onSuggestion ? suggestion => onSuggestion(suggestion.id ?? suggestion.label) : undefined}
          maxRows={6}
          {...composer}
        />
      </div>
    </div>
  )
}
