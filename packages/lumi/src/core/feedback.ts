import type { LumiContext } from './context.js'
import { translateText } from './text.js'
import { FormValidationError } from './validation.js'

/** Thrown for a submit that is already running; it is not reported to the user. */
export class FormBusyError extends Error {
  constructor() {
    super('[lumi] This form is already submitting.')
    this.name = 'FormBusyError'
  }
}

/** The toast text for a failed request, save, upload or validation. */
export function errorMessage(context: Pick<LumiContext, 'i18nProvider'>, error: unknown): string {
  const t = (key: string, fallback: string, params?: Record<string, unknown>): string => translateText(context, key, fallback, params)
  if (error instanceof FormValidationError)
    return t('lumi.feedback.invalid', 'Check the {count} highlighted fields', { count: error.issues.length })
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return message.trim() || t('lumi.feedback.failed', 'Something went wrong. Try again')
}

/**
 * Reports a failure as a danger toast. Every automatic error report goes
 * through here: unhandled action failures, React mutations and uploads.
 * Cancellations and duplicate submits stay silent.
 */
export function toastError(context: Pick<LumiContext, 'i18nProvider' | 'toastProvider'>, error: unknown): void {
  // An abort, a busy form and an undone write are the reader's own doing, not failures.
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'MutationUndoneError' || error instanceof FormBusyError))
    return
  context.toastProvider?.open({ tone: 'danger', message: errorMessage(context, error) })
}
