import type { Tone } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { LumiBadge as Badge, useUiText } from '@duxweb/lumi-ui'
import { ShellIcon } from '../components/ShellIcon.js'

export interface LumiListStat {
  key: string
  label: string
  /** Shell icon name leading the label. */
  icon?: string
  value: string | number
  /** Short chip riding beside the number, e.g. `3 overdue`; takes the item's tone. */
  badge?: string
  /** One short line under the number, e.g. the window it covers. */
  hint?: string
  /** Short delta chip beside the hint, e.g. `+4.2%`. */
  change?: string
  /** Recent values, oldest first, rendered as compact bars. */
  series?: readonly number[]
  /**
   * Colours the delta chip, and the number itself when the figure is the
   * problem — a low-stock count is read as a warning, not as a total.
   */
  tone?: Tone
}

export interface LumiStatStripProps {
  items: readonly LumiListStat[]
  ariaLabel?: string
  className?: string
}

/**
 * Totals for the table below, grouped semantically while each figure owns
 * a separate card. The caller supplies the same query snapshot as the rows.
 */
export function LumiStatStrip(props: LumiStatStripProps): ReactElement {
  const { t } = useUiText()
  const { items, ariaLabel = t('lumi.list.totals', 'Summary totals'), className } = props
  return (
    <dl className={['lumi-stat-strip', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {items.map((item) => {
        const bars = item.series && item.series.length > 1 ? item.series : undefined
        const peak = bars ? Math.max(...bars, 0) : 0
        return (
          <div key={item.key} className="lumi-stat-strip__item" data-series={bars ? true : undefined} data-tone={item.tone}>
            <dt className="lumi-stat-strip__label">
              {item.icon && <ShellIcon name={item.icon} className="lumi-stat-strip__icon" />}
              {item.label}
            </dt>
            <dd className="lumi-stat-strip__value" data-tone={item.tone}>
              {item.value}
              {item.badge && <span className="lumi-stat-strip__badge" data-tone={item.tone}>{item.badge}</span>}
            </dd>
            {(item.change || item.hint) && (
              <dd className="lumi-stat-strip__foot">
                {item.change && <Badge label={item.change} tone={item.tone ?? 'neutral'} appearance="soft" />}
                {item.hint}
              </dd>
            )}
            {bars && (
              <dd className="lumi-stat-strip__spark" aria-hidden>
                {bars.map((point, index) => (
                  <i
                    // A fixed-length window: position is the identity.
                    key={index}
                    style={{ height: peak > 0 ? `${(point / peak) * 100}%` : undefined }}
                    data-last={index === bars.length - 1 || undefined}
                  />
                ))}
              </dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}
