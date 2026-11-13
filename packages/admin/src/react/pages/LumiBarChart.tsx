import type { Tone } from '@duxweb/lumi-ui'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { niceCeiling, scaleTicks } from './chartScale.js'
import { ChartTip, tipEdge } from './ChartTip.js'

export interface LumiBarChartPoint {
  key: string
  /** Axis label under the bar, e.g. `08-10`. */
  label: string
  value: number
  /** Reads in the tooltip and the accessible table, e.g. `$2,180`. */
  display?: string
  /** Paints this column in its own tone at full strength, e.g. `danger` for an outage day. */
  tone?: Tone
}

export interface LumiBarChartProps {
  points: readonly LumiBarChartPoint[]
  ariaLabel: string
  /** Colour of the emphasised column; the other columns are a soft tint of it. */
  tone?: Tone
  /**
   * The column drawn in the full tone: `peak` is the largest value, a point
   * `key` picks one column (e.g. today), `none` paints every column in full.
   */
  highlight?: 'peak' | 'none' | (string & {})
  /** One line under the plot, e.g. where the peak sits. */
  caption?: ReactNode
  /** Prints each reading (its `display`, else the value) above its column. */
  showValues?: boolean
  /** Shows the value scale beside the gridlines. */
  axis?: boolean
  /** Top of the scale; rounded up from the series peak when omitted. */
  max?: number
  /** Formats the axis ticks; defaults to a compact number in the active locale, e.g. `8K`. */
  formatTick?: (value: number) => string
  className?: string
}

/**
 * A column chart drawn from the layout itself: no canvas, no library, and the
 * numbers stay in the DOM so a screen reader gets the series, not a picture.
 * One column carries the full tone and the rest a tint of it, so the reading
 * that matters stands out against dashed gridlines on a rounded scale.
 */
export function LumiBarChart({ points, ariaLabel, tone = 'primary', highlight = 'peak', caption, showValues, axis = true, max, formatTick, className }: LumiBarChartProps): ReactElement {
  const { locale } = useUiText()
  const peak = points.reduce((largest, point) => Math.max(largest, point.value), 0)
  const top = max ?? niceCeiling(peak)
  const compact = new Intl.NumberFormat(locale, { notation: 'compact' })
  const ticks = scaleTicks(top).map(formatTick ?? compact.format)
  const emphasised = (point: LumiBarChartPoint): boolean => point.tone !== undefined
    || highlight === 'none'
    || (highlight === 'peak' ? peak > 0 && point.value === peak : point.key === highlight)
  return (
    <figure
      className={['lumi-bar-chart', className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-axis={axis || undefined}
      data-values={showValues || undefined}
      style={{ '--lumi-bar-columns': Math.max(points.length, 1) } as CSSProperties}
    >
      {axis && (
        <div className="lumi-bar-chart__y" aria-hidden>
          {ticks.map((tick, index) => <span key={index}>{tick}</span>)}
        </div>
      )}
      <div className="lumi-bar-chart__plot" role="list" aria-label={ariaLabel}>
        <div className="lumi-bar-chart__grid" aria-hidden>
          {ticks.map((_, index) => <i key={index} />)}
        </div>
        {points.map((point, index) => {
          const reading = point.display ?? String(point.value)
          return (
            <div
              key={point.key}
              className="lumi-bar-chart__column"
              role="listitem"
              tabIndex={0}
              data-emphasis={emphasised(point) || undefined}
              data-tone={point.tone}
              data-tip-edge={tipEdge(index, points.length)}
            >
              <span className="lumi-bar-chart__track" aria-hidden>
                <span className="lumi-bar-chart__bar" style={{ height: `${top > 0 ? (Math.min(Math.max(point.value, 0), top) * 100) / top : 0}%` }}>
                  {showValues && <span className="lumi-bar-chart__value">{reading}</span>}
                </span>
              </span>
              <ChartTip label={point.label} value={reading} />
              <span className="sr-only">{`${point.label}: ${reading}`}</span>
            </div>
          )
        })}
      </div>
      <div className="lumi-bar-chart__x" aria-hidden>
        {points.map(point => <span key={point.key} data-emphasis={emphasised(point) || undefined}>{point.label}</span>)}
      </div>
      {caption && <figcaption className="lumi-bar-chart__caption">{caption}</figcaption>}
    </figure>
  )
}
