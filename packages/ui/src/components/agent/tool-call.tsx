import type { ReactElement, ReactNode } from 'react'
import type { AgentToolStatus, ToolCallProps } from '../../catalog/types-public.js'
import { AlertCircleIcon, ClockIcon, useOutlineIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { LumiCodeBlock } from '../code-block.js'
import { SpinnerGlyph } from '../spinner.js'
import { useUiText } from '../text.js'
import { formatValue, useReducedMotion, WrenchIcon } from './shared.js'
import { Timeline, TimelineRow } from './timeline.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

/** The icon of a tool row: a spinner while it runs, a clock while queued, an alert when it failed, else the tool's own icon. */
export function ToolRowIcon({ status, icon }: { status: AgentToolStatus, icon?: string | undefined }): ReactElement {
  const Icon = useOutlineIcon(icon) ?? WrenchIcon
  if (status === 'running')
    return <SpinnerGlyph size="sm" tone="muted" />
  if (status === 'pending')
    return <ClockIcon />
  if (status === 'error')
    return <AlertCircleIcon />
  return <Icon />
}

function Payload({ label, value }: { label: string, value: unknown }): ReactElement {
  const { code, language } = formatValue(value)
  return <LumiCodeBlock code={code} language={language} maxHeight={240} aria-label={label} />
}

/**
 * One tool or action call as a timeline row: icon, name and a one-line
 * summary; the round's header carries the time. What it returned, or its error, folds open
 * beneath it; the input stays in the message for the host and is not shown.
 * A running call shimmers its name.
 */
export function ToolCallRow(props: ToolCallProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { toolName, title, icon, status, output, errorText, summary, defaultOpen, className } = props
  // Only host attributes reach the row; a message part carries protocol fields too.
  const rest = { 'data-testid': props['data-testid'], 'aria-label': props['aria-label'] }
  const reduced = useReducedMotion()
  const statusLabel = {
    pending: t('lumi.agent.toolPending', 'Queued'),
    running: t('lumi.agent.toolRunning', 'Running'),
    success: t('lumi.agent.toolSuccess', 'Done'),
    error: t('lumi.agent.toolError', 'Failed'),
  }[status]
  const hasOutput = output !== undefined && status === 'success'
  const expandable = hasOutput || Boolean(errorText)
  const detail = expandable
    ? (
        <>
          {hasOutput && <Payload label={t('lumi.agent.toolOutput', 'Output')} value={output} />}
          {errorText && <p className="lumi-agent-tool-error">{errorText}</p>}
        </>
      )
    : undefined
  return (
    <TimelineRow
      {...rest}
      className={cn('lumi-agent-tool', className)}
      slot="tool-call"
      detailSlot="tool-call-body"
      status={status}
      tone={status === 'error' ? 'danger' : status === 'pending' ? 'muted' : undefined}
      running={status === 'running' && !reduced}
      icon={<ToolRowIcon status={status} icon={icon} />}
      name={title ?? toolName}
      summary={status === 'error' && !summary ? statusLabel : summary}
      srStatus={statusLabel}
      detail={detail}
      defaultOpen={defaultOpen}
    />
  )
}

/** A tool call on its own: a one-row timeline. Inside a message, calls gather under the activity line instead. */
export function LumiToolCall(props: ToolCallProps & HostProps): ReactElement {
  return <Timeline className="lumi-agent-timeline-single"><ToolCallRow {...props} /></Timeline>
}
