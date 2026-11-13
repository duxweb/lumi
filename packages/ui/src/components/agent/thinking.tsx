import type { ReactElement, ReactNode } from 'react'
import type { AgentThinkingStep, ThinkingProps } from '../../catalog/types-public.js'
import { useId, useState } from 'react'
import { AlertCircleIcon, SparklesIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { SpinnerGlyph } from '../spinner.js'
import { useUiText } from '../text.js'
import { LumiMarkdown } from './markdown.js'
import { formatDuration, KindIcon, useElapsed, useReducedMotion } from './shared.js'
import { ActivityHead, roundStatus, Timeline, TimelineRow } from './timeline.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

/** One thinking step as a timeline row: a spinner while it runs, an alert when it failed, else its icon. */
export function StepRow({ step }: { step: AgentThinkingStep }): ReactElement {
  const running = step.status === 'running'
  const failed = step.status === 'error'
  const reduced = useReducedMotion()
  return (
    <TimelineRow
      status={step.status ?? 'done'}
      tone={failed ? 'danger' : undefined}
      running={running && !reduced}
      icon={running ? <SpinnerGlyph size="sm" tone="muted" /> : failed ? <AlertCircleIcon /> : step.icon ? <KindIcon icon={step.icon} /> : <SparklesIcon />}
      name={step.label}
      summary={step.detail}
    />
  )
}

/**
 * The work behind an answer as one quiet line: the current phase shimmering
 * with the elapsed time while working, then what it took once done. Steps
 * and reasoning fold out beneath it on a timeline: open while working,
 * folded once done unless the reader opened it, or `open` decides.
 */
export function LumiThinking(props: ThinkingProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { state = 'streaming', label, text, steps, duration, open: openProp, onOpenChange, className, children: _children, ...rest } = props
  const running = state === 'streaming'
  const reduced = useReducedMotion()
  const elapsed = useElapsed(running)
  const [chosen, setChosen] = useState<boolean>()
  const panel = useId()
  const failed = !running && steps?.some(step => step.status === 'error')
  const expandable = Boolean(steps?.length || text)
  const open = expandable && (openProp ?? chosen ?? running)
  const taken = duration ?? (running ? undefined : elapsed)
  const time = running
    ? elapsed === undefined ? undefined : formatDuration(Math.floor(elapsed / 1000) * 1000, t, true)
    : taken === undefined ? undefined : formatDuration(taken, t)
  const title = roundStatus(running ? 'streaming' : failed ? 'error' : 'done', t)
  const toggle = (): void => {
    setChosen(!open)
    onOpenChange?.(!open)
  }
  return (
    <div
      {...rest}
      className={cn('lumi-agent-activity', className)}
      data-slot="thinking"
      data-state={running ? 'streaming' : failed ? 'error' : 'done'}
      data-motion={reduced ? 'reduce' : undefined}
    >
      <ActivityHead label={title} time={time} detail={label || undefined} running={running && !reduced} open={open} panel={panel} expandable={expandable} onToggle={toggle} slot="thinking-toggle" pill />
      <span role="status" className="sr-only">{running ? '' : [title, time].filter(Boolean).join(' ')}</span>
      {expandable && (
        <div id={panel} className="lumi-agent-activity-panel" hidden={!open} data-slot="thinking-panel">
          {steps?.length ? <Timeline label={t('lumi.agent.steps', 'Steps')}>{steps.map((step, index) => <StepRow key={step.id ?? index} step={step} />)}</Timeline> : null}
          {text && <LumiMarkdown className="lumi-agent-reasoning" text={text} />}
        </div>
      )}
    </div>
  )
}
