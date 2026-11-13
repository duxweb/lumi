import type { CSSProperties, Key, ReactElement, ReactNode } from 'react'
import type { LumiIdlePageState, LumiLoadingPageState, LumiRecoverablePageState } from './state.js'
import { LumiCard as Card, LumiSegmentBar, useUiText } from '@duxweb/lumi-ui'
import { LumiEmptyState, LumiLoadingState } from './state.js'

export interface LumiCardListProps<T> {
  items: readonly T[]
  getKey: (item: T) => Key
  renderItem: (item: T) => ReactNode
  layout?: 'grid' | 'list'
  /** Narrowest grid column in px (default 280); the grid fits as many columns as the width allows. */
  minItemWidth?: number
  ariaLabel?: string
  state?: LumiIdlePageState | LumiLoadingPageState | LumiRecoverablePageState
  empty?: Omit<LumiRecoverablePageState, 'kind'>
}

/** Results only: fetching, filters, and pagination stay with the list owner. */
export function LumiCardList<T>(props: LumiCardListProps<T>): ReactElement {
  const { t } = useUiText()
  const { items, getKey, renderItem, layout = 'grid', minItemWidth, ariaLabel = t('lumi.list.results', 'Results'), state, empty } = props
  let feedback: ReactNode
  if (state?.kind === 'loading')
    feedback = <LumiLoadingState label={state.label} />
  else if (state && state.kind !== 'idle')
    feedback = <LumiEmptyState {...state} />
  else if (items.length === 0)
    feedback = <LumiEmptyState kind="empty" title={t('lumi.list.noResults', 'No results')} reason={t('lumi.list.noRecords', 'No records match the current view.')} nextStep={t('lumi.list.adjustFilters', 'Adjust the filters and try again.')} {...empty} />

  return (
    <div className="lumi-card-list" data-layout={layout}>
      {feedback ?? (
        <ul className="lumi-card-list__items" aria-label={ariaLabel} style={minItemWidth ? { '--lumi-card-list-min': `${minItemWidth}px` } as CSSProperties : undefined}>
          {items.map((item) => {
            const key = getKey(item)
            return <li className="lumi-card-list__item" key={`${typeof key}:${key}`}>{renderItem(item)}</li>
          })}
        </ul>
      )}
    </div>
  )
}

export interface LumiRecordCardProps {
  title: string
  description?: string
  /** Status, category, or another short piece of record metadata. */
  meta?: ReactNode
  fields?: readonly { key: string, label: string, value: ReactNode }[]
  /** A genuine completion percentage, not a decorative chart. */
  progress?: { label: string, value: number }
  footer?: ReactNode
  /** Opens the record. The title becomes a link stretched over the card. */
  href?: string
}

/** Neutral Card composition for a record summary, without resource routing. */
export function LumiRecordCard({ title, description, meta, fields, progress, footer, href }: LumiRecordCardProps): ReactElement {
  const percentage = progress && Number.isFinite(progress.value) ? Math.min(100, Math.max(0, progress.value)) : 0
  return (
    <Card className="lumi-record-card" data-link={href ? '' : undefined}>
      <article className="lumi-record-card__body" aria-label={title}>
        <header className="lumi-record-card__header">
          <div className="lumi-record-card__title-row">
            <h2>{href ? <a className="lumi-record-card__link" href={href}>{title}</a> : title}</h2>
            {meta && <div className="lumi-record-card__meta">{meta}</div>}
          </div>
          {description && <p className="lumi-record-card__description">{description}</p>}
        </header>
        {Boolean(fields?.length) && (
          <dl className="lumi-record-card__fields">
            {fields?.map(field => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {progress && (
          <div className="lumi-record-card__progress">
            <div>
              <span>{progress.label}</span>
              <span>{`${percentage}%`}</span>
            </div>
            <progress className="sr-only" max={100} value={percentage} aria-label={`${title}: ${progress.label}`} />
            <LumiSegmentBar value={percentage} tone="brand" />
          </div>
        )}
        {footer && <footer className="lumi-record-card__footer">{footer}</footer>}
      </article>
    </Card>
  )
}
