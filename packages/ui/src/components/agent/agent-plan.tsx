import type { ReactElement, ReactNode } from 'react'
import type { AgentPlanProps, AgentPlanStatus } from '../../catalog/types-public.js'
import { useId, useState } from 'react'
import { CheckIcon, ClockIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { SpinnerGlyph } from '../spinner.js'
import { useUiText } from '../text.js'
import { CancelCircleIcon, MinusCircleIcon, useReducedMotion } from './shared.js'
import { ActivityHead, Timeline, TimelineRow } from './timeline.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

function Marker({ status }: { status: AgentPlanStatus }): ReactElement {
  if (status === 'running')
    return <SpinnerGlyph size="sm" tone="muted" />
  if (status === 'done')
    return <CheckIcon />
  if (status === 'failed')
    return <CancelCircleIcon />
  if (status === 'skipped')
    return <MinusCircleIcon />
  return <ClockIcon />
}

/**
 * The steps an agent intends to take, on the same timeline as its activity:
 * a summary line with the title and progress, then one row per step. The
 * running step shimmers, steps not started yet stay quiet, and a skipped or
 * failed step carries a status tag before its reason; the list folds from
 * the summary line.
 */
export function LumiAgentPlan(props: AgentPlanProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { title, steps, className, children: _children, ...rest } = props
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(true)
  const panel = useId()
  const settled = steps.filter(step => step.status === 'done' || step.status === 'skipped').length
  const running = steps.some(step => step.status === 'running')
  const statusLabel = {
    pending: t('lumi.agent.planPending', 'Not started'),
    running: t('lumi.agent.planRunning', 'In progress'),
    done: t('lumi.agent.planDone', 'Done'),
    failed: t('lumi.agent.planFailed', 'Failed'),
    skipped: t('lumi.agent.planSkipped', 'Skipped'),
  }
  const heading = title ?? t('lumi.agent.plan', 'Plan')
  return (
    <section {...rest} className={cn('lumi-agent-activity lumi-agent-plan', className)} data-slot="agent-plan" aria-label={rest['aria-label'] ?? heading} data-motion={reduced ? 'reduce' : undefined}>
      <ActivityHead label={heading} running={running && !reduced} open={open} panel={panel} expandable={steps.length > 0} onToggle={() => setOpen(!open)}>
        <span className="lumi-agent-plan-count" aria-label={t('lumi.agent.planSummary', '{done} of {total} steps done', { done: settled, total: steps.length })}>
          {t('lumi.agent.planProgress', '{done}/{total}', { done: settled, total: steps.length })}
        </span>
      </ActivityHead>
      <div id={panel} className="lumi-agent-activity-panel" hidden={!open}>
        <Timeline>
          {steps.map(step => (
            <TimelineRow
              key={step.id}
              status={step.status}
              tone={step.status === 'failed' ? 'danger' : step.status === 'pending' || step.status === 'skipped' ? 'muted' : undefined}
              running={step.status === 'running' && !reduced}
              aria-current={step.status === 'running' ? 'step' : undefined}
              icon={<Marker status={step.status} />}
              name={step.label}
              summary={step.detail}
              {...(step.status === 'skipped' || step.status === 'failed'
                ? { meta: <span className="lumi-agent-plan-tag" data-status={step.status}>{statusLabel[step.status]}</span> }
                : { srStatus: statusLabel[step.status] })}
            />
          ))}
        </Timeline>
      </div>
    </section>
  )
}
