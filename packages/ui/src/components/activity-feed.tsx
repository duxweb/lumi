import type { ReactElement, ReactNode } from 'react'
import type { ActivityFeedItem, ActivityFeedProps } from '../catalog/types-public.js'
import { ActivityIcon } from '../icons.js'
import { cn } from '../internal/utils.js'
import { LumiAvatar } from './avatar.js'
import { LumiBadge } from './display.js'
import { LumiEmpty } from './empty.js'
import { LumiSkeleton } from './skeleton.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

const SLOT = /(\{actor\}|\{target\})/

/**
 * The sentence `actor action target`, with both names in strong text. A
 * phrase that places `{actor}` or `{target}` itself keeps its word order.
 */
function sentence(item: ActivityFeedItem): ReactNode {
  const actor = (key: string | number): ReactElement => <strong key={key} data-slot="activity-feed-actor">{item.actor}</strong>
  const target = (key: string | number): ReactElement | null => item.target ? <strong key={key} data-slot="activity-feed-target">{item.target}</strong> : null
  const parts = item.action.split(SLOT)
  if (parts.length === 1)
    return [actor('actor'), ' ', item.action, ...(item.target ? [' ', target('target')] : [])]
  return parts.map((part, index) => part === '{actor}' ? actor(index) : part === '{target}' ? target(index) : part)
}

/**
 * Who did what, newest first. The avatar leads, the sentence and the time
 * share the first line, and context sits under the sentence with the status
 * under the time, so badges line up in one column. Rows are plain
 * reading: nothing here navigates, so nothing reacts to the pointer.
 */
export function LumiActivityFeed(props: ActivityFeedProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items, loading = false, empty = t('lumi.activity.empty', 'No activity yet'), ariaLabel, className, children: _children, ...rest } = props
  if (loading && items.length === 0)
    return <LumiSkeleton variant="list-row" lines={3} size="sm" label={t('lumi.activity.loading', 'Loading activity')} className={className} />
  if (items.length === 0)
    return <LumiEmpty size="sm" role="status" icon={<ActivityIcon />} title={empty} className={className} />
  return (
    <ol
      {...rest}
      aria-label={rest['aria-label'] ?? ariaLabel}
      aria-busy={loading || undefined}
      data-slot="activity-feed"
      className={cn('m-0 flex min-w-0 list-none flex-col divide-y divide-border p-0', className)}
    >
      {items.map(item => (
        <li key={item.key} data-slot="activity-feed-item" className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
          {/* The sentence already names the actor. Centred on the whole entry. */}
          <span aria-hidden className={cn('flex', (item.context || item.status) && 'row-span-2')}>
            <LumiAvatar name={item.actor} src={item.avatar} size="sm" />
          </span>
          <p data-slot="activity-feed-summary" className="col-start-2 m-0 min-w-0 text-sm leading-5 text-(--lumi-fg-secondary) [&_strong]:font-medium [&_strong]:text-foreground">
            {sentence(item)}
          </p>
          {item.timestamp && (
            <time data-slot="activity-feed-time" dateTime={item.dateTime} className="col-start-3 row-start-1 self-start justify-self-end text-(length:--lumi-fs-caption) leading-5 whitespace-nowrap text-muted-foreground tabular-nums">
              {item.timestamp}
            </time>
          )}
          {item.context && <span data-slot="activity-feed-context" className="col-start-2 row-start-2 min-w-0 truncate text-(length:--lumi-fs-meta) leading-5 text-muted-foreground">{item.context}</span>}
          {item.status && (
            <span data-slot="activity-feed-status" className="col-start-3 row-start-2 flex justify-self-end">
              <LumiBadge label={item.status.label} tone={item.status.tone ?? 'neutral'} appearance="soft" dot />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
