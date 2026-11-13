import type { FormStatus } from '../core/actions.js'
import type {
  FormDraftOptions,
  FormErrorGroup,
  FormGroupDefinition,
  FormValidateOptions,
  FormValidationIssue,
  ID,
  SingleResult,
  ValidationRules,
} from '../core/index.js'
import { useStateStore } from '@json-render/react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useEffect,
  useId,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createLumiHandlers,
  errorsForFields,
  firstFormError,
  formStatusPath,
  groupFormErrors,
  replaceFieldErrors,
  setPathValue,
  toastError,
  validateForm,
} from '../core/index.js'
import { useLumi } from './context.js'
import { useScopedTarget } from './data-scope.js'

export interface UseFormOptions<
  T extends Record<string, any> = Record<string, any>,
> {
  /** The resource the form saves to. */
  resource: string
  /** With an id the record is loaded and the form updates it; without one it creates. */
  id?: ID
  /** Values of a new record. An edited record initializes once it has loaded, and later refetches leave the edits alone. */
  initialValues?: Partial<T>
  /** Where the values live in page state; generated when left out. JSON elements bound to the same path edit the same form. */
  valuesPath?: string
  dataProviderName?: string
  meta?: Record<string, unknown>
  /** Business rules for the context's Validator, e.g. a JSON Schema. Leave it out when no validator is configured. */
  rules?: ValidationRules
  /** Named groups of fields, such as the steps of a wizard; `groupErrors` reports each group's errors. */
  groups?: Record<string, FormGroupDefinition>
  /** Keeps unsaved values in the browser so they can be restored later. */
  draft?: FormDraftOptions<T>
}
export interface FormDraftControl {
  /** Whether a stored draft exists. */
  has: boolean
  /** Stores the current values; false when storage refused. */
  save: () => boolean
  /** Replaces the values with the stored draft; false when there is none. */
  restore: () => boolean
  /** Forgets the stored draft. */
  clear: () => boolean
}
export interface UseFormReturn<
  T extends Record<string, any> = Record<string, any>,
> {
  /** The current values. */
  values: T
  /** The page state path the values live at. */
  valuesPath: string
  /** Replaces every value, or derives them from the current ones. */
  setValues: (next: T | ((current: T) => T)) => void
  /** Sets one field; `name` may be a dotted path such as `items.0.sku`. */
  setValue: (name: keyof T | string, value: unknown) => void
  /** Every current error, the server's field errors included. */
  errors: FormValidationIssue[]
  /** The errors of each group in `groups`, with their count and first field. */
  groupErrors: Record<string, FormErrorGroup>
  /** Validates all fields, or only `fields`, without saving; a wizard calls it on "Next". */
  validate: (options?: FormValidateOptions) => Promise<FormValidationIssue[]>
  /** The path of the first field in error, among `fields` when given. */
  firstError: (fields?: readonly string[]) => string | undefined
  /** Draft controls, present when the `draft` option is set. */
  draft?: FormDraftControl
  /** Whether the values differ from those loaded or last saved. */
  isDirty: boolean
  /** True while a save is under way; another `submit` then sends nothing. */
  isSubmitting: boolean
  /** Validates, then saves; rejects when validation fails or the server refuses, with the errors already in `errors`. */
  submit: () => Promise<SingleResult<T>>
  /** Returns to the initial values, or to `next`. */
  reset: (next?: Partial<T>) => void
}

