export type FeedbackTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

/** A light, single-line message: saves, copies and every automatic error report. */
export interface ToastParams {
  /** Replaces an open toast with the same key instead of stacking a copy. */
  key?: string
  /** Semantic colour. */
  tone?: FeedbackTone
  /** The one line shown. */
  message: string
  /** Milliseconds before it closes; `0` keeps it until dismissed. */
  duration?: number
}

/**
 * Draws toasts. Lumi calls it from the `toast` action, `useToast()` and its
 * automatic error reports; the UI layer supplies the drawing (Lumi UI ships a
 * toaster), so Lumi stays free of any component library.
 */
export interface ToastProvider {
  /** Shows a toast and answers its key. */
  open: (params: ToastParams) => string
  /** Closes the toast with this key. */
  close?: (key: string) => void
}

/** A button on a notice. Pressing it runs `onPress` and closes the notice. */
export interface NotificationAction {
  /** The button's text. */
  label: string
  /** Runs when the button is pressed. */
  onPress: () => void
}

/** A notification card: a title, an optional description and actions. */
export interface NotificationParams {
  /** Updates an open notice with the same key in place. */
  key?: string
  /** Semantic colour. */
  tone?: FeedbackTone
  /** The heading. */
  title: string
  /** Detail under the heading. */
  description?: string
  /** Buttons on the card. */
  actions?: NotificationAction[]
  /** Milliseconds before it closes; `0` keeps it until dismissed. */
  duration?: number
}

/**
 * Draws notices. Lumi calls it from the `notify` and `closeNotice` actions and
 * `useNotify()`; the UI layer supplies the drawing (Lumi UI ships a notifier).
 */
export interface NotificationProvider {
  /** Shows a notice and answers its key. */
  open: (params: NotificationParams) => string
  /** Closes the notice with this key. */
  close?: (key: string) => void
}
