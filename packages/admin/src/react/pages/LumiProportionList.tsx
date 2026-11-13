import type { Tone } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import { useUiText } from '@duxweb/lumi-ui'

export interface LumiProportionItem {
  key: string
  label: string
  /** Drives the row's bar, relative to the largest item, and its share of the total. */
  value: number
  /** Tone for the bar fill. */
  tone?: Tone
  /** What the row says on the right, e.g. `42 orders · $128,400`. */
  display?: ReactNode
  /** An aggregated remainder such as `Other`: kept last and drawn in a neutral tone. */
  other?: boolean
}

export interface LumiProportionListProps {
  items: readonly LumiProportionItem[]
  ariaLabel: string
  /** Default tone for items if not specified on item */
  tone?: Tone
  /** `desc` ranks the items by value with any `other` item last; `none` keeps the given order. */
  sort?: 'desc' | 'none'
  /** Adds each item's percentage of the total after its reading. */
  showShare?: boolean
  /** `muted` sets the reading back as a secondary count, e.g. `9 tasks` beside a person; the bar carries the comparison. */
  valueTone?: 'default' | 'muted'
  className?: string
}

/**
 * A ranking: label and reading on one line, a thin solid bar on a track under
 * them, measured against the largest item so the order reads at a glance
 * without a legend. The share column turns the list into parts of a whole.
 */
export function LumiProportionList({ items, ariaLabel, tone, sort = 'desc', showShare, valueTone, className }: LumiProportionListProps): ReactElement {
  const { locale } = useUiText()
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const peak = items.reduce((max, item) => Math.max(max, item.value), 0) || 1
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0)
  const rows = sort === 'none' ? items : [...items].sort((left, right) => Number(Boolean(left.other)) - Number(Boolean(right.other)) || right.value - left.value)
  return (
    <ul className={['lumi-proportion-list', className].filter(Boolean).join(' ')} aria-label={ariaLabel} data-share={showShare || undefined} data-value-tone={valueTone === 'muted' ? 'muted' : undefined}>
      {rows.map(item => (
        <li key={item.key} className="lumi-proportion-list__row" data-tone={item.other ? 'neutral' : item.tone ?? tone ?? 'primary'} data-other={item.other || undefined}>
          <span className="lumi-proportion-list__label">{item.label}</span>
          <span className="lumi-proportion-list__value">{item.display ?? item.value}</span>
          {showShare && <span className="lumi-proportion-list__share">{percent.format(total > 0 ? Math.max(item.value, 0) / total : 0)}</span>}
          <span className="lumi-proportion-list__track" aria-hidden>
            <span className="lumi-proportion-list__bar" style={{ width: `${Math.min(Math.max(item.value, 0) / peak, 1) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}
