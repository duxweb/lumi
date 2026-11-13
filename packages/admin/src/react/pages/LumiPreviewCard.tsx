import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { LumiBadge as Badge } from '@duxweb/lumi-ui'
import { useId } from 'react'

export interface LumiPreviewCardProps {
  title: string
  /** One line; a longer text is truncated and stays whole in the tooltip. */
  description?: string
  /** A short label over the preview's top-left corner, such as a category. */
  badge?: string
  /** A static miniature of the subject. It is inert and hidden from assistive technology; the title names the card. */
  preview: ReactNode
  /** Shrinks a miniature that is larger than the frame, e.g. `0.75`. */
  previewScale?: number
  /** Opens the subject. The title becomes a link stretched over the card. */
  href?: string
  className?: string
}

/**
 * A gallery tile: a fixed-ratio preview on a muted surface above a name and a
 * one-line description. Every tile in a row has the same height whatever its
 * preview holds.
 */
export function LumiPreviewCard({ title, description, badge, preview, previewScale, href, className }: LumiPreviewCardProps): ReactElement {
  const titleId = useId()
  // Zoom keeps the full frame width and lays the miniature out in more, smaller pixels.
  const stage: CSSProperties | undefined = previewScale && previewScale !== 1 ? { zoom: previewScale } : undefined
  return (
    <article className={['lumi-preview-card', className].filter(Boolean).join(' ')} data-link={href ? '' : undefined} aria-labelledby={titleId}>
      <div className="lumi-preview-card__media">
        <div className="lumi-preview-card__stage" inert aria-hidden="true">
          <div className="lumi-preview-card__content" style={stage}>{preview}</div>
        </div>
        {badge && <Badge className="lumi-preview-card__badge" label={badge} tone="neutral" appearance="outline" />}
      </div>
      <div className="lumi-preview-card__body">
        <h3 id={titleId} className="lumi-preview-card__title">
          {href ? <a className="lumi-preview-card__link" href={href}>{title}</a> : title}
        </h3>
        {description && <p className="lumi-preview-card__description" title={description}>{description}</p>}
      </div>
    </article>
  )
}
