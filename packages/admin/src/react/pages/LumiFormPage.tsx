import type { UseFormReturn } from '@duxweb/lumi'
import type { ReactElement, ReactNode } from 'react'
import type { LumiPageHeaderProps } from './LumiPage.js'
import type { LumiPageState } from './state.js'
import {
  LumiAlert as Alert,
  LumiButton as Button,
  LumiForm as Form,
  LumiSpinner as Spinner,
  useUiText,
} from '@duxweb/lumi-ui'
import { useEffect, useRef, useState } from 'react'
import { CheckIcon } from '../icons.js'
import { LumiPage, LumiPageHeader } from './LumiPage.js'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.js'

export type LumiSaveState = 'idle' | 'dirty' | 'saving' | 'success' | 'error'

export interface LumiSaveStatusProps {
  state: LumiSaveState
  children?: ReactNode
  className?: string
}

/**
 * Save feedback for a form or settings group: a warning dot while dirty, a
 * check in the success tone once saved, muted text otherwise. It is a live
 * region, so every change is announced once.
 */
export function LumiSaveStatus({ state, children, className }: LumiSaveStatusProps): ReactElement {
  return (
    <span className={['lumi-save-status', className].filter(Boolean).join(' ')} role="status" aria-live="polite" data-state={state}>
      {state === 'saving' && <span className="lumi-save-status__icon" aria-hidden><Spinner size="sm" tone="muted" /></span>}
      {state === 'success' && <CheckIcon className="lumi-save-status__icon" aria-hidden focusable="false" />}
      {children}
    </span>
  )
}

export interface LumiFormPageActionContext {
  /** Awaits validation and submit; repeated calls while saving are ignored. */
  save: () => Promise<void>
  reset: () => void
  saving: boolean
  dirty: boolean
}

export interface LumiFormPageSection {
  key: string
  label: string
  /** One line under the step title. Ignored by the `tabs` layout. */
  description?: string
  content: ReactNode
  /** Marks the tab as holding errors; the step footer keeps its own state. */
  invalid?: boolean
  disabled?: boolean
  /** Offers a Skip control on this step. */
  optional?: boolean
  fields?: readonly string[]
}

export interface LumiFormPageProps<
  T extends Record<string, any>,
> extends LumiPageHeaderProps {
  form: UseFormReturn<T>
  children?: ReactNode
  /**
   * `centered` groups fields in cards. An optional aside adds a metadata column.
   * `tabs` and `steps` split a long form by `sections` — tabs when the parts are
   * independent, steps when a later part depends on an earlier one.
   */
  layout?: 'centered' | 'publish' | 'tabs' | 'steps'
  /** Optional supporting blocks beside any form layout, one node per group. */
  aside?: ReactNode
  /** The parts of the form, for `tabs` and `steps`. */
  sections?: readonly LumiFormPageSection[]
  activeSection?: string
  defaultSection?: string
  onSectionChange?: (key: string) => void
  backLabel?: string
  continueLabel?: string
  finishLabel?: string
  skipLabel?: string
  state?: LumiPageState
  formTitle?: string
  formDescription?: string
  saveLabel?: string
  savingLabel?: string
  /** Shown on the well while the form holds unsaved work. */
  dirtyLabel?: string
  /** Announced once after a successful save, then cleared by the next edit. */
  savedLabel?: string
  resetLabel?: string
  leaveTitle?: string
  leaveDescription?: string
  beforeSubmit?: () => boolean | Promise<boolean>
  /**
   * Replaces the built-in Reset / Save buttons (not used by `steps`). The save
   * state label and `actions` still render; use it for paired commits such as
   * Save draft and Publish that write a field before saving.
   */
  renderActions?: (context: LumiFormPageActionContext) => ReactNode
  onSaved?: (
    result: Awaited<ReturnType<UseFormReturn<T>['submit']>>,
  ) => void | Promise<void>
}

