import type { LiveEvent, LiveMode, LiveProvider, LiveSubscribeParams } from '@duxweb/lumi'
import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import { createSimpleDataProvider, DEFAULT_TENANT_HEADER, LumiCanAccess, LumiServicesProvider, useCan, useIdentity, useList, useLumi, usePermissions, usePublish, useSubscription, useTenant, useTranslate } from '@duxweb/lumi'
import { LumiCodeExample } from '@duxweb/lumi-admin'
import { LumiAlert as Alert, LumiBadge as Badge, LumiButton as Button, LumiCodeBlock as CodeBlock, LumiDescriptionList as DescriptionList, LumiInput as Input, LumiSelect as Select, LumiStack as Stack, LumiTable as Table, LumiText as Text } from '@duxweb/lumi-ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Code, DeveloperPage } from '../developer/kit.js'
import { apiUrl } from '../session.js'
import { perLocale } from '../shared.js'

// Live, tenant and access hooks against the running app: the SSE stream of the
// mock API, the Shell's tenant provider and the signed-in account.

const clock = (value: number | string): string => new Date(value).toLocaleTimeString()

/* -------------------------------------------------------------------------- */
/* Custom channel                                                             */

/**
 * A provider that can publish: events go to every tab of this browser through a
 * BroadcastChannel and to this tab's own subscribers. The app's SSE provider
 * only listens, so the example swaps this one in for its subtree.
 */
function broadcastLiveProvider(name: string): LiveProvider {
  const subscriptions = new Set<LiveSubscribeParams>()
  const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(name)
  const deliver = (event: LiveEvent): void => {
    for (const subscription of [...subscriptions]) {
      if (subscription.channel === event.channel && (!subscription.types?.length || subscription.types.includes(event.type)))
        subscription.onLiveEvent(event)
    }
  }
  channel?.addEventListener('message', message => deliver(message.data as LiveEvent))
  return {
    subscribe(params) {
      subscriptions.add(params)
      return () => subscriptions.delete(params)
    },
    publish(event) {
      channel?.postMessage(event)
      deliver(event)
    },
  }
}

const chatLive = broadcastLiveProvider('lumi-demo-live')

const CHANNEL_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { usePublish, useSubscription } from '@duxweb/lumi'

function Composer() {
  const publish = usePublish()
  const [text, setText] = useState('')
  return (
    <LumiButton
      label="Publish"
      onClick={() => publish({
        channel: 'team/chat',
        type: 'message',
        payload: { text },
        date: new Date().toISOString(),
      })}
    />
  )
}

function Inbox() {
  const [events, setEvents] = useState<LiveEvent[]>([])
  useSubscription({
    channel: 'team/chat',
    types: ['message'],
    onLiveEvent: event => setEvents(list => [event, ...list]),
  })
  return <LumiTable rows={events.map(rowOf)} columns={columns} />
}`,
  },
  {
    name: 'main.tsx',
    language: 'tsx',
    code: `import { createLumi, createSseLiveProvider } from '@duxweb/lumi'

