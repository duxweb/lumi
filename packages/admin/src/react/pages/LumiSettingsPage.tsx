import type { HTMLAttributes, ReactElement, ReactNode, Ref } from 'react'
import type { LumiPageHeaderProps } from './LumiPage.js'
import type { LumiPageState } from './state.js'
import { LumiTabs as Tabs, useUiText } from '@duxweb/lumi-ui'
import { useCallback, useId, useState } from 'react'
import { LumiPage, LumiPageHeader } from './LumiPage.js'
import { SettingsHoldContext } from './settings-guard.js'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.js'

export interface LumiSettingsSection {
  value: string
  label: string
  /** Optional host metadata. Horizontal settings tabs do not render group headings. */
  group?: string
  disabled?: boolean
  /** Heading shown above the active section's form. Defaults to `label`. */
  title?: string
  /** One line explaining what can be changed in this section. */
  description?: string
  /** Hides the active-tab heading when the content supplies its own titled rows. */
  showHeader?: boolean
  /** `rows` contains independent setting cards; `content` owns one shared card. */
  layout?: 'rows' | 'content'
  /** Overrides the page actions for this section. Set to `false` for read-only content. */
  actions?: ReactNode | false
  content: ReactNode
}

export interface LumiSettingsPageProps extends LumiPageHeaderProps {
  sections: readonly LumiSettingsSection[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  dirty?: boolean
  state?: LumiPageState
  sectionsTitle?: string
  sectionsDescription?: string
  /** Save state or validation feedback shown beside the section actions. */
  status?: ReactNode
  navLabel?: string
  leaveTitle?: string
  leaveDescription?: string
}

export interface LumiSettingsRowProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'> {
  label: ReactNode
  description?: ReactNode
  required?: boolean
  /** Arranges compact controls below the heading. Two columns collapse on narrow screens. */
  columns?: 1 | 2
  /** Actions and status owned by this group, rendered in its card footer. */
  actions?: ReactNode
  /** Save feedback beside the heading, in a fixed-width slot so the heading never moves. */
  status?: ReactNode
  children?: ReactNode
  className?: string
  ref?: Ref<HTMLElement>
}

/** A settings group owns one card with a heading, fields and optional footer. */
export function LumiSettingsRow({ label, description, required, columns = 1, actions, status, children, className, ...rest }: LumiSettingsRowProps): ReactElement {
  const titleId = useId()
  return (
    <section {...rest} className={['lumi-settings-row', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <div className="lumi-settings-page__measure lumi-settings-row__inner">
        <header className="lumi-settings-row__copy">
          <h3 className="lumi-settings-row__label" id={titleId}>
            {label}
            {required && <span data-slot="required-mark" aria-hidden> *</span>}
          </h3>
          {status !== undefined && <div className="lumi-settings-row__status">{status}</div>}
          {description && <div className="lumi-settings-row__description">{description}</div>}
        </header>
        <div className="lumi-settings-row__control" data-columns={columns}>
          {children}
        </div>
      </div>
      {actions && <footer className="lumi-settings-row__actions">{actions}</footer>}
    </section>
  )
}

export function LumiSettingsPage(props: LumiSettingsPageProps): ReactElement {
  const { t } = useUiText()
  const { sections, value, defaultValue, onChange, dirty = false, state, sectionsTitle, sectionsDescription, status, navLabel = t('lumi.settings.sections', 'Settings sections'), leaveTitle, leaveDescription, ...header } = props
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set())
  const hold = useCallback((id: string, holding: boolean): void => setHeld((current) => {
    if (current.has(id) === holding)
      return current
    const next = new Set(current)
    if (holding)
      next.add(id)
    else
      next.delete(id)
    return next
  }), [])
  const dirtyGuard = useUnsavedChangesGuard({ dirty: dirty || held.size > 0, owner: 'LumiSettingsPage', title: leaveTitle, description: leaveDescription })
  const [internal, setInternal] = useState(() => defaultValue ?? sections[0]?.value ?? '')
  const current = value ?? internal
  const select = (next: string): void => dirtyGuard.request(() => {
    if (value === undefined)
      setInternal(next)
    onChange?.(next)
  })
  const actions = header.actions
  return (
    <SettingsHoldContext.Provider value={hold}>
      <LumiPage className="lumi-settings-page" state={state} ariaLabel={header.title}>
        <div className="lumi-settings-page__measure lumi-settings-page__top">
          <LumiPageHeader title={header.title} description={header.description} meta={header.meta} />
        </div>
        <Tabs
          className="lumi-settings-page__tabs"
          aria-label={navLabel}
          value={current}
          items={sections.map(section => ({ value: section.value, label: section.label, disabled: section.disabled }))}
          onChange={select}
        >
          {sections.map((section) => {
            const sectionTitle = section.title ?? sectionsTitle ?? section.label
            const sectionDescription = section.description ?? sectionsDescription
            const sectionActions = section.actions === false ? undefined : section.actions ?? actions
            const sectionStatus = sectionActions ? status : undefined
            const sectionLayout = section.layout ?? 'content'
            return (
              <section key={section.value} className="lumi-settings-page__workspace" data-layout={sectionLayout} aria-label={sectionTitle}>
                {section.showHeader !== false && (
                  <header className="lumi-settings-page__section-header">
                    <div className="lumi-settings-page__measure lumi-settings-page__section-header-inner">
                      <div className="lumi-settings-page__section-copy">
                        <h2>{sectionTitle}</h2>
                        {sectionDescription && <p>{sectionDescription}</p>}
                      </div>
                    </div>
                  </header>
                )}
                <div className="lumi-settings-page__panel" data-layout={sectionLayout}>
                  {sectionLayout === 'rows'
                    ? section.content
                    : <div className="lumi-settings-page__measure lumi-settings-page__content">{section.content}</div>}
                </div>
                {sectionActions && (
                  <footer className="lumi-settings-page__footer-actions">
                    <div className="lumi-settings-page__measure lumi-settings-page__footer-actions-inner">
                      {sectionStatus}
                      {sectionActions}
                    </div>
                  </footer>
                )}
              </section>
            )
          })}
        </Tabs>
        {dirtyGuard.dialog}
      </LumiPage>
    </SettingsHoldContext.Provider>
  )
}
