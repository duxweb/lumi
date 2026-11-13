import type { Tone } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { LumiBadge as Badge } from '@duxweb/lumi-ui'
import { ShellIcon } from '../components/ShellIcon.js'

export interface LumiMetricCardProps {
  label: string
  value: string | number
  /** Trails the value in a quieter face, e.g. `k` or `orders`. */
  unit?: string
  /** Leads the label; a registered icon name such as `receipt`. */
  icon?: string
  /**
   * Reads under the number: what it is compared against or where it came
   * from. Keep it to a few words — it repeats across the whole row.
   */
  description?: string
  /** Short delta chip, e.g. `+12.4%`. */
  change?: string
  tone?: Tone
  /** Recent history, oldest first. Drawn as mini bars; two points minimum. */
  series?: readonly number[]
  /**
   * `md` is the dashboard scale, where the number is the page. `sm` is the
   * strip above a table, where the table is the page.
   */
  scale?: 'md' | 'sm'
  className?: string
}

const PLACEHOLDER: readonly number[] = Array.from<number>({ length: 12 }).fill(0)

/**
 * At `md` the card has a header — what it is and how it moved — over a hairline,
 * and a body that is the number. At `sm` it is one label over one figure, so a
 * row of four still reads across.
 */
export function LumiMetricCard({ label, value, unit, icon, description, change, tone = 'neutral', series, scale = 'md', className }: LumiMetricCardProps): ReactElement {
  // A dashboard card without history still draws its row of columns, each at
  // the lowest step, so a row of cards keeps one shape.
  const placeholder = !(series && series.length > 1) && scale === 'md'
  const bars = series && series.length > 1 ? series : placeholder ? PLACEHOLDER : undefined
  // Bars are measured from zero, not from the window's own minimum: a series
  // that moved 1% would otherwise draw the same dramatic climb as one that
  // doubled. A zero keeps the shortest bar (a CSS minimum), so it holds its place.
  const peak = bars ? Math.max(...bars, 0) : 0
  const chip = change ? <Badge label={change} tone={tone} appearance="soft" /> : null
  const figure = (
    <p className="lumi-metric-card__value">
      {value}
      {unit && <small className="lumi-metric-card__unit">{unit}</small>}
    </p>
  )
  return (
    <article className={['lumi-metric-card', className].filter(Boolean).join(' ')} data-scale={scale} data-tone={tone}>
      <header className="lumi-metric-card__head">
        {icon && <ShellIcon name={icon} className="lumi-metric-card__icon" />}
        <p className="lumi-metric-card__label">{label}</p>
        {scale === 'md' && chip && <span className="lumi-metric-card__change">{chip}</span>}
      </header>
      <div className="lumi-metric-card__figure">
        {figure}
        {scale === 'sm' && chip}
        {scale === 'md' && description && <p className="lumi-metric-card__foot">{description}</p>}
        {scale === 'sm' && description && <span className="lumi-metric-card__foot">{description}</span>}
      </div>
      {bars && (
        <div className="lumi-metric-card__spark" aria-hidden data-placeholder={placeholder || undefined}>
          {bars.map((point, index) => (
            // The series is a fixed-length window; position is the identity.
            <span key={index} className="lumi-metric-card__col" data-last={(index === bars.length - 1 && !placeholder) || undefined}>
              <i style={{ height: peak > 0 ? `${(point / peak) * 100}%` : undefined }} />
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
