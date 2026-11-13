import type { Filter } from '@duxweb/lumi'
import type { ReactElement } from 'react'
import { useCreate, useForm, useList, useOne, useTable, useTranslate } from '@duxweb/lumi'
import { LumiFormRow, LumiFormSection, LumiSegmented, useAdminDrawer, useAdminDrawerChrome } from '@duxweb/lumi-admin'
import { LumiDialog as Dialog, LumiForm as Form, LumiFormField as FormField, LumiFragment as Fragment, LumiInput as Input, LumiPagination as Pagination, LumiStack as Stack, LumiTable as Table, LumiText as Text } from '@duxweb/lumi-ui'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDrawerSave } from '../drawer-form.js'
import { currencyExact, perLocale, statusLabel } from '../shared.js'

interface Customer {
  id: number
  name: string
  email: string
  tier: 'enterprise' | 'gold' | 'standard'
  spent: number
}

interface CustomerDraft {
  name: string
  email: string
  tier: Customer['tier']
}

interface Order {
  id: number
  number: string
  customerId: number
  status: string
  total: number
  items: string
  createdAt: string
}

interface Category {
  id: number
  name: string
  parentId?: number
}

const TIER_OPTIONS = perLocale(t => ([
  { label: t('Enterprise'), value: 'enterprise' },
  { label: t('Gold'), value: 'gold' },
  { label: t('Standard'), value: 'standard' },
]))

const ORDER_STATUS_OPTIONS = perLocale(t => ['pending', 'paid', 'packed', 'shipped', 'cancelled'].map(value => ({
  label: t(statusLabel(value)),
  value,
})))

function parseItemCount(raw: string | undefined): number {
  if (!raw)
    return 0
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  }
  catch {
    return 0
  }
}

const NON_SLUG = /[^a-z0-9]+/g
const EDGE_HYPHEN = /^-+|-+$/g

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(NON_SLUG, '-').replace(EDGE_HYPHEN, '')
}

/**
 * Routed drawer form: the list stays behind, the record is shareable as
 * `?drawer=edit-customer&record=`. Dirty close uses the shared guard.
 */
export function CustomerEditDrawer(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  const query = useOne<Customer>({ resource: 'customers', id: drawer.recordId, enabled: Boolean(drawer.recordId) })
  const customer = query.data?.data
  const form = useForm<CustomerDraft>({
    resource: 'customers',
    id: drawer.recordId,
    initialValues: customer
      ? { name: customer.name, email: customer.email, tier: customer.tier }
      : undefined,
    rules: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', minLength: 3 },
      },
    },
  })
  const save = useDrawerSave(form, {
    owner: 'customer-edit',
    title: t('Edit customer'),
    description: customer ? `${customer.email} · ${customer.name}` : undefined,
    ready: Boolean(customer),
  })
  if (!drawer.recordId)
    return <Text variant="muted" text={t('Choose a customer from the list')} />
  if (query.isPending)
    return <Text variant="muted" role="status" text={t('Loading customer…')} />
  return (
    <Form value={{ ...form.values }} disabled={form.isSubmitting} data-testid="customer-edit-drawer" onSubmit={save}>
      <LumiFormSection title={t('Profile')} description={t('How this account appears on invoices and in the list')}>
        <LumiFormRow span="full">
          <FormField name="name" label={t('Customer name')} required value={form.values.name} onChange={value => form.setValue('name', value)} />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="email" label={t('Email')} type="email" required value={form.values.email} onChange={value => form.setValue('email', value)} />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="tier" label={t('Tier')} fieldType="enum" widget="Select" value={form.values.tier} options={TIER_OPTIONS(t)} onChange={value => form.setValue('tier', value)} />
        </LumiFormRow>
      </LumiFormSection>
      <LumiFormSection title={t('Account')} description={t('Lifetime figures are calculated, not edited here')}>
        <LumiFormRow>
          <FormField name="spent" label={t('Lifetime spend')} value={customer ? currencyExact.format(customer.spent) : '—'} disabled />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="id" label={t('Customer ID')} value={customer ? String(customer.id) : '—'} disabled />
        </LumiFormRow>
      </LumiFormSection>
    </Form>
  )
}

/**
 * 720px table drawer: this customer's orders, not a second copy of the orders
 * page. Search and one status chip only — the row already scoped the set.
 */
