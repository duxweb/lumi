import type { BaseComponentProps } from '@json-render/react'
import type { ReactElement } from 'react'
import type {
  AgentEvent,
  AgentFeedback,
  AgentMentionPickerProps,
  AgentMessage,
  AgentMessagePart,
  AgentQuestionProps,
  AgentSessionListProps,
  ApprovalProps,
  ChatMessageProps,
  ChatThreadProps,
  ContextChipsProps,
  MessageActionsProps,
  PromptInputProps,
  ThinkingProps,
} from '../catalog/types-public.js'
import type { LumiPromptInputProps } from '../components/agent/prompt-input.js'
import { useBoundProp } from '@json-render/react'
import { useState } from 'react'
import { LumiAgentPlan } from '../components/agent/agent-plan.js'
import { LumiApproval } from '../components/agent/approval.js'
import { LumiChangeDiff } from '../components/agent/change-diff.js'
import { LumiChatMessage, LumiChatThread, LumiMessageActions } from '../components/agent/chat.js'
import { LumiContextChips } from '../components/agent/context-chips.js'
import { LumiAgentMentionPicker } from '../components/agent/mention-picker.js'
import { LumiPromptInput } from '../components/agent/prompt-input.js'
import { LumiAgentQuestion } from '../components/agent/question.js'
import { LumiAgentSessionList } from '../components/agent/session-list.js'
import { LumiThinking } from '../components/agent/thinking.js'
import { LumiToolCall } from '../components/agent/tool-call.js'

type Context<P> = BaseComponentProps<P>

/**
 * A bound prop writes through to the StateStore. An unbound one follows the
 * Spec until the reader changes it, then keeps that change locally. Exported
 * for registries that wrap these components (Admin's remote @ picker).
 */
export function useBoundOrLocal<T>(value: T | undefined, binding: string | undefined): [T | undefined, (next: T) => void] {
  const [bound, setBound] = useBoundProp(value, binding)
  const [local, setLocal] = useState<{ value: T }>()
  return binding ? [bound, setBound] : [local ? local.value : value, next => setLocal({ value: next })]
}

function useEventSink(props: { activeEvent?: unknown }, bindings: Record<string, string> | undefined, emit: (event: string) => void): (name: string, event: AgentEvent) => void {
  const [, setEvent] = useBoundProp(props.activeEvent, bindings?.activeEvent)
  return (name, event) => {
    setEvent(event)
    emit(name)
  }
}

/**
 * The PromptInput registry body. A host whose @ picker searches a backend
 * passes it here, e.g. Admin's resource-backed picker for `mentions.sources`.
 */
export function connectPromptInput(mentionPicker?: LumiPromptInputProps['mentionPicker']): (context: Context<PromptInputProps>) => ReactElement {
  return function PromptInputBody(context: Context<PromptInputProps>): ReactElement {
    return <ConnectedPromptInput {...context} mentionPicker={mentionPicker} />
  }
}

function ConnectedPromptInput({ props, bindings, emit, mentionPicker }: Context<PromptInputProps> & { mentionPicker?: LumiPromptInputProps['mentionPicker'] }): ReactElement {
  // Unbound, the text is kept here, so a suggestion can fill it and a sent
  // message clears it, as a bound value does through its state.
  const [value, setValue] = useBoundOrLocal(props.value ?? '', bindings?.value)
  const bound = bindings?.value !== undefined
  const [, setCommand] = useBoundProp(props.command, bindings?.command)
  const [attachments, setAttachments] = useBoundOrLocal(props.attachments, bindings?.attachments)
  const [context, setContext] = useBoundOrLocal(props.context, bindings?.context)
  const [model, setModel] = useBoundOrLocal(props.model, bindings?.model)
  const [approvalMode, setApprovalMode] = useBoundOrLocal(props.approvalMode, bindings?.approvalMode)
  const write = (next: string): void => {
    setValue(next)
    emit('change')
  }
  return (
    <LumiPromptInput
      {...props}
      value={value ?? ''}
      attachments={attachments}
      context={context}
      model={model}
      {...(approvalMode ? { approvalMode, onApprovalModeChange: setApprovalMode } : {})}
      onChange={write}
      onSubmit={() => {
        emit('submit')
        if (!bound)
          setValue('')
      }}
      onStop={() => emit('stop')}
      onAttachClick={props.attachable ? () => emit('attach') : undefined}
      onMention={props.mentionable ? () => emit('mention') : undefined}
      onAttachmentsChange={setAttachments}
      onContextChange={setContext}
      onModelChange={setModel}
      {...(mentionPicker ? { mentionPicker } : {})}
      onCommand={(command) => {
        setCommand(command.value)
        emit('command')
      }}
      onSuggestion={(suggestion) => {
        setValue(suggestion.prompt ?? suggestion.label)
        emit('suggestion')
      }}
    />
  )
}

