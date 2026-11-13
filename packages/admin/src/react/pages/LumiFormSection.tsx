import type { ReactElement, ReactNode } from 'react'

export interface LumiFormSectionProps {
  /**
   * Band label. Rendered as a section title, not as a larger field label.
   * Leave it out when the fields explain themselves, such as an editor's
   * title and body; give `ariaLabel` instead.
   */
  title?: string
  /** One line explaining what the group covers. */
  description?: string
  /** Names an untitled section for assistive technology. */
  ariaLabel?: string
  /**
   * `grid` lays fields out in two columns; `rows` stacks full-width rows under
   * one shared rule, which is what toggle lists want.
   */
  variant?: 'grid' | 'rows'
  children?: ReactNode
  className?: string
}

/** A titled group of form rows. */
export function LumiFormSection({ title, description, ariaLabel, variant = 'grid', children, className }: LumiFormSectionProps): ReactElement {
  return (
    <section className={['lumi-form-section', className].filter(Boolean).join(' ')} aria-label={title ? undefined : ariaLabel}>
      {title && <h3 className="lumi-form-section__title">{title}</h3>}
      {description && <p className="lumi-form-section__description">{description}</p>}
      <div className="lumi-form-section__fields" data-variant={variant}>{children}</div>
    </section>
  )
}

export interface LumiFormRowProps {
  /** Makes the field span both columns of a `grid` section. */
  span?: 'half' | 'full'
  /**
   * Trailing content on the field's label line, e.g. a suggestion with
   * Apply / Ignore buttons or a character count. The field keeps its own label.
   */
  action?: ReactNode
  children?: ReactNode
  className?: string
}

/** One row of a form section, half or full width, with an optional action beside it. */
export function LumiFormRow({ span = 'half', action, children, className }: LumiFormRowProps): ReactElement {
  return (
    <div className={['lumi-form-row', className].filter(Boolean).join(' ')} data-span={span} data-action={action ? '' : undefined}>
      {action && <div className="lumi-form-row__action">{action}</div>}
      {children}
    </div>
  )
}
