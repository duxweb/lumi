import type { CSSProperties, ReactElement } from 'react'
import type { LumiChartProps } from '../catalog/types-public.js'
import { useEffect, useRef, useState } from 'react'
import { LumiEmpty } from '../components/empty.js'
import { useUiText } from '../components/text.js'
import { AnalyticsIcon } from '../icons.js'
import { chartPoints, formatChartValue } from './model.js'

export { chartComponentDefinition } from '../catalog/chart.js'

/**
 * Area, line and donut draw on the lazily loaded canvas engine; bars are
 * layout, solid rounded bars on a track measured against the largest reading,
 * so they need no engine. A bar is an amount, not progress: it never uses the
 * segmented progress meter. The readings
 * are always in the DOM: as text beside each bar, as the donut legend, and as
 * a screen-reader table for the canvas charts.
 */
export function LumiChart({ type, points, ariaLabel, height = 260, color = 1, valueFormat, locale, currency, emptyLabel, errorLabel }: LumiChartProps): ReactElement {
  const { t } = useUiText()
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const data = chartPoints(type, points)
  const empty = !data.length || (type === 'donut' && data.every(point => point.value === 0))
  const canvas = type !== 'bar'
  const formatValue = (value: number): string => formatChartValue(value, { valueFormat, locale, currency })
  // No data draws no axes or ring: the empty state takes the chart's own height.
  const emptyState = (
    <div className="lumi-chart__status">
      <LumiEmpty size="sm" role="status" icon={<AnalyticsIcon />} title={emptyLabel ?? t('lumi.chart.empty', 'No data for this period')} />
    </div>
  )

  useEffect(() => {
    const element = host.current
    if (!element || empty || !canvas)
      return
    let disposed = false
    let destroy: (() => void) | undefined
    setStatus('loading')
    void import('./engine.js').then(({ mountChart }) => {
      if (disposed)
        return
      destroy = mountChart(element, { type, points, ariaLabel, color, valueFormat, locale, currency })
      setStatus('ready')
    }).catch(() => {
      if (!disposed)
        setStatus('error')
    })
    return () => {
      disposed = true
      destroy?.()
    }
  }, [type, points, ariaLabel, color, valueFormat, locale, currency, empty, canvas])

  if (type === 'bar') {
    const peak = data.reduce((max, point) => Math.max(max, point.value), 0)
    return (
      <figure className="lumi-chart" aria-label={ariaLabel} data-chart-type={type} data-chart-status={empty ? 'empty' : 'ready'}>
        {empty
          ? <div className="lumi-chart__visual" style={{ height }}>{emptyState}</div>
          : (
              <ul className="lumi-chart__bars" style={{ minHeight: height }}>
                {data.map((point, index) => (
                  <li key={`${point.label}-${index}`} title={`${point.label}: ${formatValue(point.value)}`}>
                    <span className="lumi-chart__bar-label">{point.label}</span>
                    <span className="lumi-chart__bar-track" aria-hidden>
                      <span className="lumi-chart__bar-fill" style={{ 'width': `${peak > 0 ? (Math.max(point.value, 0) * 100) / peak : 0}%`, '--lumi-chart-bar-fill': `var(--chart-${color})` } as CSSProperties} />
                    </span>
                    <b className="lumi-chart__bar-value">{formatValue(point.value)}</b>
                  </li>
                ))}
              </ul>
            )}
      </figure>
    )
  }

  const total = data.reduce((sum, point) => sum + point.value, 0)
  return (
    <figure className="lumi-chart" aria-label={ariaLabel} data-chart-type={type} data-chart-status={empty ? 'empty' : status}>
      <div className="lumi-chart__body">
        <div className="lumi-chart__visual" style={{ height }}>
          <div ref={host} className="lumi-chart__canvas" aria-hidden="true" />
          {empty
            ? emptyState
            : status !== 'ready' && <p className="lumi-chart__status" role="status">{status === 'error' ? errorLabel ?? t('lumi.chart.error', 'Chart unavailable') : t('lumi.chart.loading', 'Loading chart…')}</p>}
          {type === 'donut' && !empty && status === 'ready' && (
            <div className="lumi-chart__center" aria-hidden="true">
              <strong>{formatValue(total)}</strong>
              <span>{t('lumi.chart.total', 'Total')}</span>
            </div>
          )}
        </div>
        {type === 'donut' && !empty && (
          <ul className="lumi-chart__legend">
            {data.map((point, index) => (
              <li key={`${point.label}-${index}`}>
                <span>
                  <i style={{ background: `var(--chart-${index % 5 + 1})` }} />
                  {point.label}
                </span>
                <b>{formatValue(point.value)}</b>
                <small>{total > 0 ? `${Math.round((point.value / total) * 100)}%` : ''}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
      {(type !== 'donut' || empty) && (
        <table className="sr-only">
          <caption>{ariaLabel}</caption>
          <tbody>
            {data.map((point, index) => (
              <tr key={`${point.label}-${index}`}>
                <th scope="row">{point.label}</th>
                <td>{formatValue(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}

export type { LumiChartPoint, LumiChartProps } from '../catalog/types-public.js'