function stable(value: unknown): string {
  if (value === undefined)
    return 'null'
  if (Array.isArray(value))
    return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        key =>
          `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/** A form over one record: loads it when `id` is given, keeps the edited values in page state, validates, and saves once through the same path as the `submitForm` action. */
export function useForm<T extends Record<string, any> = Record<string, any>>(
  input: UseFormOptions<T>,
): UseFormReturn<T> {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const client = useQueryClient()
  const state = useStateStore()
  const instance = useId()
  const target = stable({
    resource: options.resource,
    id: options.id,
    dataProviderName: options.dataProviderName,
    meta: options.meta,
  })
  const valuesPath
    = options.valuesPath
      ?? `/__lumi/values/${encodeURIComponent(instance + target)}`
  const statusPath = formStatusPath(valuesPath)
  const [, setRevision] = useState(0)
  const baseline = useRef({
    target: '',
    path: '',
    value: '{}',
    initialized: false,
    epoch: 0,
  })
  const validationRevision = useRef(0)
  const mounted = useRef(false)
  useInsertionEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const handlers = useMemo(
    () =>
      createLumiHandlers(lumi, client, state, {
        isActive: () =>
          mounted.current
          && baseline.current.target === target
          && baseline.current.path === valuesPath,
      }),
    [lumi, client, state.getSnapshot, target, valuesPath],
  )
  const initialKey = stable(options.initialValues ?? {})
  const initial = useMemo(
    () => structuredClone(options.initialValues ?? {}) as T,
    [initialKey],
  )
  const changedTarget
    = baseline.current.target !== target || baseline.current.path !== valuesPath
  const existing = state.get(valuesPath)
  const values = (
    changedTarget && baseline.current.target ? initial : (existing ?? initial)
  ) as T
  const status = state.get(statusPath) as FormStatus | undefined
  const errors = status?.errors ?? []

  // The form as the latest render knows it. A callback kept from before the
  // record changed (an upload finishing, a save going on after an await) must
  // not pull the form back to the record it was created for.
  const latest = useRef({ target, valuesPath })
  latest.current = { target, valuesPath }
  const stale = (): boolean => latest.current.target !== target || latest.current.valuesPath !== valuesPath
  const initialize = (): void => {
    if (stale())
      return
    const previous = baseline.current
    const changed = previous.target !== target || previous.path !== valuesPath
    const current = state.get(valuesPath)
    const awaitingInitial
      = !previous.initialized
        && options.initialValues !== undefined
        && stable(current ?? {}) === previous.value
    if (!changed && !awaitingInitial)
      return
    // Existing native state wins on first mount. A later target has its own baseline.
    const replacement
      = changed && !previous.target && current !== undefined
        ? current
        : structuredClone(initial)
    baseline.current = {
      target,
      path: valuesPath,
      value: stable(replacement),
      // Only initial values make the form initialised. State the page declared
      // beforehand (a Spec's `state` defaults) does not: a record that loads
      // after the first render still fills the form, unless the reader has
      // edited it meanwhile.
      initialized: options.initialValues !== undefined,
      epoch: previous.epoch + 1,
    }
    state.update({
      [valuesPath]: replacement,
      [statusPath]: { pending: false, errors: [], fieldErrors: {} },
    })
  }
  useEffect(initialize, [
    target,
    valuesPath,
    initialKey,
    state.update,
    statusPath,
  ])

  const setValues = (next: T | ((current: T) => T)): void => {
    if (stale())
      return
    initialize()
    state.set(
      valuesPath,
      typeof next === 'function'
        ? next((state.get(valuesPath) ?? initial) as T)
        : next,
    )
  }
  const reset = (next?: Partial<T>): void => {
    const replacement = { ...initial, ...next } as T
    baseline.current = {
      target,
      path: valuesPath,
      value: stable(replacement),
      initialized: true,
      epoch: baseline.current.epoch + 1,
    }
    validationRevision.current += 1
    state.update({
      [valuesPath]: replacement,
      [statusPath]: { pending: false, errors: [], fieldErrors: {} },
    })
  }
  const validate = async (
    selection?: FormValidateOptions,
  ): Promise<FormValidationIssue[]> => {
    initialize()
    const revision = ++validationRevision.current
    const snapshot = state.get(valuesPath) ?? initial
    const next = await validateForm(
      lumi.validator,
      options.rules,
      structuredClone(snapshot) as T,
      lumi.i18nProvider,
    )
    if (
      mounted.current
      && state.get(valuesPath) === snapshot
      && validationRevision.current === revision
    ) {
      const currentStatus = state.get(statusPath) as FormStatus | undefined
      const merged = replaceFieldErrors(
        currentStatus?.errors ?? [],
        next,
        selection?.fields,
      )
      state.set(statusPath, {
        ...currentStatus,
        errors: merged,
        fieldErrors: Object.fromEntries(
          merged.map(issue => [issue.path, issue.message]),
        ),
        valid: merged.length === 0,
      })
    }
    return errorsForFields(next, selection?.fields)
  }
  const submit = async (): Promise<SingleResult<T>> => {
    if (stale())
      throw new Error('[lumi] The form now edits another record; this save was for the previous one.')
    initialize()
    const epoch = baseline.current.epoch
    const snapshot = state.get(valuesPath)
    let result: SingleResult<T>
    try {
      result = (await handlers.submitForm!({
        resource: options.resource,
        id: options.id,
        dataProviderName: options.dataProviderName,
        meta: options.meta,
        valuesPath,
        rules: options.rules,
      })) as SingleResult<T>
    }
    catch (error) {
      toastError(lumi, error)
      throw error
    }
    if (
      mounted.current
      && baseline.current.epoch === epoch
      && baseline.current.target === target
    ) {
      baseline.current.value = stable(snapshot)
      setRevision(current => current + 1)
    }
    return result
  }
  const draftOperation = (operation: () => void): boolean => {
    try {
      operation()
      setRevision(current => current + 1)
      return true
    }
    catch {
      return false
    }
  }
  const draft = options.draft
  const draftControl: FormDraftControl | undefined = draft
    ? {
        has: (() => {
          try {
            return draft.store.has(draft.key)
          }
          catch {
            return false
          }
        })(),
        save: () =>
          draftOperation(() =>
            draft.store.set(
              draft.key,
              structuredClone((state.get(valuesPath) ?? initial) as T),
            ),
          ),
        restore: () => {
          try {
            const saved = draft.store.get(draft.key)
            if (saved === undefined)
              return false
            state.update({
              [valuesPath]: structuredClone(saved),
              [statusPath]: { pending: false, errors: [], fieldErrors: {} },
            })
            return true
          }
          catch {
            return false
          }
        },
        clear: () => draftOperation(() => draft.store.delete(draft.key)),
      }
    : undefined
  return {
    values,
    valuesPath,
    setValues,
    setValue: (name, value) =>
      setValues(current => setPathValue(current, String(name), value)),
    errors,
    groupErrors: groupFormErrors(errors, options.groups),
    validate,
    firstError: fields => firstFormError(errors, fields),
    draft: draftControl,
    isDirty:
      stable(values)
      !== (changedTarget ? stable(values) : baseline.current.value),
    isSubmitting: status?.pending ?? false,
    submit,
    reset,
  }
}
