import type { TableProps, TimelineProps } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import type { LumiPageHeaderProps } from './LumiPage.js'
import type { LumiPageState } from './state.js'
import { LumiTable as Table, LumiTimeline as Timeline, useUiText } from '@duxweb/lumi-ui'
import { LumiPage, LumiPageHeader } from './LumiPage.js'

export interface LumiDetailField {
  key: string
  label: string
  value: ReactNode
  /** One quiet line under the value, e.g. `$60 discount applied`. */
  hint?: ReactNode
}

export interface LumiDetailItems {
  /** Line items of the record, e.g. the products on an order. */
  table: TableProps
  title?: string
  /** Reads beside the panel title, e.g. `3 products · 4 units`. */
  description?: string
  /** Money rows under the amounts column; the last one is the total. */
  summary?: ReadonlyArray<{ key: string, label: string, value: ReactNode, total?: boolean }>
}

export interface LumiDetailBlock {
  key: string
  /** Heading for an independent content section. */
  title: string
  /** Trails the heading, e.g. an `Edit address` button. */
  action?: ReactNode
  children: ReactNode
  /** Drops the block's inner padding for content that sets its own, e.g. a list. */
  flush?: boolean
}

export interface LumiDetailPageProps extends LumiPageHeaderProps {
  fields: readonly LumiDetailField[]
  items?: LumiDetailItems
  /** Content sections below the record's summary fields. */
  sections?: readonly LumiDetailBlock[]
  timeline?: TimelineProps
  /** Rides beside the title, e.g. the record's status badge. */
  status?: ReactNode
  /** Blocks for the 320px column: who this belongs to, what happened to it. */
  aside?: readonly LumiDetailBlock[]
  children?: ReactNode
  state?: LumiPageState
  timelineTitle?: string
}

function DetailBand({ title, action }: { title: string, action?: ReactNode }): ReactElement {
  return (
    <header className="lumi-detail-page__band" data-action={action ? true : undefined}>
      <h2>{title}</h2>
      {action && <div className="lumi-detail-page__band-action">{action}</div>}
    </header>
  )
}

/** Record details use independent cards that follow their content height. */
export function LumiDetailPage(props: LumiDetailPageProps): ReactElement {
  const { t } = useUiText()
  const { fields, items, sections, timeline, status, aside, children, state, timelineTitle = t('lumi.detail.activity', 'Activity'), meta, ...header } = props
  const blocks: LumiDetailBlock[] = [
    ...(aside ?? []),
    // The 320px column is read top-down: what happened, then when.
    ...(timeline ? [{ key: '__timeline', title: timelineTitle, children: <Timeline marker="dot" datePlacement="below" {...timeline} /> }] : []),
  ]
  return (
    <LumiPage state={state} ariaLabel={header.title} className="lumi-detail-page">
      <LumiPageHeader
        {...header}
        meta={(
          <>
            {status}
            {meta}
          </>
        )}
      />
      <div className="lumi-detail-page__layout" data-aside={blocks.length > 0 || undefined}>
        <div className="lumi-detail-page__main">
          {(fields.length > 0 || children) && (
            <section className="lumi-detail-page__panel">
              {fields.length > 0 && (
                <dl className="lumi-detail-page__fields">
                  {fields.map(field => (
                    <div key={field.key}>
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                      {field.hint && <dd className="lumi-detail-page__hint">{field.hint}</dd>}
                    </div>
                  ))}
                </dl>
              )}
              {children}
            </section>
          )}
          {items && (
            <section className="lumi-detail-page__panel lumi-detail-page__items">
              <header className="lumi-detail-page__band">
                <h2>{items.title ?? t('lumi.detail.items', 'Items')}</h2>
                {items.description && <p>{items.description}</p>}
              </header>
              <Table {...items.table} />
              {items.summary && items.summary.length > 0 && (
                <dl className="lumi-detail-page__summary">
                  {items.summary.map(row => (
                    <div key={row.key} data-total={row.total || undefined}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}
          {sections?.map(section => (
            <section key={section.key} className="lumi-detail-page__panel lumi-detail-page__section">
              <DetailBand title={section.title} action={section.action} />
              <div className="lumi-detail-page__block" data-flush={section.flush || undefined}>{section.children}</div>
            </section>
          ))}
        </div>
        {blocks.length > 0 && (
          <div className="lumi-detail-page__aside">
            {blocks.map(block => (
              <section key={block.key} className="lumi-detail-page__panel">
                <DetailBand title={block.title} action={block.action} />
                <div className="lumi-detail-page__block" data-flush={block.flush || undefined}>{block.children}</div>
              </section>
            ))}
          </div>
        )}
      </div>
    </LumiPage>
  )
}
