import type { z } from 'zod'
import type {
  agentApprovalFieldSchema,
  agentApprovalItemSchema,
  agentApprovalLineSchema,
  agentApprovalPartSchema,
  agentAttachmentSchema,
  agentCommandSchema,
  agentContextItemSchema,
  agentContextPartSchema,
  agentDefinitions,
  agentDiffPartSchema,
  agentEventSchema,
  agentFieldChangeSchema,
  agentFilePartSchema,
  agentMentionOptionSchema,
  agentMentionTypeSchema,
  agentMessagePartSchema,
  agentMessageSchema,
  agentPlanPartSchema,
  agentPlanStepSchema,
  agentPromptMentionsSchema,
  agentQuestionOptionSchema,
  agentQuestionPartSchema,
  agentReasoningPartSchema,
  agentSessionSchema,
  agentSourcePartSchema,
  agentSuggestionSchema,
  agentTextPartSchema,
  agentThinkingStepSchema,
  agentToolCallPartSchema,
} from './agent.js'

type Definitions = typeof agentDefinitions

export type AgentMessage = z.infer<typeof agentMessageSchema>
export type AgentMessagePart = z.infer<typeof agentMessagePartSchema>
export type AgentTextPart = z.infer<typeof agentTextPartSchema>
export type AgentReasoningPart = z.infer<typeof agentReasoningPartSchema>
export type AgentToolCallPart = z.infer<typeof agentToolCallPartSchema>
export type AgentApprovalPart = z.infer<typeof agentApprovalPartSchema>
export type AgentPlanPart = z.infer<typeof agentPlanPartSchema>
export type AgentQuestionPart = z.infer<typeof agentQuestionPartSchema>
export type AgentQuestionOption = z.infer<typeof agentQuestionOptionSchema>
export type AgentQuestionStatus = AgentQuestionPart['status']
export type AgentQuestionAnswer = string | string[]
export type AgentApprovalField = z.infer<typeof agentApprovalFieldSchema>
export type AgentApprovalLine = z.infer<typeof agentApprovalLineSchema>
export type AgentDiffPart = z.infer<typeof agentDiffPartSchema>
export type AgentSourcePart = z.infer<typeof agentSourcePartSchema>
export type AgentFilePart = z.infer<typeof agentFilePartSchema>
export type AgentContextPart = z.infer<typeof agentContextPartSchema>
export type AgentThinkingStep = z.infer<typeof agentThinkingStepSchema>
export type AgentContextItem = z.infer<typeof agentContextItemSchema>
export type AgentAttachment = z.infer<typeof agentAttachmentSchema>
export type AgentSuggestion = z.infer<typeof agentSuggestionSchema>
export type AgentApprovalItem = z.infer<typeof agentApprovalItemSchema>
export type AgentPlanStep = z.infer<typeof agentPlanStepSchema>
export type AgentFieldChange = z.infer<typeof agentFieldChangeSchema>
export type AgentEvent = z.infer<typeof agentEventSchema>
export type AgentToolStatus = AgentToolCallPart['status']
export type AgentApprovalStatus = AgentApprovalPart['status']
export type AgentPlanStatus = AgentPlanStep['status']
export type AgentFeedback = 'up' | 'down' | null
export type AgentMessageAction = 'copy' | 'regenerate' | 'feedback'

export type PromptInputProps = z.input<Definitions['PromptInput']['props']> & {
  onChange?: ((value: string) => void) | undefined
  /** Enter or the send button with non-empty text. */
  onSubmit?: ((value: string) => void) | undefined
  onStop?: (() => void) | undefined
  /** Without it the attach button is hidden; receives the picked files. */
  onAttach?: ((files: File[]) => void) | undefined
  onMention?: (() => void) | undefined
  onAttachmentsChange?: ((attachments: AgentAttachment[]) => void) | undefined
  onContextChange?: ((context: AgentContextItem[]) => void) | undefined
  onModelChange?: ((model: string) => void) | undefined
  /** Without it a suggestion fills the box. */
  onSuggestion?: ((suggestion: AgentSuggestion) => void) | undefined
  /** A slash command without a `prompt` was picked. */
  onCommand?: ((command: AgentCommand) => void) | undefined
  onApprovalModeChange?: ((mode: 'ask' | 'auto') => void) | undefined
}

