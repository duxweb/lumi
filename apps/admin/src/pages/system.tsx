import type { FilterModel, ListFilterSchema, TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useCustom, useDialog, useTable, useTranslate, useUpdate } from '@duxweb/lumi'
import { LumiListPage, useAdminDrawer, useAssistantContext } from '@duxweb/lumi-admin'
import { LumiButton as Button, LumiDialog as Dialog, LumiText as Text } from '@duxweb/lumi-ui'
import { filterConditionsToCoreFilters, filterModelToConditions } from '@duxweb/lumi-ui/catalog'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { currency, DATE_PRESETS, perLocale, statusLabel } from '../shared.js'
import { NewCategoryDialog } from './overlays.js'

interface ListPage {
  title: string
  description?: string
  resource: string
  schema: ListFilterSchema
  columns: TableColumn[]
  actions?: ReactElement
  /** Derives display fields; keep it module-level so rows stay memoised. */
  mapRow?: (row: Record<string, unknown>) => Record<string, unknown>
  onRowClick?: (row: Record<string, unknown>) => void
  onRowAction?: (event: { action: string, row: Record<string, unknown> }) => void
}

/**
 * The third list flavour the design draft names: no figures at all. Most tables
 * in a real admin are this one — reference data you look something up in.
 */
function PlainListPage({ title, description, resource, schema, columns, actions, mapRow, onRowClick, onRowAction }: ListPage): ReactElement {
  const t = useTranslate()
  const [filters, setFilters] = useState<FilterModel>({})
  const coreFilters = useMemo(() => filterConditionsToCoreFilters(filterModelToConditions(schema.fields, filters)), [schema, filters])
  const table = useTable<Record<string, unknown>>({ resource, pagination: { pageSize: 10 }, filters: coreFilters })
  const rows = useMemo(() => mapRow ? table.rows.map(mapRow) : table.rows, [mapRow, table.rows])
  return (
    <LumiListPage
      title={title}
      {...(description ? { description } : {})}
      actions={actions}
      filters={{
        title: t('{title} filters', { title }),
        schema,
        applyMode: 'immediate',
        value: filters,
        loading: table.query.isFetching,
        onChange: (value) => {
          setFilters(value)
          table.setPage(1)
        },
      }}
      grid={{
        rows,
        columns,
        rowKey: 'id',
        page: table.page,
        pageSize: table.pageSize,
        total: table.total,
        loading: table.query.isPending,
        pageSizeOptions: [10, 20, 50],
        sorters: table.sorters,
        onPageChange: table.setPage,
        onPageSizeChange: (pageSize) => {
          table.setPageSize(pageSize)
          table.setPage(1)
        },
        onSort: (sorters) => {
          table.setSorters(sorters)
          table.setPage(1)
        },
        onRowClick,
        onRowAction,
      }}
    />
  )
}

const TIER_LABELS = perLocale(t => ({ enterprise: t('Enterprise'), gold: t('Gold'), standard: t('Standard') }))

export function AdminCustomersRoute(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  const open = (action: string, row: Record<string, unknown>): void => {
    if (action === 'orders')
      drawer.open('customer-orders', row.id as number)
    else
      drawer.open('edit-customer', row.id as number)
  }
  return (
    <PlainListPage
      title={t('Customers')}
      description={t('Everyone who has bought from the store, their tier and what they have spent')}
      resource="customers"
      schema={{
        fields: [
          { field: 'name', label: t('Search customers'), widget: 'search', placeholder: t('Search name or email…'), primary: true },
          { field: 'tier', label: t('Tier'), widget: 'chips', options: Object.entries(TIER_LABELS(t)).map(([value, label]) => ({ label, value })) },
        ],
      }}
      columns={[
        { field: 'name', label: t('Customer'), kind: 'entity', descriptionField: 'email', sortable: true },
        { field: 'tier', label: t('Tier'), width: '140px', kind: 'badge', valueMap: TIER_LABELS(t), toneMap: { enterprise: 'info', gold: 'warning', standard: 'neutral' } },
        { field: 'spent', label: t('Lifetime spend'), width: '160px', kind: 'currency', currency: 'USD', sortable: true },
        { field: 'actions', kind: 'actions', actions: [{ value: 'edit', label: t('Edit') }, { value: 'orders', label: t('Orders') }] },
      ]}
      onRowClick={row => open('edit', row)}
      onRowAction={({ action, row }) => open(action, row)}
    />
  )
}

