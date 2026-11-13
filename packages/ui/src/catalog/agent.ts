import { z } from 'zod'

// The agent message contract: what a backend sends for a conversation turn.
// Part names follow the Vercel AI SDK `UIMessage` where they mean the same
// thing (`text`/`reasoning` with `state`, `toolCallId`, `input`, `output`,
// `errorText`, `sourceId`, `mediaType`), so a backend that already emits that
// shape converts with a small mapping. It stays Lumi's own documented format.

const host = {
  'className': z.string().optional(),
  'data-testid': z.string().optional(),
  'aria-label': z.string().optional(),
}

const streamState = z.enum(['streaming', 'done'])
/** A value shown in a diff: text, a number, a yes/no or nothing. */
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const AGENT_TOOL_STATUSES = ['pending', 'running', 'success', 'error'] as const
/** `running` while the approved action is in flight (buttons locked); `failed` when it did not complete (the card stays open with `reason` and can be approved again). */
export const AGENT_APPROVAL_STATUSES = ['pending', 'running', 'approved', 'rejected', 'expired', 'failed'] as const
export const AGENT_QUESTION_STATUSES = ['pending', 'answered', 'skipped'] as const
export const AGENT_PLAN_STATUSES = ['pending', 'running', 'done', 'failed', 'skipped'] as const
export const AGENT_MESSAGE_ACTIONS = ['copy', 'regenerate', 'feedback'] as const

export const agentThinkingStepSchema = z.strictObject({
  id: z.string().optional(),
  label: z.string(),
  detail: z.string().optional(),
  /** A HugeIcons name for what the step did, e.g. `search` or `database-01`. */
  icon: z.string().optional(),
  status: z.enum(['running', 'done', 'error']).optional(),
})

export const agentContextItemSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** What the item is; picks the default icon. */
  kind: z.enum(['page', 'record', 'file', 'selection', 'data']).optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  /** The referenced record's fields, sent to the agent and not shown. */
  data: z.record(z.string(), z.unknown()).optional(),
})

export const agentAttachmentSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  /** IANA media type, e.g. `text/csv` or `image/png`. */
  mediaType: z.string().optional(),
  /** Bytes. */
  size: z.number().nonnegative().optional(),
  /** A preview image for image files. */
  url: z.string().optional(),
  status: z.enum(['uploading', 'ready', 'error']).optional(),
})

export const agentSuggestionSchema = z.strictObject({
  id: z.string().optional(),
  label: z.string(),
  /** The text sent or put in the prompt; defaults to `label`. */
  prompt: z.string().optional(),
  icon: z.string().optional(),
})

export const agentApprovalItemSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  /** Included when approved; defaults to true. */
  selected: z.boolean().optional(),
  disabled: z.boolean().optional(),
})

/** A label and value row of a confirmation, e.g. the delivery address or the refund amount. */
export const agentApprovalFieldSchema = z.strictObject({
  label: z.string(),
  value: z.string(),
  /** A second, quieter line under the value. */
  description: z.string().optional(),
  /** `success` for a saving or a discount, `danger` for a loss. */
  tone: z.enum(['neutral', 'success', 'danger']).optional(),
})

/** A product or record line of a confirmation: an image, a title, a quiet detail line and an amount. */
export const agentApprovalLineSchema = z.strictObject({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  /** An image URL (http(s) or relative). */
  image: z.string().optional(),
  amount: z.string().optional(),
})

export const agentQuestionOptionSchema = z.strictObject({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
})

export const agentPlanStepSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  status: z.enum(AGENT_PLAN_STATUSES),
  detail: z.string().optional(),
})

export const agentFieldChangeSchema = z.strictObject({
  /** The record field, e.g. `status`. */
  field: z.string().optional(),
  label: z.string(),
  before: scalar.optional(),
  after: scalar.optional(),
  /** Inferred from which side has a value when omitted. */
  kind: z.enum(['added', 'removed', 'changed']).optional(),
})

/** Answer text in Markdown (no raw HTML). `[1]` cites the first source part of the message. */
export const agentTextPartSchema = z.strictObject({
  type: z.literal('text'),
  id: z.string().optional(),
  text: z.string(),
  state: streamState.optional(),
})

