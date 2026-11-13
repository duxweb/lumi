import type { FocusEvent, ReactElement } from 'react'
import type { LumiFeedbackQueue, LumiFeedbackTone } from './feedback-queue.js'
import { useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '../icons.js'
import { cn } from '../internal/utils.js'
import { createFeedbackQueue, FEEDBACK_ICONS, useFeedbackTimer } from './feedback-queue.js'
import { useUiText } from './text.js'

export type { LumiFeedbackQueue, LumiFeedbackTone } from './feedback-queue.js'

export interface LumiToastInput {
  /** Replaces an open toast with the same key instead of stacking a copy. */
  key?: string
  tone?: LumiFeedbackTone
  message: string
  /** Milliseconds before it closes; `0` keeps it until closed in code. Defaults to 3000. */
  duration?: number
}

export interface LumiToastEntry extends Required<Pick<LumiToastInput, 'key' | 'tone' | 'message' | 'duration'>> {
  /** Bumped when a keyed toast is reopened, so its timer starts again. */
  version: number
}

/**
 * The toast queue. Its `open`/`close` pair has the shape of Lumi's
 * ToastProvider, so a toaster is passed to `createLumi` as `toastProvider` and
 * the `toast` action and automatic error reports land here.
 */
export type LumiToaster = LumiFeedbackQueue<LumiToastInput, LumiToastEntry>

/** A queue of toasts for `LumiToasterViewport`; it is also a Lumi ToastProvider. */
export function createToaster(): LumiToaster {
  return createFeedbackQueue<LumiToastInput, LumiToastEntry>('toast', 5, (input, key, version) => ({
    key,
    tone: input.tone ?? 'neutral',
    message: input.message,
    duration: input.duration ?? 3000,
    version,
  }))
}

/** The application-wide queue that `LumiToasterViewport` shows when given no other. */
export const toaster: LumiToaster = createToaster()

function Toast({ entry, queue }: { entry: LumiToastEntry, queue: LumiToaster }): ReactElement {
  const { t } = useUiText()
  const { pause, resume } = useFeedbackTimer(entry, queue.close)
  // The timer waits while the pointer is over the toast or focus is inside it.
  const held = useRef({ hover: false, focus: false })
  const hold = (key: 'hover' | 'focus', on: boolean): void => {
    held.current[key] = on
    if (held.current.hover || held.current.focus)
      pause()
    else
      resume()
  }
  const Icon = FEEDBACK_ICONS[entry.tone]
  return (
    <li
      data-slot="toast"
      data-tone={entry.tone}
      onMouseEnter={() => hold('hover', true)}
      onMouseLeave={() => hold('hover', false)}
      onFocus={() => hold('focus', true)}
      onBlur={(event: FocusEvent<HTMLLIElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          hold('focus', false)
      }}
    >
      <Icon aria-hidden data-slot="toast-icon" />
      {/* Keyed by version, so a toast reopened under its key is announced again; danger interrupts. */}
      <p key={entry.version} data-slot="toast-message" {...(entry.tone === 'danger' ? { role: 'alert' } : {})}>{entry.message}</p>
      <button type="button" data-slot="toast-close" aria-label={t('lumi.common.close', 'Close')} onClick={() => queue.close(entry.key)}>
        <XIcon aria-hidden />
      </button>
    </li>
  )
}

export interface LumiToasterProps {
  /** Defaults to the shared `toaster`. */
  toaster?: LumiToaster
  className?: string
}

/** Renders light messages centred at the top of the viewport, newest first. */
export function LumiToasterViewport({ toaster: queue = toaster, className }: LumiToasterProps): ReactElement | null {
  const entries = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  const { t } = useUiText()
  if (typeof document === 'undefined')
    return null
  return createPortal(
    <section aria-label={t('lumi.toast.region', 'Messages')} data-slot="toaster" className={cn(className)}>
      {/* A live region from the start around the list, so each toast added is read once, with no hidden copy. */}
      <div role="status" aria-live="polite" aria-relevant="additions text" data-slot="toast-live">
        <ol>
          {[...entries].reverse().map(entry => <Toast key={entry.key} entry={entry} queue={queue} />)}
        </ol>
      </div>
    </section>,
    document.body,
  )
}
