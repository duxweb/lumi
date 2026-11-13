import type { Tone } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import type { LumiPageHeaderProps } from './LumiPage.js'
import type { LumiPageState } from './state.js'
import { useUiText } from '@duxweb/lumi-ui'
import { LumiMetricCard } from './LumiMetricCard.js'
import { LumiPage, LumiPageHeader } from './LumiPage.js'

export interface LumiDashboardMetric {
  key: string
  label: string
  value: string | number
  /** Trails the value in a quieter face. */
  unit?: string
  /** Leads the label; a registered icon name. */
  icon?: string
  description?: string
  change?: string
  tone?: Tone
  /** Recent history for the card's sparkline, oldest first. */
  series?: readonly number[]
}

export interface LumiDashboardPageProps extends LumiPageHeaderProps {
  metrics?: readonly LumiDashboardMetric[]
  children?: ReactNode
  state?: LumiPageState
}

/** A bounded workspace with one shared axis for its heading, metrics and panels. */
export function LumiDashboardPage({ metrics = [], children, state, ...header }: LumiDashboardPageProps): ReactElement {
  const { t } = useUiText()
  return (
    <LumiPage state={state} ariaLabel={header.title} className="lumi-dashboard-page">
      <LumiPageHeader {...header} />
      <div className="lumi-dashboard-body">
        {metrics.length > 0 && (
          // A metric card is its own object: one number, its delta, and where it
          // came from. A Frame is the data-grid container and does not belong
          // around a single figure.
          <div className="lumi-metric-cards" aria-label={t('lumi.dashboard.metrics', 'Key metrics')}>
            {metrics.map(({ key, ...metric }) => <LumiMetricCard key={key} {...metric} scale="md" />)}
          </div>
        )}
        {children && <div className="lumi-dashboard-content">{children}</div>}
      </div>
    </LumiPage>
  )
}
