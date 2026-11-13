import type { ReactElement, ReactNode } from 'react'
import type { AgentFilePart, AgentMessage, AgentMessageAction, AgentMessagePart, AgentSourcePart, ChatMessageProps, ChatThreadProps, MessageActionsProps } from '../../catalog/types-public.js'
import type { ActivityPart } from './activity.js'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircleIcon, ArrowDownStemIcon, CheckIcon, ChevronRightIcon, CopyIcon, CornerDownRightIcon, PencilIcon, RefreshIcon } from '../../icons.js'
import { formatFileSize } from '../../internal/file-size.js'
import { TOOLTIP_LAYER } from '../../internal/layers.js'
import { cn } from '../../internal/utils.js'
import { LumiEmpty } from '../empty.js'
import { useUiText } from '../text.js'
import { AgentActivity, isActivityPart } from './activity.js'
import { LumiAgentPlan } from './agent-plan.js'
import { LumiApproval } from './approval.js'
import { LumiChangeDiff } from './change-diff.js'
import { ContextChip } from './context-chips.js'
import { LumiMarkdown, safeHref } from './markdown.js'
import { LumiAgentQuestion } from './question.js'
import { ArrowUpRightIcon, copyText, KindIcon, ThumbsDownIcon, ThumbsUpIcon, useReducedMotion } from './shared.js'
import { LumiThinking } from './thinking.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

const ALL_ACTIONS: AgentMessageAction[] = ['copy', 'regenerate', 'feedback']

function hostOf(url: string | undefined): string | undefined {
  if (!url)
    return undefined
  try {
    return new URL(url).host || undefined
  }
  catch {
    return undefined
  }
}

/** A citation: a chip that previews its source on hover or focus and opens it when pressed. */
export function LumiSourceChip({ source, index, inline, onOpen }: { source: AgentSourcePart, index?: number | undefined, inline?: boolean | undefined, onOpen?: ((source: AgentSourcePart) => void) | undefined }): ReactElement {
  const { t } = useUiText()
  const href = source.url ? safeHref(source.url) : undefined
  const origin = hostOf(href)
  const content = (
    <>
      {inline
        ? <span>{index}</span>
        : (
            <>
              {index !== undefined && <span className="lumi-agent-source-index">{index}</span>}
              <KindIcon icon={source.icon} kind={source.kind ?? (href ? 'web' : undefined)} className="lumi-agent-chip-icon" />
              <span className="lumi-agent-chip-label">{source.title}</span>
            </>
          )}
    </>
  )
  const common = {
    'className': 'lumi-agent-source',
    'data-inline': inline || undefined,
    'data-hit-area': inline ? '' : undefined,
    'data-slot': 'source-chip',
    'aria-label': inline ? t('lumi.agent.source', 'Source {index}: {title}', { index: index ?? '', title: source.title }) : undefined,
  }
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {href
            ? <a {...common} href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.(source)}>{content}</a>
            : <button {...common} type="button" onClick={() => onOpen?.(source)}>{content}</button>}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side="top" align="start" sideOffset={6} collisionPadding={8} style={TOOLTIP_LAYER} className="lumi-glass-panel lumi-agent-source-preview" data-slot="source-preview">
            {origin && (
              <span className="lumi-agent-source-origin">
                <KindIcon icon={source.icon} kind={source.kind ?? (href ? 'web' : undefined)} className="lumi-agent-chip-icon" />
                {origin}
              </span>
            )}
            <span className="lumi-agent-source-title">{source.title}</span>
            {source.snippet && <span className="lumi-agent-source-snippet">{source.snippet}</span>}
            {(href || onOpen) && (
              <span className="lumi-agent-source-open">
                <ArrowUpRightIcon aria-hidden />
                {t('lumi.agent.openSource', 'Press to open')}
              </span>
            )}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/** Copy, regenerate and a thumbs up or down rating under an answer. */
