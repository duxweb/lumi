import type { EmptyProps } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import type { OutlineIconComponent } from '../icons.js'
import { LumiButton as Button, LumiEmpty, useUiText } from '@duxweb/lumi-ui'
import { CheckCircleIcon, ClockIcon, CloudOffIcon, InboxIcon, ShieldXIcon, TriangleAlertIcon } from '../icons.js'

export type LumiRecoverableStateKind = 'empty' | 'error' | 'permission' | 'offline' | 'timeout'

export interface LumiIdlePageState {
  kind: 'idle'
}

export interface LumiLoadingPageState {
  kind: 'loading'
  label?: string
}

export interface LumiSuccessPageState {
  kind: 'success'
  title: string
  message: string
  /** The next task, e.g. back to the list the record was created from. */
  actionLabel?: string
  onAction?: () => void
}

export interface LumiRecoverablePageState {
  kind: LumiRecoverableStateKind
  title: string
  reason: string
  nextStep: string
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
}

export type LumiPageState = LumiIdlePageState | LumiLoadingPageState | LumiSuccessPageState | LumiRecoverablePageState

export type LumiEmptyStateProps = LumiRecoverablePageState & {
  compact?: boolean
  /** The way forward as composed content, e.g. the Spec's `actions` slot; replaces `actionLabel`/`onAction`. */
  actions?: ReactNode
}

const FIGURE_BY_KIND = {
  empty: { icon: InboxIcon, tone: 'neutral' },
  error: { icon: TriangleAlertIcon, tone: 'danger' },
  permission: { icon: ShieldXIcon, tone: 'warning' },
  offline: { icon: CloudOffIcon, tone: 'warning' },
  timeout: { icon: ClockIcon, tone: 'warning' },
  success: { icon: CheckCircleIcon, tone: 'success' },
} as const satisfies Record<LumiRecoverableStateKind | 'success', { icon: OutlineIconComponent, tone: NonNullable<EmptyProps['tone']> }>

/**
 * Every page state is the UI empty state in its kind's tone and glyph, so a
 * page-level state and an empty table read as one family. `compact` is the
 * size a state takes inside a grid or card; otherwise it stands for the page.
 */
function LumiStateFigure({ kind, title, detail, action, compact }: {
  kind: LumiRecoverableStateKind | 'success'
  title: string
  detail: readonly string[]
  action?: ReactNode
  compact?: boolean
}): ReactElement {
  const { icon: Icon, tone } = FIGURE_BY_KIND[kind]
  return (
    <LumiEmpty
      size={compact ? 'sm' : 'md'}
      tone={tone}
      icon={<Icon />}
      title={title}
      headingLevel={2}
      role={kind === 'empty' || kind === 'success' ? 'status' : 'alert'}
      description={detail.map(line => <p key={line}>{line}</p>)}
    >
      {action}
    </LumiEmpty>
  )
}

export function LumiEmptyState(props: LumiEmptyStateProps): ReactElement {
  const action = props.actions ?? (props.onAction && props.actionLabel
    ? <Button label={props.actionLabel} appearance="solid" disabled={props.disabled} onClick={props.onAction} />
    : undefined)
  return (
    <LumiStateFigure
      kind={props.kind}
      title={props.title}
      detail={[props.reason, props.nextStep]}
      action={action}
      compact={props.compact}
    />
  )
}

/** A success result: a title, a message and an optional next action. */
export function LumiResultState({ title, message, actionLabel, onAction }: Omit<LumiSuccessPageState, 'kind'>): ReactElement {
  const action = onAction && actionLabel ? <Button label={actionLabel} appearance="solid" onClick={onAction} /> : undefined
  return <LumiStateFigure kind="success" title={title} detail={[message]} action={action} />
}

/** The loading placeholder of a page area. */
export function LumiLoadingState(props: { label?: string }): ReactElement {
  const { t } = useUiText()
  const { label = t('lumi.page.loadingContent', 'Loading content') } = props
  return (
    <div className="lumi-page-loading" role="status" aria-label={label} aria-busy="true">
      <span className="lumi-page-loading__line" />
      <span className="lumi-page-loading__line" />
      <span className="lumi-page-loading__line" />
    </div>
  )
}
