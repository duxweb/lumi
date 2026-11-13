import type { ReactElement, ReactNode } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { useId } from 'react'

export interface LumiCodeExampleProps {
  title: string
  /** One or two sentences on what the example shows; may hold inline `<code>`. */
  description?: ReactNode
  /** The source: a code block, an editor, or several files in tabs. */
  code: ReactNode
  /**
   * Caption above the source, for source without a header of its own, such as
   * an editor. A code block names its files in its own header.
   */
  codeLabel?: string
  /** Controls for the source beside its caption. */
  codeActions?: ReactNode
  /** The live result of the source. Without one the code takes the full width. */
  preview?: ReactNode
  /** Caption above the result; it also names the result region. */
  previewLabel?: string
  /** Controls for the result, such as a reset button, beside its caption. */
  previewActions?: ReactNode
  /** Controls for the whole example, beside its title. */
  actions?: ReactNode
  /**
   * `split` puts code and result side by side once the example is wide enough;
   * `stack` keeps the result below the code, for results that need the full
   * width, such as a table. Narrow examples always stack.
   */
  layout?: 'split' | 'stack'
  /** `center` places a small result in the middle of its pane instead of at the top. */
  align?: 'start' | 'center'
  id?: string
  className?: string
}

function Bar({ id, label, actions }: { id?: string, label: string, actions?: ReactNode }): ReactElement {
  return (
    <div className="lumi-code-example__bar">
      <span id={id} className="lumi-code-example__bar-label">{label}</span>
      {actions && <div className="lumi-code-example__bar-actions">{actions}</div>}
    </div>
  )
}

/**
 * A documented example: a short explanation, then the source and the result it
 * produces. Code is always visible; the two panes share one frame and one
 * height, so a short result never leaves the code hanging past it.
 */
export function LumiCodeExample({ title, description, code, codeLabel, codeActions, preview, previewLabel, previewActions, actions, layout = 'split', align = 'start', id, className }: LumiCodeExampleProps): ReactElement {
  const { t } = useUiText()
  const generated = useId()
  const titleId = `${id ?? generated}-title`
  const labelId = `${id ?? generated}-result`
  const hasPreview = preview !== undefined && preview !== null && preview !== false
  return (
    <section id={id} className={['lumi-code-example', className].filter(Boolean).join(' ')} data-layout={hasPreview ? layout : 'code'} data-align={align} aria-labelledby={titleId}>
      <header className="lumi-code-example__header">
        <div className="lumi-code-example__copy">
          <h2 id={titleId} className="lumi-code-example__title">{title}</h2>
          {description && <div className="lumi-code-example__description">{description}</div>}
        </div>
        {actions && <div className="lumi-code-example__actions">{actions}</div>}
      </header>
      <div className="lumi-code-example__body">
        <div className="lumi-code-example__code">
          {codeLabel && <Bar label={codeLabel} actions={codeActions} />}
          {code}
        </div>
        {hasPreview && (
          // Every example has a result region; the title keeps their names unique.
          <div className="lumi-code-example__preview" role="region" aria-labelledby={`${labelId} ${titleId}`}>
            <Bar id={labelId} label={previewLabel ?? t('lumi.example.result', 'Result')} actions={previewActions} />
            <div className="lumi-code-example__result">{preview}</div>
          </div>
        )}
      </div>
    </section>
  )
}
