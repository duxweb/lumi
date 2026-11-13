import type { TreeSource } from '@duxweb/lumi'
import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useForm, useSelect, useTable, useTranslate, useTreeSource } from '@duxweb/lumi'
import { LumiCodeExample } from '@duxweb/lumi-admin'
import { LumiAlert as Alert, LumiButton as Button, LumiCodeBlock as CodeBlock, LumiDescriptionList as DescriptionList, LumiFormField as FormField, LumiGrid as Grid, LumiInput as Input, LumiPagination as Pagination, LumiSelect as Select, LumiStack as Stack, LumiTable as Table, LumiText as Text, LumiTree as Tree } from '@duxweb/lumi-ui'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { Code, DeveloperPage } from '../developer/kit.js'
import { perLocale } from '../shared.js'

// The list-shaped hooks: each keeps its state headless and hands plain
// props to Lumi UI controls, so the same hook drives any table, select,
// form or tree.

/* -------------------------------------------------------------------------- */
/* useTable                                                                   */

const STATUS_TONES = { pending: 'warning', paid: 'primary', packed: 'info', shipped: 'success', cancelled: 'neutral' } as const

const orderColumns = perLocale((t): TableColumn[] => ([
  { field: 'number', label: t('Order'), kind: 'code', sortable: true },
  { field: 'customer', label: t('Customer'), truncate: true, sortable: true },
  { field: 'status', label: t('Status'), kind: 'badge', toneMap: STATUS_TONES, valueMap: { pending: t('Pending'), paid: t('Paid'), packed: t('Packed'), shipped: t('Shipped'), cancelled: t('Cancelled') } },
  { field: 'total', label: t('Total'), kind: 'currency', currency: 'CNY', align: 'right', sortable: true },
]))

const TABLE_CODE = `const table = useTable<Order>({
  resource: 'orders',
  pagination: { pageSize: 5 },
  filters: status
    ? [{ field: 'status', operator: 'eq', value: status }]
    : [],
  // ?page=2&pageSize=10&sort=total:desc
  syncWithLocation: true,
})

<Table
  rows={table.rows}
  loading={table.query.isFetching}
  sorters={table.sorters}
  onSort={table.setSorters}
  …
/>
<Pagination
  page={table.page}
  pageSize={table.pageSize}
  total={table.total}
  onPageChange={table.setPage}
  onPageSizeChange={table.setPageSize}
/>`