const ROLE_LABELS = perLocale(t => ({ admin: t('Administrator'), manager: t('Manager'), support: t('Support') }))

export function AdminUsersRoute(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  const dialog = useDialog()
  const update = useUpdate({ resource: 'users' })
  const toggleActive = (row: Record<string, unknown>): void => {
    const active = row.active !== false
    void dialog.confirm({
      title: active ? t('Suspend {name}?', { name: String(row.name) }) : t('Reactivate {name}?', { name: String(row.name) }),
      message: active ? t('They keep their history but cannot sign in until an administrator reactivates them') : t('They can sign in again with their current role'),
      ...(active ? { tone: 'danger' as const } : {}),
      confirmText: active ? t('Suspend') : t('Reactivate'),
      cancelText: t('Cancel'),
    }).then((confirmed) => {
      if (confirmed)
        update.mutate({ id: row.id as number, variables: { active: !active } })
    })
  }
  return (
    <PlainListPage
      title={t('Users')}
      description={t('Who can sign in, and with which role. The role decides what each user may do')}
      resource="users"
      actions={<Button label={t('New user')} icon="plus" onClick={() => drawer.open('edit-user')} />}
      schema={{
        fields: [
          { field: 'name', label: t('Search users'), widget: 'search', placeholder: t('Search name or email…'), primary: true },
          { field: 'role', label: t('Role'), widget: 'chips', options: Object.entries(ROLE_LABELS(t)).map(([value, label]) => ({ label, value })) },
        ],
      }}
      columns={[
        { field: 'name', label: t('User'), kind: 'entity', descriptionField: 'email', initials: true, sortable: true },
        { field: 'role', label: t('Role'), width: '150px', kind: 'badge', valueMap: ROLE_LABELS(t), toneMap: { admin: 'info', manager: 'neutral', support: 'neutral' } },
        { field: 'active', label: t('Status'), width: '120px', kind: 'badge', valueMap: { true: t('Active'), false: t('Suspended') }, toneMap: { true: 'success', false: 'warning' } },
        { field: 'actions', kind: 'actions', actions: [{ value: 'edit', label: t('Edit') }, { value: 'status', label: t('Suspend or reactivate') }] },
      ]}
      onRowClick={row => drawer.open('edit-user', row.id as number)}
      onRowAction={({ action, row }) => action === 'status' ? toggleActive(row) : drawer.open('edit-user', row.id as number)}
    />
  )
}

const roleRow = perLocale(t => (row: Record<string, unknown>): Record<string, unknown> => {
  const count = Array.isArray(row.permissions) ? row.permissions.length : 0
  // Seeded role names read in the current language, as they do on Users; a renamed role keeps its own name.
  return { ...row, name: t(String(row.name)), permissionCount: count === 1 ? t('1 permission') : t('{count} permissions', { count }) }
})

export function AdminRolesRoute(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  return (
    <PlainListPage
      title={t('Roles')}
      description={t('Each role is a set of resource:action codes. The access provider checks them for routes, buttons and requests')}
      resource="roles"
      actions={<Button label={t('New role')} icon="plus" onClick={() => drawer.open('edit-role')} />}
      schema={{ fields: [{ field: 'name', label: t('Search roles'), widget: 'search', placeholder: t('Search role…'), primary: true }] }}
      mapRow={roleRow(t)}
      columns={[
        { field: 'name', label: t('Role'), kind: 'entity', sortable: true },
        { field: 'code', label: t('Code'), width: '160px', kind: 'code' },
        { field: 'permissionCount', label: t('Permissions'), width: '160px', align: 'right' },
        { field: 'actions', kind: 'actions', actions: [{ value: 'edit', label: t('Edit permissions') }] },
      ]}
      onRowClick={row => drawer.open('edit-role', row.id as number)}
      onRowAction={({ row }) => drawer.open('edit-role', row.id as number)}
    />
  )
}