export function LumiFormPage<T extends Record<string, any>>(props: LumiFormPageProps<T>): ReactElement {
  const { t } = useUiText()
  const {
    form,
    children,
    layout = 'centered',
    aside,
    sections,
    activeSection,
    defaultSection,
    onSectionChange,
    backLabel = t('lumi.form.back', 'Back'),
    continueLabel = t('lumi.form.continue', 'Next'),
    finishLabel = t('lumi.form.finish', 'Finish'),
    skipLabel = t('lumi.form.skip', 'Skip'),
    state,
    formTitle,
    formDescription,
    saveLabel = t('lumi.form.save', 'Save'),
    savingLabel = t('lumi.form.saving', 'Saving…'),
    dirtyLabel = t('lumi.form.dirty', 'Unsaved'),
    savedLabel = t('lumi.form.saved', 'Changes saved'),
    resetLabel = t('lumi.form.reset', 'Reset'),
    leaveTitle = t('lumi.form.leaveTitle', 'Discard unsaved changes?'),
    leaveDescription = t('lumi.form.leaveDescription', 'This page has unsaved changes. Leave the page and discard them?'),
    onSaved,
    beforeSubmit,
    renderActions,
    ...header
  } = props
  const dirtyGuard = useUnsavedChangesGuard({
    dirty: form.isDirty,
    owner: 'LumiFormPage',
    title: leaveTitle,
    description: leaveDescription,
  })
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>(
    'idle',
  )
  const [saveError, setSaveError] = useState<string>()
  const saving = useRef(false)

  useEffect(() => {
    if (form.isDirty && saveResult === 'success')
      setSaveResult('idle')
  }, [form.isDirty, saveResult])

  // `submit` settles the form's baseline on the next render. `onSaved` often
  // navigates away, so it waits for that commit: by then the unsaved-changes
  // guard above has registered the clean draft and lets the navigation through.
  const settled = useRef<(() => void) | null>(null)
  const [, setSettleTick] = useState(0)
  useEffect(() => {
    const resolve = settled.current
    settled.current = null
    resolve?.()
  })
  const afterCommit = (): Promise<void> => new Promise<void>((resolve) => {
    settled.current = resolve
    setSettleTick(tick => tick + 1)
  })
  const save = async (): Promise<void> => {
    if (form.isSubmitting || saving.current)
      return
    saving.current = true
    setSaveResult('idle')
    setSaveError(undefined)
    try {
      if (beforeSubmit && !(await beforeSubmit()))
        return
      const result = await form.submit()
      if (onSaved) {
        await afterCommit()
        await onSaved(result)
      }
      setSaveResult('success')
    }
    catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t('lumi.form.saveFailedReason', 'The changes could not be saved.'),
      )
      setSaveResult('error')
    }
    finally {
      saving.current = false
    }
  }
  const reset = (): void => {
    form.reset()
    setSaveResult('idle')
    setSaveError(undefined)
  }
  const saveState: LumiSaveState = form.isSubmitting
    ? 'saving'
    : saveResult === 'error'
      ? 'error'
      : saveResult === 'success' && !form.isDirty
        ? 'success'
        : form.isDirty
          ? 'dirty'
          : 'idle'

  const parts = sections ?? []
  const [internalSection, setInternalSection] = useState(
    () => defaultSection ?? parts[0]?.key ?? '',
  )
  const currentKey = activeSection ?? internalSection
  const currentIndex = Math.max(
    0,
    parts.findIndex(part => part.key === currentKey),
  )
  const goto = (key: string): void => {
    if (activeSection === undefined)
      setInternalSection(key)
    onSectionChange?.(key)
  }
  const [checkingStep, setCheckingStep] = useState(false)
  const stepGate = useRef(false)
  const advance = async (key: string): Promise<void> => {
    if (stepGate.current || form.isSubmitting)
      return
    stepGate.current = true
    setCheckingStep(true)
    try {
      const destination = parts.findIndex(part => part.key === key)
      const traversed = parts.slice(currentIndex, destination)
      const fields = traversed.every(part => part.fields !== undefined)
        ? traversed.flatMap(part => [...part.fields!])
        : undefined
      const errors = await form.validate({ fields })
      if (!errors.length) {
        goto(key)
      }
      else {
        setSaveError(errors[0]?.message)
        setSaveResult('error')
      }
    }
    catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      setSaveResult('error')
    }
    finally {
      stepGate.current = false
      setCheckingStep(false)
    }
  }
  const stepped = layout === 'steps' && parts.length > 0
  const tabbed = layout === 'tabs' && parts.length > 0

  // Tabbed forms place actions beside their section navigation. Other forms
  // place them beside the page title. A step form owns its commit in the footer.
  const controls = (
    <>
      <span
        className="lumi-form-page__feedback"
        data-save-state={saveState}
        aria-live="polite"
      >
        {/* Every label stays mounted in one cell, so the actions keep their place as the state changes. */}
        <span className="lumi-form-page__dirty" data-state="dirty">{dirtyLabel}</span>
        <span data-state="saving">{savingLabel}</span>
        <span data-state="success">{savedLabel}</span>
      </span>
      {header.actions}
      {renderActions && !stepped
        ? renderActions({ save, reset, saving: form.isSubmitting, dirty: form.isDirty })
        : (
            <Button
              label={resetLabel}
              appearance="outline"
              size={stepped ? 'sm' : 'md'}
              disabled={!form.isDirty || form.isSubmitting}
              onClick={reset}
            />
          )}
      {!stepped && !renderActions && (
        <Button
          label={saveLabel}
          loading={form.isSubmitting}
          disabled={!form.isDirty || form.isSubmitting}
          onClick={() => {
            void save()
          }}
        />
      )}
    </>
  )

  const alert = saveState === 'error' && (
    <div className="lumi-form-page__alert">
      <Alert
        tone="danger"
        title={t('lumi.form.saveFailed', 'Save failed')}
        message={saveError ?? t('lumi.form.saveFailedReason', 'The changes could not be saved.')}
      />
    </div>
  )
  const lastStep = currentIndex === parts.length - 1
  // The step actions close the form column, so they never run under the aside.
  // Back appears once there is a step behind; the last step commits.
  const stepFooter = stepped && (
    <div className="lumi-form-page__stepfoot">
      <span className="lumi-form-page__stepcount">{t('lumi.form.stepCount', 'Step {current} of {total}', { current: currentIndex + 1, total: parts.length })}</span>
      <div className="lumi-form-page__stepfoot-actions">
        {currentIndex > 0 && (
          <Button
            label={backLabel}
            appearance="outline"
            icon="chevron-left"
            disabled={form.isSubmitting}
            onClick={() => goto(parts[currentIndex - 1]!.key)}
          />
        )}
        {parts[currentIndex]?.optional && !lastStep && (
          <Button
            label={skipLabel}
            appearance="ghost"
            onClick={() => goto(parts[currentIndex + 1]!.key)}
          />
        )}
        {lastStep
          ? (
              <Button
                label={finishLabel}
                icon={form.isSubmitting ? undefined : 'check'}
                loading={form.isSubmitting}
                disabled={form.isSubmitting}
                onClick={() => {
                  void save()
                }}
              />
            )
          : (
              <Button
                label={continueLabel}
                icon={checkingStep ? undefined : 'chevron-right'}
                iconPosition="right"
                loading={checkingStep}
                onClick={() => void advance(parts[currentIndex + 1]!.key)}
              />
            )}
      </div>
    </div>
  )
  const sectionBody = stepped
    ? (
        <div className="lumi-form-page__step-panel">
          {parts[currentIndex]?.content}
          {stepFooter}
        </div>
      )
    : parts[currentIndex]?.content
  const body
    = aside
      ? (
          <div className="lumi-form-page__publish">
            <div className="lumi-form-page__main">
              {alert}
              {tabbed || stepped ? sectionBody : children}
            </div>
            {aside && (
              <aside className="lumi-form-page__aside" aria-label={t('lumi.form.metadata', 'Metadata')}>
                {aside}
              </aside>
            )}
          </div>
        )
      : (
          <div className="lumi-form-page__body">
            {alert}
            {tabbed || stepped ? sectionBody : children}
          </div>
        )

  const tabs = tabbed && (
    <div
      className="lumi-form-page__tabs"
      role="tablist"
      aria-label={header.title}
    >
      {parts.map(part => (
        <button
          key={part.key}
          type="button"
          role="tab"
          id={`${part.key}-tab`}
          aria-selected={part.key === currentKey}
          aria-controls={`${part.key}-panel`}
          disabled={part.disabled}
          data-active={part.key === currentKey || undefined}
          data-invalid={part.invalid || undefined}
          className="lumi-form-page__tab"
          onClick={() => goto(part.key)}
        >
          {part.label}
          {part.invalid && (
            <span className="lumi-form-page__tab-dot" aria-label={t('lumi.form.hasErrors', 'Has errors')} />
          )}
        </button>
      ))}
    </div>
  )
  const progress = stepped && (
    <LumiFormSteps
      parts={parts}
      currentIndex={currentIndex}
      onGoto={(key) => {
        const index = parts.findIndex(part => part.key === key)
        if (index <= currentIndex)
          goto(key)
        else void advance(key)
      }}
    />
  )
  const surfaceLead
    = progress
      || (formTitle || formDescription
        ? (
            <div className="lumi-form-page__surface-copy">
              {formTitle && <h2>{formTitle}</h2>}
              {formDescription && <p>{formDescription}</p>}
            </div>
          )
        : undefined)

  return (
    <LumiPage
      className={`lumi-form-page lumi-form-page--${layout}`}
      state={state}
      ariaLabel={header.title}
    >
      <LumiPageHeader
        title={header.title}
        description={header.description}
        actions={tabbed ? undefined : controls}
        meta={header.meta}
      />
      {tabbed && (
        <div className="lumi-form-page__page-tabs">
          {tabs}
          <div className="lumi-form-page__page-tabs-actions">{controls}</div>
        </div>
      )}
      <section
        className="lumi-form-page__surface"
        data-layout={layout}
        aria-label={t('lumi.form.name', '{title} form', { title: header.title })}
      >
        {!formTitle && <h2 className="sr-only">{t('lumi.form.name', '{title} form', { title: header.title })}</h2>}
        {surfaceLead && (
          <header className="lumi-form-page__toolbar">{surfaceLead}</header>
        )}
        <Form
          value={form.values}
          disabled={form.isSubmitting}
          layout="vertical"
          onSubmit={() => {
            void save()
          }}
        >
          {tabbed
            ? (
                <div
                  id={`${currentKey}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${currentKey}-tab`}
                >
                  {body}
                </div>
              )
            : (
                body
              )}
        </Form>
      </section>
      {dirtyGuard.dialog}
    </LumiPage>
  )
}

/** Progress band: filled for finished steps, outlined for the one in hand. */
function LumiFormSteps({
  parts,
  currentIndex,
  onGoto,
}: {
  parts: readonly LumiFormPageSection[]
  currentIndex: number
  onGoto: (key: string) => void
}): ReactElement {
  return (
    <ol className="lumi-form-page__steps">
      {parts.map((part, index) => {
        const state
          = index < currentIndex
            ? 'done'
            : index === currentIndex
              ? 'now'
              : 'todo'
        return (
          <li
            key={part.key}
            className="lumi-form-page__step"
            data-state={state}
          >
            <button
              type="button"
              className="lumi-form-page__step-dot"
              aria-current={state === 'now' ? 'step' : undefined}
              disabled={state === 'todo'}
              onClick={() => onGoto(part.key)}
            >
              {state === 'done' ? '✓' : index + 1}
            </button>
            <span className="lumi-form-page__step-text">
              <b>{part.label}</b>
              {part.description && <small>{part.description}</small>}
            </span>
            {index < parts.length - 1 && (
              <span
                className="lumi-form-page__step-line"
                data-done={index < currentIndex || undefined}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
