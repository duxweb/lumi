import type { UseFormReturn } from '@duxweb/lumi'
import type { FocusEvent, KeyboardEvent, ReactElement } from 'react'
import type { LumiSettingsRowProps } from './LumiSettingsPage.js'
import { LumiButton as Button, LumiForm as Form, useUiText } from '@duxweb/lumi-ui'
import { useContext, useEffect, useId, useRef, useState } from 'react'
import { LumiSaveStatus } from './LumiFormPage.js'
import { LumiSettingsRow } from './LumiSettingsPage.js'
import { SettingsHoldContext } from './settings-guard.js'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.js'

export type LumiSettingsSaveMode = 'auto' | 'manual'

export interface LumiSettingsFormProps<T extends Record<string, any>> extends Omit<LumiSettingsRowProps, 'actions' | 'status' | 'onSubmit'> {
  form: UseFormReturn<T>
  /**
   * `auto` saves each change on its own: switches, selects and choices when
   * they change, typed fields on blur or Enter. `manual` keeps Discard and Save
   * in the card footer for changes that need an explicit confirmation.
   */
  saveMode?: LumiSettingsSaveMode
  /** Locks the controls, e.g. while the record loads. */
  disabled?: boolean
  saveLabel?: string
  discardLabel?: string
  savingLabel?: string
  /** `auto`: shown briefly beside the heading. `manual`: shown in the footer after a save. */
  savedLabel?: string
  saveFailedLabel?: string
  retryLabel?: string
  dirtyLabel?: string
  /** `manual` footer text while nothing is pending. */
  cleanLabel?: string
  onSaved?: (result: Awaited<ReturnType<UseFormReturn<T>['submit']>>) => void
}

type AutoState = 'idle' | 'saving' | 'saved' | 'error'

const SAVED_VISIBLE_MS = 2000
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

/** Typed fields commit on blur or Enter rather than on every keystroke. */
function isTextEntry(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement)
    return true
  if (element instanceof HTMLInputElement)
    return !NON_TEXT_INPUTS.has(element.type)
  return element instanceof HTMLElement && element.isContentEditable
}

function changedFields(previous: Record<string, unknown>, next: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
}