export function AdminProjectsRoute(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  return (
    <PlainListPage
      title={t('Projects')}
      description={t('Each project\'s owner, status, budget and due date')}
      resource="projects"
      actions={<Button label={t('New project')} icon="plus" href="/projects/new" />}
      schema={{
        fields: [
          { field: 'name', label: t('Search projects'), widget: 'search', placeholder: t('Search project…'), primary: true },
          { field: 'status', label: t('Status'), widget: 'chips', options: ['active', 'review', 'blocked', 'planned'].map(value => ({ label: t(statusLabel(value)), value })) },
          { field: 'dueAt', label: t('Due'), widget: 'dateRange', presets: DATE_PRESETS(t) },
        ],
      }}
      columns={[
        { field: 'name', label: t('Project'), kind: 'entity', descriptionField: 'owner', sortable: true },
        { field: 'status', label: t('Status'), width: '120px', kind: 'badge', valueMap: { active: t('Active'), review: t('In review'), blocked: t('Blocked'), planned: t('Planned') }, toneMap: { active: 'success', review: 'info', blocked: 'danger', planned: 'neutral' } },
        { field: 'budget', label: t('Budget'), width: '140px', kind: 'currency', currency: 'USD', sortable: true },
        { field: 'dueAt', label: t('Due'), width: '130px', kind: 'date', sortable: true },
        { field: 'actions', kind: 'actions', actions: [{ value: 'edit', label: t('Edit project') }] },
      ]}
      onRowClick={row => void navigate(`/projects/${String(row.id)}/edit`)}
      onRowAction={({ row }) => void navigate(`/projects/${String(row.id)}/edit`)}
    />
  )
}

interface Article {
  id: number
  title: string
  summary: string
  category: string
  author: string
  status?: 'published' | 'draft'
}

const ARTICLE_CATEGORIES = ['Operations', 'Growth', 'Support', 'Finance', 'Security']

export function AdminArticlesRoute(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  const dialog = useDialog()
  const update = useUpdate({ resource: 'articles' })
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [preview, setPreview] = useState<Article>()
  const setStatus = (article: Article, status: 'published' | 'draft'): void => {
    if ((article.status ?? 'published') === status) {
      void dialog.alert({ title: status === 'draft' ? t('Already a draft') : t('Already published'), message: status === 'draft' ? t('“{title}” is not in the public index', { title: article.title }) : t('“{title}” is already public', { title: article.title }), confirmText: t('OK') })
      return
    }
    if (status === 'published') {
      update.mutate({ id: article.id, variables: { status } })
      return
    }
    void dialog.confirm({
      title: t('Unpublish “{title}”?', { title: article.title }),
      message: t('This removes the article from the public index. The draft stays in the catalog'),
      tone: 'danger',
      confirmText: t('Unpublish'),
      cancelText: t('Keep published'),
    }).then((confirmed) => {
      if (confirmed)
        update.mutate({ id: article.id, variables: { status } })
    })
  }
  return (
    <>
      <PlainListPage
        title={t('Articles')}
        description={t('Drafts and published articles by category and author')}
        resource="articles"
        actions={(
          <>
            <Button label={t('New category')} appearance="outline" onClick={() => setCategoryOpen(true)} />
            <Button label={t('Write article')} icon="plus" href="/articles/new" />
          </>
        )}
        schema={{
          fields: [
            { field: 'title', label: t('Search articles'), widget: 'search', placeholder: t('Search title…'), primary: true },
            { field: 'status', label: t('Status'), widget: 'chips', options: [{ label: t('Published'), value: 'published' }, { label: t('Draft'), value: 'draft' }] },
            { field: 'category', label: t('Category'), widget: 'chips', options: ARTICLE_CATEGORIES.map(value => ({ label: t(value), value })) },
            { field: 'updatedAt', label: t('Updated'), widget: 'dateRange', presets: DATE_PRESETS(t) },
          ],
        }}
        columns={[
          { field: 'title', label: t('Article'), kind: 'entity', descriptionField: 'summary', sortable: true },
          { field: 'status', label: t('Status'), width: '120px', kind: 'badge', valueMap: { published: t('Published'), draft: t('Draft') }, toneMap: { published: 'success', draft: 'neutral' } },
          { field: 'category', label: t('Category'), width: '140px', kind: 'badge', valueMap: Object.fromEntries(ARTICLE_CATEGORIES.map(value => [value, t(value)])), toneMap: { Operations: 'neutral', Growth: 'success', Support: 'info', Finance: 'warning', Security: 'danger' } },
          { field: 'author', label: t('Author'), width: '160px' },
          { field: 'updatedAt', label: t('Updated'), width: '130px', kind: 'date', sortable: true },
          { field: 'actions', kind: 'actions', actions: [{ value: 'preview', label: t('Preview') }, { value: 'publish', label: t('Publish') }, { value: 'unpublish', label: t('Unpublish') }] },
        ]}
        onRowClick={row => void navigate(`/articles/${String(row.id)}/edit`)}
        onRowAction={({ action, row }) => {
          const article = row as unknown as Article
          if (action === 'unpublish')
            setStatus(article, 'draft')
          else if (action === 'publish')
            setStatus(article, 'published')
          else
            setPreview(article)
        }}
      />
      <NewCategoryDialog open={categoryOpen} onOpenChange={setCategoryOpen} />
      <Dialog
        open={Boolean(preview)}
        title={preview?.title ?? t('Article')}
        description={preview ? `${t(preview.category)} · ${preview.author}` : undefined}
        size="md"
        cancelText={t('Close')}
        onOpenChange={(open) => {
          if (!open)
            setPreview(undefined)
        }}
      >
        <Text variant="muted" text={preview?.summary ?? ''} />
      </Dialog>
    </>
  )
}