// A provider publishes only when it knows where to send:
// with publishUrl, createSseLiveProvider POSTs each event there and
// the server fans it out on /live to every reader.
const lumi = createLumi({
  liveProvider: createSseLiveProvider({
    url: 'https://api.example.com/live',
    publishUrl: 'https://api.example.com/live/publish',
    headers: () => ({ Authorization: session.token() }),
  }),
})`,
  },
]

const messageColumns = perLocale((t): TableColumn[] => ([
  { field: 'time', label: t('Received'), kind: 'code', width: '7rem' },
  { field: 'from', label: t('From'), width: '8rem' },
  { field: 'text', label: t('Message'), wrap: true },
]))

function ChannelComposer(): ReactElement {
  const t = useTranslate()
  const publish = usePublish()
  const identity = useIdentity<{ name?: string }>()
  const [text, setText] = useState(() => t('The courier arrives at three'))
  const send = (): void => {
    void publish({ channel: 'team/chat', type: 'message', payload: { text, from: identity.data?.name ?? '' }, date: new Date().toISOString() })
  }
  return (
    <Stack direction="horizontal" gap="sm" align="center" wrap>
      <Input ariaLabel={t('Message')} value={text} onChange={value => setText(String(value ?? ''))} data-testid="live-message" />
      <Button label={t('Publish')} disabled={!text.trim()} onClick={send} data-testid="live-publish" />
    </Stack>
  )
}

function ChannelInbox(): ReactElement {
  const t = useTranslate()
  const [events, setEvents] = useState<LiveEvent[]>([])
  useSubscription({ channel: 'team/chat', types: ['message'], onLiveEvent: event => setEvents(list => [event, ...list].slice(0, 5)) })
  const rows = events.map((event, index) => ({
    id: index,
    time: clock(event.date ?? Date.now()),
    from: String(event.payload?.from ?? ''),
    text: String(event.payload?.text ?? ''),
  }))
  return rows.length
    ? <Table rowKey="id" columns={messageColumns(t)} rows={rows} data-testid="live-inbox" />
    : <Text variant="muted" text={t('Nothing received yet. Publish a message')} />
}

function ChannelExample(): ReactElement {
  const t = useTranslate()
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const context = useMemo(() => ({ ...lumi, liveProvider: chatLive }), [lumi])
  return (
    <LumiCodeExample
      title={t('Publish and subscribe on a channel')}
      code={<Code files={CHANNEL_FILES} />}
      previewLabel={t('Result')}
      preview={(
        <LumiServicesProvider context={context} queryClient={queryClient}>
          <Stack gap="md">
            <ChannelComposer />
            <ChannelInbox />
          </Stack>
        </LumiServicesProvider>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Live list                                                                  */

interface Note {
  id: number
  title: string
  priority: string
}

const LIVE_LIST_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { useList } from '@duxweb/lumi'

// With a liveProvider every list is live: an event on
// resources/notes refetches it (liveMode "auto").
const notes = useList<Note>({
  resource: 'notes',
  pagination: { page: 1, pageSize: 5 },
  liveMode, // 'auto' | 'manual' | 'off'
  onLiveEvent: event => log(event),
})

// The same subscription without a query, e.g. for a badge:
useResourceLive('notes', undefined, {
  liveMode: 'manual',
  onLiveEvent: event => setUnseen(count => count + 1),
})`,
  },
  {
    name: 'notes.go',
    language: 'go',
    code: `// After a write is committed, tell every reader on /live.
func updateNote(w http.ResponseWriter, r *http.Request) {
\t// …decode, validate, save
\tlive.Broadcast(live.Event{
\t\tChannel: "resources/notes",
\t\tType:    "updated",
\t\tPayload: map[string]any{"ids": []int{note.ID}},
\t})
\twriteJSON(w, http.StatusOK, map[string]any{"data": note})
}`,
  },
]

const noteColumns = perLocale((t): TableColumn[] => ([
  { field: 'id', label: 'ID', kind: 'code', width: '4rem' },
  { field: 'title', label: t('Title'), truncate: true },
  { field: 'priority', label: t('Priority'), kind: 'badge', width: '7rem', valueMap: { high: t('High'), normal: t('Normal'), low: t('Low') }, toneMap: { high: 'danger', normal: 'info', low: 'neutral' } },
]))

const LIVE_MODES = perLocale(t => ([
  { value: 'auto', label: t('auto: refetch') },
  { value: 'manual', label: t('manual: only onLiveEvent') },
  { value: 'off', label: t('off: no subscription') },
]))

/** The note the example changes; its priority flips between two values, so nothing drifts. */
const LIVE_NOTE_ID = 2

