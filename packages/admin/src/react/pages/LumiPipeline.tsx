import type { ReactElement } from 'react'

export interface LumiPipelineStage {
  key: string
  label: string
  value: number
  /**
   * Stage colour. `neutral` is the lightest ground, for stages that carry no
   * verdict; `muted` is a step darker, for in-progress stages.
   */
  tone?: 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info'
}

export interface LumiPipelineProps {
  stages: readonly LumiPipelineStage[]
  ariaLabel: string
  className?: string
}

/**
 * One bar for the whole, one breakdown row per stage. A proportion list would
 * rank the stages against each other; a pipeline is about how one population
 * divides, so the stages share a single bar and the rows underneath carry the
 * counts and shares, like a disk usage bar. In a wide container the rows fold
 * into a legend grid under the bar.
 */
export function LumiPipeline({ stages, ariaLabel, className }: LumiPipelineProps): ReactElement {
  const total = stages.reduce((sum, stage) => sum + stage.value, 0)
  const share = (value: number): string => (total > 0 ? `${Math.round((value / total) * 1000) / 10}%` : '0%')
  return (
    <div className={['lumi-pipeline', className].filter(Boolean).join(' ')}>
      <div className="lumi-pipeline__bar" aria-hidden>
        {stages.map(stage => stage.value > 0 && (
          <i key={stage.key} data-tone={stage.tone ?? 'neutral'} style={{ flexGrow: stage.value }} />
        ))}
      </div>
      <ul className="lumi-pipeline__legend" aria-label={ariaLabel}>
        {stages.map(stage => (
          <li key={stage.key}>
            <i className="lumi-pipeline__swatch" data-tone={stage.tone ?? 'neutral'} aria-hidden />
            <span className="lumi-pipeline__label">{stage.label}</span>
            <b className="lumi-pipeline__reading">
              <span className="lumi-pipeline__value">{stage.value.toLocaleString()}</span>
              <small className="lumi-pipeline__share">{share(stage.value)}</small>
            </b>
          </li>
        ))}
      </ul>
    </div>
  )
}
