import type { ReactElement, ReactNode } from 'react'
import { ShellIcon } from '../components/ShellIcon.js'

export interface LumiToggleRowProps {
  title: ReactNode
  /** One line on what turning it on actually does. */
  description?: ReactNode
  /** Manifest icon name shown before the title, e.g. `mail` or `bell`. */
  icon?: string
  /**
   * Id of the control on the right. The title becomes its `<label>` and the
   * description its `aria-describedby` target (`${controlId}-description`).
   */
  controlId?: string
  /** The control itself: a switch, a compact select or a short input. */
  children: ReactNode
  /** Field error under the description, linked as `${controlId}-error`. */
  error?: ReactNode
  className?: string
}

/**
 * A settings switch is a row, not a field and not a card: the sentence explains
 * it on the left and the control answers on the right. Giving each one a card
 * would make six minor preferences look like six major objects.
 */
export function LumiToggleRow({ title, description, icon, controlId, children, error, className }: LumiToggleRowProps): ReactElement {
  const heading = (
    <>
      {icon && <ShellIcon name={icon} className="lumi-toggle-row__icon" />}
      {title}
    </>
  )
  return (
    <div className={['lumi-toggle-row', className].filter(Boolean).join(' ')} data-invalid={error ? '' : undefined}>
      <span className="lumi-toggle-row__copy">
        {controlId ? <label className="lumi-toggle-row__title" htmlFor={controlId}>{heading}</label> : <b className="lumi-toggle-row__title">{heading}</b>}
        {description && <small id={controlId ? `${controlId}-description` : undefined}>{description}</small>}
        {error && <small className="lumi-toggle-row__error" id={controlId ? `${controlId}-error` : undefined} role="alert">{error}</small>}
      </span>
      <span className="lumi-toggle-row__control">{children}</span>
    </div>
  )
}
