import type { TransferColumn } from '@duxweb/lumi'
import type { LumiRecoverablePageState } from '@duxweb/lumi-admin'
import type { FilterModel, ListFilterSchema, TableColumn, TimelineProps, Tone } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useDialog, useExport, useForm, useImport, useInvalidate, useOne, useTable, useTranslate, useUpdate } from '@duxweb/lumi'
import {
  LumiAuditLog,
  LumiDetailPage,
  LumiFormPage,
  LumiFormRow,
  LumiFormSection,
  LumiListPage,
  LumiSettingsForm,
  LumiSettingsPage,
  LumiToggleRow,
  useDocumentTitle,
} from '@duxweb/lumi-admin'
import { LumiBadge as Badge, LumiButton as Button, LumiCheckboxGroup as CheckboxGroup, LumiFormField as FormField, LumiNumberInput as NumberInput, LumiSelect as Select, LumiSwitch as Switch, LumiText as Text } from '@duxweb/lumi-ui'
import { filterConditionsToCoreFilters, filterModelToConditions } from '@duxweb/lumi-ui/catalog'
import { useId, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AdminAgentRoute, AdminAuthorCommandsRoute } from './pages/ai.js'
import { AdminBackendAuthRoute, AdminBackendDataRoute, AdminBackendErrorsRoute, AdminBackendSpecRoute } from './pages/backend.js'
import { AdminPlannedRoute } from './pages/capabilities.js'
import { AdminArticleFormRoute, AdminProjectFormRoute } from './pages/content.js'
import { AdminDashboardRoute } from './pages/dashboard.js'
import { AdminAccountCenterRoute, AdminBasicFormRoute, AdminChartsRoute, AdminStatesRoute } from './pages/examples.js'
import { AdminException403Route, AdminException404Route, AdminException500Route, AdminResultFailRoute, AdminResultSuccessRoute } from './pages/feedback.js'
import { AdminHooksAppRoute } from './pages/hooks-app.js'
import { AdminHooksDataRoute } from './pages/hooks-data.js'
import { AdminHooksListsRoute } from './pages/hooks-lists.js'
import { AdminHooksLiveRoute } from './pages/hooks-live.js'
import { AdminHooksTransferRoute } from './pages/hooks-transfer.js'
import { AdminJsonActionsRoute, AdminJsonQueryRoute, AdminJsonStartRoute, AdminJsonStateRoute } from './pages/json-guide.js'
import { AdminJsonCatalogRoute, AdminJsonPlaygroundRoute } from './pages/json-tools.js'
import { AdminArticleSearchRoute, AdminProjectCardsRoute } from './pages/lists.js'
import { AdminOrderDetailRoute } from './pages/orders.js'
import { AdminComponentOverviewRoute } from './pages/overview.js'
import { AdminPermissionsRoute, AdminStatsRoute, AdminUploadRoute } from './pages/platform.js'
import { AdminProductEditRoute, MAX_PRODUCT_IMAGES, ProductImages } from './pages/product-edit.js'
import { AdminShellLayoutRoute, AdminShellThemeRoute } from './pages/shell.js'
import { AdminArticlesRoute, AdminCustomersRoute, AdminOrdersRoute, AdminProjectsRoute, AdminRolesRoute, AdminUsersRoute } from './pages/system.js'
import { AdminWorkbenchRoute } from './pages/workbench.js'
import { currency, currencyExact, DATE_PRESETS, perLocale, statusLabel } from './shared.js'

interface Product {
  id: number
  name: string
  sku: string
  categoryId: number
  price: number
  status: 'draft' | 'active' | 'archived'
  images?: string[]
  content: string
  updatedAt: string
}

interface ProductDraft {
  name: string
  sku: string
  categoryId: number
  price: number
  status: Product['status']
  images: string[]
  content: string
}

interface UserProfile {
  id: number
  name: string
  email: string
  role: string
  active: boolean
  bio: string
  emailUpdates: boolean
  inApp: boolean
  digest: boolean
  orderUpdates: boolean
  inventoryAlerts: boolean
  /** Hours after payment before an unshipped order raises an alert. */
  overdueHours?: number
  /** Sellable stock below which an inventory alert fires. */
  lowStockThreshold?: number
  dailyBrief?: boolean
  briefTime?: string
  briefContent?: string[]
  language: string
  timezone: string
  dateFormat: string
  firstDay: string
  rememberTabs: boolean
  confirmLeave: boolean
  signInAlerts: boolean
  permissionAlerts: boolean
  exportAlerts: boolean
}