/** One settings card bound to a form: it saves itself as values change, or on Save in `manual` mode. */
export function LumiSettingsForm<T extends Record<string, any>>(props: LumiSettingsFormProps<T>): ReactElement {
  const { t } = useUiText()
  const {
    form,
    saveMode = 'auto',
    disabled = false,
    saveLabel = t('lumi.form.save', 'Save'),
    discardLabel = t('lumi.settings.discard', 'Discard'),
    savingLabel = t('lumi.form.saving', 'Saving…'),
    savedLabel = saveMode === 'auto' ? t('lumi.settings.saved', 'Saved') : t('lumi.form.saved', 'Changes saved'),
    saveFailedLabel = t('lumi.form.saveFailed', 'Save failed'),
    retryLabel = t('lumi.page.retry', 'Retry'),
    dirtyLabel = t('lumi.form.dirty', 'Unsaved'),
    cleanLabel = t('lumi.settings.allSaved', 'All changes saved'),
    onSaved,
    className,
    children,
    onBlur,
    onKeyDown,
    ...row
  } = props
  const auto = saveMode === 'auto'
  const ownerId = useId()
  const hold = useContext(SettingsHoldContext)
  const latest = useRef(form)
  latest.current = form
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const [autoState, setAutoState] = useState<AutoState>('idle')
  const [manualResult, setManualResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [busy, setBusy] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [flushes, setFlushes] = useState(0)
  const running = useRef(false)
  const flushRequested = useRef(false)
  const rejected = useRef<string | undefined>(undefined)
  const committed = useRef<T>(form.values)
  const failed = useRef<T | undefined>(undefined)
  const section = useRef<HTMLElement>(null)
  const valuesKey = JSON.stringify(form.values)

  // A clean form holds the values the server last accepted.
  useEffect(() => {
    if (!form.isDirty && !running.current)
      committed.current = form.values
  }, [form.isDirty, valuesKey])

  const commit = async (): Promise<void> => {
    const current = latest.current
    const snapshot = current.values
    const key = JSON.stringify(snapshot)
    running.current = true
    setBusy(true)
    try {
      const issues = await current.validate({ fields: changedFields(committed.current, snapshot) })
      if (issues.length) {
        rejected.current = key
        setInvalid(true)
        return
      }
      rejected.current = undefined
      setInvalid(false)
      setAutoState('saving')
      try {
        const result = await current.submit()
        committed.current = snapshot
        failed.current = undefined
        setAutoState('saved')
        onSavedRef.current?.(result)
      }
      catch {
        // Optimistic values roll back to the last accepted ones; submit already raised the error toast.
        failed.current = snapshot
        latest.current.reset(committed.current)
        setAutoState('error')
      }
    }
    finally {
      running.current = false
      setBusy(false)
    }
  }

  // Changes queue behind the save in flight; the next run sends only the latest values.
  useEffect(() => {
    if (!auto || disabled || busy || running.current || !form.isDirty)
      return
    const explicit = flushRequested.current
    if (!explicit && rejected.current === valuesKey)
      return
    const active = document.activeElement
    if (!explicit && section.current?.contains(active) && isTextEntry(active))
      return
    flushRequested.current = false
    void commit()
  }, [auto, disabled, busy, form.isDirty, valuesKey, flushes])

  useEffect(() => {
    if (autoState !== 'saved')
      return
    const timer = setTimeout(() => setAutoState(state => state === 'saved' ? 'idle' : state), SAVED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [autoState])

  useEffect(() => {
    if (!form.isDirty)
      setInvalid(false)
  }, [form.isDirty])

  // The leave guard already asked, so a card that goes away (e.g. its tab closes)
  // drops the edits it could not save instead of leaving a hidden draft.
  useEffect(() => () => {
    const current = latest.current
    if (current.isDirty && !running.current)
      current.reset(committed.current)
  }, [])

  useEffect(() => {
    if (!auto && form.isDirty)
      setManualResult('idle')
  }, [auto, form.isDirty])

  const flush = (): void => {
    flushRequested.current = true
    setFlushes(count => count + 1)
  }
  const retry = (): void => {
    const values = failed.current
    if (!values)
      return
    latest.current.setValues(values)
    flush()
  }

  // Auto cards only hold the leave guard while a save runs or an invalid edit cannot be sent.
  const holding = auto ? busy || invalid : form.isDirty || form.isSubmitting
  useEffect(() => {
    if (!hold)
      return
    hold(ownerId, holding)
    return () => hold(ownerId, false)
  }, [hold, ownerId, holding])
  const guard = useUnsavedChangesGuard({ dirty: hold ? false : holding, owner: 'LumiSettingsForm' })

  const saveManually = (): void => {
    if (disabled || form.isSubmitting || !form.isDirty)
      return
    setManualResult('idle')
    void form.submit().then((result) => {
      setManualResult('success')
      onSavedRef.current?.(result)
    }, () => setManualResult('error'))
  }

  const status = auto
    ? (
        <LumiSaveStatus state={autoState === 'saved' ? 'success' : autoState} className="lumi-settings-row__save">
          {autoState === 'saving' && savingLabel}
          {autoState === 'saved' && savedLabel}
          {autoState === 'error' && (
            <>
              {saveFailedLabel}
              <button type="button" className="lumi-settings-row__retry" onClick={retry}>{retryLabel}</button>
            </>
          )}
        </LumiSaveStatus>
      )
    : undefined

  const actions = auto
    ? undefined
    : (
        <>
          {form.isSubmitting
            ? <LumiSaveStatus state="saving">{savingLabel}</LumiSaveStatus>
            : manualResult === 'error'
              ? <LumiSaveStatus state="error">{saveFailedLabel}</LumiSaveStatus>
              : form.isDirty
                ? <LumiSaveStatus state="dirty">{dirtyLabel}</LumiSaveStatus>
                : manualResult === 'success'
                  ? <LumiSaveStatus state="success">{savedLabel}</LumiSaveStatus>
                  : <LumiSaveStatus state="idle">{cleanLabel}</LumiSaveStatus>}
          <Button
            label={discardLabel}
            appearance="outline"
            size="sm"
            disabled={!form.isDirty || form.isSubmitting}
            onClick={() => {
              form.reset(committed.current)
              setManualResult('idle')
            }}
          />
          <Button type="submit" size="sm" label={saveLabel} loading={form.isSubmitting} disabled={!form.isDirty || form.isSubmitting || disabled} />
        </>
      )

  return (
    <Form
      className={['lumi-settings-form', className].filter(Boolean).join(' ')}
      value={form.values}
      disabled={disabled || (!auto && form.isSubmitting)}
      onSubmit={auto ? flush : saveManually}
    >
      <LumiSettingsRow
        {...row}
        ref={section}
        data-save-mode={saveMode}
        status={status}
        actions={actions}
        onBlur={(event: FocusEvent<HTMLElement>) => {
          onBlur?.(event)
          if (auto && isTextEntry(event.target))
            flush()
        }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          onKeyDown?.(event)
          if (auto && event.key === 'Enter' && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement && isTextEntry(event.target))
            flush()
        }}
      >
        {children}
      </LumiSettingsRow>
      {guard.dialog}
    </Form>
  )
}