function LiveListExample(): ReactElement {
  const t = useTranslate()
  const [mode, setMode] = useState<LiveMode>('auto')
  const [events, setEvents] = useState<string[]>([])
  const notes = useList<Note>({
    resource: 'notes',
    pagination: { page: 1, pageSize: 5 },
    sorters: [{ field: 'id', order: 'asc' }],
    liveMode: mode,
    onLiveEvent: event => setEvents(list => [`${clock(event.date ?? Date.now())}  ${event.type} ${(event.payload?.ids ?? []).map(id => `#${String(id)}`).join(', ')}`, ...list].slice(0, 4)),
  })
  const note = notes.data?.data.find(row => row.id === LIVE_NOTE_ID)
  // Another session changes the note: the mock saves the patch and broadcasts
  // the event on /live; nothing on this page invalidates the list.
  const changeElsewhere = (): void => {
    void fetch(`${apiUrl()}/__live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'notes', type: 'updated', ids: [LIVE_NOTE_ID], patch: { priority: note?.priority === 'high' ? 'normal' : 'high' } }),
    })
  }
  return (
    <LumiCodeExample
      title={t('Lists refresh from the live stream')}
      code={<Code files={LIVE_LIST_FILES} />}
      previewLabel={t('Result')}
      previewActions={<Select ariaLabel={t('Live mode')} size="sm" options={LIVE_MODES(t)} value={mode} onChange={value => setMode((value ?? 'auto') as LiveMode)} />}
      preview={(
        <Stack gap="md">
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button label={t('Change note #2 from another session')} appearance="outline" size="sm" icon="refresh" disabled={!note} onClick={changeElsewhere} data-testid="live-change" />
            <Text variant="caption" text={notes.dataUpdatedAt ? t('Fetched at {time}', { time: clock(notes.dataUpdatedAt) }) : t('Loading')} />
          </Stack>
          <Table rowKey="id" columns={noteColumns(t)} rows={(notes.data?.data ?? []) as unknown as Record<string, unknown>[]} loading={notes.isPending} data-testid="live-notes" />
          <CodeBlock title="onLiveEvent" code={events.length ? events.join('\n') : t('No event yet')} copyable={false} maxHeight={160} data-testid="live-events" />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Tenant                                                                     */

// The workspaces of this demo's manifest (`app.workspaces`); the Shell switcher
// lists the same ones. The tenant provider itself does not list options here.
const WORKSPACES = perLocale(t => ([
  { value: 'showcase', label: t('Lumi') },
  { value: 'staging', label: t('Lumi Staging') },
  { value: 'retail', label: t('Dux Retail') },
]))

const TENANT_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { useList, useTenant } from '@duxweb/lumi'

const { tenant, setTenant } = useTenant()
const orders = useList({
  resource: 'orders',
  pagination: { page: 1, pageSize: 3 },
})

// setTenant('retail'):
// 1. every Lumi query is cleared in the same call, so no frame
//    shows the old tenant's rows;
// 2. the mounted queries fetch again with X-Tenant: retail;
// 3. the live stream reconnects with the new header.`,
  },
  {
    name: 'main.tsx',
    language: 'tsx',
    code: `import { createHttpClient, createLumi, createTenantProvider, createSimpleDataProvider } from '@duxweb/lumi'

const tenantProvider = createTenantProvider({ storageKey: 'shop:tenant' })
const http = createHttpClient({
  getTenant: () => tenantProvider.get(), // sent as X-Tenant
})
const lumi = createLumi({
  tenantProvider,
  http,
  dataProvider: createSimpleDataProvider({ apiUrl: 'https://api.example.com', http }),
})`,
  },
]

/**
 * The headers the app's data provider sends, captured by building the same
 * createSimpleDataProvider with a recording fetcher: the mock does not echo them.
 */
function useSentHeaders(tenant: string | undefined): Record<string, string> | undefined {
  const lumi = useLumi()
  const [headers, setHeaders] = useState<Record<string, string>>()
  const probe = useMemo(() => createSimpleDataProvider({
    apiUrl: apiUrl(),
    http: lumi.http.extend({
      fetcher: (input, init) => {
        setHeaders({ ...init?.headers as Record<string, string> })
        return fetch(input, init)
      },
    }),
  }), [lumi])
  useEffect(() => {
    void probe.getList({ resource: 'orders', pagination: { page: 1, pageSize: 1 } }).catch(() => undefined)
  }, [probe, tenant])
  return headers
}

function TenantExample(): ReactElement {
  const t = useTranslate()
  const { tenant, setTenant } = useTenant()
  const orders = useList({ resource: 'orders', pagination: { page: 1, pageSize: 3 } })
  const headers = useSentHeaders(tenant)
  const [fetches, setFetches] = useState(0)
  useEffect(() => {
    if (orders.dataUpdatedAt)
      setFetches(count => count + 1)
  }, [orders.dataUpdatedAt])
  const workspaces = WORKSPACES(t)
  return (
    <LumiCodeExample
      title={t('Switch the tenant')}
      code={<Code files={TENANT_FILES} />}
      previewLabel={t('Result')}
      previewActions={<Select ariaLabel={t('Tenant')} size="sm" options={workspaces} value={tenant ?? null} onChange={value => value && setTenant(String(value))} />}
      align="center"
      preview={(
        <DescriptionList
          layout="rows"
          bordered
          data-testid="tenant-state"
          items={[
            { label: t('Current tenant'), value: workspaces.find(item => item.value === tenant)?.label ?? tenant ?? '—' },
            { label: t('{header} header sent', { header: DEFAULT_TENANT_HEADER }), value: headers?.[DEFAULT_TENANT_HEADER] ?? '—' },
            { label: t('Orders query'), value: orders.isPending ? t('Loading') : orders.isFetching ? t('Refetching') : t('{count} orders', { count: orders.data?.total ?? 0 }) },
            { label: t('Fetched at'), value: orders.dataUpdatedAt ? clock(orders.dataUpdatedAt) : '—' },
            { label: t('Fetches since the page opened'), value: fetches },
          ]}
        />
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Identity and access                                                        */

const ACCESS_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { LumiCanAccess, useCan, useIdentity, usePermissions } from '@duxweb/lumi'

const identity = useIdentity<{ name: string, role: string }>()
// ['notes:list', 'notes:delete', …]
const permissions = usePermissions()
const canDelete = useCan({ resource: 'notes', action: 'delete' })
const canRefund = useCan({ resource: 'invoices', action: 'refund' })

<LumiButton label="Delete note" disabled={!canDelete.data?.can} />
<LumiButton label="Refund invoice" disabled={!canRefund.data?.can} />

// Renders its children only when allowed; nothing while it checks.
<LumiCanAccess
  resource="roles"
  action="edit"
  fallback={<LumiAlert title="Only administrators edit roles" />}
>
  <LumiButton label="Edit roles" />
</LumiCanAccess>`,
  },
]

function AccessExample(): ReactElement {
  const t = useTranslate()
  const identity = useIdentity<{ name?: string, role?: string, email?: string }>()
  const permissions = usePermissions()
  const canDelete = useCan({ resource: 'notes', action: 'delete' })
  const canRefund = useCan({ resource: 'invoices', action: 'refund' })
  const granted = Array.isArray(permissions.data) ? permissions.data as string[] : []
  const allowed = (can: boolean | undefined): string => can === undefined ? '…' : can ? t('Allowed') : t('Denied')
  return (
    <LumiCodeExample
      title={t('Identity, permissions and access checks')}
      code={<Code files={ACCESS_FILES} />}
      previewLabel={t('Your account')}
      preview={(
        <Stack gap="md">
          <DescriptionList
            layout="rows"
            bordered
            items={[
              { label: t('User'), value: identity.data?.name ?? '—' },
              { label: t('Role'), value: identity.data?.role ?? '—' },
              { label: t('Permissions'), value: permissions.isPending ? '…' : t('{count} codes, e.g. {first}', { count: granted.length, first: granted.slice(0, 2).join(', ') || '—' }) },
            ]}
          />
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button label={t('Delete note')} appearance="outline" size="sm" icon="delete-02" disabled={!canDelete.data?.can} data-testid="access-delete" />
            <Badge appearance="outline" tone={canDelete.data?.can ? 'success' : 'neutral'} label={`notes:delete · ${allowed(canDelete.data?.can)}`} />
          </Stack>
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button label={t('Refund invoice')} appearance="outline" size="sm" disabled={!canRefund.data?.can} data-testid="access-refund" />
            <Badge appearance="outline" tone={canRefund.data?.can ? 'success' : 'neutral'} label={`invoices:refund · ${allowed(canRefund.data?.can)}`} />
          </Stack>
          <LumiCanAccess resource="roles" action="edit" fallback={<Alert tone="warning" title={t('Only administrators edit roles')} />}>
            <Button label={t('Edit roles')} size="sm" icon="edit" data-testid="access-roles" />
          </LumiCanAccess>
        </Stack>
      )}
    />
  )
}

export function AdminHooksLiveRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Live, tenants & access')} description={t('Realtime events, tenants and the signed-in account')}>
      <ChannelExample />
      <LiveListExample />
      <TenantExample />
      <AccessExample />
    </DeveloperPage>
  )
}