const ORDER_STATUS_LABELS: Record<string, string> = { pending: 'Unpaid', paid: 'To ship', packed: 'Packed', shipped: 'Shipped', cancelled: 'Cancelled' }

const ORDER_FILTERS = perLocale((t): ListFilterSchema => ({
  fields: [
    { field: 'searchText', label: t('Search orders'), widget: 'search', placeholder: t('Order no. or customer name'), primary: true },
    { field: 'status', label: t('Status'), widget: 'select', options: Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label: t(label) })), primary: true },
    { field: 'warehouse', label: t('Warehouse'), widget: 'select', options: ['Hangzhou', 'Shenzhen', 'Chengdu'].map(value => ({ value, label: t(value) })), primary: true },
    { field: 'paymentMethod', label: t('Payment'), widget: 'chips', options: [{ value: 'wechat', label: t('WeChat Pay') }, { value: 'alipay', label: t('Alipay') }, { value: 'unionpay', label: t('Card') }, { value: 'cod', label: t('Cash on delivery') }] },
    // Stored as the threshold; the route turns it into `overdueHours >= n`.
    { field: 'overdue', label: t('Overdue'), widget: 'chips', options: [12, 24, 48].map(hours => ({ value: hours, label: t('Over {hours}h', { hours }) })) },
    { field: 'createdAt', label: t('Placed'), widget: 'dateRange', presets: DATE_PRESETS(t) },
    { field: 'watched', label: t('Watching'), widget: 'chips', options: [{ value: true, label: t('Watched only') }] },
  ],
}))

const ORDER_COLUMNS = perLocale((t): TableColumn[] => ([
  { field: 'number', label: t('Order no'), kind: 'code', sortable: true },
  { field: 'customer', label: t('Customer'), kind: 'entity', initials: true, truncate: true },
  { field: 'product', label: t('Product'), truncate: true },
  { field: 'warehouse', label: t('Warehouse') },
  // `state` is the code the tone keys on; `stateLabel` is what a reader sees.
  { field: 'state', label: t('Status'), kind: 'badge', labelField: 'stateLabel', toneMap: { overdue: 'warning', paid: 'info', pending: 'neutral', packed: 'neutral', shipped: 'success', cancelled: 'neutral' } },
  { field: 'total', label: t('Amount'), kind: 'currency', currency: 'USD', sortable: true },
  { field: 'placedAt', label: t('Placed'), kind: 'datetime' },
  { field: 'actions', kind: 'actions', actions: [{ value: 'view', label: t('View order') }, { value: 'ship', label: t('Ship'), icon: 'truck' }, { value: 'print', label: t('Print label'), icon: 'printer' }] },
]))

const ORDER_BULK_ACTIONS = perLocale(t => ([
  { value: 'ship', label: t('Bulk ship'), icon: 'truck' },
  { value: 'print', label: t('Print labels'), icon: 'printer' },
  { value: 'export', label: t('Export'), icon: 'download' },
  { value: 'agent', label: t('Hand to Agent'), icon: 'sparkles', tone: 'primary' as const },
]))

interface OrderStats {
  total: number
  last28Days: number
  awaitingPayment: number
  toShip: number
  overdue: number
  refunding: number
  watching: number
  todayRevenue: number
}