function ChatMessageBody({ props, bindings, emit }: Context<ChatMessageProps & { activeEvent?: unknown }>): ReactElement {
  const [feedback, setFeedback] = useBoundOrLocal<AgentFeedback>(props.feedback ?? null, bindings?.feedback)
  const fire = useEventSink(props, bindings, emit)
  const { activeEvent: _event, ...rest } = props
  return (
    <LumiChatMessage
      {...rest}
      parts={props.parts ?? []}
      feedback={feedback ?? null}
      onCopy={(messageId, text) => fire('copy', { type: 'copy', messageId, value: text })}
      onRegenerate={messageId => fire('regenerate', { type: 'regenerate', messageId })}
      onFeedback={(messageId, value) => {
        setFeedback(value)
        fire('feedback', { type: 'feedback', messageId, value })
      }}
      onSuggestion={(suggestion, messageId) => fire('suggestion', { type: 'suggestion', messageId, partId: suggestion.id, value: suggestion.prompt ?? suggestion.label })}
      onOpenSource={(source, messageId) => fire('openSource', { type: 'openSource', messageId, partId: source.sourceId, value: source.url })}
      onApprove={(messageId, approvalId, selected) => fire('approve', { type: 'approve', messageId, partId: approvalId, value: selected })}
      onReject={(messageId, approvalId) => fire('reject', { type: 'reject', messageId, partId: approvalId })}
      onAnswer={(messageId, questionId, answer) => fire('answer', { type: 'answer', messageId, partId: questionId, value: answer })}
      onSkip={(messageId, questionId) => fire('skip', { type: 'skip', messageId, partId: questionId })}
      onEditMessage={(messageId, text) => fire('edit', { type: 'edit', messageId, value: text })}
    />
  )
}

function MessageActionsBody({ props, bindings, emit }: Context<MessageActionsProps>): ReactElement {
  const [feedback, setFeedback] = useBoundOrLocal<AgentFeedback>(props.feedback ?? null, bindings?.feedback)
  return (
    <LumiMessageActions
      {...props}
      feedback={feedback ?? null}
      onCopy={() => emit('copy')}
      onRegenerate={() => emit('regenerate')}
      onFeedbackChange={(value) => {
        setFeedback(value)
        emit('feedback')
      }}
    />
  )
}

function ThinkingBody({ props, bindings, emit }: Context<ThinkingProps>): ReactElement {
  const [open, setOpen] = useBoundProp(props.open, bindings?.open)
  return (
    <LumiThinking
      {...props}
      open={open ?? undefined}
      onOpenChange={(next) => {
        setOpen(next)
        emit('openChange')
      }}
    />
  )
}