export type MessageActionsProps = z.input<Definitions['MessageActions']['props']> & {
  onCopy?: (() => void) | undefined
  onRegenerate?: (() => void) | undefined
  onFeedbackChange?: ((feedback: AgentFeedback) => void) | undefined
}

export type ThinkingProps = z.input<Definitions['Thinking']['props']> & {
  onOpenChange?: ((open: boolean) => void) | undefined
}

export type ToolCallProps = z.input<Definitions['ToolCall']['props']>

export type ApprovalProps = z.input<Definitions['Approval']['props']> & {
  onSelectedChange?: ((selected: string[]) => void) | undefined
  /** Receives the included item ids. */
  onApprove?: ((selected: string[]) => void) | undefined
  onReject?: (() => void) | undefined
  onEdit?: (() => void) | undefined
}

export type AgentPlanProps = z.input<Definitions['AgentPlan']['props']>

export type AgentQuestionProps = z.input<Definitions['AgentQuestion']['props']> & {
  onAnswer?: ((answer: AgentQuestionAnswer) => void) | undefined
  onSkip?: (() => void) | undefined
}

export type ChangeDiffProps = z.input<Definitions['ChangeDiff']['props']>

export type ContextChipsProps = z.input<Definitions['ContextChips']['props']> & {
  onSharedChange?: ((shared: boolean) => void) | undefined
  /** Shows the remove buttons; receives the item removed. */
  onRemove?: ((item: AgentContextItem) => void) | undefined
}

/** Callbacks a message hands to its parts, keyed by the message they belong to. */
export interface AgentMessageCallbacks {
  onCopy?: ((messageId: string, text: string) => void) | undefined
  onRegenerate?: ((messageId: string) => void) | undefined
  onFeedback?: ((messageId: string, feedback: AgentFeedback) => void) | undefined
  onSuggestion?: ((suggestion: AgentSuggestion, messageId: string) => void) | undefined
  onOpenSource?: ((source: AgentSourcePart, messageId: string) => void) | undefined
  onApprovalSelect?: ((messageId: string, approvalId: string, selected: string[]) => void) | undefined
  onApprove?: ((messageId: string, approvalId: string, selected: string[]) => void) | undefined
  onReject?: ((messageId: string, approvalId: string) => void) | undefined
  onApprovalEdit?: ((messageId: string, approvalId: string) => void) | undefined
  onAnswer?: ((messageId: string, questionId: string, answer: AgentQuestionAnswer) => void) | undefined
  onSkip?: ((messageId: string, questionId: string) => void) | undefined
  /** Edit a user message; the host decides what editing means, e.g. refill the prompt. */
  onEditMessage?: ((messageId: string, text: string) => void) | undefined
}

export type AgentSession = z.infer<typeof agentSessionSchema>
export type AgentSessionStatus = AgentSession['status']
export type AgentMentionType = z.infer<typeof agentMentionTypeSchema>
export type AgentMentionOption = z.infer<typeof agentMentionOptionSchema>
export type AgentPromptMentions = z.infer<typeof agentPromptMentionsSchema>
export type AgentCommand = z.infer<typeof agentCommandSchema>

export type AgentMentionPickerProps = z.input<Definitions['AgentMentionPicker']['props']> & {
  onTypeChange?: ((type: string) => void) | undefined
  onQueryChange?: ((query: string) => void) | undefined
  onChange?: ((value: AgentContextItem[]) => void) | undefined
  /** A pick, with the item it added or removed. */
  onSelect?: ((item: AgentContextItem, picked: boolean) => void) | undefined
  /** Asked when the list is scrolled to its end while `hasMore`. */
  onLoadMore?: (() => void) | undefined
}

export type AgentSessionListProps = z.input<Definitions['AgentSessionList']['props']> & {
  onChange?: ((id: string, session: AgentSession) => void) | undefined
  onQueryChange?: ((query: string) => void) | undefined
  onCreate?: (() => void) | undefined
  onLoadMore?: (() => void) | undefined
}

export type ChatMessageProps = Omit<z.input<Definitions['ChatMessage']['props']>, 'activeEvent'> & AgentMessageCallbacks

export type ChatThreadProps = Omit<z.input<Definitions['ChatThread']['props']>, 'activeEvent'> & AgentMessageCallbacks