export function AdminOrdersRoute(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  const dialog = useDialog()
  const [filters, setFilters] = useState<FilterModel>({})
  const [selection, setSelection] = useState<Array<string | number>>([])
  const stats = useCustom<OrderStats>({ url: '/orders/stats' }).data?.data
  const schema = useMemo<ListFilterSchema>(() => ({
    ...ORDER_FILTERS(t),
    presets: [
      { name: 'to-ship', label: t('To ship'), count: stats?.toShip, conditions: [{ field: 'status', op: 'eq', value: 'paid' }] },
      { name: 'overdue', label: t('Overdue'), count: stats?.overdue, conditions: [{ field: 'overdue', op: 'eq', value: 12 }] },
      { name: 'watching', label: t('Watching'), count: stats?.watching, conditions: [{ field: 'watched', op: 'eq', value: true }] },
    ],
  }), [stats, t])
  const coreFilters = useMemo(() => filterConditionsToCoreFilters(filterModelToConditions(ORDER_FILTERS(t).fields, filters)).map(filter => filter.field === 'overdue'
    ? { field: 'overdueHours', operator: 'gte' as const, value: filter.value }
    : filter), [filters, t])
  const table = useTable<Record<string, unknown>>({ resource: 'orders', pagination: { pageSize: 10 }, filters: coreFilters })
  const rows = useMemo(() => table.rows.map((row) => {
    const overdue = typeof row.overdueHours === 'number' && row.overdueHours > 0
    return {
      ...row,
      state: overdue ? 'overdue' : row.status,
      stateLabel: overdue ? t('Overdue {hours}h', { hours: row.overdueHours }) : t(ORDER_STATUS_LABELS[String(row.status)] ?? String(row.status)),
    }
  }), [t, table.rows])
  // The selected orders go to the assistant as context chips while this page is open.
  useAssistantContext(table.rows
    .filter(row => selection.includes(row.id as string | number))
    .map(row => ({ id: `orders:${String(row.id)}`, label: String(row.number), kind: 'record' as const, description: String(row.customer ?? '') })))
  const runBulk = (action: string, keys: Array<string | number>): void => {
    const label = ORDER_BULK_ACTIONS(t).find(entry => entry.value === action)?.label ?? action
    void dialog.confirm({
      title: keys.length === 1 ? t('{action} · 1 order', { action: label }) : t('{action} · {count} orders', { action: label, count: keys.length }),
      message: t('This demo does not send anything. A real backend would receive the selected order ids'),
      confirmText: t('OK'),
      cancelText: t('Cancel'),
    })
  }
  return (
    <LumiListPage
      title={t('Orders')}
      description={stats ? t('Last 28 days · {count} orders, refunds and cancellations included', { count: stats.last28Days.toLocaleString() }) : undefined}
      actions={(
        <>
          <Button label={t('Export')} appearance="outline" icon="download" />
          <Button label={t('New order')} icon="plus" />
        </>
      )}
      stats={stats
        ? [
            { key: 'awaiting', icon: 'clock', label: t('Awaiting payment'), value: stats.awaitingPayment.toLocaleString() },
            { key: 'to-ship', icon: 'truck', label: t('To ship'), value: stats.toShip.toLocaleString(), tone: stats.overdue > 0 ? 'warning' : undefined, badge: stats.overdue > 0 ? t('{count} overdue', { count: stats.overdue }) : undefined },
            { key: 'refunding', icon: 'undo', label: t('Refunding'), value: stats.refunding.toLocaleString() },
            { key: 'revenue', icon: 'file-text', label: t('Today’s revenue'), value: currency.format(stats.todayRevenue) },
          ]
        : undefined}
      allCount={stats?.total}
      filters={{
        title: t('Order filters'),
        schema,
        applyMode: 'immediate',
        value: filters,
        loading: table.query.isFetching,
        onChange: (value) => {
          setFilters(value)
          setSelection([])
          table.setPage(1)
        },
      }}
      grid={{
        rows,
        columns: ORDER_COLUMNS(t),
        rowKey: 'id',
        page: table.page,
        pageSize: table.pageSize,
        total: table.total,
        loading: table.query.isPending,
        pageSizeOptions: [10, 20, 50],
        sorters: table.sorters,
        selectable: true,
        selectedKeys: selection,
        bulkActions: ORDER_BULK_ACTIONS(t),
        onSelectionChange: setSelection,
        onBulkAction: ({ action, keys }) => runBulk(action, keys),
        onPageChange: table.setPage,
        onPageSizeChange: (pageSize) => {
          table.setPageSize(pageSize)
          table.setPage(1)
        },
        onSort: (sorters) => {
          table.setSorters(sorters)
          table.setPage(1)
        },
        onRowClick: row => navigate(`/orders/${String(row.id)}`),
        onRowAction: ({ action, row }) => {
          if (action === 'view')
            navigate(`/orders/${String(row.id)}`)
          else
            runBulk(action, [row.id as number])
        },
      }}
    />
  )
}