/** The work behind an answer: a phase label, steps as they arrive and optional free reasoning text. */
export const agentReasoningPartSchema = z.strictObject({
  type: z.literal('reasoning'),
  id: z.string().optional(),
  /** Free reasoning text in Markdown. */
  text: z.string().optional(),
  state: streamState.optional(),
  /** The current phase while streaming, e.g. `Searching orders`. */
  label: z.string().optional(),
  steps: z.array(agentThinkingStepSchema).optional(),
  /** Milliseconds the work took, shown once done. */
  duration: z.number().nonnegative().optional(),
})

export const agentToolCallPartSchema = z.strictObject({
  type: z.literal('tool-call'),
  id: z.string().optional(),
  toolCallId: z.string(),
  /** The tool or registered action, e.g. `orders.search`. */
  toolName: z.string(),
  /** A readable name; the tool name shows beside it. */
  title: z.string().optional(),
  icon: z.string().optional(),
  status: z.enum(AGENT_TOOL_STATUSES),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
  /** One line on what the call found or did, e.g. `Found 3 orders`; shown beside the name. */
  summary: z.string().optional(),
  /** Milliseconds. */
  duration: z.number().nonnegative().optional(),
})

/** A confirmation the user gives before a registered action runs. */
export const agentApprovalPartSchema = z.strictObject({
  type: z.literal('approval'),
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  /** The registered action that runs on approval, e.g. `orders.remind`; it identifies the decision for the host and is never shown to the reader. */
  action: z.string().optional(),
  /** The tool call this approval gates, if any. */
  toolCallId: z.string().optional(),
  items: z.array(agentApprovalItemSchema).optional(),
  /** Product or record lines, e.g. the goods of an order. */
  lines: z.array(agentApprovalLineSchema).optional(),
  /** Label and value rows, e.g. address, delivery, discount and payment. */
  fields: z.array(agentApprovalFieldSchema).optional(),
  /** The figure the decision is about, e.g. `{ label: "Total", value: "$328.00" }`. */
  total: z.strictObject({ label: z.string().optional(), value: z.string() }).optional(),
  /** `warning` for changes that are hard to undo, `danger` for destructive ones. */
  tone: z.enum(['neutral', 'warning', 'danger']).optional(),
  status: z.enum(AGENT_APPROVAL_STATUSES),
  /** Shown once decided or expired, e.g. `Sent 3 reminders` or `Expired after 10 minutes`. */
  reason: z.string().optional(),
  approveLabel: z.string().optional(),
  rejectLabel: z.string().optional(),
  /** Shows an Edit button that asks for changes instead of deciding. */
  editable: z.boolean().optional(),
})

export const agentPlanPartSchema = z.strictObject({
  type: z.literal('plan'),
  id: z.string().optional(),
  title: z.string().optional(),
  steps: z.array(agentPlanStepSchema),
})

/** A question the agent asks before it goes on: pick one or several options, or write an answer. */
export const agentQuestionPartSchema = z.strictObject({
  type: z.literal('question'),
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  /** `single` (default) picks one option, `multiple` several, `text` takes a written answer. */
  mode: z.enum(['single', 'multiple', 'text']).optional(),
  options: z.array(agentQuestionOptionSchema).optional(),
  /** Adds a free text answer beside the options. */
  allowText: z.boolean().optional(),
  placeholder: z.string().optional(),
  status: z.enum(AGENT_QUESTION_STATUSES),
  /** The answer once given: an option value, several values, or the written text. */
  answer: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  submitLabel: z.string().optional(),
  /** Shows a Skip button. */
  skippable: z.boolean().optional(),
})

/** Field changes to a record, or a line diff of two texts such as a Spec before and after. */
export const agentDiffPartSchema = z.strictObject({
  type: z.literal('diff'),
  id: z.string().optional(),
  title: z.string().optional(),
  fields: z.array(agentFieldChangeSchema).optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  /** Highlighting for the text diff, as in CodeBlock. */
  language: z.string().optional(),
})

/** A source the answer relies on; shown as a citation chip that previews it. */
export const agentSourcePartSchema = z.strictObject({
  type: z.literal('source'),
  sourceId: z.string(),
  title: z.string(),
  url: z.string().optional(),
  snippet: z.string().optional(),
  icon: z.string().optional(),
  /** E.g. `record`, `page`, `document` or `web`. */
  kind: z.string().optional(),
})

export const agentFilePartSchema = z.strictObject({
  type: z.literal('file'),
  id: z.string().optional(),
  mediaType: z.string(),
  filename: z.string().optional(),
  url: z.string().optional(),
  size: z.number().nonnegative().optional(),
})

