import type { ReactElement, ReactNode } from 'react'
import type { AgentApprovalLine, ApprovalProps } from '../../catalog/types-public.js'
import { useId, useRef, useState } from 'react'
import { AlertCircleIcon, CheckIcon, ClockIcon, XIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { LumiButton } from '../base.js'
import { LumiCheckbox } from '../controls.js'
import { useUiText } from '../text.js'
import { safeImageSrc } from './markdown.js'
import { ShieldIcon } from './shared.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

/** Items beyond this fold behind a "show more" button. */
const VISIBLE_ITEMS = 5

/** The approval items selected to begin with: all but those with `selected: false`. */
export function defaultApprovalSelection(items: ApprovalProps['items']): string[] {
  return (items ?? []).filter(item => item.selected !== false).map(item => item.id)
}

function Line({ line }: { line: AgentApprovalLine }): ReactElement {
  const src = line.image ? safeImageSrc(line.image) : undefined
  return (
    <li className="lumi-agent-line">
      {src && <span className="lumi-agent-line-thumb" aria-hidden><img src={src} alt="" loading="lazy" /></span>}
      <span className="lumi-agent-line-copy">
        <span className="lumi-agent-line-title">{line.title}</span>
        {line.description && <span className="lumi-agent-line-meta">{line.description}</span>}
      </span>
      {line.amount && <span className="lumi-agent-line-amount">{line.amount}</span>}
    </li>
  )
}

/**
 * A confirmation before a registered action runs. While pending it is a card:
 * what will happen in the reader's words, then what it covers (items to
 * narrow, product lines, label and value rows and a total) and the decision.
 * `running` locks the buttons while the action is in flight, `failed` keeps
 * the card open with the reason. Once decided it folds to one line with the
 * outcome, which opens to show what was decided.
 */
export function LumiApproval(props: ApprovalProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { title, description, action: _action, items, lines, fields, total, selected: selectedProp, tone = 'neutral', status, reason, approveLabel, rejectLabel, editable, onSelectedChange, onApprove, onReject, onEdit, className, children, ...rest } = props
  const [own, setOwn] = useState(() => defaultApprovalSelection(items))
  const [all, setAll] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const selected = selectedProp ?? own
  const root = useRef<HTMLDivElement>(null)
  const heading = useId()
  const card = useId()
  const open = status === 'pending' || status === 'running' || status === 'failed'
  const busy = status === 'running'
  const count = items ? items.filter(item => selected.includes(item.id)).length : 0
  const statusLabel = {
    pending: t('lumi.agent.approvalPending', 'Awaiting approval'),
    running: t('lumi.agent.approvalRunning', 'Running'),
    approved: t('lumi.agent.approvalApproved', 'Approved'),
    rejected: t('lumi.agent.approvalRejected', 'Rejected'),
    expired: t('lumi.agent.approvalExpired', 'Expired'),
    failed: t('lumi.agent.approvalFailed', 'Did not complete'),
  }[status]
  const toggle = (id: string, checked: boolean): void => {
    const next = checked ? [...selected.filter(key => key !== id), id] : selected.filter(key => key !== id)
    const ordered = (items ?? []).map(item => item.id).filter(key => next.includes(key))
    setOwn(ordered)
    onSelectedChange?.(ordered)
  }
  // The buttons leave with the decision, so focus moves to the card instead of the page.
  const decide = (run: () => void): void => {
    run()
    root.current?.focus()
  }
  const shown = items && !all ? items.slice(0, VISIBLE_ITEMS) : items
  const hidden = (items?.length ?? 0) - (shown?.length ?? 0)
  const store = Boolean(total)

  const body = (
    <div id={card} className="lumi-agent-card lumi-agent-approval-card" data-tone={tone}>
      <div className="lumi-agent-approval-head">
        <span className="lumi-agent-approval-icon" aria-hidden><ShieldIcon /></span>
        <div className="lumi-agent-approval-copy">
          <span id={heading} className="lumi-agent-approval-title">{title}</span>
          {description && <p className="lumi-agent-approval-description">{description}</p>}
        </div>
      </div>
      {lines?.length ? <ul className="lumi-agent-lines">{lines.map((line, index) => <Line key={line.id ?? index} line={line} />)}</ul> : null}
      {shown?.length
        ? (
            <ul className="lumi-agent-approval-items" aria-label={t('lumi.agent.approvalItems', 'Affected items')}>
              {shown.map(item => (
                <li key={item.id}>
                  <label data-disabled={!open || busy || item.disabled || undefined}>
                    <LumiCheckbox ariaLabel={item.label} value={selected.includes(item.id)} disabled={!open || busy || Boolean(item.disabled)} onChange={checked => toggle(item.id, Boolean(checked))} />
                    <span className="lumi-agent-approval-item">{item.label}</span>
                    {item.description && <span className="lumi-agent-approval-meta">{item.description}</span>}
                  </label>
                </li>
              ))}
              {hidden > 0 && (
                <li>
                  <button type="button" className="lumi-agent-approval-more" onClick={() => setAll(true)}>
                    {t('lumi.agent.approvalMore', 'Show {count} more', { count: hidden })}
                  </button>
                </li>
              )}
            </ul>
          )
        : null}
      {fields?.length
        ? (
            <dl className="lumi-agent-fields" data-slot="description-list" data-layout="rows" data-bordered="">
              {fields.map(field => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd data-tone={field.tone}>
                    <span>{field.value}</span>
                    {field.description && <span className="lumi-agent-field-sub">{field.description}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )
        : null}
      {total && (
        <p className="lumi-agent-total">
          <span>{total.label ?? t('lumi.agent.approvalTotal', 'Total')}</span>
          <strong>{total.value}</strong>
        </p>
      )}
      {children}
      {status === 'failed' && reason && (
        <p className="lumi-agent-approval-failure" role="alert">
          <AlertCircleIcon aria-hidden />
          <span>{reason}</span>
        </p>
      )}
      {open && (onApprove || onReject || (editable && onEdit))
        ? (
            <div className="lumi-agent-approval-actions" data-wide={store || undefined}>
              {editable && onEdit && <LumiButton size="sm" appearance="ghost" label={t('lumi.agent.approvalEdit', 'Edit')} disabled={busy} onClick={onEdit} />}
              {!store && <span className="lumi-agent-spacer" />}
              {onReject && <LumiButton size={store ? 'lg' : 'sm'} appearance="outline" label={rejectLabel ?? t('lumi.agent.approvalReject', 'Reject')} disabled={busy} onClick={() => decide(onReject)} />}
              {onApprove && (
                <LumiButton
                  size={store ? 'lg' : 'sm'}
                  appearance={tone === 'danger' ? 'danger' : 'solid'}
                  loading={busy}
                  label={approveLabel ?? (items?.length ? t('lumi.agent.approvalApproveCount', 'Approve ({count})', { count }) : t('lumi.agent.approvalApprove', 'Approve'))}
                  disabled={Boolean(items?.length) && count === 0}
                  onClick={() => decide(() => onApprove(selected))}
                />
              )}
            </div>
          )
        : null}
    </div>
  )

  return (
    <div
      {...rest}
      ref={root}
      tabIndex={-1}
      role="group"
      aria-labelledby={heading}
      className={cn('lumi-agent-approval', className)}
      data-slot="approval"
      data-status={status}
      data-tone={tone}
      aria-busy={busy || undefined}
    >
      {open
        ? body
        : (
            <>
              <button type="button" className="lumi-agent-decided" aria-expanded={reviewing} aria-controls={card} onClick={() => setReviewing(!reviewing)}>
                {status === 'approved' ? <CheckIcon aria-hidden data-tone="success" /> : status === 'expired' ? <ClockIcon aria-hidden /> : <XIcon aria-hidden />}
                <span className="lumi-agent-decided-label">{statusLabel}</span>
                <span className="lumi-agent-decided-reason">{reason ?? title}</span>
              </button>
              {reviewing ? body : <span id={heading} hidden>{title}</span>}
            </>
          )}
      <span role="status" className="sr-only">{status === 'pending' ? '' : statusLabel}</span>
    </div>
  )
}
