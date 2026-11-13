import type { ReactElement } from 'react'
import type { LumiFeedbackQueue, LumiFeedbackTone } from './feedback-queue.js'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '../icons.js'
import { cn } from '../internal/utils.js'
import { LumiButton } from './base.js'
import { createFeedbackQueue, FEEDBACK_ICONS, useFeedbackTimer } from './feedback-queue.js'
import { useUiText } from './text.js'

/** A button on a notice. Pressing it runs `onPress` and closes the notice. */
export interface LumiNoticeAction {
  label: string
  onPress: () => void
}

export interface LumiNoticeInput {
  /** Updates an open notice with the same key in place. */
  key?: string
  tone?: LumiFeedbackTone
  title: string
  description?: string
  actions?: LumiNoticeAction[]
  /** Milliseconds before it closes; `0` keeps it until dismissed. Defaults to 4500. */
  duration?: number
}

export interface LumiNoticeEntry extends Required<Pick<LumiNoticeInput, 'key' | 'tone' | 'title' | 'duration'>> {
  description?: string
  actions: LumiNoticeAction[]
  /** Bumped when a keyed notice is reopened, so its timer starts again. */
  version: number
}

/**
 * The notice queue. Its `open`/`close` pair has the shape of Lumi's
 * NotificationProvider, so a notifier is passed to `createLumi` as
 * `notificationProvider` and the `notify` and `closeNotice` actions land here.
 */
export type LumiNotifier = LumiFeedbackQueue<LumiNoticeInput, LumiNoticeEntry>

/** Notices kept at once; the oldest leave first. */
const MAX_NOTICES = 5
/** Newest notices shown in full; older ones collapse to their title until the stack is hovered. */
const EXPANDED_NOTICES = 3

/** A queue of notification cards for `LumiNotifierViewport`; it is also a Lumi NotificationProvider. */
export function createNotifier(): LumiNotifier {
  return createFeedbackQueue<LumiNoticeInput, LumiNoticeEntry>('notice', MAX_NOTICES, (input, key, version) => ({
    key,
    tone: input.tone ?? 'neutral',
    title: input.title,
    description: input.description,
    actions: input.actions ?? [],
    duration: input.duration ?? 4500,
    version,
  }))
}

/** The application-wide queue that `LumiNotifierViewport` shows when given no other. */
export const notifier: LumiNotifier = createNotifier()

function Notice({ entry, queue, collapsed }: { entry: LumiNoticeEntry, queue: LumiNotifier, collapsed: boolean }): ReactElement {
  const { t } = useUiText()
  const { pause, resume } = useFeedbackTimer(entry, queue.close)
  const Icon = FEEDBACK_ICONS[entry.tone]
  return (
    <li
      data-slot="notice"
      data-tone={entry.tone}
      data-collapsed={collapsed || undefined}
      className="lumi-glass-panel"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Icon aria-hidden data-slot="notice-icon" />
      {/* The live role sits on the body: a list item must keep its own role. */}
      <div data-slot="notice-body" role={entry.tone === 'danger' ? 'alert' : 'status'} aria-live={entry.tone === 'danger' ? 'assertive' : 'polite'}>
        <p data-slot="notice-title">{entry.title}</p>
        {entry.description && <p data-slot="notice-description">{entry.description}</p>}
        {entry.actions.length > 0 && (
          <div data-slot="notice-actions">
            {entry.actions.map((action, index) => (
              <LumiButton
                key={action.label}
                label={action.label}
                size="sm"
                appearance={index === 0 ? 'solid' : 'outline'}
                onClick={() => {
                  queue.close(entry.key)
                  action.onPress()
                }}
              />
            ))}
          </div>
        )}
      </div>
      <button type="button" data-slot="notice-close" aria-label={t('lumi.common.close', 'Close')} onClick={() => queue.close(entry.key)}>
        <XIcon aria-hidden />
      </button>
    </li>
  )
}

export interface LumiNotifierProps {
  /** Defaults to the shared `notifier`. */
  notifier?: LumiNotifier
  className?: string
}

/** Renders notification cards at the top-right of the viewport, newest first. */
export function LumiNotifierViewport({ notifier: queue = notifier, className }: LumiNotifierProps): ReactElement | null {
  const entries = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  const { t } = useUiText()
  if (typeof document === 'undefined')
    return null
  return createPortal(
    <section aria-label={t('lumi.notice.region', 'Notifications')} data-slot="notifier" className={cn(className)}>
      <ol>
        {[...entries].reverse().map((entry, index) => <Notice key={entry.key} entry={entry} queue={queue} collapsed={index >= EXPANDED_NOTICES} />)}
      </ol>
    </section>,
    document.body,
  )
}