/** What the user shared with the message: the current page, records, a selection. */
export const agentContextPartSchema = z.strictObject({
  type: z.literal('context'),
  id: z.string().optional(),
  items: z.array(agentContextItemSchema),
})

export const agentMessagePartSchema = z.discriminatedUnion('type', [
  agentTextPartSchema,
  agentReasoningPartSchema,
  agentToolCallPartSchema,
  agentApprovalPartSchema,
  agentQuestionPartSchema,
  agentPlanPartSchema,
  agentDiffPartSchema,
  agentSourcePartSchema,
  agentFilePartSchema,
  agentContextPartSchema,
])

export const agentMessageSchema = z.strictObject({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(agentMessagePartSchema),
  /** `streaming` while parts still arrive; `error` when the turn failed. */
  status: z.enum(['streaming', 'done', 'error']).optional(),
  /** Shown with `status: "error"`. */
  errorText: z.string().optional(),
  createdAt: z.string().optional(),
  /** The reader's rating of an assistant answer. */
  feedback: z.enum(['up', 'down']).nullable().optional(),
  /** Follow-up prompts offered under an assistant answer. */
  suggestions: z.array(agentSuggestionSchema).optional(),
})

/** The last thing a reader did in a ChatThread or ChatMessage, written before the matching event. */
export const agentEventSchema = z.strictObject({
  type: z.enum(['copy', 'regenerate', 'feedback', 'suggestion', 'openSource', 'approve', 'reject', 'edit', 'select', 'answer', 'skip']),
  messageId: z.string().optional(),
  /** The approval part, source or suggestion acted on. */
  partId: z.string().optional(),
  value: z.unknown().optional(),
})

export const AGENT_SESSION_STATUSES = ['idle', 'running', 'waiting', 'unread', 'error'] as const

/** One conversation in a session list. */
export const agentSessionSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  /** The last line of the conversation, shown by the detailed variant. */
  preview: z.string().optional(),
  /** A display time, e.g. `14:20` or `Yesterday`. */
  time: z.string().optional(),
  /** Drawn as the dot before the title: running, waiting for the reader, a new reply, or failed. */
  status: z.enum(AGENT_SESSION_STATUSES).optional(),
  /** A heading for runs of sessions, e.g. `Today`; a new heading starts where it changes. */
  group: z.string().optional(),
})

/** A kind of thing the @ picker can reference, shown as a tab. */
export const agentMentionTypeSchema = z.strictObject({
  value: z.string(),
  label: z.string(),
  icon: z.string().optional(),
})

/** One result of the @ picker. */
export const agentMentionOptionSchema = z.strictObject({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  image: z.string().optional(),
  /** The `types` value it belongs to; static options are filtered by the active tab. */
  type: z.string().optional(),
})

/** What typing @ in the composer offers: a tab per kind and, for static use, the results. */
export const agentPromptMentionsSchema = z.strictObject({
  types: z.array(agentMentionTypeSchema).optional(),
  options: z.array(agentMentionOptionSchema).optional(),
  placeholder: z.string().optional(),
})

/** A slash command: `/value` in the composer, offered while the box holds only the command. */
export const agentCommandSchema = z.strictObject({
  value: z.string().regex(/^[\w.-]+$/),
  label: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  /** Text the command puts in the box; without it the command is emitted as `command`. */
  prompt: z.string().optional(),
})

const messageActions = z.array(z.enum(AGENT_MESSAGE_ACTIONS))
const usageSchema = z.strictObject({
  used: z.number().nonnegative(),
  limit: z.number().positive(),
  /** The unit, e.g. `tokens`. */
  unit: z.string().optional(),
})