export function CustomerOrdersDrawer(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  const navigate = useNavigate()
  const customer = useOne<Customer>({ resource: 'customers', id: drawer.recordId, enabled: Boolean(drawer.recordId) })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const filters = useMemo<Filter[]>(() => {
    const next: Filter[] = []
    if (drawer.recordId)
      next.push({ field: 'customerId', operator: 'eq', value: Number(drawer.recordId) })
    if (search)
      next.push({ field: 'number', operator: 'like', value: search })
    if (status)
      next.push({ field: 'status', operator: 'eq', value: status })
    return next
  }, [drawer.recordId, search, status])
  const table = useTable<Order>({ resource: 'orders', pagination: { pageSize: 9 }, filters })
  const record = customer.data?.data
  useAdminDrawerChrome({
    revision: `${record?.id ?? ''}:${table.page}:${table.total}`,
    title: record ? t('Orders · {name}', { name: record.name }) : t('Orders'),
    description: record
      ? t('{count} orders · {amount} lifetime', { count: table.total, amount: currencyExact.format(record.spent) })
      : undefined,
    footerStart: <span>{table.total === 0 ? t('No orders') : t('Showing {from}–{to} of {total}', { from: (table.page - 1) * table.pageSize + 1, to: Math.min(table.page * table.pageSize, table.total), total: table.total })}</span>,
    footerEnd: (
      <Pagination
        page={table.page}
        pageSize={table.pageSize}
        total={table.total}
        showTotal={false}
        ariaLabel={t('Customer orders pagination')}
        onPageChange={table.setPage}
      />
    ),
  })
  const rows = table.rows.map(row => ({
    ...row,
    itemCount: `${parseItemCount(row.items)} item${parseItemCount(row.items) === 1 ? '' : 's'}`,
  }))
  return (
    <Fragment layout="stack" data-lumi-fill data-testid="customer-orders-drawer">
      <Stack direction="horizontal" gap="sm" wrap>
        <Input
          ariaLabel={t('Search orders')}
          placeholder={t('Search orders…')}
          value={search}
          onChange={(value: string) => {
            setSearch(value)
            table.setPage(1)
          }}
        />
        <LumiSegmented
          ariaLabel={t('Status')}
          value={status}
          options={[{ value: '', label: t('All') }, ...ORDER_STATUS_OPTIONS(t)]}
          onChange={(value) => {
            setStatus(String(value))
            table.setPage(1)
          }}
        />
      </Stack>
      <Table
        rowKey="id"
        rows={rows}
        columns={[
          { field: 'number', label: t('Order'), kind: 'entity', descriptionField: 'itemCount' },
          { field: 'createdAt', label: t('Placed'), width: '170px', kind: 'date' },
          { field: 'status', label: t('Status'), width: '130px', kind: 'badge', valueMap: Object.fromEntries(ORDER_STATUS_OPTIONS(t).map(option => [option.value, option.label])), toneMap: { pending: 'warning', paid: 'info', packed: 'neutral', shipped: 'success', cancelled: 'danger' } },
          { field: 'total', label: t('Total'), width: '120px', kind: 'currency', currency: 'USD' },
        ]}
        onRowClick={(row) => {
          drawer.close()
          void navigate(`/orders/${row.id}`)
        }}
      />
    </Fragment>
  )
}

export function NewCategoryDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }): ReactElement {
  const t = useTranslate()
  const categories = useList<Category>({ resource: 'categories', pagination: { page: 1, pageSize: 50 } })
  const create = useCreate<{ id: number }, { name: string, parentId?: number, visible: boolean }>({ resource: 'categories' })
  const [name, setName] = useState('Accessories')
  const [parentId, setParentId] = useState<number | ''>('')
  const [slug, setSlug] = useState('accessories')
  const [slugTouched, setSlugTouched] = useState(false)
  const reset = (): void => {
    setName('Accessories')
    setParentId('')
    setSlug('accessories')
    setSlugTouched(false)
  }
  const submit = (): void => {
    create.mutate(
      { name, parentId: parentId === '' ? undefined : parentId, visible: true },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      },
    )
  }
  return (
    <Dialog
      open={open}
      title={t('New category')}
      description={t('Categories group products in the storefront')}
      size="md"
      confirmText={t('Create')}
      cancelText={t('Cancel')}
      loading={create.isPending}
      data-testid="new-category-dialog"
      onConfirm={submit}
      onOpenChange={(next: boolean) => {
        if (!next)
          reset()
        onOpenChange(next)
      }}
    >
      <Form value={{ name, parentId, slug }} onSubmit={submit}>
        <Fragment layout="stack">
          <FormField
            name="name"
            label={t('Name')}
            required
            value={name}
            onChange={(value) => {
              setName(String(value ?? ''))
              if (!slugTouched)
                setSlug(slugify(String(value ?? '')))
            }}
          />
          <FormField
            name="parentId"
            label={t('Parent')}
            fieldType="enum"
            widget="Select"
            placeholder={t('None')}
            value={parentId}
            options={[{ label: t('None'), value: '' }, ...(categories.data?.data ?? []).map(category => ({ label: category.name, value: category.id }))]}
            onChange={value => setParentId(value === '' || value === undefined ? '' : Number(value))}
          />
          <FormField
            name="slug"
            label={t('Slug')}
            value={slug}
            help={t('Used in the storefront URL')}
            onChange={(value) => {
              setSlugTouched(true)
              setSlug(String(value ?? ''))
            }}
          />
        </Fragment>
      </Form>
    </Dialog>
  )
}