function TableExample(): ReactElement {
  const t = useTranslate()
  const location = useLocation()
  const [status, setStatus] = useState('')
  const table = useTable({
    resource: 'orders',
    pagination: { pageSize: 5 },
    filters: status ? [{ field: 'status', operator: 'eq', value: status }] : [],
    syncWithLocation: true,
  })
  return (
    <LumiCodeExample
      title={t('useTable with syncWithLocation')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: TABLE_CODE }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="sm">
          <Select
            ariaLabel={t('Status')}
            labelPrefix={t('Status')}
            size="sm"
            value={status || null}
            clearable
            placeholder={t('Any')}
            options={[{ label: t('Pending'), value: 'pending' }, { label: t('Paid'), value: 'paid' }, { label: t('Shipped'), value: 'shipped' }]}
            onChange={(value) => {
              setStatus(value === null ? '' : String(value))
              table.setPage(1)
            }}
          />
          <Table
            rowKey="id"
            columns={orderColumns(t)}
            rows={table.rows}
            loading={table.query.isFetching}
            sorters={table.sorters}
            onSort={table.setSorters}
            data-testid="hooks-table"
          />
          <Pagination ariaLabel={t('Orders pages')} page={table.page} pageSize={table.pageSize} total={table.total} pageSizeOptions={[5, 10, 20]} showTotal onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
          <CodeBlock title={t('Address')} language="text" code={`${location.pathname}${location.search}`} copyable={false} wrap data-testid="hooks-table-address" />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useSelect                                                                  */

const SELECT_CODE = `const [value, setValue] = useState<number | null>(40)
const select = useSelect({
  resource: 'members',
  labelField: 'name',
  descriptionField: 'role',
  avatarField: 'avatar',
  searchField: 'name', // typing sends name[like]=…
  pageSize: 10,
  selected: value, // labels a value beyond the loaded pages
})

<Select
  filterable
  value={value}
  options={select.options}
  selectedOptions={select.selectedOptions}
  loading={select.loading}
  loadingMore={select.loadingMore}
  hasMore={select.hasMore}
  onSearch={select.search}
  onLoadMore={select.loadMore}
  onChange={setValue}
/>`

function SelectExample(): ReactElement {
  const t = useTranslate()
  const [value, setValue] = useState<number | null>(40)
  const select = useSelect({ resource: 'members', labelField: 'name', descriptionField: 'role', avatarField: 'avatar', searchField: 'name', pageSize: 10, selected: value })
  return (
    <LumiCodeExample
      title={t('useSelect: remote search and load more')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: SELECT_CODE }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <Select
            ariaLabel={t('Member')}
            placeholder={t('Choose a member')}
            filterable
            clearable
            value={value}
            options={select.options}
            selectedOptions={select.selectedOptions}
            loading={select.loading}
            loadingMore={select.loadingMore}
            hasMore={select.hasMore}
            onSearch={select.search}
            onLoadMore={select.loadMore}
            onChange={next => setValue(next === null ? null : Number(next))}
            data-testid="hooks-select"
          />
          <DescriptionList
            bordered
            layout="rows"
            data-testid="hooks-select-state"
            items={[
              { label: t('Value'), value: value ?? '' },
              { label: t('Search'), value: select.keyword },
              { label: t('Loaded'), value: t('{loaded} of {total}', { loaded: select.options.length, total: select.total ?? '…' }) },
              { label: t('More pages'), value: select.hasMore ? t('Yes') : t('No') },
            ]}
          />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useForm                                                                    */

interface NoteDraft { title: string, priority: string }

const FORM_CODE = `const form = useForm<NoteDraft>({
  resource: 'notes',
  initialValues: { title: '', priority: 'normal' },
  rules: {
    type: 'object',
    required: ['title', 'priority'],
    properties: { title: { type: 'string', minLength: 4 } },
  },
})
const error = (name: string) =>
  form.errors.find(issue => issue.path === name)?.message

<FormField
  name="title"
  value={form.values.title}
  error={error('title')}
  onChange={value => form.setValue('title', value)}
/>
<Button
  label="Save"
  loading={form.isSubmitting}
  onClick={async () => {
    // Validates first; a 422 adds the server's field errors.
    await form.submit()
    form.reset()
  }}
/>`

function FormExample(): ReactElement {
  const t = useTranslate()
  const [saved, setSaved] = useState<string>()
  const form = useForm<NoteDraft>({
    resource: 'notes',
    initialValues: { title: '', priority: 'normal' },
    rules: {
      type: 'object',
      required: ['title', 'priority'],
      properties: { title: { type: 'string', minLength: 4 } },
    },
  })
  const error = (name: string): string | undefined => form.errors.find(issue => issue.path === name)?.message
  const submit = async (): Promise<void> => {
    setSaved(undefined)
    try {
      const result = await form.submit()
      setSaved(t('Created note #{id}: {title}', { id: String((result.data as { id?: unknown }).id), title: result.data.title }))
      form.reset()
    }
    catch {
      // Field errors are already on the form; anything else was reported as a toast.
    }
  }
  return (
    <LumiCodeExample
      title={t('useForm: validation and submit')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: FORM_CODE }]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <FormField name="title" label={t('Title')} required value={form.values.title} error={error('title')} placeholder={t('Call the courier')} onChange={value => form.setValue('title', value)} data-testid="hooks-form-title" />
          <FormField name="priority" label={t('Priority')} required fieldType="enum" widget="Select" value={form.values.priority} error={error('priority')} options={[{ label: t('Low'), value: 'low' }, { label: t('Normal'), value: 'normal' }, { label: t('High'), value: 'high' }]} onChange={value => form.setValue('priority', value)} />
          <Stack direction="horizontal" gap="sm" align="center">
            <Button label={t('Save')} loading={form.isSubmitting} onClick={() => void submit()} data-testid="hooks-form-save" />
            <Button label={t('Validate only')} appearance="outline" onClick={() => void form.validate()} />
            <Button label={t('Reset')} appearance="ghost" disabled={!form.isDirty} onClick={() => form.reset()} />
          </Stack>
          {saved
            ? <Alert tone="success" title={saved} data-testid="hooks-form-saved" />
            : <Text variant="muted" text={form.isDirty ? t('Unsaved changes') : t('No changes')} />}
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* useTreeSource                                                              */

const CATEGORY_SOURCE: TreeSource = { resource: 'categories', labelField: 'name' }
const REGION_SOURCE: TreeSource = { resource: 'regions', labelField: 'name', lazy: true, rootValue: 0, searchField: 'name' }

const TREE_CODE = `// Full: one request for every row, nested by parentId.
const categories = useTreeSource({
  resource: 'categories',
  labelField: 'name',
})

// Lazy: the root level first, each level as its parent opens.
const regions = useTreeSource({
  resource: 'regions',
  labelField: 'name',
  lazy: true,
  rootValue: 0, // root rows have parentId 0
  searchField: 'name',
})

<Tree items={categories.items} loading={categories.loading} />
<Input value={query} onChange={(next) => {
  setQuery(next)
  regions.search?.(next) // name[like] on the server
}} />
<Tree
  items={regions.items}
  loading={regions.loading || regions.searching}
  query={query} // highlights and opens matches
  onLoadChildren={regions.loadChildren}
/>`

function TreeExample(): ReactElement {
  const t = useTranslate()
  const [category, setCategory] = useState<string | number | null>(null)
  const [query, setQuery] = useState('')
  const categories = useTreeSource(CATEGORY_SOURCE, { value: category })
  const regions = useTreeSource(REGION_SOURCE)
  return (
    <LumiCodeExample
      title={t('useTreeSource: full and lazy trees')}
      code={<Code files={[{ name: 'hooks.tsx', language: 'tsx', code: TREE_CODE }]} />}
      previewLabel={t('Result')}
      preview={(
        <Grid columns={2} gap="md">
          <Stack gap="sm">
            <Text variant="caption" text={t('Categories, full')} />
            <Tree ariaLabel={t('Categories')} items={categories.items} loading={categories.loading} selectionMode="single" value={category} onChange={value => setCategory(Array.isArray(value) ? value[0] as string | number ?? null : value as string | number | null)} data-testid="hooks-tree-full" />
            <Text variant="muted" text={t('Selected: {name}', { name: categories.selectedNodes[0]?.label ?? '—' })} />
          </Stack>
          <Stack gap="sm">
            <Text variant="caption" text={t('Regions, lazy')} />
            <Input
              ariaLabel={t('Search regions')}
              placeholder={t('Search regions')}
              size="sm"
              clearable
              value={query}
              onChange={(next) => {
                setQuery(next)
                regions.search?.(next)
              }}
              data-testid="hooks-tree-search"
            />
            <Tree
              ariaLabel={t('Regions')}
              items={regions.items}
              loading={regions.loading || regions.searching}
              query={query}
              onLoadChildren={regions.loadChildren}
              data-testid="hooks-tree-lazy"
            />
          </Stack>
        </Grid>
      )}
    />
  )
}

export function AdminHooksListsRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Tables, selects & forms')} description={t('List, select, form and tree state; you render the UI')}>
      <TableExample />
      <SelectExample />
      <FormExample />
      <TreeExample />
    </DeveloperPage>
  )
}
