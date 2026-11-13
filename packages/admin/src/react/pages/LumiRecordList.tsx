import type { BadgeTone } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import { LumiBadge as Badge, LumiCheckbox as Checkbox, LumiEmpty as Empty, LumiProgress as Progress, useUiText } from '@duxweb/lumi-ui'

export interface LumiRecordListItem {
  key: string
  /** The record's identity, e.g. an order number or product name. */
  title: ReactNode
  /** Secondary line, e.g. the customer. Wraps instead of eliding. */
  description?: ReactNode | undefined
  status?: { label: string, tone?: BadgeTone } | undefined
  /** The figure on the right, e.g. a total. Tabular numerals. */
  value?: ReactNode | undefined
  /** Small print under the value, e.g. a timestamp. */
  meta?: ReactNode | undefined
  /** Makes the row a button, e.g. to open the record. */
  onSelect?: () => void
  /** Adds a leading checkbox; a checked row reads as done. */
  checked?: boolean | undefined
  /** Without it the checkbox is read-only. */
  onCheckedChange?: (checked: boolean) => void
  /** A bar under the title, e.g. a project's completion. */
  progress?: { value: number, max?: number | undefined, tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | undefined } | undefined
}

export interface LumiRecordListProps {
  items: readonly LumiRecordListItem[]
  /** Small uppercase heading above the rows. */
  title?: string
  ariaLabel?: string
  loading?: boolean
  /** Shown when there are no rows and nothing is loading. */
  emptyLabel?: string
  className?: string
}

const label = (item: LumiRecordListItem): string => typeof item.title === 'string' ? item.title : item.key

/**
 * Compact rows for a feed, a drawer or a dashboard side panel: identity and
 * status lead, the figure trails on the same baseline, metadata sits below.
 * For sortable or paginated records use a Table instead.
 */
export function LumiRecordList(props: LumiRecordListProps): ReactElement {
  const { t } = useUiText()
  const { items, title, ariaLabel, loading, emptyLabel = t('lumi.list.nothing', 'Nothing to show.'), className } = props
  return (
    <section className={['lumi-record-list', className].filter(Boolean).join(' ')} aria-label={ariaLabel ?? title}>
      {title && <h3 className="lumi-record-list__title">{title}</h3>}
      {items.length > 0 && (
        <ul className="lumi-record-list__rows">
          {items.map((item) => {
            const content = (
              <>
                <span className="lumi-record-list__name">{item.title}</span>
                {item.status && <Badge label={item.status.label} tone={item.status.tone ?? 'neutral'} appearance="soft" />}
                {item.value !== undefined && <span className="lumi-record-list__value">{item.value}</span>}
                {item.progress && <Progress className="lumi-record-list__progress" value={item.progress.value} max={item.progress.max} tone={item.progress.tone} aria-label={t('lumi.list.progressOf', '{name} progress', { name: label(item) })} />}
                {item.description !== undefined && <span className="lumi-record-list__description">{item.description}</span>}
                {item.meta !== undefined && <span className="lumi-record-list__meta">{item.meta}</span>}
              </>
            )
            return (
              <li key={item.key} data-done={item.checked || undefined} data-check={item.checked === undefined ? undefined : ''}>
                {item.checked !== undefined && (
                  <Checkbox ariaLabel={label(item)} value={item.checked} readonly={!item.onCheckedChange} onChange={checked => item.onCheckedChange?.(Boolean(checked))} />
                )}
                {item.onSelect
                  ? <button type="button" className="lumi-record-list__row" onClick={item.onSelect}>{content}</button>
                  : <div className="lumi-record-list__row">{content}</div>}
              </li>
            )
          })}
        </ul>
      )}
      {loading && <p className="lumi-record-list__note" role="status">{t('lumi.select.loading', 'Loading…')}</p>}
      {!loading && items.length === 0 && <Empty size="sm" title={emptyLabel} />}
    </section>
  )
}
