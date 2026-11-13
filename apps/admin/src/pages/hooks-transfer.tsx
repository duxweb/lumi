import type { AuditLogEntry, Filter, TransferColumn, TransferFile } from '@duxweb/lumi'
import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import { useAuditLogList, useDelete, useExport, useImport, useList, useOne, useTranslate, useUpdate } from '@duxweb/lumi'
import { LumiAuditLog, LumiCodeExample } from '@duxweb/lumi-admin'
import { LumiButton as Button, LumiCodeBlock as CodeBlock, LumiDescriptionList as DescriptionList, LumiProgress as Progress, LumiSelect as Select, LumiStack as Stack, LumiTable as Table, LumiText as Text } from '@duxweb/lumi-ui'
import { useMemo, useState } from 'react'
import { Code, DeveloperPage } from '../developer/kit.js'
import { currency, perLocale } from '../shared.js'

// Import, export and the audit log, against the mock API. Imports and edits go
// to the scratch `notes` resource, and each example can undo what it wrote.

/* -------------------------------------------------------------------------- */
/* Export                                                                     */

/** What a person edits in a spreadsheet, as the products page exports it. */
const productFileColumns = perLocale((t): TransferColumn[] => ([
  { field: 'id', label: 'ID', type: 'number' },
  { field: 'name', label: t('Product name') },
  { field: 'sku', label: 'SKU' },
  { field: 'price', label: t('Price'), type: 'number' },
  { field: 'status', label: t('Status') },
]))

const productColumns = perLocale((t): TableColumn[] => ([
  { field: 'sku', label: 'SKU', kind: 'code', width: '8rem' },
  { field: 'name', label: t('Product name'), truncate: true },
  { field: 'priceText', label: t('Price'), align: 'right', width: '7rem' },
  { field: 'status', label: t('Status'), kind: 'badge', width: '7rem', valueMap: { active: t('Active'), draft: t('Draft'), archived: t('Archived') }, toneMap: { active: 'success', draft: 'warning', archived: 'neutral' } },
]))

const STATUS_OPTIONS = perLocale(t => ([
  { value: 'all', label: t('All statuses') },
  { value: 'active', label: t('Active') },
  { value: 'draft', label: t('Draft') },
  { value: 'archived', label: t('Archived') },
]))

const EXPORT_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { useExport, useList } from '@duxweb/lumi'

const filters = status === 'all'
  ? []
  : [{ field: 'status', operator: 'eq', value: status }]
const columns = [
  { field: 'id', label: 'ID', type: 'number' },
  { field: 'name', label: 'Product name' },
  { field: 'sku', label: 'SKU' },
  { field: 'price', label: 'Price', type: 'number' },
  { field: 'status', label: 'Status' },
]

// The list and the file share the same filters.
const products = useList({ resource: 'products', filters, pagination: { page: 1, pageSize: 5 } })
const csv = useExport({ resource: 'products', filters, columns, filename: 'products' })
const json = useExport({ resource: 'products', filters, columns, filename: 'products', format: 'json' })

// Loads every matching page, then downloads the file and returns it.
const file = await csv.trigger()
csv.progress // { loaded: 42, total: 42 }`,
  },
]

const LINE_BREAK_RE = /\r?\n/

interface Product {
  id: number
  name: string
  sku: string
  price: number
  status: string
}

