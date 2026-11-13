import type { Filter, MutationMode, Sorter } from '@duxweb/lumi'
import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useCreate, useCustom, useCustomMutation, useDelete, useInfiniteList, useInvalidate, useList, useMany, useOne, useTranslate, useUpdate } from '@duxweb/lumi'
import { LumiCodeExample, LumiSegmented } from '@duxweb/lumi-admin'
import { LumiAlert as Alert, LumiButton as Button, LumiDescriptionList as DescriptionList, LumiGrid as Grid, LumiMultiSelect as MultiSelect, LumiPagination as Pagination, LumiSelect as Select, LumiStack as Stack, LumiTable as Table, LumiText as Text } from '@duxweb/lumi-ui'
import { useState } from 'react'
import { Code, DeveloperPage } from '../developer/kit.js'
import { perLocale } from '../shared.js'

// Each example drives one data hook against the mock API and renders the
// result with plain Lumi UI. The code tab is the hook call the preview makes.

interface OrderRow extends Record<string, unknown> { id: number, number: string, customer: string, status: string, total: number }
interface CustomerRow extends Record<string, unknown> { id: number, name: string, email: string, tier: string, spent: number }
interface MemberRow extends Record<string, unknown> { id: number, name: string, role: string, team: string }
interface NoteRow extends Record<string, unknown> { id: number, title: string, priority: 'low' | 'normal' | 'high' }

const STATUS_TONES = { pending: 'warning', paid: 'primary', packed: 'info', shipped: 'success', cancelled: 'neutral' } as const

const orderColumns = perLocale((t): TableColumn[] => ([
  { field: 'number', label: t('Order'), kind: 'code' },
  { field: 'customer', label: t('Customer'), truncate: true },
  { field: 'status', label: t('Status'), kind: 'badge', toneMap: STATUS_TONES, valueMap: { pending: t('Pending'), paid: t('Paid'), packed: t('Packed'), shipped: t('Shipped'), cancelled: t('Cancelled') } },
  { field: 'total', label: t('Total'), kind: 'currency', currency: 'CNY', align: 'right' },
]))

const time = (at: number): string => at ? new Date(at).toLocaleTimeString() : '—'

/* -------------------------------------------------------------------------- */
/* useList                                                                    */

const LIST_CODE = `const [status, setStatus] = useState('paid')
const [sort, setSort] = useState('total:desc')
const [page, setPage] = useState(1)
const [field, order] = sort.split(':')

const { data, isFetching } = useList<Order>({
  resource: 'orders',
  pagination: { page, pageSize: 5 },
  filters: status
    ? [{ field: 'status', operator: 'eq', value: status }]
    : [],
  sorters: [{ field, order }],
})

<Table rows={data?.data ?? []} loading={isFetching} … />
<Pagination
  page={page}
  pageSize={5}
  total={data?.total ?? 0}
  onPageChange={setPage}
/>`

