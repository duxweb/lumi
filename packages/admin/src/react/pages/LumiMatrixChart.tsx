import type { CSSProperties, ReactElement } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { niceCeiling, scaleTicks } from './chartScale.js'
import { ChartTip, tipEdge } from './ChartTip.js'

export interface LumiMatrixChartPoint {
  key: string
  /** Axis label, e.g. `10/19`. Every `labelEvery`-th one is printed. */
  label: string
  value: number
  /** Reads in the tooltip and the accessible list, e.g. `$2,180`. */
  display?: string
  /** Tints the column and reads in its tooltip, e.g. `Payment outage`. */
  note?: string
}

export interface LumiMatrixChartProps {
  points: readonly LumiMatrixChartPoint[]
  ariaLabel: string
  /** Dots per column; the column's value fills them from the bottom. */
  rows?: number
  /** Top of the scale; rounded up from the series peak when omitted. */
  max?: number
  /** Formats the y-axis ticks; defaults to a compact number in the active locale, e.g. `8K`. */
  formatTick?: (value: number) => string
  /** Prints every n-th axis label, starting from the first and ending on the last. */
  labelEvery?: number
  className?: string
}

/**
 * A daily trend drawn as a dot matrix: each day is a column of dots filled up
 * to its share of the scale, so a single bad day reads at a glance without the
 * false precision of a smooth line. Values stay in the DOM for screen readers.
 */
export function LumiMatrixChart({ points, ariaLabel, rows = 16, max, formatTick, labelEvery = 7, className }: LumiMatrixChartProps): ReactElement {
  const { locale } = useUiText()
  const compact = new Intl.NumberFormat(locale, { notation: 'compact' })
  const top = max ?? niceCeiling(points.reduce((peak, point) => Math.max(peak, point.value), 0))
  const ticks = scaleTicks(top).map(formatTick ?? compact.format)
  const last = points.length - 1
  return (
    <figure className={['lumi-matrix-chart', className].filter(Boolean).join(' ')} style={{ '--lumi-matrix-columns': points.length, '--lumi-matrix-rows': rows } as CSSProperties}>
      <div className="lumi-matrix-chart__y" aria-hidden>
        {ticks.map((tick, index) => <span key={index}>{tick}</span>)}
      </div>
      <div className="lumi-matrix-chart__plot" role="list" aria-label={ariaLabel}>
        {points.map((point, index) => {
          const filled = Math.max(1, Math.round((point.value / top) * rows))
          const reading = `${point.label}: ${point.display ?? point.value}`
          return (
            <div key={point.key} className="lumi-matrix-chart__column" role="listitem" tabIndex={0} data-flag={point.note ? '' : undefined} data-tip-edge={tipEdge(index, points.length)}>
              <span className="lumi-matrix-chart__dots" aria-hidden>
                {Array.from({ length: rows }, (_, row) => (
                  // Dots are positional; the column owns their identity.
                  <i key={row} data-filled={rows - row <= filled || undefined} />
                ))}
              </span>
              <ChartTip label={point.label} value={point.display ?? String(point.value)} note={point.note} />
              <span className="sr-only">{point.note ? `${reading}, ${point.note}` : reading}</span>
            </div>
          )
        })}
      </div>
      <div className="lumi-matrix-chart__x" aria-hidden>
        {points.map((point, index) => (
          <span key={point.key}>{index === last || (index % labelEvery === 0 && last - index >= labelEvery / 2) ? point.label : ''}</span>
        ))}
      </div>
    </figure>
  )
}