export function LumiMessageActions(props: MessageActionsProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { text, actions = ALL_ACTIONS, feedback, onCopy, onRegenerate, onFeedbackChange, className, children, ...rest } = props
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, 2000, false)
    return () => clearTimeout(timer)
  }, [copied])
  const show = (action: AgentMessageAction): boolean => actions.includes(action)
  const copyLabel = copied ? t('lumi.agent.copied', 'Copied') : t('lumi.agent.copy', 'Copy')
  const rate = (value: 'up' | 'down'): void => onFeedbackChange?.(feedback === value ? null : value)
  return (
    <div {...rest} role="toolbar" aria-label={t('lumi.agent.messageActions', 'Message actions')} className={cn('lumi-agent-actions', className)} data-slot="message-actions">
      {show('copy') && (text || onCopy) && (
        <button
          type="button"
          className="lumi-agent-icon-button"
          aria-label={copyLabel}
          title={copyLabel}
          data-copied={copied || undefined}
          onClick={() => {
            const done = (): void => {
              setCopied(true)
              onCopy?.()
            }
            if (text)
              copyText(text).then(done, () => {})
            else
              done()
          }}
        >
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        </button>
      )}
      {show('regenerate') && onRegenerate && (
        <button type="button" className="lumi-agent-icon-button" aria-label={t('lumi.agent.regenerate', 'Regenerate')} title={t('lumi.agent.regenerate', 'Regenerate')} onClick={onRegenerate}>
          <RefreshIcon aria-hidden />
        </button>
      )}
      {show('feedback') && onFeedbackChange && (
        <>
          <button type="button" className="lumi-agent-icon-button" aria-label={t('lumi.agent.good', 'Good response')} title={t('lumi.agent.good', 'Good response')} aria-pressed={feedback === 'up'} onClick={() => rate('up')}>
            <ThumbsUpIcon aria-hidden />
          </button>
          <button type="button" className="lumi-agent-icon-button" aria-label={t('lumi.agent.bad', 'Bad response')} title={t('lumi.agent.bad', 'Bad response')} aria-pressed={feedback === 'down'} onClick={() => rate('down')}>
            <ThumbsDownIcon aria-hidden />
          </button>
        </>
      )}
      <span role="status" className="sr-only">{copied ? copyLabel : ''}</span>
      {children}
    </div>
  )
}

function FileChip({ file }: { file: AgentFilePart }): ReactElement {
  const name = file.filename ?? file.mediaType
  const href = file.url ? safeHref(file.url) : undefined
  const image = href && file.mediaType.startsWith('image/')
  const body = (
    <>
      {image ? <img className="lumi-agent-chip-thumb" src={href} alt="" /> : <KindIcon mediaType={file.mediaType} className="lumi-agent-chip-icon" />}
      <span className="lumi-agent-chip-label">{name}</span>
      {file.size !== undefined && <span className="lumi-agent-chip-meta">{formatFileSize(file.size)}</span>}
    </>
  )
  return href
    ? <a className="lumi-agent-chip" data-slot="file-chip" href={href} target="_blank" rel="noopener noreferrer" title={name}>{body}</a>
    : <span className="lumi-agent-chip" data-slot="file-chip" title={name}>{body}</span>
}

/** Copy and edit under a user message, shown on hover or focus. */
function UserActions({ text, onCopy, onEdit }: { text: string, onCopy?: (() => void) | undefined, onEdit?: (() => void) | undefined }): ReactElement {
  const { t } = useUiText()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, 2000, false)
    return () => clearTimeout(timer)
  }, [copied])
  const copyLabel = copied ? t('lumi.agent.copied', 'Copied') : t('lumi.agent.copy', 'Copy')
  return (
    <div role="toolbar" aria-label={t('lumi.agent.messageActions', 'Message actions')} className="lumi-agent-actions" data-slot="user-actions">
      <button
        type="button"
        className="lumi-agent-icon-button"
        aria-label={copyLabel}
        title={copyLabel}
        data-copied={copied || undefined}
        onClick={() => copyText(text).then(() => {
          setCopied(true)
          onCopy?.()
        }, () => {})}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </button>
      {onEdit && (
        <button type="button" className="lumi-agent-icon-button" aria-label={t('lumi.agent.editMessage', 'Edit message')} title={t('lumi.agent.editMessage', 'Edit message')} onClick={onEdit}>
          <PencilIcon aria-hidden />
        </button>
      )}
      <span role="status" className="sr-only">{copied ? copyLabel : ''}</span>
    </div>
  )
}

