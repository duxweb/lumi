import type { ReactElement, ReactNode } from 'react'
import { LumiCard as Card } from '@duxweb/lumi-ui'

export interface LumiDashboardCardProps {
  title: string
  description?: string
  /** Rides the header's trailing edge, e.g. a total chip. */
  action?: ReactNode
  /** One line under the body, above a hairline — where the peak sits, and so on. */
  footer?: ReactNode
  children?: ReactNode
  /** Claims the full measure of the dashboard grid. */
  span?: 'full'
  /** Body without padding, for a table or list that runs edge to edge. */
  flush?: boolean
  className?: string
}

/**
 * A dashboard panel is a Card, not a Frame: the Frame's outer well exists to
 * hold a page header above a data grid, and a chart has neither. Wrapping one
 * figure in two surfaces is the card-in-card the design brief rejects.
 */
export function LumiDashboardCard({ title, description, action, footer, children, span, flush, className }: LumiDashboardCardProps): ReactElement {
  return (
    <div className={['lumi-dashboard-card', className].filter(Boolean).join(' ')} data-span={span} data-flush={flush || undefined}>
      <Card title={title} description={description} headerEnd={action}>
        {children}
        {footer && <div className="lumi-dashboard-card__footer">{footer}</div>}
      </Card>
    </div>
  )
}