function ListExample(): ReactElement {
  const t = useTranslate()
  const [status, setStatus] = useState<string>('paid')
  const [sort, setSort] = useState('total:desc')
  const [page, setPage] = useState(1)
  const [field = 'total', order = 'desc'] = sort.split(':')
  const filters: Filter[] = status ? [{ field: 'status', operator: 'eq', value: status }] : []
  const sorters: Sorter[] = [{ field, order: order as Sorter['order'] }]
  const { data, isFetching, error } = useList<OrderRow>({ resource: 'orders', pagination: { page, pageSize: 5 }, filters, sorters })
  return (
    <LumiCodeExample
      title={t('useList: filters, sorting and pages')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: LIST_CODE }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="sm">
          <Grid columns={2} gap="sm">
            <Select
              ariaLabel={t('Status')}
              labelPrefix={t('Status')}
              size="sm"
              value={status}
              clearable
              placeholder={t('Any')}
              options={[{ label: t('Pending'), value: 'pending' }, { label: t('Paid'), value: 'paid' }, { label: t('Shipped'), value: 'shipped' }, { label: t('Cancelled'), value: 'cancelled' }]}
              onChange={(value) => {
                setStatus(value === null ? '' : String(value))
                setPage(1)
              }}
            />
            <Select
              ariaLabel={t('Sort')}
              labelPrefix={t('Sort')}
              size="sm"
              value={sort}
              options={[{ label: t('Highest total'), value: 'total:desc' }, { label: t('Lowest total'), value: 'total:asc' }, { label: t('Order number'), value: 'number:asc' }]}
              onChange={value => setSort(String(value ?? 'total:desc'))}
            />
          </Grid>
          {error && <Alert tone="danger" title={t('Could not load records')} message={error.message} />}
          <Table rowKey="id" columns={orderColumns(t)} rows={data?.data ?? []} loading={isFetching} data-testid="hooks-list-table" />
          <Pagination ariaLabel={t('Orders pages')} page={page} pageSize={5} total={data?.total ?? 0} showTotal onPageChange={setPage} />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useOne and useMany                                                         */

const CUSTOMER_IDS = [1, 2, 3, 4, 5, 6, 7, 8]

function OneExample(): ReactElement {
  const t = useTranslate()
  const [id, setId] = useState<number>(1)
  const { data, isPending, error } = useOne<CustomerRow>({ resource: 'customers', id })
  const customer = data?.data
  return (
    <LumiCodeExample
      title={t('useOne: one record by id')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: `const { data, isPending, error } = useOne<Customer>({\n  resource: 'customers',\n  id,\n})\n\nif (error)\n  return <Alert tone="danger" title={error.message} />\nreturn <DescriptionList items={…data.data…} />` }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="sm">
          <Select ariaLabel={t('Customer id')} labelPrefix="id" size="sm" value={id} options={[...CUSTOMER_IDS, 99].map(value => ({ label: String(value), value }))} onChange={value => setId(Number(value ?? 1))} />
          {error
            ? <Alert tone="danger" title={t('Could not load record')} message={error.message} />
            : (
                <DescriptionList
                  bordered
                  layout="rows"
                  data-testid="hooks-one"
                  items={[
                    { label: t('Name'), value: isPending ? '…' : customer?.name ?? '' },
                    { label: t('Email'), value: isPending ? '…' : customer?.email ?? '' },
                    { label: t('Tier'), value: isPending ? '…' : customer?.tier ?? '' },
                  ]}
                />
              )}
        </Stack>
      )}
    />
  )
}

const customerColumns = perLocale((t): TableColumn[] => ([
  { field: 'id', label: 'id', kind: 'code', width: '4rem' },
  { field: 'name', label: t('Name'), kind: 'entity', descriptionField: 'email', initials: true },
  { field: 'tier', label: t('Tier'), kind: 'badge' },
]))

