import type { FiltersProps } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import { LumiFilters as Filters, useUiText } from '@duxweb/lumi-ui'

export interface LumiFilterBarProps extends FiltersProps {
  title?: string
  description?: string
  /** Leading toolbar controls that choose the current view. */
  toolbarStart?: ReactNode
  /** Trailing toolbar controls that act on the view rather than the query. */
  toolbarEnd?: ReactNode
  className?: string
}

export function LumiFilterBar({ title, description, className, ...filters }: LumiFilterBarProps): ReactElement {
  const { t } = useUiText()
  return (
    <section className={['lumi-filter-bar', className].filter(Boolean).join(' ')} aria-label={title ?? t('lumi.list.filters', 'Filters')}>
      {title && <h2 className="sr-only">{title}</h2>}
      <Filters {...filters} />
      {description && (
        <div className="lumi-filter-bar__copy">
          <p>{description}</p>
        </div>
      )}
    </section>
  )
}
