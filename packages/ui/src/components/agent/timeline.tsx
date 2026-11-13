import type { ReactElement, ReactNode } from 'react'
import type { UiText } from '../text.js'
import { useId, useState } from 'react'
import { ChevronRightIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'

/**
 * One row of an agent timeline: an icon, a name and a one-line summary, with
 * quiet meta at the end. With `detail` the row is a button that folds the
 * detail open beneath it. It is a list item: standing alone it sits in a
 * one-row Timeline. The connector to the next row is drawn by the list,
 * from under this icon to the next one, so it never crosses an icon.
 */
export function TimelineRow({ icon, name, summary, meta, status, detail, running, tone, defaultOpen, slot, detailSlot, srStatus, className, ...rest }: {
  'icon': ReactNode
  'name': ReactNode
  'summary'?: ReactNode
  'meta'?: ReactNode
  'status'?: string | undefined
  'detail'?: ReactNode
  'running'?: boolean | undefined
  'tone'?: 'danger' | 'muted' | undefined
  'defaultOpen'?: boolean | undefined
  'slot'?: string | undefined
  'detailSlot'?: string | undefined
  /** Read after the name, e.g. "Done"; the row shows status through its icon. */
  'srStatus'?: string | undefined
  'className'?: string | undefined
  'data-testid'?: string | undefined
  'aria-label'?: string | undefined
  'aria-current'?: 'step' | undefined
}): ReactElement {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const panel = useId()
  const head = (
    <>
      <span className="lumi-agent-tl-icon" aria-hidden>{icon}</span>
      <span className="lumi-agent-tl-name" data-shimmer={running || undefined}>{name}</span>
      {summary ? <span className="lumi-agent-tl-summary">{summary}</span> : null}
      {meta ? <span className="lumi-agent-tl-meta">{meta}</span> : null}
      {srStatus && <span className="sr-only">{srStatus}</span>}
      {detail ? <ChevronRightIcon aria-hidden className="lumi-agent-chevron" data-open={open || undefined} /> : null}
    </>
  )
  return (
    <li {...rest} className={cn('lumi-agent-tl', className)} data-slot={slot} data-status={status} data-tone={tone}>
      {detail
        ? <button type="button" className="lumi-agent-tl-row" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>{head}</button>
        : <div className="lumi-agent-tl-row">{head}</div>}
      {detail ? <div id={panel} className="lumi-agent-tl-detail" hidden={!open} data-slot={detailSlot}>{detail}</div> : null}
    </li>
  )
}

/** The rows of a timeline; each item draws the connector down to the next. */
export function Timeline({ children, className, label, slot }: { children: ReactNode, className?: string, label?: string | undefined, slot?: string | undefined }): ReactElement {
  return <ol className={cn('lumi-agent-timeline', className)} aria-label={label} data-slot={slot}>{children}</ol>
}

/**
 * The header of a round: its status and time, then the current phase or what
 * was done, muted; a hairline sets it off from the answer. As a `pill` it is
 * a compact capsule of the status and time alone, the phase kept as its
 * tooltip. The status shimmers while work runs, and the header folds the
 * timeline beneath it.
 */
export function ActivityHead({ label, time, detail, running, open, panel, expandable, onToggle, slot, pill, children }: {
  label: ReactNode
  time?: string | undefined
  detail?: ReactNode
  running?: boolean | undefined
  open: boolean
  panel: string
  expandable: boolean
  onToggle: () => void
  slot?: string | undefined
  pill?: boolean | undefined
  children?: ReactNode
}): ReactElement {
  const tip = pill && typeof detail === 'string' ? detail : undefined
  const body = (
    <>
      <span className="lumi-agent-activity-label" data-shimmer={running || undefined}>{label}</span>
      {time && <span className="lumi-agent-activity-time">{time}</span>}
      {detail && !pill ? <span className="lumi-agent-activity-detail">{detail}</span> : null}
      {children}
      {expandable && <ChevronRightIcon aria-hidden className="lumi-agent-chevron" data-open={open || undefined} />}
    </>
  )
  return expandable
    ? <button type="button" className="lumi-agent-activity-head" aria-expanded={open} aria-controls={panel} onClick={onToggle} data-slot={slot} data-pill={pill || undefined} title={tip}>{body}</button>
    : <span className="lumi-agent-activity-head" data-slot={slot} data-pill={pill || undefined} title={tip}>{body}</span>
}

/** The status word of a round: working, done, or done with failures. */
export function roundStatus(state: 'streaming' | 'done' | 'error', t: UiText['t']): string {
  return state === 'streaming' ? t('lumi.agent.statusWorking', 'Working') : state === 'error' ? t('lumi.agent.statusFailed', 'Finished with errors') : t('lumi.agent.statusDone', 'Done')
}