interface PasswordChange {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const EMPTY_PASSWORD: PasswordChange = { currentPassword: '', newPassword: '', confirmPassword: '' }

function errorStatus(error: Error | null): 'error' | 'offline' | 'timeout' {
  const status = (error as Error & { status?: number } | null)?.status
  return status === 503 ? 'offline' : status === 504 ? 'timeout' : 'error'
}

function recoverableState(t: ReturnType<typeof useTranslate>, error: Error | null, retry: () => void): LumiRecoverablePageState {
  const kind = errorStatus(error)
  if (kind === 'offline') {
    return { kind, title: t('Service offline'), reason: t('The product service is currently unavailable'), nextStep: t('Check the connection and retry the request'), actionLabel: t('Retry'), onAction: retry } as const
  }
  if (kind === 'timeout') {
    return { kind, title: t('Request timed out'), reason: t('The product service did not respond in time'), nextStep: t('Retry now or narrow the current filters'), actionLabel: t('Retry'), onAction: retry } as const
  }
  return { kind, title: t('Products could not load'), reason: error?.message ?? t('The request failed'), nextStep: t('Retry the request. If it still fails, contact support'), actionLabel: t('Retry'), onAction: retry } as const
}

const productFilterSchema = perLocale((t): ListFilterSchema => ({
  fields: [
    { field: 'name', label: t('Search products'), widget: 'search', placeholder: t('Search products…'), primary: true },
    { field: 'categoryId', label: t('Category'), widget: 'select', options: [{ label: t('Electronics'), value: 1 }, { label: t('Home'), value: 2 }, { label: t('Outdoor'), value: 3 }], placeholder: t('Category'), primary: true },
    { field: 'status', label: t('Status'), widget: 'chips', options: [{ label: t('Draft'), value: 'draft' }, { label: t('Active'), value: 'active' }, { label: t('Archived'), value: 'archived' }] },
    {
      field: 'price',
      label: t('Price'),
      widget: 'numberRange',
      presets: [{ label: '< $20', value: [0, 20] }, { label: '$20 – $50', value: [20, 50] }, { label: '> $50', value: [50, 999] }],
    },
    {
      field: 'updatedAt',
      label: t('Updated'),
      widget: 'dateRange',
      presets: DATE_PRESETS(t),
    },
  ],
  presets: [{ name: 'active', label: t('Active'), conditions: [{ field: 'status', op: 'eq', value: 'active' }] }],
}))

const productColumns = perLocale((t): TableColumn[] => ([
  { field: 'id', label: 'ID', width: '64px', kind: 'code', sortable: true },
  { field: 'name', label: t('Product'), kind: 'entity', sortable: true },
  { field: 'sku', label: 'SKU', width: '140px', kind: 'code' },
  { field: 'status', label: t('Status'), width: '110px', kind: 'badge', valueMap: { draft: t('Draft'), active: t('Active'), archived: t('Archived') }, toneMap: { draft: 'warning', active: 'success', archived: 'neutral' } },
  { field: 'price', label: t('Price'), width: '110px', kind: 'currency', currency: 'USD', sortable: true },
  { field: 'updatedAt', label: t('Last updated'), width: '150px', kind: 'datetime' },
  { field: 'actions', kind: 'actions', actions: [{ value: 'view', label: t('View') }] },
]))

const PRODUCT_BULK_ACTIONS = perLocale(t => ([
  { value: 'publish', label: t('Publish'), icon: 'check' },
  { value: 'archive', label: t('Archive'), icon: 'archive-02' },
  { value: 'export', label: t('Export'), icon: 'download' },
  { value: 'delete', label: t('Delete'), icon: 'delete-02', tone: 'danger' as const },
]))

function productFileColumns(t: (key: string) => string): TransferColumn[] {
  return [
    { field: 'id', label: 'ID', type: 'number' },
    { field: 'name', label: t('Product name') },
    { field: 'sku', label: 'SKU' },
    { field: 'categoryId', label: t('Category'), type: 'number' },
    { field: 'price', label: t('Price'), type: 'number' },
    { field: 'status', label: t('Status') },
  ]
}

export function AdminProductsRoute(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [filters, setFilters] = useState<FilterModel>({})
  const [selection, setSelection] = useState<Array<string | number>>([])
  const dialog = useDialog()
  const preview = params.get('state')
  const meta = preview === 'empty'
    ? { __empty: 1 }
    : preview === 'error'
      ? { __error: 1 }
      : preview === 'offline'
        ? { __offline: 1 }
        : preview === 'timeout'
          ? { __timeout: 1 }
          : preview === 'loading'
            ? { __delay: 1 }
            : undefined
  const coreFilters = useMemo(() => filterConditionsToCoreFilters(filterModelToConditions(productFilterSchema(t).fields, filters)), [filters, t])
  const table = useTable<Product>({
    resource: 'products',
    pagination: { pageSize: 10 },
    syncWithLocation: true,
    filters: coreFilters,
    meta,
    aggregate: { url: '/products/aggregate', totalKey: 'products' },
  })
  // The file carries what a person edits in a spreadsheet; the server fills in the rest.
  const exporter = useExport({ resource: 'products', filename: 'products', filters: coreFilters, sorters: table.sorters, meta, columns: productFileColumns(t) })
  const importer = useImport({ resource: 'products', columns: productFileColumns(t) })
  const state = table.query.error
    ? recoverableState(t, table.query.error, () => {
        void table.query.refetch()
      })
    : undefined
  return (
    <LumiListPage
      title={t('Products')}
      description={t('Manage your catalog, availability, and pricing')}
      actions={(
        <>
          <Button label={t('Import')} appearance="outline" icon="upload" loading={importer.isLoading} onClick={() => void importer.trigger().catch(() => {})} />
          <Button label={t('Export')} appearance="outline" icon="download" loading={exporter.isLoading} onClick={() => void exporter.trigger().catch(() => {})} />
          <Button label={t('New product')} icon="plus" onClick={() => navigate('/products/new')} />
        </>
      )}
      stats={table.aggregate
        ? [
            { key: 'products', label: t('Products'), value: Number(table.aggregate.products ?? 0) },
            { key: 'active', label: t('Active'), value: Number(table.aggregate.active ?? 0) },
            { key: 'draft', label: t('Draft'), value: Number(table.aggregate.draft ?? 0) },
            { key: 'value', label: t('Catalog value'), value: currency.format(Number(table.aggregate.value ?? 0)) },
          ]
        : undefined}
      filters={{
        title: t('Catalog filters'),
        schema: productFilterSchema(t),
        applyMode: 'immediate',
        value: filters,
        loading: table.query.isFetching,
        onChange: (value) => {
          setFilters(value)
          table.setPage(1)
        },
      }}
      grid={{
        rows: table.rows as unknown as Record<string, unknown>[],
        columns: productColumns(t),
        rowKey: 'id',
        page: table.page,
        pageSize: table.pageSize,
        total: table.total,
        loading: table.query.isPending || (preview === 'loading' && table.query.isFetching),
        pageSizeOptions: [10, 20, 50],
        sorters: table.sorters,
        state,
        onPageChange: table.setPage,
        onPageSizeChange: (pageSize) => {
          table.setPageSize(pageSize)
          table.setPage(1)
        },
        onSort: (sorters) => {
          table.setSorters(sorters)
          table.setPage(1)
        },
        onRowClick: row => navigate(`/products/${String(row.id)}`),
        onRowAction: ({ row }) => navigate(`/products/${String(row.id)}`),
        selectable: true,
        selectedKeys: selection,
        onSelectionChange: setSelection,
        bulkActions: PRODUCT_BULK_ACTIONS(t),
        onBulkAction: ({ action, keys }) => {
          const bulk = PRODUCT_BULK_ACTIONS(t).find(entry => entry.value === action)
          const label = bulk?.label ?? action
          void dialog.confirm({
            title: keys.length === 1 ? t('{action} · 1 product', { action: label }) : t('{action} · {count} products', { action: label, count: keys.length }),
            message: t('This demo does not change anything. A real backend would receive the selected product ids'),
            tone: bulk?.tone,
            icon: bulk?.tone === 'danger' ? bulk.icon : undefined,
            confirmText: t('OK'),
            cancelText: t('Cancel'),
          })
        },
      }}
    />
  )
}

function fieldError<T extends Record<string, any>>(form: ReturnType<typeof useForm<T>>, name: keyof T & string): string | undefined {
  return form.errors.find(issue => issue.path === name)?.message
}

export function AdminProductFormRoute(): ReactElement {
  const t = useTranslate()
  const [step, setStep] = useState('identity')
  const [createdId, setCreatedId] = useState<number>()
  const form = useForm<ProductDraft>({
    resource: 'products',
    initialValues: { name: '', sku: '', categoryId: 1, price: 49, status: 'draft', images: [], content: '' },
    rules: {
      type: 'object',
      required: ['name', 'sku'],
      properties: {
        name: { type: 'string', minLength: 2 },
        sku: { type: 'string', minLength: 3 },
        price: { type: 'number', minimum: 0 },
      },
    },
  })
  return (
    <LumiFormPage
      title={t('Create product')}
      form={form}
      layout="steps"
      description={t('Set up the product details, then review its publishing information')}
      activeSection={step}
      onSectionChange={setStep}
      finishLabel={t('Create product')}
      onSaved={result => setCreatedId((result.data as Product).id)}
      actions={createdId
        ? (
            <Badge role="status" tone="success" label={t('Created product #{id}', { id: createdId })} />
          )
        : undefined}
      sections={[
        {
          key: 'identity',
          label: t('Identity'),
          description: t('Name, SKU, and category'),
          content: (
            <LumiFormSection title={t('Basics')} description={t('What the product is called and where it belongs')}>
              <LumiFormRow>
                <FormField name="name" label={t('Name')} required value={form.values.name} error={fieldError(form, 'name')} onChange={value => form.setValue('name', value)} />
              </LumiFormRow>
              <LumiFormRow>
                <FormField name="sku" label="SKU" required value={form.values.sku} error={fieldError(form, 'sku')} help={t('Uppercase letters and digits')} onChange={value => form.setValue('sku', value)} />
              </LumiFormRow>
              <LumiFormRow span="full">
                <FormField name="categoryId" label={t('Category')} fieldType="enum" widget="Select" value={form.values.categoryId} options={[{ label: t('Electronics'), value: 1 }, { label: t('Cameras'), value: 2 }, { label: t('Audio'), value: 3 }, { label: t('Home'), value: 4 }]} onChange={value => form.setValue('categoryId', value)} />
              </LumiFormRow>
            </LumiFormSection>
          ),
        },
        {
          key: 'publishing',
          label: t('Publishing'),
          description: t('Price, status, and description'),
          content: (
            <>
              <LumiFormSection title={t('Pricing')} description={t('Shown to customers in the storefront currency')}>
                <LumiFormRow>
                  <FormField name="price" label={t('Price')} fieldType="number" value={form.values.price} error={fieldError(form, 'price')} min={0} onChange={value => form.setValue('price', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="status" label={t('Status')} fieldType="enum" widget="Select" value={form.values.status} options={[{ label: t('Draft'), value: 'draft' }, { label: t('Active'), value: 'active' }, { label: t('Archived'), value: 'archived' }]} onChange={value => form.setValue('status', value)} />
                </LumiFormRow>
              </LumiFormSection>
              <LumiFormSection title={t('Images')} description={t('The first image is the cover. Use 800 × 800 or larger, up to {count} images', { count: MAX_PRODUCT_IMAGES })}>
                <LumiFormRow span="full">
                  <ProductImages value={form.values.images} onChange={value => form.setValue('images', value)} />
                </LumiFormRow>
              </LumiFormSection>
              <LumiFormSection title={t('Description')} description={t('The copy that appears on the product page')}>
                <LumiFormRow span="full">
                  <FormField name="content" label={t('Description')} fieldType="text" widget="Textarea" value={form.values.content} rows={6} help={t('Long descriptions wrap without widening the page')} onChange={value => form.setValue('content', value)} />
                </LumiFormRow>
              </LumiFormSection>
            </>
          ),
        },
      ]}
    />
  )
}

const CATEGORY_NAMES: Record<number, string> = { 1: 'Electronics', 2: 'Home', 3: 'Outdoor' }
const PRODUCT_STATUS_TONES: Record<Product['status'], Tone> = { draft: 'warning', active: 'success', archived: 'neutral' }
const stamp = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeStyle: 'short', hour12: false })

const HTML_TAG = /<[^>]*>/gu
const RUN_OF_SPACE = /\s+/gu

/** Demo content arrives as a fragment of HTML; the detail page shows text. */
function plainText(html: string): string {
  return html.replace(HTML_TAG, ' ').replace(RUN_OF_SPACE, ' ').trim()
}

export function AdminProductDetailRoute(): ReactElement {
  const t = useTranslate()
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useOne<Product>({ resource: 'products', id })
  const invalidate = useInvalidate()
  const update = useUpdate<Product, Partial<Product>>({ resource: 'products' })
  const product = query.data?.data
  // The tab names the product, not "Product · 11".
  useDocumentTitle(product?.name)
  const setStatus = (status: Product['status']): void => {
    if (!product)
      return
    const onSuccess = (): void => {
      void invalidate({ resource: 'products' })
    }
    update.mutate({ id: product.id, variables: { status } }, { onSuccess })
  }
  const timeline: TimelineProps = {
    items: product
      ? [
          { key: 'updated', title: t('Catalog record updated'), timestamp: `${stamp.format(new Date(product.updatedAt))} · ${t('system')}`, tone: 'neutral', status: 'current' },
          { key: 'review', title: t('Editorial review queued'), timestamp: t('Awaiting an editor'), tone: 'neutral', status: 'upcoming' },
          { key: 'publish', title: t('Publish to channels'), timestamp: t('After review'), tone: 'neutral', status: 'upcoming' },
        ]
      : [],
    loading: query.isPending,
    empty: t('No product activity is available'),
  }
  return (
    <LumiDetailPage
      title={product?.name ?? t('Product detail')}
      status={product && <Badge dot label={t(statusLabel(product.status))} tone={PRODUCT_STATUS_TONES[product.status]} />}
      actions={product && (
        <>
          <Button label={t('Edit')} appearance="outline" icon="edit" onClick={() => navigate(`/products/${product.id}/edit`)} />
          <Button
            label={t('Archive')}
            appearance="outline"
            disabled={product.status === 'archived' || update.isPending}
            onClick={() => setStatus('archived')}
          />
          {product.status === 'active'
            ? <Button label={t('Move to draft')} appearance="outline" disabled={update.isPending} onClick={() => setStatus('draft')} />
            : <Button label={t('Publish')} loading={update.isPending} onClick={() => setStatus('active')} />}
        </>
      )}
      fields={product
        ? [
            { key: 'sku', label: 'SKU', value: <span className="font-mono">{product.sku}</span> },
            { key: 'price', label: t('Price'), value: currencyExact.format(product.price) },
            { key: 'category', label: t('Category'), value: CATEGORY_NAMES[product.categoryId] ? t(CATEGORY_NAMES[product.categoryId]!) : `#${product.categoryId}` },
            { key: 'updated', label: t('Last updated'), value: stamp.format(new Date(product.updatedAt)) },
          ]
        : []}
      sections={product
        ? [{
            key: 'description',
            title: t('Description'),
            children: <Text variant="muted" text={plainText(product.content) || t('No description has been added')} />,
          }, {
            key: 'history',
            title: t('Change history'),
            children: <LumiAuditLog resource="products" id={product.id} pageSize={5} />,
          }]
        : []}
      timeline={timeline}
      state={query.isPending
        ? { kind: 'loading', label: t('Loading product detail') }
        : query.error
          ? { kind: 'error', title: t('Product unavailable'), reason: query.error.message, nextStep: t('Return to Products or retry this request'), actionLabel: t('Retry'), onAction: () => { void query.refetch() } }
          : undefined}
    />
  )
}

function SettingsToggle({ name, label, description, icon, value, onChange }: {
  name: string
  label: string
  description: string
  icon?: string
  value: boolean
  onChange: (value: boolean) => void
}): ReactElement {
  const id = useId()
  return (
    <LumiToggleRow className="lumi-settings-form__toggle" title={label} description={description} icon={icon} controlId={id}>
      <Switch id={id} name={name} ariaLabel={label} aria-describedby={`${id}-description`} value={value} onChange={onChange} />
    </LumiToggleRow>
  )
}

const OVERDUE_OPTIONS = perLocale(t => [6, 12, 24, 48].map(hours => ({ label: t('After {hours} hours', { hours }), value: hours })))
const FIRST_DAY_OPTIONS = perLocale(t => ['Monday', 'Sunday'].map(value => ({ label: t(value), value })))
const BRIEF_TIME_OPTIONS = ['08:00', '09:00', '10:00', '18:00'].map(value => ({ label: value, value }))
const BRIEF_CONTENT_OPTIONS = perLocale(t => ([{ label: t('Business data'), value: 'business' }, { label: t('Order exceptions'), value: 'orders' }, { label: t('Inventory'), value: 'inventory' }]))

export function AdminSettingsRoute(): ReactElement {
  const t = useTranslate()
  const [section, setSection] = useState('profile')
  const profile = useOne<UserProfile>({ resource: 'users', id: 1 })
  const identity = useForm<Pick<UserProfile, 'name' | 'email' | 'bio'>>({
    resource: 'users',
    id: 1,
    initialValues: profile.data?.data ? { name: profile.data.data.name, email: profile.data.data.email, bio: profile.data.data.bio } : undefined,
  })
  const access = useForm<Pick<UserProfile, 'active'>>({
    resource: 'users',
    id: 1,
    initialValues: profile.data?.data ? { active: profile.data.data.active } : undefined,
  })
  const delivery = useForm<Pick<UserProfile, 'emailUpdates' | 'inApp' | 'digest'>>({
    resource: 'users',
    id: 1,
    initialValues: profile.data?.data ? { emailUpdates: profile.data.data.emailUpdates, inApp: profile.data.data.inApp, digest: profile.data.data.digest } : undefined,
  })
  const events = useForm<Pick<UserProfile, 'orderUpdates' | 'inventoryAlerts' | 'overdueHours' | 'lowStockThreshold'>>({
    resource: 'users',
    id: 1,
    // The mock profile has no alert thresholds yet; start from sensible defaults.
    initialValues: profile.data?.data ? { orderUpdates: profile.data.data.orderUpdates, inventoryAlerts: profile.data.data.inventoryAlerts, overdueHours: profile.data.data.overdueHours ?? 24, lowStockThreshold: profile.data.data.lowStockThreshold ?? 20 } : undefined,
    rules: { type: 'object', properties: { lowStockThreshold: { type: 'integer', minimum: 1, maximum: 9999 } } },
  })
  const brief = useForm<Pick<UserProfile, 'dailyBrief' | 'briefTime' | 'briefContent'>>({
    resource: 'users',
    id: 1,
    // The mock profile has no brief preferences until the first save.
    initialValues: profile.data?.data ? { dailyBrief: profile.data.data.dailyBrief ?? true, briefTime: profile.data.data.briefTime ?? '09:00', briefContent: profile.data.data.briefContent ?? ['business', 'orders'] } : undefined,
    rules: { type: 'object', properties: { briefContent: { type: 'array', minItems: 1 } } },
  })
  const briefTimeId = useId()
  const briefContentId = useId()
  const overdueId = useId()
  const stockId = useId()
  const locale = useForm<Pick<UserProfile, 'language' | 'timezone' | 'dateFormat' | 'firstDay'>>({
    resource: 'users',
    id: 1,
    initialValues: profile.data?.data ? { language: profile.data.data.language, timezone: profile.data.data.timezone, dateFormat: profile.data.data.dateFormat, firstDay: profile.data.data.firstDay } : undefined,
  })
  const workspace = useForm<Pick<UserProfile, 'rememberTabs' | 'confirmLeave'>>({
    resource: 'users',
    id: 1,
    initialValues: profile.data?.data ? { rememberTabs: profile.data.data.rememberTabs, confirmLeave: profile.data.data.confirmLeave } : undefined,
  })
  const security = useForm<Pick<UserProfile, 'signInAlerts' | 'permissionAlerts' | 'exportAlerts'>>({
    resource: 'users',
    id: 1,
    initialValues: profile.data?.data ? { signInAlerts: profile.data.data.signInAlerts, permissionAlerts: profile.data.data.permissionAlerts, exportAlerts: profile.data.data.exportAlerts } : undefined,
  })
  const password = useForm<PasswordChange>({
    resource: 'users',
    id: 1,
    initialValues: EMPTY_PASSWORD,
    rules: { type: 'object', required: ['currentPassword', 'newPassword', 'confirmPassword'], properties: { currentPassword: { type: 'string', minLength: 1 }, newPassword: { type: 'string', minLength: 8 }, confirmPassword: { type: 'string', minLength: 1 } } },
  })
  return (
    <LumiSettingsPage
      title={t('Settings')}
      description={t('Manage your account settings and user preferences')}
      value={section}
      onChange={setSection}
      state={profile.isPending
        ? { kind: 'loading', label: t('Loading settings') }
        : profile.error
          ? { kind: 'error', title: t('Settings unavailable'), reason: profile.error.message, nextStep: t('Retry loading your account settings'), actionLabel: t('Retry'), onAction: () => { void profile.refetch() } }
          : undefined}
      sections={[
        {
          value: 'profile',
          label: t('Profile'),
          group: t('Account'),
          showHeader: false,
          layout: 'rows',
          actions: false,
          content: (
            <>
              <LumiSettingsForm form={identity} saveMode="manual" disabled={profile.isPending} label={t('Personal information')} description={t('Manage your profile identity and contact details')} savedLabel={t('Profile saved successfully')} columns={2}>
                <FormField name="name" label={t('Display name')} required error={fieldError(identity, 'name')} value={identity.values.name ?? ''} onChange={value => identity.setValue('name', value)} />
                <FormField name="email" label={t('Email address')} required type="email" error={fieldError(identity, 'email')} value={identity.values.email ?? ''} onChange={value => identity.setValue('email', value)} />
                <div className="lumi-settings-form__full">
                  <FormField name="bio" label={t('Bio')} fieldType="text" widget="Textarea" rows={3} help={t('A short introduction for your team')} value={identity.values.bio ?? ''} onChange={value => identity.setValue('bio', value)} />
                </div>
              </LumiSettingsForm>
              <LumiSettingsForm form={access} disabled={profile.isPending} label={t('Account access')} description={t('Review the account role and sign-in availability')}>
                <FormField name="role" label={t('Role')} value={t('Administrator')} disabled />
                <SettingsToggle name="active" icon="user" label={t('Account active')} description={t('Allow this account to sign in to the workspace')} value={access.values.active ?? false} onChange={value => access.setValue('active', value)} />
              </LumiSettingsForm>
            </>
          ),
        },
        {
          value: 'notifications',
          label: t('Notifications'),
          showHeader: false,
          layout: 'rows',
          actions: false,
          content: (
            <>
              <LumiSettingsForm form={delivery} disabled={profile.isPending} label={t('Notification delivery')} description={t('Choose where you receive updates about your workspace')}>
                <SettingsToggle name="emailUpdates" icon="mail" label={t('Email notifications')} description={t('Receive important workspace updates in your inbox')} value={delivery.values.emailUpdates ?? false} onChange={value => delivery.setValue('emailUpdates', value)} />
                <SettingsToggle name="inApp" icon="bell" label={t('In-app notifications')} description={t('See new activity in the notification center')} value={delivery.values.inApp ?? false} onChange={value => delivery.setValue('inApp', value)} />
                <SettingsToggle name="digest" icon="news" label={t('Weekly digest')} description={t('Get a weekly summary of orders, inventory, and team activity')} value={delivery.values.digest ?? false} onChange={value => delivery.setValue('digest', value)} />
              </LumiSettingsForm>
              <LumiSettingsForm form={events} disabled={profile.isPending} label={t('Activity updates')} description={t('Keep the signals you need and reduce the noise')}>
                <SettingsToggle name="orderUpdates" icon="package" label={t('Order updates')} description={t('New orders and changes to payment or fulfillment status')} value={events.values.orderUpdates ?? false} onChange={value => events.setValue('orderUpdates', value)} />
                <LumiToggleRow title={t('Overdue shipments')} description={t('Paid orders still unshipped after this long')} controlId={overdueId}>
                  <Select id={overdueId} ariaLabel={t('Overdue shipments')} aria-describedby={`${overdueId}-description`} options={OVERDUE_OPTIONS(t)} value={events.values.overdueHours ?? 24} onChange={value => events.setValue('overdueHours', Number(value))} />
                </LumiToggleRow>
                <SettingsToggle name="inventoryAlerts" icon="box" label={t('Inventory alerts')} description={t('Products running low or returning to stock')} value={events.values.inventoryAlerts ?? false} onChange={value => events.setValue('inventoryAlerts', value)} />
                <LumiToggleRow title={t('Low stock threshold')} description={t('Alert when any SKU\'s sellable stock falls below')} controlId={stockId} error={fieldError(events, 'lowStockThreshold')}>
                  <NumberInput id={stockId} name="lowStockThreshold" ariaLabel={t('Low stock threshold')} aria-describedby={`${stockId}-description ${stockId}-error`} invalid={Boolean(fieldError(events, 'lowStockThreshold'))} suffix={t('items')} value={events.values.lowStockThreshold ?? 20} onChange={value => events.setValue('lowStockThreshold', value ?? 0)} />
                </LumiToggleRow>
              </LumiSettingsForm>
              <LumiSettingsForm form={brief} disabled={profile.isPending} label={t('Daily brief')} description={t('Agent sums up each day\'s changes and to-dos, and sends them to the channels you choose')}>
                <SettingsToggle name="dailyBrief" icon="sparkles" label={t('Receive the daily brief')} description={t('Sent on weekdays, paused on holidays')} value={brief.values.dailyBrief ?? false} onChange={value => brief.setValue('dailyBrief', value)} />
                <LumiToggleRow title={t('Send time')} description={t('In your account\'s time zone')} controlId={briefTimeId}>
                  <Select id={briefTimeId} ariaLabel={t('Send time')} aria-describedby={`${briefTimeId}-description`} options={BRIEF_TIME_OPTIONS} value={brief.values.briefTime ?? '09:00'} onChange={value => brief.setValue('briefTime', String(value))} />
                </LumiToggleRow>
                <LumiToggleRow title={t('Includes')} description={t('Choose at least one')} controlId={briefContentId} error={fieldError(brief, 'briefContent')}>
                  <CheckboxGroup id={briefContentId} ariaLabel={t('Includes')} direction="row" invalid={brief.errors.some(issue => issue.path === 'briefContent')} options={BRIEF_CONTENT_OPTIONS(t)} value={brief.values.briefContent ?? []} onChange={value => brief.setValue('briefContent', value.map(String))} />
                </LumiToggleRow>
              </LumiSettingsForm>
            </>
          ),
        },
        {
          value: 'preferences',
          label: t('Preferences'),
          showHeader: false,
          layout: 'rows',
          actions: false,
          content: (
            <>
              <LumiSettingsForm form={locale} disabled={profile.isPending} label={t('Language & region')} description={t('Choose your preferred language, time zone, and date format')} columns={2}>
                <FormField name="language" label={t('Language')} fieldType="enum" widget="Select" value={locale.values.language ?? ''} options={['English', '简体中文', '日本語'].map(value => ({ label: value, value }))} onChange={value => locale.setValue('language', value)} />
                <FormField name="timezone" label={t('Time zone')} fieldType="enum" widget="Select" value={locale.values.timezone ?? ''} options={['Asia/Shanghai', 'UTC', 'America/New_York'].map(value => ({ label: value, value }))} onChange={value => locale.setValue('timezone', value)} />
                <FormField name="dateFormat" label={t('Date format')} fieldType="enum" widget="Select" value={locale.values.dateFormat ?? ''} options={['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].map(value => ({ label: value, value }))} onChange={value => locale.setValue('dateFormat', value)} />
                <FormField name="firstDay" label={t('Start of week')} fieldType="enum" widget="Select" value={locale.values.firstDay ?? ''} options={FIRST_DAY_OPTIONS(t)} onChange={value => locale.setValue('firstDay', value)} />
              </LumiSettingsForm>
              <LumiSettingsForm form={workspace} disabled={profile.isPending} label={t('Workspace preferences')} description={t('Make your daily workflow feel more familiar')}>
                <SettingsToggle name="rememberTabs" icon="layers" label={t('Restore open tabs')} description={t('Continue where you left off when you return')} value={workspace.values.rememberTabs ?? false} onChange={value => workspace.setValue('rememberTabs', value)} />
                <SettingsToggle name="confirmLeave" icon="triangle-alert" label={t('Unsaved changes reminder')} description={t('Ask before leaving a page with unsaved edits')} value={workspace.values.confirmLeave ?? false} onChange={value => workspace.setValue('confirmLeave', value)} />
              </LumiSettingsForm>
            </>
          ),
        },
        {
          value: 'security',
          label: t('Security'),
          showHeader: false,
          layout: 'rows',
          actions: false,
          content: (
            <>
              <LumiSettingsForm form={security} disabled={profile.isPending} label={t('Security alerts')} description={t('Choose which account events you want to hear about')}>
                <SettingsToggle name="signInAlerts" icon="key-round" label={t('New sign-in alerts')} description={t('Notify me when my account signs in from a new device')} value={security.values.signInAlerts ?? false} onChange={value => security.setValue('signInAlerts', value)} />
                <SettingsToggle name="permissionAlerts" icon="shield" label={t('Permission changes')} description={t('Notify me when my role or access permissions change')} value={security.values.permissionAlerts ?? false} onChange={value => security.setValue('permissionAlerts', value)} />
                <SettingsToggle name="exportAlerts" icon="cloud-download" label={t('Data export alerts')} description={t('Notify me when an export is requested from my account')} value={security.values.exportAlerts ?? false} onChange={value => security.setValue('exportAlerts', value)} />
              </LumiSettingsForm>
              <LumiSettingsForm form={password} saveMode="manual" label={t('Change password')} description={t('Use at least 8 characters. You stay signed in on this device')} savedLabel={t('Password changed')} columns={2} onSaved={() => password.reset(EMPTY_PASSWORD)}>
                <div className="lumi-settings-form__full">
                  <FormField name="currentPassword" label={t('Current password')} required type="password" error={fieldError(password, 'currentPassword')} value={password.values.currentPassword} onChange={value => password.setValue('currentPassword', value)} />
                </div>
                <FormField name="newPassword" label={t('New password')} required type="password" error={fieldError(password, 'newPassword')} value={password.values.newPassword} onChange={value => password.setValue('newPassword', value)} />
                <FormField name="confirmPassword" label={t('Confirm new password')} required type="password" error={fieldError(password, 'confirmPassword')} value={password.values.confirmPassword} onChange={value => password.setValue('confirmPassword', value)} />
              </LumiSettingsForm>
            </>
          ),
        },
      ]}
    />
  )
}

export const adminRouteComponents = {
  AdminPlannedRoute,
  AdminJsonStartRoute,
  AdminJsonStateRoute,
  AdminJsonActionsRoute,
  AdminJsonQueryRoute,
  AdminJsonCatalogRoute,
  AdminJsonPlaygroundRoute,
  AdminHooksDataRoute,
  AdminHooksListsRoute,
  AdminHooksLiveRoute,
  AdminHooksTransferRoute,
  AdminHooksAppRoute,
  AdminBackendSpecRoute,
  AdminBackendDataRoute,
  AdminBackendErrorsRoute,
  AdminBackendAuthRoute,
  AdminUploadRoute,
  AdminPermissionsRoute,
  AdminStatsRoute,
  AdminAgentRoute,
  AdminAuthorCommandsRoute,
  AdminShellLayoutRoute,
  AdminShellThemeRoute,
  AdminBasicFormRoute,
  AdminStatesRoute,
  AdminAccountCenterRoute,
  AdminChartsRoute,
  AdminOrdersRoute,
  AdminDashboardRoute,
  AdminWorkbenchRoute,
  AdminProductsRoute,
  AdminProductFormRoute,
  AdminProductDetailRoute,
  AdminProductEditRoute,
  AdminOrderDetailRoute,
  AdminCustomersRoute,
  AdminArticlesRoute,
  AdminArticleFormRoute,
  AdminArticleSearchRoute,
  AdminProjectsRoute,
  AdminProjectCardsRoute,
  AdminProjectFormRoute,
  AdminUsersRoute,
  AdminRolesRoute,
  AdminResultSuccessRoute,
  AdminResultFailRoute,
  AdminException403Route,
  AdminException404Route,
  AdminException500Route,
  AdminComponentOverviewRoute,
  AdminSettingsRoute,
}
