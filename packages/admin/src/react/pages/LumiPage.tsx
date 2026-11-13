import type { ReactElement, ReactNode } from 'react'
import type { LumiPageState } from './state.js'
import { LumiAlert as Alert } from '@duxweb/lumi-ui'
import { LumiEmptyState, LumiLoadingState, LumiResultState } from './state.js'

export interface LumiPageProps {
  children?: ReactNode
  state?: LumiPageState
  /** Shared responsive width by default; content narrows prose, full fills the parent. */
  width?: 'content' | 'wide' | 'full'
  /**
   * Takes the height the shell gives the page instead of the height its content
   * happens to need — for pages whose foot is part of the design, like a
   * wizard's step controls, which must not float halfway up an empty well.
   */
  stretch?: boolean
  /** Stacks several sections (cards, tables, previews) with the standard section gap. */
  stack?: boolean
  ariaLabel?: string
  className?: string
}

export function LumiPage({ children, state = { kind: 'idle' }, width = 'wide', stretch, stack, ariaLabel, className }: LumiPageProps): ReactElement {
  // A result, an exception or a page that failed to load is the whole page.
  const standalone = state.kind !== 'idle' && state.kind !== 'loading' && !(state.kind === 'success' && children)
  return (
    <section className={['lumi-admin-page', className].filter(Boolean).join(' ')} data-width={width} data-stretch={stretch || undefined} data-stack={stack || undefined} data-page-state={standalone ? state.kind : undefined} aria-label={ariaLabel}>
      {state.kind === 'loading'
        ? <LumiLoadingState label={state.label} />
        : state.kind !== 'idle' && state.kind !== 'success'
          ? <LumiEmptyState {...state} />
          : (
              <>
                {state.kind === 'success' && (children
                  ? <LumiSuccessNotice title={state.title} message={state.message} />
                  : <LumiResultState {...state} />)}
                {children}
              </>
            )}
    </section>
  )
}

function LumiSuccessNotice({ title, message }: { title: string, message: string }): ReactElement {
  return (
    <div className="lumi-admin-page__notice" role="status" aria-live="polite">
      <Alert tone="success" title={title} message={message} />
    </div>
  )
}

export interface LumiPageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
}

export function LumiPageHeader({ title, description, actions, meta }: LumiPageHeaderProps): ReactElement {
  return (
    <header className="lumi-page-header">
      <div className="lumi-page-header__copy">
        <div className="lumi-page-header__title-row">
          <h1>{title}</h1>
          {meta}
        </div>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="lumi-page-header__actions">{actions}</div>}
    </header>
  )
}