function ManyExample(): ReactElement {
  const t = useTranslate()
  const [ids, setIds] = useState<number[]>([1, 4, 6])
  const { data, isFetching } = useMany<CustomerRow>({ resource: 'customers', ids })
  return (
    <LumiCodeExample
      title={t('useMany: several records by id')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: `const [ids, setIds] = useState([1, 4, 6])\nconst { data } = useMany<Customer>({\n  resource: 'customers',\n  ids,\n})\n\n<Table rows={data?.data ?? []} … />` }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="sm">
          <MultiSelect ariaLabel={t('Customer ids')} size="sm" value={ids} options={CUSTOMER_IDS.map(value => ({ label: `id ${value}`, value }))} onChange={value => setIds(value.map(Number))} />
          <Table rowKey="id" columns={customerColumns(t)} rows={ids.length ? data?.data ?? [] : []} loading={isFetching} empty={t('Choose some ids')} data-testid="hooks-many" />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useInfiniteList                                                            */

const memberColumns = perLocale((t): TableColumn[] => ([
  { field: 'name', label: t('Name'), kind: 'entity', descriptionField: 'role', initials: true },
  { field: 'team', label: t('Team') },
]))

function InfiniteExample(): ReactElement {
  const t = useTranslate()
  const list = useInfiniteList<MemberRow>({ resource: 'members', pagination: { pageSize: 6 } })
  const rows = list.data?.pages.flatMap(page => page.data) ?? []
  const total = list.data?.pages.at(-1)?.total ?? 0
  return (
    <LumiCodeExample
      title={t('useInfiniteList: load more')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: `const list = useInfiniteList<Member>({\n  resource: 'members',\n  pagination: { pageSize: 6 },\n})\nconst rows = list.data?.pages.flatMap(page => page.data) ?? []\n\n<Table rows={rows} … />\n<Button\n  label="Load more"\n  loading={list.isFetchingNextPage}\n  disabled={!list.hasNextPage}\n  onClick={() => list.fetchNextPage()}\n/>` }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="sm">
          <Table rowKey="id" columns={memberColumns(t)} rows={rows} loading={list.isPending} data-testid="hooks-infinite" />
          <Stack direction="horizontal" gap="sm" align="center" justify="between">
            <Text variant="muted" text={t('{loaded} of {total} loaded', { loaded: rows.length, total })} />
            <Button label={list.hasNextPage ? t('Load more') : t('All loaded')} appearance="outline" size="sm" loading={list.isFetchingNextPage} disabled={!list.hasNextPage} onClick={() => void list.fetchNextPage()} data-testid="hooks-load-more" />
          </Stack>
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Writes and mutation modes                                                  */

const NEXT_PRIORITY = { low: 'normal', normal: 'high', high: 'low' } as const

const noteColumns = perLocale((t): TableColumn[] => ([
  { field: 'title', label: t('Title'), truncate: true },
  { field: 'priority', label: t('Priority'), kind: 'badge', width: '6rem', toneMap: { low: 'neutral', normal: 'info', high: 'warning' }, valueMap: { low: t('Low'), normal: t('Normal'), high: t('High') } },
  { field: 'actions', kind: 'actions', width: '5rem', actions: [{ value: 'raise', label: t('Change priority'), icon: 'arrow-up' }, { value: 'delete', label: t('Delete'), icon: 'trash', tone: 'danger' }] },
]))

const MUTATION_CODE = `const notes = useList<Note>({ resource: 'notes' })
// mutationMode applies to updates and deletes; creates always wait.
const create = useCreate({ resource: 'notes' })
const update = useUpdate({ resource: 'notes', mutationMode: mode })
const remove = useDelete({ resource: 'notes', mutationMode: mode })

create.mutate({ title: 'Call the courier', priority: 'low' })
update.mutate({ id, variables: { priority: 'high' } })
remove.mutate({ id })
// pessimistic: changes when the server answers
// optimistic:  changes at once, rolls back on failure
// undoable:    optimistic, plus 5 s to Undo`

const MODES: readonly MutationMode[] = ['pessimistic', 'optimistic', 'undoable']

function MutationExample(): ReactElement {
  const t = useTranslate()
  const [mode, setMode] = useState<MutationMode>('optimistic')
  const [last, setLast] = useState<string>()
  const notes = useList<NoteRow>({ resource: 'notes', pagination: { page: 1, pageSize: 6 }, sorters: [{ field: 'id', order: 'desc' }] })
  // The mock waits 800 ms on writes with `__delay`, so the modes can be told apart.
  const slow = { __delay: 1 }
  const create = useCreate<NoteRow>({ resource: 'notes', meta: slow, onSuccess: result => setLast(t('Created #{id}', { id: result.data.id })) })
  const update = useUpdate<NoteRow>({ resource: 'notes', meta: slow, mutationMode: mode, onSuccess: result => setLast(t('Saved #{id}', { id: result.data.id })) })
  const remove = useDelete<NoteRow>({ resource: 'notes', meta: slow, mutationMode: mode, onSuccess: (_, variables) => setLast(t('Deleted #{id}', { id: variables.id })) })
  return (
    <LumiCodeExample
      title={t('useCreate, useUpdate and useDelete')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: MUTATION_CODE }]} />}
      previewLabel={t('Result')}
      previewActions={(
        <Button
          label={t('Create note')}
          appearance="ghost"
          size="sm"
          icon="plus"
          loading={create.isPending}
          onClick={() => create.mutate({ title: t('Call the courier {n}', { n: Date.now() % 10000 }), priority: 'low' })}
          data-testid="hooks-create"
        />
      )}
      preview={(
        <Stack gap="sm">
          <LumiSegmented ariaLabel={t('Mutation mode')} value={mode} options={MODES.map(value => ({ value, label: value }))} onChange={value => setMode(value as MutationMode)} />
          <Table
            rowKey="id"
            columns={noteColumns(t)}
            rows={notes.data?.data ?? []}
            loading={notes.isPending}
            data-testid="hooks-notes"
            onRowAction={({ action, row }) => {
              const note = row as unknown as NoteRow
              if (action === 'raise')
                update.mutate({ id: note.id, variables: { priority: NEXT_PRIORITY[note.priority] ?? 'normal' } })
              else
                remove.mutate({ id: note.id })
            }}
          />
          <Text variant="muted" text={update.isPending || remove.isPending ? t('Waiting for the server…') : last ?? t('Change a priority or delete a row in each mode')} data-testid="hooks-mutation-status" />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useCustom and useCustomMutation                                            */

const CUSTOM_CODE = `// A read that is not a resource list or record.
const stats = useCustom<OrderStats>({ url: '/orders/stats' })

// A write to any endpoint; resource is invalidated after it.
const flip = useCustomMutation<Note, Note['priority']>({
  resource: 'notes',
  build: priority => ({
    url: '/notes/1',
    method: 'PUT',
    payload: { priority },
  }),
})
const note = useOne<Note>({ resource: 'notes', id: 1 })

flip.mutate(note.data.data.priority === 'high' ? 'low' : 'high')`

function CustomExample(): ReactElement {
  const t = useTranslate()
  const stats = useCustom<Record<string, number>>({ url: '/orders/stats' })
  const note = useOne<NoteRow>({ resource: 'notes', id: 1 })
  const flip = useCustomMutation<NoteRow, NoteRow['priority']>({
    resource: 'notes',
    build: priority => ({ url: '/notes/1', method: 'PUT', payload: { priority } }),
  })
  const s = stats.data?.data
  const priority = note.data?.data.priority
  return (
    <LumiCodeExample
      title={t('useCustom and useCustomMutation')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: CUSTOM_CODE }]} />}
      previewLabel={t('Result')}
      previewActions={<Button label={t('Refetch')} appearance="ghost" size="sm" icon="refresh" loading={stats.isFetching} onClick={() => void stats.refetch()} />}
      preview={(
        <Stack gap="md">
          <DescriptionList
            bordered
            layout="rows"
            data-testid="hooks-custom"
            items={[
              { label: t('Orders'), value: s?.total ?? '…' },
              { label: t('Awaiting payment'), value: s?.awaitingPayment ?? '…' },
              { label: t('To ship'), value: s?.toShip ?? '…' },
              { label: t('Overdue'), value: s?.overdue ?? '…' },
            ]}
          />
          <Stack direction="horizontal" gap="sm" align="center" justify="between">
            <Text text={t('Note #1 priority: {priority}', { priority: priority ? t(priority === 'low' ? 'Low' : priority === 'high' ? 'High' : 'Normal') : '…' })} data-testid="hooks-custom-note" />
            <Button
              label="PUT /notes/1"
              appearance="outline"
              size="sm"
              loading={flip.isPending}
              disabled={!priority}
              onClick={() => flip.mutate(priority === 'high' ? 'low' : 'high')}
              data-testid="hooks-custom-mutate"
            />
          </Stack>
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useInvalidate                                                              */

function InvalidateExample(): ReactElement {
  const t = useTranslate()
  const invalidate = useInvalidate()
  const notes = useList<NoteRow>({ resource: 'notes', pagination: { page: 1, pageSize: 1 } })
  const customers = useList<CustomerRow>({ resource: 'customers', pagination: { page: 1, pageSize: 1 } })
  return (
    <LumiCodeExample
      title={t('useInvalidate')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: `const invalidate = useInvalidate()\n\nawait invalidate({ resource: 'notes' })\nawait invalidate({ dataProviderName: 'default' })\nawait invalidate({}) // every Lumi query` }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="sm">
          <DescriptionList
            bordered
            layout="rows"
            data-testid="hooks-invalidate"
            items={[
              { label: t('notes fetched at'), value: notes.isFetching ? '…' : time(notes.dataUpdatedAt) },
              { label: t('customers fetched at'), value: customers.isFetching ? '…' : time(customers.dataUpdatedAt) },
            ]}
          />
          <Stack direction="horizontal" gap="sm" wrap>
            <Button label={t('Invalidate notes')} appearance="outline" size="sm" onClick={() => void invalidate({ resource: 'notes' })} data-testid="hooks-invalidate-notes" />
            <Button label={t('Invalidate everything')} appearance="outline" size="sm" onClick={() => void invalidate({})} data-testid="hooks-invalidate-all" />
          </Stack>
        </Stack>
      )}
    />
  )
}

export function AdminHooksDataRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Data hooks')} description={t('Reads and writes through the DataProvider')}>
      <ListExample />
      <OneExample />
      <ManyExample />
      <InfiniteExample />
      <MutationExample />
      <CustomExample />
      <InvalidateExample />
    </DeveloperPage>
  )
}