function ApprovalBody({ props, bindings, emit }: Context<ApprovalProps>): ReactElement {
  const [status, setStatus] = useBoundOrLocal(props.status, bindings?.status)
  const [selected, setSelected] = useBoundOrLocal(props.selected, bindings?.selected)
  return (
    <LumiApproval
      {...props}
      status={status ?? 'pending'}
      selected={selected}
      onSelectedChange={(next) => {
        setSelected(next)
        emit('change')
      }}
      onApprove={(next) => {
        setSelected(next)
        setStatus('approved')
        emit('approve')
      }}
      onReject={() => {
        setStatus('rejected')
        emit('reject')
      }}
      onEdit={props.editable ? () => emit('edit') : undefined}
    />
  )
}

function AgentQuestionBody({ props, bindings, emit }: Context<AgentQuestionProps>): ReactElement {
  const [status, setStatus] = useBoundOrLocal(props.status, bindings?.status)
  const [answer, setAnswer] = useBoundOrLocal(props.answer, bindings?.answer)
  return (
    <LumiAgentQuestion
      {...props}
      status={status ?? 'pending'}
      answer={answer}
      onAnswer={(next) => {
        setAnswer(next)
        setStatus('answered')
        emit('answer')
      }}
      onSkip={props.skippable
        ? () => {
            setStatus('skipped')
            emit('skip')
          }
        : undefined}
    />
  )
}

/**
 * The @ picker under native json-render: the tab, the search text and the picks
 * write through to bound state. Hosts that search remotely wrap the plain
 * component instead and pass `remote`, `options` and `hasMore` themselves.
 */
function AgentMentionPickerBody({ props, bindings, emit }: Context<AgentMentionPickerProps>): ReactElement {
  const [type, setType] = useBoundOrLocal(props.type, bindings?.type)
  const [query, setQuery] = useBoundOrLocal(props.query, bindings?.query)
  const [value, setValue] = useBoundOrLocal(props.value, bindings?.value)
  return (
    <LumiAgentMentionPicker
      {...props}
      type={type}
      query={query ?? ''}
      value={value ?? []}
      onTypeChange={setType}
      onQueryChange={(next) => {
        setQuery(next)
        emit('search')
      }}
      onChange={(next) => {
        setValue(next)
        emit('change')
      }}
      onSelect={() => emit('select')}
    />
  )
}

function AgentSessionListBody({ props, bindings, emit }: Context<AgentSessionListProps>): ReactElement {
  const [value, setValue] = useBoundOrLocal(props.value, bindings?.value)
  const [query, setQuery] = useBoundOrLocal(props.query, bindings?.query)
  return (
    <LumiAgentSessionList
      {...props}
      value={value}
      query={query ?? ''}
      onChange={(id) => {
        setValue(id)
        emit('change')
      }}
      onQueryChange={(next) => {
        setQuery(next)
        emit('search')
      }}
      onCreate={() => emit('create')}
      onLoadMore={() => emit('loadMore')}
    />
  )
}

function ContextChipsBody({ props, bindings, emit }: Context<ContextChipsProps>): ReactElement {
  const [shared, setShared] = useBoundOrLocal(props.shared, bindings?.shared)
  const [items, setItems] = useBoundOrLocal(props.items, bindings?.items)
  return (
    <LumiContextChips
      {...props}
      shared={shared}
      items={items}
      onSharedChange={(next) => {
        setShared(next)
        emit('change')
      }}
      onRemove={(item) => {
        setItems((items ?? []).filter(entry => entry.id !== item.id))
        emit('remove')
      }}
    />
  )
}

