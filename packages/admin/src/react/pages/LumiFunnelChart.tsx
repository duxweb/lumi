import type { CSSProperties, ReactElement } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { ChartTip } from './ChartTip.js'

export interface LumiFunnelStage {
  key: string
  label: string
  value: number
  /** Reads beside the band instead of the formatted value, e.g. `$1.2k`. */
  display?: string
}

export interface LumiFunnelChartProps {
  /** Ordered stages, widest first; each band is measured against the first stage. */
  stages: readonly LumiFunnelStage[]
  ariaLabel: string
  /** Chart palette colour (`--chart-1` … `--chart-5`) the bands step down from. */
  color?: 1 | 2 | 3 | 4 | 5
  /**
   * How a stage's share of the first sets its band width. `sqrt` keeps small
   * stages readable after a steep first drop; `linear` is strictly proportional.
   * Either way a band never drops below a minimum width or widens down the funnel.
   */
  scale?: 'sqrt' | 'linear'
  className?: string
}

/** Narrowest band, as a percentage of the track, so a tiny last stage still shows. */
const MIN_WIDTH = 24
/** Band intensity steps from the full colour at the top to this share at the bottom. */
const LAST_INTENSITY = 52
const CONNECTOR_INTENSITY = 26

/** Band widths in percent of the track: monotonic, never under `MIN_WIDTH`. */
export function funnelWidths(values: readonly number[], scale: 'sqrt' | 'linear' = 'sqrt'): number[] {
  const first = Math.max(values[0] ?? 0, 0)
  let previous = 100
  return values.map((value) => {
    const share = first > 0 ? Math.min(Math.max(value, 0) / first, 1) : 0
    const width = Math.min(previous, MIN_WIDTH + (100 - MIN_WIDTH) * (scale === 'linear' ? share : Math.sqrt(share)))
    previous = width
    return width
  })
}

/**
 * A centred funnel drawn in SVG: each stage is a band whose width tapers down
 * the funnel, and trapezoid connectors join consecutive bands into one
 * silhouette. The bands step from the full palette colour to a lighter tint;
 * the connectors carry the stage-to-stage conversion. Names and counts sit in
 * aligned side columns (above each band in a narrow card), and an ordered list
 * gives screen readers every stage with its share, conversion and drop-off.
 */
export function LumiFunnelChart({ stages, ariaLabel, color = 1, scale = 'sqrt', className }: LumiFunnelChartProps): ReactElement {
  const { t, locale } = useUiText()
  const count = new Intl.NumberFormat(locale)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const first = Math.max(stages[0]?.value ?? 0, 0)
  const ratio = (value: number, base: number): number => (base > 0 ? Math.max(value, 0) / base : 0)
  const widths = funnelWidths(stages.map(stage => stage.value), scale)
  const intensity = (index: number): number => (stages.length > 1 ? 100 - ((100 - LAST_INTENSITY) * index) / (stages.length - 1) : 100)
  const rows = stages.map((stage, index) => {
    const previous = stages[index - 1]
    return {
      stage,
      reading: stage.display ?? count.format(stage.value),
      share: percent.format(ratio(stage.value, first)),
      conversion: previous && t('lumi.funnel.conversion', '{rate} converted', { rate: percent.format(ratio(stage.value, previous.value)) }),
      dropOff: previous && t('lumi.funnel.dropOff', '{count} dropped', { count: count.format(Math.max(previous.value - stage.value, 0)) }),
    }
  })
  return (
    <figure className={['lumi-funnel-chart', className].filter(Boolean).join(' ')} aria-label={ariaLabel} style={{ '--lumi-funnel-fill': `var(--chart-${color})` } as CSSProperties}>
      <div className="lumi-funnel-chart__plot" aria-hidden>
        {rows.map(({ stage, reading, share, conversion, dropOff }, index) => {
          const width = widths[index]!
          const above = widths[index - 1]
          return [
            above !== undefined && (
              <div key={`${stage.key}-step`} className="lumi-funnel-chart__step">
                <span className="lumi-funnel-chart__connector">
                  <svg viewBox="0 0 100 1" preserveAspectRatio="none" style={{ '--lumi-funnel-mix': `${CONNECTOR_INTENSITY}%` } as CSSProperties}>
                    <polygon points={`${(100 - above) / 2},0 ${(100 + above) / 2},0 ${(100 + width) / 2},1 ${(100 - width) / 2},1`} />
                  </svg>
                  <span className="lumi-funnel-chart__rate">{conversion}</span>
                </span>
              </div>
            ),
            <div key={stage.key} className="lumi-funnel-chart__stage">
              <span className="lumi-funnel-chart__label">{stage.label}</span>
              <span className="lumi-funnel-chart__band">
                <svg viewBox="0 0 100 1" preserveAspectRatio="none" style={{ '--lumi-funnel-mix': `${intensity(index)}%` } as CSSProperties}>
                  <rect x={(100 - width) / 2} y={0} width={width} height={1} />
                </svg>
                <ChartTip label={stage.label} value={`${reading} · ${share}`} note={dropOff} />
              </span>
              <span className="lumi-funnel-chart__value">
                <b>{reading}</b>
                <small>{share}</small>
              </span>
            </div>,
          ]
        })}
      </div>
      <ol className="sr-only">
        {rows.map(({ stage, reading, share, conversion, dropOff }) => (
          <li key={stage.key}>{[`${stage.label}: ${reading} (${share})`, conversion, dropOff].filter(Boolean).join(', ')}</li>
        ))}
      </ol>
    </figure>
  )
}