/** The sources of an answer as one line, their icons stacked and a count, opening to the full list. */
function SourcesLine({ sources, onOpen }: { sources: readonly AgentSourcePart[], onOpen?: ((source: AgentSourcePart) => void) | undefined }): ReactElement {
  const { t } = useUiText()
  const [open, setOpen] = useState(false)
  const list = useId()
  return (
    <div className="lumi-agent-sources-line" data-slot="sources">
      <button type="button" className="lumi-agent-sources-toggle" aria-expanded={open} aria-controls={list} onClick={() => setOpen(!open)}>
        <span className="lumi-agent-sources-stack" aria-hidden>
          {sources.slice(0, 3).map(source => (
            <span key={source.sourceId}><KindIcon icon={source.icon} kind={source.kind ?? (source.url ? 'web' : undefined)} /></span>
          ))}
        </span>
        {sources.length === 1 ? t('lumi.agent.sourceOne', '1 source') : t('lumi.agent.sourcesCount', '{count} sources', { count: sources.length })}
        <ChevronRightIcon aria-hidden className="lumi-agent-chevron" data-open={open || undefined} />
      </button>
      <ul id={list} className="lumi-agent-sources" aria-label={t('lumi.agent.sources', 'Sources')} hidden={!open}>
        {sources.map((source, index) => (
          <li key={source.sourceId}><LumiSourceChip source={source} index={index + 1} onOpen={onOpen} /></li>
        ))}
      </ul>
    </div>
  )
}

function messageText(parts: readonly AgentMessagePart[]): string {
  return parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('\n\n')
}

/**
 * One message of a conversation. Assistant parts render in order, then the
 * host's children, the citation chips, the actions and the follow-ups; the
 * message never mutates itself, it reports through the callbacks.
 */