export const agentDefinitions = {
  PromptInput: {
    props: z
      .strictObject({
        value: z.string().optional(),
        placeholder: z.string().optional(),
        /** While true the send button becomes a stop button that emits `stop`. */
        streaming: z.boolean().optional(),
        disabled: z.boolean().optional(),
        attachments: z.array(agentAttachmentSchema).optional(),
        /** Records or pages referenced with @, shown as removable chips. */
        context: z.array(agentContextItemSchema).optional(),
        /** Shows the attach button, which emits `attach`. */
        attachable: z.boolean().optional(),
        /** Shows the @ button, which emits `mention`. With `mentions` it opens the picker instead. */
        mentionable: z.boolean().optional(),
        /**
         * Turns on @ references: typing @ at the start of a word, or the @ button,
         * opens the picker over the box, and a pick becomes a `context` chip.
         */
        mentions: agentPromptMentionsSchema.optional(),
        /** Slash commands, offered while the box holds only `/` and a name; arrow keys and Enter pick. */
        commands: z.array(agentCommandSchema).optional(),
        /** The last command picked without a `prompt`; bind it to read which one `command` emitted. */
        command: z.string().nullable().optional(),
        /**
         * Shows the approval switch: `ask` waits for the reader before the agent
         * changes anything, `auto` gives it full access. Bind it with `$bindState`.
         */
        approvalMode: z.enum(['ask', 'auto']).optional(),
        model: z.string().optional(),
        /** Shows a compact model picker bound to `model`. */
        models: z.array(z.strictObject({ label: z.string(), value: z.string(), description: z.string().optional() })).optional(),
        /** Prompt starters shown above the box while it is empty. */
        suggestions: z.array(agentSuggestionSchema).optional(),
        /** Rows the box grows to before it scrolls; defaults to 8. */
        maxRows: z.number().int().min(1).max(30).optional(),
        ariaLabel: z.string().optional(),
      })
      .extend(host),
    slots: [],
    events: ['change', 'submit', 'stop', 'attach', 'mention', 'suggestion', 'command'],
    description: 'The message box of a chat: a text area that grows with its text, chips for attachments and @-referenced context (each removable), an optional compact model picker and a send button. Enter emits `submit`, Shift+Enter adds a line. With `mentions`, typing @ (or the @ button) opens the reference picker and a pick lands in `context`; with `commands`, typing / at the start offers them, and one without a `prompt` writes `command` and emits `command`. While `streaming` the send button turns into a stop button that emits `stop`. Bind `value`, `attachments`, `context` and `model` with `$bindState`; clear the text after sending with pushState `clearStatePath`. A suggestion fills the box and emits `suggestion`.',
  },
  ChatMessage: {
    props: z
      .strictObject({
        id: z.string().optional(),
        role: z.enum(['user', 'assistant', 'system']),
        parts: z.array(agentMessagePartSchema),
        status: z.enum(['streaming', 'done', 'error']).optional(),
        errorText: z.string().optional(),
        feedback: z.enum(['up', 'down']).nullable().optional(),
        suggestions: z.array(agentSuggestionSchema).optional(),
        /** Message actions under an assistant answer; defaults to all three. Use `[]` for none. */
        actions: messageActions.optional(),
        /** Written before each event: `{ type, messageId, partId?, value? }`. */
        activeEvent: agentEventSchema.nullable().optional(),
      })
      .extend(host),
    slots: [],
    events: ['copy', 'regenerate', 'feedback', 'suggestion', 'openSource', 'approve', 'reject', 'edit', 'answer', 'skip'],
    description: 'One message of a conversation, drawn from the agent message contract. A user message is a bubble with its files and context chips; an assistant message renders its parts in order — Markdown text with a caret while streaming, consecutive thinking and tool calls gathered under one activity line that shimmers while working and folds once done, plans, diffs, approvals and questions — then a sources line whose citations preview on hover or focus, then copy, regenerate and rating actions and follow-up suggestions. Bind `feedback` to keep the rating; `activeEvent` receives what was pressed before the matching event.',
  },
  MessageActions: {
    props: z
      .strictObject({
        /** The text Copy puts on the clipboard. */
        text: z.string().optional(),
        actions: messageActions.optional(),
        feedback: z.enum(['up', 'down']).nullable().optional(),
      })
      .extend(host),
    slots: [],
    events: ['copy', 'regenerate', 'feedback'],
    description: 'The actions under an answer: copy, regenerate, and thumbs up or down as toggle buttons. Bind `feedback` ({ "$bindState": "/path" }); pressing the active rating again clears it.',
  },
  Thinking: {
    props: z
      .strictObject({
        state: streamState.optional(),
        label: z.string().optional(),
        text: z.string().optional(),
        steps: z.array(agentThinkingStepSchema).optional(),
        /** Milliseconds, shown once done; otherwise the time it was seen working. */
        duration: z.number().nonnegative().optional(),
        /** Open or closed regardless of state; omitted, it is open while working and closed when done. */
        open: z.boolean().optional(),
      })
      .extend(host),
    slots: [],
    events: ['openChange'],
    description: 'A compact working pill — spinner, phase label and elapsed time — that settles to a check with the time taken when `state` is `done`. Steps and reasoning text fold out beneath it: open while working, folded once done. No motion beyond the spinner, which stops for readers who prefer reduced motion.',
  },
  ToolCall: {
    props: z
      .strictObject({
        toolName: z.string(),
        title: z.string().optional(),
        icon: z.string().optional(),
        status: z.enum(AGENT_TOOL_STATUSES),
        input: z.unknown().optional(),
        output: z.unknown().optional(),
        errorText: z.string().optional(),
        summary: z.string().optional(),
        duration: z.number().nonnegative().optional(),
        defaultOpen: z.boolean().optional(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'A tool or action the agent called, as one quiet timeline row: its icon (a spinner while running), its name and a one-line `summary` of what it found, with the time it took. When there is input, output or an error the row folds open to show them as highlighted JSON or the error text. Inside a ChatMessage consecutive thinking and tool calls gather under one activity line.',
  },
  Approval: {
    props: z
      .strictObject({
        title: z.string(),
        description: z.string().optional(),
        action: z.string().optional(),
        items: z.array(agentApprovalItemSchema).optional(),
        lines: z.array(agentApprovalLineSchema).optional(),
        fields: z.array(agentApprovalFieldSchema).optional(),
        total: z.strictObject({ label: z.string().optional(), value: z.string() }).optional(),
        /** Ids of the included items; bind it to keep the selection. Defaults to every item not marked `selected: false`. */
        selected: z.array(z.string()).optional(),
        tone: z.enum(['neutral', 'warning', 'danger']).optional(),
        status: z.enum(AGENT_APPROVAL_STATUSES),
        reason: z.string().optional(),
        approveLabel: z.string().optional(),
        rejectLabel: z.string().optional(),
        editable: z.boolean().optional(),
      })
      .extend(host),
    slots: [],
    events: ['approve', 'reject', 'edit', 'change'],
    description: 'Asks the reader to confirm before a registered action runs: what it does in plain words (`action` names it for the host and is not shown), then what it covers — a checklist of affected `items`, product `lines` with images and amounts, label and value `fields` (address, delivery, refund destination) and a `total` — and Approve, Reject and (with `editable`) Edit. Bind `status` and `selected`: Approve writes `approved` and emits `approve`, Reject writes `rejected` and emits `reject`; run the action from `on.approve`. To wait for the action, set `status` to `running` (the buttons lock and Approve shows progress), then `approved`, or `failed` with a `reason` to keep the card open for another try. `tone` marks risky changes, and `danger` turns Approve red. Once approved, rejected or expired the card folds to one line with the decision and `reason`, which opens to show what was decided.',
  },
  AgentQuestion: {
    props: z
      .strictObject({
        title: z.string(),
        description: z.string().optional(),
        mode: z.enum(['single', 'multiple', 'text']).optional(),
        options: z.array(agentQuestionOptionSchema).optional(),
        allowText: z.boolean().optional(),
        placeholder: z.string().optional(),
        status: z.enum(AGENT_QUESTION_STATUSES),
        answer: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        submitLabel: z.string().optional(),
        skippable: z.boolean().optional(),
      })
      .extend(host),
    slots: [],
    events: ['answer', 'skip'],
    description: 'A question the agent asks before it goes on. `single` (default) lists the options to pick one — pressing an option answers at once, and digit keys pick by number — `multiple` lets the reader tick several and confirm, `text` takes a written answer; `allowText` adds a written answer beside the options. Bind `status` and `answer`: answering writes `answered` and the value and emits `answer`, Skip (with `skippable`) writes `skipped` and emits `skip`. Answered and skipped questions fold to one line with the answer, which opens to change it.',
  },
  AgentPlan: {
    props: z
      .strictObject({
        title: z.string().optional(),
        steps: z.array(agentPlanStepSchema),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'The steps an agent intends to take, in order, each `pending`, `running`, `done`, `failed` or `skipped` with an optional detail line, on a timeline under a summary line with the progress such as 3/5. The running step shimmers; the list folds from the summary line.',
  },
  ChangeDiff: {
    props: z
      .strictObject({
        title: z.string().optional(),
        fields: z.array(agentFieldChangeSchema).optional(),
        before: z.string().optional(),
        after: z.string().optional(),
        language: z.string().optional(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'What a change does. `fields` lists record edits as label, before and after, marked added, removed or changed. `before` and `after` compare two texts line by line — a Spec or a config — with added and removed lines highlighted in the CodeBlock style and a +/− count.',
  },
  ContextChips: {
    props: z
      .strictObject({
        /** What the reader is looking at, e.g. `Order detail · 1`. */
        viewing: z.string().optional(),
        /** Whether the viewed page is shared; shows a switch. */
        shared: z.boolean().optional(),
        items: z.array(agentContextItemSchema).optional(),
        /** Shows a remove button on each item. */
        removable: z.boolean().optional(),
        usage: usageSchema.optional(),
      })
      .extend(host),
    slots: [],
    events: ['change', 'remove'],
    description: 'What the agent can see: a "Viewing" chip for the current page with a share switch bound to `shared`, the attached context items (removable, which updates a bound `items`), and an optional usage meter of `used` out of `limit`.',
  },
  AgentMentionPicker: {
    props: z
      .strictObject({
        /** The kinds of things to reference, shown as tabs, e.g. orders, articles, customers. */
        types: z.array(agentMentionTypeSchema).optional(),
        /** The active tab. Bind it to keep it in state. */
        type: z.string().optional(),
        /** The search text. Bind it to keep it in state. */
        query: z.string().optional(),
        /** Results for the active tab. Without a remote source they are filtered by `type` and `query` here. */
        options: z.array(agentMentionOptionSchema).optional(),
        /** The picked references as context items; bind it to the PromptInput `context` so each pick becomes a chip. */
        value: z.array(agentContextItemSchema).optional(),
        /** Allow several picks; otherwise a pick replaces the previous one. */
        multiple: z.boolean().optional(),
        loading: z.boolean().optional(),
        loadingMore: z.boolean().optional(),
        /** More results exist past the end; scrolling to the end asks for them. */
        hasMore: z.boolean().optional(),
        placeholder: z.string().optional(),
        emptyText: z.string().optional(),
        /** Pixels; the result list scrolls beyond it. */
        maxHeight: z.number().int().positive().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend(host),
    slots: [],
    events: ['change', 'search', 'select'],
    description: 'The @ reference picker: a search field, a tab per kind of thing (`types`, e.g. orders, articles, customers), and the results with the match highlighted, picked with the arrow keys and Enter. Picks are written to `value` as context items `{ id, label, kind, icon }`; bind it to the PromptInput `context` so they show as chips. Static `options` are filtered here by `type` and `query`; with a remote source the host searches and pages them (`loading`, `hasMore`).',
  },
  AgentSessionList: {
    props: z
      .strictObject({
        sessions: z.array(agentSessionSchema),
        /** The open session's id. Bind it to switch sessions from state. */
        value: z.string().nullable().optional(),
        /** `compact` one line per session; `detailed` adds the time and the last line. */
        variant: z.enum(['compact', 'detailed']).optional(),
        /** A search field above the list; static sessions are filtered by title and preview here. */
        searchable: z.boolean().optional(),
        query: z.string().optional(),
        /** A New chat button above the list, which emits `create`. */
        creatable: z.boolean().optional(),
        loading: z.boolean().optional(),
        hasMore: z.boolean().optional(),
        emptyText: z.string().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend(host),
    slots: [],
    events: ['change', 'search', 'create', 'loadMore'],
    description: 'A list of conversations. Each row keeps a dot slot before its title for its status (`running` pulses, `waiting` for the reader, `unread` reply, `error`), so titles stay aligned whether or not a dot shows. `compact` is one line per session; `detailed` adds the time and the last line. `group` starts a heading such as `Today`. Pressing a row writes its id to a bound `value` and emits `change`; `searchable` adds a search field and `creatable` a New chat button.',
  },
  ChatThread: {
    props: z
      .strictObject({
        messages: z.array(agentMessageSchema),
        /** Waiting for a reply: shows a thinking pill until the assistant message arrives. */
        streaming: z.boolean().optional(),
        actions: messageActions.optional(),
        activeEvent: agentEventSchema.nullable().optional(),
        /** Pixels; the thread scrolls beyond it and follows new messages while scrolled to the end. */
        maxHeight: z.number().int().positive().optional(),
        emptyTitle: z.string().optional(),
        emptyDescription: z.string().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend(host),
    slots: [],
    events: ['copy', 'regenerate', 'feedback', 'suggestion', 'openSource', 'approve', 'reject', 'edit', 'answer', 'skip'],
    description: 'A conversation drawn from an array of agent messages (`{ id, role, parts, status? }`), each as a ChatMessage. Bind `messages` with `$bindState` and the thread keeps ratings, approval decisions and answers to questions in it; `activeEvent` receives `{ type, messageId, partId?, value? }` before each event, so `on.approve` can run the registered action the approval names.',
  },
}