function ExportExample(): ReactElement {
  const t = useTranslate()
  const [status, setStatus] = useState('active')
  const [file, setFile] = useState<TransferFile>()
  const filters = useMemo<Filter[]>(() => status === 'all' ? [] : [{ field: 'status', operator: 'eq', value: status }], [status])
  const columns = productFileColumns(t)
  const products = useList<Product>({ resource: 'products', filters, pagination: { page: 1, pageSize: 5 } })
  const csv = useExport({ resource: 'products', filters, columns, filename: 'products' })
  const json = useExport({ resource: 'products', filters, columns, filename: 'products', format: 'json' })
  // The last export keeps its progress after it finishes.
  const [last, setLast] = useState<'csv' | 'json'>()
  const progress = last === 'csv' ? csv.progress : last === 'json' ? json.progress : undefined
  const run = (exporter: typeof csv, format: 'csv' | 'json'): void => {
    setLast(format)
    // Written in the browser, so its content is text; a backend export (`url`) would answer a Blob.
    void exporter.trigger().then(result => setFile(result && typeof result.content === 'string' ? result as TransferFile : undefined), () => undefined)
  }
  const rows = (products.data?.data ?? []).map(row => ({ ...row, priceText: currency.format(row.price) }))
  const lines = file?.content.split(LINE_BREAK_RE).filter(Boolean) ?? []
  return (
    <LumiCodeExample
      title={t('Export a filtered list')}
      layout="stack"
      code={<Code files={EXPORT_FILES} />}
      previewLabel={t('Result')}
      previewActions={<Select ariaLabel={t('Status')} size="sm" options={STATUS_OPTIONS(t)} value={status} onChange={value => setStatus(String(value ?? 'all'))} />}
      preview={(
        <Stack gap="md">
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button label={t('Export CSV')} appearance="outline" size="sm" icon="download" loading={csv.isLoading} onClick={() => run(csv, 'csv')} data-testid="export-csv" />
            <Button label={t('Export JSON')} appearance="outline" size="sm" icon="download" loading={json.isLoading} onClick={() => run(json, 'json')} data-testid="export-json" />
            <Text variant="caption" text={t('{count} matching products; the first five are shown', { count: products.data?.total ?? 0 })} />
          </Stack>
          <Table rowKey="id" columns={productColumns(t)} rows={rows} loading={products.isPending} />
          {progress && <Progress label={t('Loaded {loaded} of {total}', { loaded: progress.loaded, total: progress.total ?? '…' })} value={progress.loaded} max={progress.total || 1} tone="success" />}
          {file && (
            <CodeBlock
              title={t('{name}, {count} lines', { name: file.name, count: lines.length })}
              language={file.name.endsWith('.json') ? 'json' : 'text'}
              code={lines.slice(0, 8).join('\n') + (lines.length > 8 ? '\n…' : '')}
              maxHeight={240}
              data-testid="export-file"
            />
          )}
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */

const noteFileColumns = perLocale((t): TransferColumn[] => ([
  { field: 'title', label: t('Title') },
  { field: 'priority', label: t('Priority') },
]))

// The last row repeats a title the mock already holds, so it is refused with a
// field error and the notice names it.
const SAMPLE_TITLES = ['Restock the Chengdu warehouse', 'Call the courier about Friday', 'Review the Chengdu backlog'] as const
const SAMPLE_CSV = `Title,Priority
${SAMPLE_TITLES[0]},high
${SAMPLE_TITLES[1]},normal
${SAMPLE_TITLES[2]},low`

const IMPORT_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { useImport } from '@duxweb/lumi'

const importer = useImport({
  resource: 'notes',
  // Headers are read by label, so a translated sheet imports too.
  columns: [
    { field: 'title', label: 'Title' },
    { field: 'priority', label: 'Priority' },
  ],
  onFinish: result => console.log(result.succeeded, result.errors),
})

// Opens the file picker (.csv, .json); one create per row.
<LumiButton
  label="Choose a file"
  onClick={() => importer.trigger()}
/>

// Or import content you already have:
await importer.trigger({ name: 'notes.csv', content: csvText })

// { total: 3, processed: 2, succeeded: 2, failed: 0 }
importer.progress
// The same counts, plus each refused row and why:
// errors: [{ row: 3, message: 'Validation failed' }]
importer.result
// A clean run shows a toast; refused rows show a notice
// naming them.`,
  },
  { name: 'notes.csv', language: 'text', code: SAMPLE_CSV },
  {
    name: 'notes.json',
    language: 'json',
    code: `[
  { "title": "${SAMPLE_TITLES[0]}", "priority": "high" },
  { "title": "${SAMPLE_TITLES[1]}", "priority": "normal" }
]`,
  },
]

const errorColumns = perLocale((t): TableColumn[] => ([
  { field: 'row', label: t('Row'), kind: 'code', width: '4rem' },
  { field: 'message', label: t('Message'), wrap: true },
]))

function ImportExample(): ReactElement {
  const t = useTranslate()
  const importer = useImport({ resource: 'notes', columns: noteFileColumns(t) })
  const imported = useList<{ id: number, title: string }>({ resource: 'notes', filters: [{ field: 'title', operator: 'in', value: [...SAMPLE_TITLES.slice(0, 2)] }], pagination: { page: 1, pageSize: 20 } })
  const remove = useDelete({ resource: 'notes' })
  const [removing, setRemoving] = useState(false)
  const leftovers = imported.data?.data ?? []
  const removeImported = async (): Promise<void> => {
    setRemoving(true)
    try {
      for (const note of leftovers)
        await remove.mutateAsync({ id: note.id })
    }
    finally {
      setRemoving(false)
    }
  }
  const progress = importer.progress
  const result = importer.result
  return (
    <LumiCodeExample
      title={t('Import a CSV or JSON file')}
      code={<Code files={IMPORT_FILES} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button label={t('Import the sample')} size="sm" icon="upload" loading={importer.isLoading} onClick={() => void importer.trigger({ name: 'notes.csv', content: SAMPLE_CSV }).catch(() => undefined)} data-testid="import-sample" />
            <Button label={t('Choose a file')} appearance="outline" size="sm" disabled={importer.isLoading} onClick={() => void importer.trigger().catch(() => undefined)} data-testid="import-pick" />
            <Button label={t('Remove imported notes')} appearance="ghost" size="sm" icon="delete-02" disabled={!leftovers.length || importer.isLoading} loading={removing} onClick={() => void removeImported()} data-testid="import-undo" />
          </Stack>
          {progress
            ? <Progress label={t('Processed {processed} of {total}', { processed: progress.processed, total: progress.total })} value={progress.processed} max={progress.total || 1} tone={progress.failed ? 'warning' : 'success'} />
            : <Text variant="muted" text={t('Nothing imported yet')} />}
          {result && (
            <DescriptionList
              layout="rows"
              bordered
              data-testid="import-result"
              items={[
                { label: t('Rows'), value: result.total },
                { label: t('Created'), value: result.succeeded },
                { label: t('Refused'), value: result.failed },
              ]}
            />
          )}
          {result && result.errors.length > 0 && <Table rowKey="row" columns={errorColumns(t)} rows={result.errors as unknown as Record<string, unknown>[]} />}
          <Text variant="caption" text={t('{count} sample notes in the notes resource', { count: leftovers.length })} />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */

/** The note the example edits; its priority flips between two values. */
const HISTORY_NOTE_ID = 3

const HISTORY_FILES: readonly CodeFile[] = [
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `import { useAuditLogList, useOne, useUpdate } from '@duxweb/lumi'

const note = useOne({ resource: 'notes', id: 3 })
const update = useUpdate({ resource: 'notes' })
// One record's history, newest first; it refreshes after every
// write to the resource, so the new entry appears by itself.
const log = useAuditLogList({ resource: 'notes', id: 3, pagination: { page: 1, pageSize: 5 } })

await update.mutateAsync({ id: 3, variables: { priority: 'normal' } })

log.data?.data // [{ action: 'update', data: { priority: 'normal' },
//   author: { name: 'Ada Admin' }, createdAt: '…' }, …]

// The same hook drawn as an activity feed:
<LumiAuditLog resource="notes" id={3} pageSize={5} />`,
  },
  {
    name: 'main.tsx',
    language: 'tsx',
    code: `import { createLumi, createDataAuditLogProvider } from '@duxweb/lumi'

// Every accepted write is recorded in the audit-logs resource;
// the server stamps who and when.
const lumi = createLumi({
  dataProvider,
  auditLogProvider: createDataAuditLogProvider({
    dataProvider: () => dataProvider,
    resource: 'audit-logs',
  }),
})`,
  },
]

const historyColumns = perLocale((t): TableColumn[] => ([
  { field: 'action', label: t('Action'), kind: 'badge', width: '6rem', toneMap: { create: 'success', update: 'info', delete: 'danger' } },
  { field: 'change', label: t('Change'), kind: 'code', wrap: true },
  { field: 'author', label: t('By'), width: '8rem' },
  { field: 'createdAt', label: t('Recorded'), kind: 'datetime', width: '11rem' },
]))

function historyRow(entry: AuditLogEntry): Record<string, unknown> {
  return {
    id: entry.id,
    action: entry.action,
    change: entry.data && typeof entry.data === 'object' ? JSON.stringify(entry.data) : '',
    author: entry.author?.name ?? '',
    createdAt: entry.createdAt,
  }
}

function HistoryExample(): ReactElement {
  const t = useTranslate()
  const note = useOne<{ id: number, title: string, priority: string }>({ resource: 'notes', id: HISTORY_NOTE_ID })
  const update = useUpdate({ resource: 'notes' })
  const log = useAuditLogList({ resource: 'notes', id: HISTORY_NOTE_ID, pagination: { page: 1, pageSize: 5 } })
  const priority = note.data?.data.priority
  const next = priority === 'low' ? 'normal' : 'low'
  return (
    <LumiCodeExample
      title={t('A record\'s audit history')}
      layout="stack"
      code={<Code files={HISTORY_FILES} />}
      previewLabel={t('Result')}
      previewActions={(
        <Button
          label={t('Set priority to {priority}', { priority: next === 'low' ? t('Low') : t('Normal') })}
          appearance="outline"
          size="sm"
          icon="edit"
          disabled={!note.data}
          loading={update.isPending}
          onClick={() => void update.mutateAsync({ id: HISTORY_NOTE_ID, variables: { priority: next } }).catch(() => undefined)}
          data-testid="history-update"
        />
      )}
      preview={(
        <Stack gap="md">
          <Text variant="caption" text={note.data ? t('Note #{id} “{title}”, priority {priority}', { id: HISTORY_NOTE_ID, title: note.data.data.title, priority: priority === 'low' ? t('Low') : priority === 'high' ? t('High') : t('Normal') }) : t('Loading')} />
          {log.data?.data.length
            ? <Table rowKey="id" columns={historyColumns(t)} rows={log.data.data.map(historyRow)} loading={log.isFetching} data-testid="history-log" />
            : <Text variant="muted" text={log.isPending ? t('Loading') : t('No change recorded yet. Change the priority')} />}
          <Text variant="caption" text={t('LumiAuditLog over the same hook')} />
          <LumiAuditLog resource="notes" id={HISTORY_NOTE_ID} pageSize={3} />
        </Stack>
      )}
    />
  )
}

export function AdminHooksTransferRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Import, export & history')} description={t('CSV and JSON import and export, and the audit log')}>
      <ExportExample />
      <ImportExample />
      <HistoryExample />
    </DeveloperPage>
  )
}