export function LumiChatMessage(props: ChatMessageProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { id = '', role, parts, status, errorText, feedback, suggestions, actions = ALL_ACTIONS, onCopy, onRegenerate, onFeedback, onSuggestion, onOpenSource, onApprovalSelect, onApprove, onReject, onApprovalEdit, onAnswer, onSkip, onEditMessage, className, children, ...rest } = props
  const reduced = useReducedMotion()
  const streaming = status === 'streaming'
  const sources = parts.filter((part): part is AgentSourcePart => part.type === 'source')
  const open = onOpenSource ? (source: AgentSourcePart) => onOpenSource(source, id) : undefined
  const renderCitation = (index: number): ReactNode => {
    const source = sources[index - 1]
    return source ? <LumiSourceChip source={source} index={index} inline onOpen={open} /> : undefined
  }
  const lastText = parts.findLastIndex(part => part.type === 'text')
  const caret = <span className="lumi-agent-caret" aria-hidden data-motion={reduced ? 'reduce' : undefined} />

  if (role === 'user') {
    const attached = parts.filter(part => part.type === 'file' || part.type === 'context')
    const text = messageText(parts)
    return (
      <div {...rest} className={cn('lumi-agent-message', className)} data-slot="chat-message" data-role="user">
        {attached.length > 0 && (
          <div className="lumi-agent-chips" data-align="end">
            {attached.map((part, index) => part.type === 'file'
              ? <FileChip key={part.id ?? index} file={part} />
              : part.type === 'context' ? part.items.map(item => <ContextChip key={`${index}:${item.id}`} item={item} />) : null)}
          </div>
        )}
        {(text || children) && (
          <div className="lumi-agent-bubble">
            {text}
            {children}
          </div>
        )}
        {text && <UserActions text={text} onCopy={onCopy ? () => onCopy(id, text) : undefined} onEdit={onEditMessage ? () => onEditMessage(id, text) : undefined} />}
      </div>
    )
  }
  if (role === 'system') {
    return (
      <div {...rest} className={cn('lumi-agent-message', className)} data-slot="chat-message" data-role="system">
        <p className="lumi-agent-system">
          {messageText(parts)}
          {children}
        </p>
      </div>
    )
  }

  const visible = parts.filter(part => part.type !== 'source')
  // Consecutive thinking and tool calls read as one activity line.
  const blocks: Array<{ key: string, part: AgentMessagePart, index: number } | { key: string, activity: ActivityPart[] }> = []
  parts.forEach((part, index) => {
    const key = ('id' in part && part.id) || (part.type === 'tool-call' ? part.toolCallId : `${part.type}:${index}`)
    const last = blocks.at(-1)
    if (isActivityPart(part)) {
      if (last && 'activity' in last)
        last.activity.push(part)
      else
        blocks.push({ key: `activity:${key}`, activity: [part] })
    }
    else if (part.type !== 'source') {
      blocks.push({ key, part, index })
    }
  })
  return (
    <div {...rest} className={cn('lumi-agent-message', className)} data-slot="chat-message" data-role="assistant" data-status={status} aria-busy={streaming || undefined}>
      <div className="lumi-agent-body">
        {streaming && !visible.length && !children && <LumiThinking state="streaming" />}
        {blocks.map((block) => {
          if ('activity' in block)
            return <AgentActivity key={block.key} parts={block.activity} streaming={streaming} />
          const { key, part, index } = block
          switch (part.type) {
            case 'text':
              return <LumiMarkdown key={key} text={part.text} renderCitation={sources.length ? renderCitation : undefined} trailing={streaming && index === lastText ? caret : undefined} />
            case 'approval':
              return (
                <LumiApproval
                  key={key}
                  {...part}
                  {...(onApprovalSelect ? { selected: (part.items ?? []).filter(item => item.selected !== false).map(item => item.id), onSelectedChange: (selected: string[]) => onApprovalSelect(id, part.id, selected) } : {})}
                  onApprove={onApprove ? selected => onApprove(id, part.id, selected) : undefined}
                  onReject={onReject ? () => onReject(id, part.id) : undefined}
                  onEdit={onApprovalEdit ? () => onApprovalEdit(id, part.id) : undefined}
                />
              )
            case 'question':
              return (
                <LumiAgentQuestion
                  key={key}
                  {...part}
                  onAnswer={onAnswer ? answer => onAnswer(id, part.id, answer) : undefined}
                  onSkip={onSkip ? () => onSkip(id, part.id) : undefined}
                />
              )
            case 'plan':
              return <LumiAgentPlan key={key} title={part.title} steps={part.steps} />
            case 'diff':
              return <LumiChangeDiff key={key} title={part.title} fields={part.fields} before={part.before} after={part.after} language={part.language} />
            case 'file':
              return <div key={key} className="lumi-agent-chips"><FileChip file={part} /></div>
            case 'context':
              return <div key={key} className="lumi-agent-chips">{part.items.map(item => <ContextChip key={item.id} item={item} />)}</div>
            default:
              return null
          }
        })}
        {children}
        {status === 'error' && (
          <div className="lumi-agent-error" role="alert">
            <AlertCircleIcon aria-hidden />
            <span>{errorText ?? t('lumi.agent.failed', 'The answer could not be finished')}</span>
            {onRegenerate && (
              <button type="button" className="lumi-agent-text-button" onClick={() => onRegenerate(id)}>
                <RefreshIcon aria-hidden />
                {t('lumi.agent.retry', 'Try again')}
              </button>
            )}
          </div>
        )}
        {sources.length > 0 && <SourcesLine sources={sources} onOpen={open} />}
        {!streaming && status !== 'error' && actions.length > 0 && (
          <LumiMessageActions
            text={messageText(parts)}
            actions={actions}
            feedback={feedback ?? null}
            onCopy={onCopy ? () => onCopy(id, messageText(parts)) : undefined}
            onRegenerate={onRegenerate ? () => onRegenerate(id) : undefined}
            onFeedbackChange={onFeedback ? value => onFeedback(id, value) : undefined}
          />
        )}
        {!streaming && suggestions?.length
          ? (
              <div className="lumi-agent-follow-ups" role="group" aria-label={t('lumi.agent.followUps', 'Follow-up suggestions')}>
                {suggestions.map(suggestion => (
                  <button key={suggestion.id ?? suggestion.label} type="button" className="lumi-agent-follow-up" disabled={!onSuggestion} onClick={() => onSuggestion?.(suggestion, id)}>
                    {suggestion.icon ? <KindIcon icon={suggestion.icon} className="lumi-agent-chip-icon" /> : <CornerDownRightIcon aria-hidden className="lumi-agent-chip-icon" />}
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )
          : null}
      </div>
    </div>
  )
}

export interface LumiChatThreadProps extends ChatThreadProps, HostProps {
  /** Host-rendered content appended to a message, by message id. */
  renderContent?: ((message: AgentMessage) => ReactNode) | undefined
}

function keyed(messages: readonly AgentMessage[]): Array<[string, AgentMessage]> {
  const seen = new Set<string>()
  return messages.map((message, index) => {
    const key = seen.has(message.id) ? `${message.id}:${index}` : message.id
    seen.add(message.id)
    return [key, message]
  })
}

/**
 * A conversation from agent messages. When it is the scroll container it
 * follows new content while the reader is at the bottom, including content
 * that grows after render such as highlighted code or loaded images, and
 * stays put once they scroll up to read. Host children and the jump button
 * sit after the message list, not inside it.
 */
export function LumiChatThread(props: LumiChatThreadProps): ReactElement {
  const { t } = useUiText()
  const { messages, streaming, actions, emptyTitle, emptyDescription, maxHeight, ariaLabel, renderContent, className, children, 'aria-label': hostLabel, ...rest } = props
  const { onCopy, onRegenerate, onFeedback, onSuggestion, onOpenSource, onApprovalSelect, onApprove, onReject, onApprovalEdit, onAnswer, onSkip, onEditMessage, ...host } = rest
  const callbacks = { onCopy, onRegenerate, onFeedback, onSuggestion, onOpenSource, onApprovalSelect, onApprove, onReject, onApprovalEdit, onAnswer, onSkip, onEditMessage }
  const scroller = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const pinned = useRef(true)
  const [away, setAway] = useState(false)
  const waiting = Boolean(streaming) && messages.at(-1)?.role !== 'assistant'
  const filled = messages.length > 0 || waiting
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element || !filled)
      return
    // A thread that no longer overflows, say another conversation, has nothing below to jump to.
    if (element.scrollHeight <= element.clientHeight) {
      pinned.current = true
      if (away)
        setAway(false)
      return
    }
    if (pinned.current)
      element.scrollTop = element.scrollHeight
  })
  // Content can grow after it renders (a highlighter, an image); stay at the
  // bottom through that while the reader is there.
  useEffect(() => {
    const element = scroller.current
    const content = list.current
    if (!element || !content || typeof ResizeObserver === 'undefined')
      return
    const observer = new ResizeObserver(() => {
      if (pinned.current && element.scrollHeight > element.clientHeight)
        element.scrollTop = element.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [filled])
  if (!filled) {
    return (
      <div {...host} className={cn('lumi-agent-thread', className)} data-slot="chat-thread" data-empty="">
        <LumiEmpty size="sm" icon="sparkles" title={emptyTitle ?? t('lumi.agent.emptyTitle', 'No messages yet')} description={emptyDescription ?? undefined} />
        {children}
      </div>
    )
  }
  return (
    <div
      {...host}
      ref={scroller}
      className={cn('lumi-agent-thread', className)}
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      data-slot="chat-thread"
      onScroll={(event) => {
        const element = event.currentTarget
        pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
        setAway(!pinned.current)
      }}
    >
      <ol ref={list} className="lumi-agent-thread-list" aria-label={ariaLabel ?? hostLabel ?? t('lumi.agent.conversation', 'Conversation')} aria-busy={streaming || undefined}>
        {keyed(messages).map(([key, message], index) => {
          // `createdAt` is data for the host, not a prop of the message view.
          const { createdAt: _createdAt, ...shown } = message
          return (
            <li key={key} data-role={message.role} data-latest={(!waiting && index === messages.length - 1) || undefined}>
              <LumiChatMessage {...shown} actions={actions} {...callbacks}>{renderContent?.(message)}</LumiChatMessage>
            </li>
          )
        })}
        {waiting && (
          <li data-role="assistant" data-waiting="">
            <LumiChatMessage id="" role="assistant" status="streaming" parts={[]} />
          </li>
        )}
      </ol>
      {children}
      {away && (
        <div className="lumi-agent-jump" data-slot="jump-latest">
          <button
            type="button"
            className="lumi-agent-jump-button"
            aria-label={t('lumi.agent.jumpLatest', 'Jump to latest')}
            title={t('lumi.agent.jumpLatest', 'Jump to latest')}
            onClick={() => {
              const element = scroller.current
              if (element)
                element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
            }}
          >
            <ArrowDownStemIcon aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
