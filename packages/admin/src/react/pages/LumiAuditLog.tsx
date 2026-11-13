import type { AuditLogEntry, I18nProvider, ID } from '@duxweb/lumi'
import type { ActivityFeedItem } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useAuditLogList, useLumi } from '@duxweb/lumi'
import { LumiActivityFeed, useUiText } from '@duxweb/lumi-ui'

export interface LumiAuditLogProps {
  resource: string
  /** One record's history; the resource's without it. */
  id?: ID
  pageSize?: number
  dataProviderName?: string
  /** Shown when nothing was recorded yet. */
  empty?: string
  ariaLabel?: string
}

type Translate = ReturnType<typeof useUiText>['t']

const ACTIONS: Record<string, string> = {
  create: 'created',
  createMany: 'created',
  update: 'updated',
  updateMany: 'updated',
  delete: 'deleted',
  deleteMany: 'deleted',
  import: 'imported',
}

/** What the entry was done to: the changed fields, the import counts or the records. */
function target(entry: AuditLogEntry, t: Translate): string | undefined {
  const data = entry.data
  if (entry.action === 'import' && data && typeof data === 'object') {
    const counts = data as { succeeded?: number, total?: number }
    return t('lumi.audit.importCount', '{succeeded} of {total} records', { succeeded: counts.succeeded ?? 0, total: counts.total ?? 0 })
  }
  if ((entry.action === 'update' || entry.action === 'updateMany') && data && typeof data === 'object' && !Array.isArray(data)) {
    const fields = Object.keys(data)
    if (fields.length)
      return fields.join(', ')
  }
  return entry.ids?.length ? entry.ids.map(id => `#${String(id)}`).join(', ') : undefined
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

/** Through the app's i18n formatting (its time zone), or the browser's when it has none. */
function formatTime(value: string | undefined, locale: string | undefined, i18n: I18nProvider | undefined): string | undefined {
  if (!value)
    return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return value
  try {
    if (i18n?.formatDateTime)
      return i18n.formatDateTime(value, TIME_FORMAT, locale)
  }
  catch {
    // A server time the app's format refuses (not strict ISO UTC) falls back to the browser's.
  }
  return new Intl.DateTimeFormat(locale, TIME_FORMAT).format(date)
}

/** The audit log as an activity feed: who did what to which record, and when. */
export function LumiAuditLog({ resource, id, pageSize = 20, dataProviderName, empty, ariaLabel }: LumiAuditLogProps): ReactElement {
  const { t, locale } = useUiText()
  const i18n = useLumi().i18nProvider
  const log = useAuditLogList({ resource, id, pagination: { page: 1, pageSize }, ...(dataProviderName ? { dataProviderName } : {}) })
  const items: ActivityFeedItem[] = (log.data?.data ?? []).map((entry) => {
    const verb = ACTIONS[entry.action]
    const subject = target(entry, t)
    return {
      key: String(entry.id),
      actor: entry.author?.name ?? t('lumi.audit.system', 'System'),
      ...(entry.author?.avatar ? { avatar: entry.author.avatar } : {}),
      action: verb ? t(`lumi.audit.${verb}`, verb) : entry.action,
      ...(subject ? { target: subject } : {}),
      ...(entry.name ? { context: entry.name } : {}),
      ...(entry.createdAt ? { timestamp: formatTime(entry.createdAt, locale, i18n), dateTime: entry.createdAt } : {}),
    }
  })
  return (
    <LumiActivityFeed
      items={items}
      loading={log.isPending && log.fetchStatus !== 'idle'}
      empty={log.error ? t('lumi.audit.loadFailed', 'Could not load the history') : empty ?? t('lumi.audit.empty', 'No changes recorded yet')}
      ariaLabel={ariaLabel ?? t('lumi.audit.label', 'Change history')}
    />
  )
}