function ChatThreadBody({ props, bindings, emit }: Context<ChatThreadProps & { activeEvent?: unknown }>): ReactElement {
  // Ratings and decisions are kept in the messages only when they are bound;
  // a `$state` read stays the page's to update.
  const [messages, setMessages] = useBoundProp<AgentMessage[]>(props.messages, bindings?.messages)
  const fire = useEventSink(props, bindings, emit)
  const list = messages ?? []
  const { activeEvent: _event, ...rest } = props
  const patch = (messageId: string, change: (message: AgentMessage) => AgentMessage): void => {
    setMessages(list.map(message => (message.id === messageId ? change(message) : message)))
  }
  const patchApproval = (messageId: string, approvalId: string, change: (part: Extract<AgentMessagePart, { type: 'approval' }>) => AgentMessagePart): void => {
    patch(messageId, message => ({ ...message, parts: message.parts.map(part => (part.type === 'approval' && part.id === approvalId ? change(part) : part)) }))
  }
  const patchQuestion = (messageId: string, questionId: string, change: (part: Extract<AgentMessagePart, { type: 'question' }>) => AgentMessagePart): void => {
    patch(messageId, message => ({ ...message, parts: message.parts.map(part => (part.type === 'question' && part.id === questionId ? change(part) : part)) }))
  }
  const choose = (selected: string[]) => (part: Extract<AgentMessagePart, { type: 'approval' }>) => ({ ...part, items: part.items?.map(item => ({ ...item, selected: selected.includes(item.id) })) })
  return (
    <LumiChatThread
      {...rest}
      messages={list}
      onCopy={(messageId, text) => fire('copy', { type: 'copy', messageId, value: text })}
      onRegenerate={messageId => fire('regenerate', { type: 'regenerate', messageId })}
      onFeedback={(messageId, value) => {
        patch(messageId, message => ({ ...message, feedback: value }))
        fire('feedback', { type: 'feedback', messageId, value })
      }}
      onSuggestion={(suggestion, messageId) => fire('suggestion', { type: 'suggestion', messageId, partId: suggestion.id, value: suggestion.prompt ?? suggestion.label })}
      onOpenSource={(source, messageId) => fire('openSource', { type: 'openSource', messageId, partId: source.sourceId, value: source.url })}
      onApprovalSelect={bindings?.messages ? (messageId, approvalId, selected) => patchApproval(messageId, approvalId, choose(selected)) : undefined}
      onApprove={(messageId, approvalId, selected) => {
        patchApproval(messageId, approvalId, part => ({ ...choose(selected)(part), status: 'approved' }))
        fire('approve', { type: 'approve', messageId, partId: approvalId, value: selected })
      }}
      onReject={(messageId, approvalId) => {
        patchApproval(messageId, approvalId, part => ({ ...part, status: 'rejected' }))
        fire('reject', { type: 'reject', messageId, partId: approvalId })
      }}
      onApprovalEdit={(messageId, approvalId) => fire('edit', { type: 'edit', messageId, partId: approvalId })}
      onAnswer={(messageId, questionId, answer) => {
        patchQuestion(messageId, questionId, part => ({ ...part, status: 'answered', answer }))
        fire('answer', { type: 'answer', messageId, partId: questionId, value: answer })
      }}
      onSkip={(messageId, questionId) => {
        patchQuestion(messageId, questionId, part => ({ ...part, status: 'skipped' }))
        fire('skip', { type: 'skip', messageId, partId: questionId })
      }}
      onEditMessage={(messageId, text) => fire('edit', { type: 'edit', messageId, value: text })}
    />
  )
}

/** Registry bodies for the agent components, spread into the UI registry. */
export const agentRegistryComponents = {
  PromptInput: connectPromptInput(),
  ChatMessage: ChatMessageBody,
  MessageActions: MessageActionsBody,
  Thinking: ThinkingBody,
  ToolCall: ({ props }: Context<Parameters<typeof LumiToolCall>[0]>) => <LumiToolCall {...props} />,
  Approval: ApprovalBody,
  AgentQuestion: AgentQuestionBody,
  AgentMentionPicker: AgentMentionPickerBody,
  AgentSessionList: AgentSessionListBody,
  AgentPlan: ({ props }: Context<Parameters<typeof LumiAgentPlan>[0]>) => <LumiAgentPlan {...props} />,
  ChangeDiff: ({ props }: Context<Parameters<typeof LumiChangeDiff>[0]>) => <LumiChangeDiff {...props} />,
  ContextChips: ContextChipsBody,
  ChatThread: ChatThreadBody,
}
