import type { Filter, ID, Meta } from '@duxweb/lumi'
import type { TableProps } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useList, useMany } from '@duxweb/lumi'
import { LumiButton, LumiDialog, LumiInput, LumiTag, useUiText } from '@duxweb/lumi-ui'
import { useEffect, useRef, useState } from 'react'
import { LumiDataGrid } from './LumiDataGrid.js'

type Row = Record<string, unknown>

export interface LumiRecordPickerProps {
  resource: string
  dataProviderName?: string
  meta?: Meta
  /** Fixed filters on the records offered. */
  filters?: Filter[]
  columns: TableProps['columns']
  rowKey?: string
  /** Field shown for a chosen record; defaults to `label`, `name`, `title`, then the key. */
  labelField?: string
  /** Field the dialog's search box filters with `like`; without it there is no search box. */
  searchField?: string
  multiple?: boolean
  value?: ID | ID[] | null
  onChange?: (value: ID | ID[] | null) => void
  placeholder?: string
  title?: string
  description?: string
  pageSize?: number
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  ariaLabel?: string
  className?: string
  id?: string
}

const SEARCH_DELAY = 300

function toIds(value: ID | ID[] | null | undefined): ID[] {
  if (value === null || value === undefined || value === '')
    return []
  return Array.isArray(value) ? value : [value]
}

/**
 * A field whose value is one or more record keys, chosen from a searchable,
 * paged table in a dialog. Chosen keys that are not on screen are read by ID
 * so their labels show.
 */
export function LumiRecordPicker(props: LumiRecordPickerProps): ReactElement {
  const { t } = useUiText()
  const { resource, dataProviderName, meta, filters, columns, rowKey = 'id', labelField, searchField, multiple = false, value, onChange, placeholder, title, description, pageSize = 10, disabled, readonly, invalid, ariaLabel, className, id } = props
  const chosen = toIds(value)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ID[]>([])
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)
  const [query, setQuery] = useState('')
  const [needle, setNeedle] = useState('')
  const seen = useRef(new Map<string, Row>())
  const unavailable = Boolean(disabled || readonly)
  const name = ariaLabel ?? title ?? t('lumi.recordPicker.title', 'Choose records')

  useEffect(() => {
    const timer = setTimeout(() => {
      setNeedle(query.trim())
      setPage(1)
    }, SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [query])

  const list = useList<Row>({
    resource,
    dataProviderName,
    meta,
    pagination: { page, pageSize: size },
    filters: [...(filters ?? []), ...(searchField && needle ? [{ field: searchField, operator: 'like' as const, value: needle }] : [])],
    enabled: open,
  })
  const rows = list.data?.data ?? []
  rows.forEach(row => seen.current.set(String(row[rowKey]), row))
  const unknown = [...chosen, ...draft].filter(key => !seen.current.has(String(key)))
  const many = useMany<Row>({ resource, dataProviderName, meta, ids: unknown, enabled: unknown.length > 0 })
  many.data?.data.forEach(row => seen.current.set(String(row[rowKey]), row))

  const labelOf = (key: ID): string => {
    const row = seen.current.get(String(key))
    const label = row && (labelField ? row[labelField] : row.label ?? row.name ?? row.title)
    return label === undefined || label === null || label === '' ? String(key) : String(label)
  }
  const commit = (next: ID[]): void => onChange?.(multiple ? next : next[0] ?? null)
  const openDialog = (): void => {
    if (unavailable)
      return
    setDraft(chosen)
    setOpen(true)
  }
  const pageKeys = new Set(rows.map(row => String(row[rowKey])))

  return (
    <div id={id} className={['lumi-record-picker', className].filter(Boolean).join(' ')} data-invalid={invalid || undefined} data-disabled={disabled || undefined} role="group" aria-label={name}>
      <div className="lumi-record-picker__value">
        {chosen.length === 0
          ? <span className="lumi-record-picker__placeholder">{placeholder ?? t('lumi.recordPicker.choose', 'Choose…')}</span>
          : chosen.map(key => (
              <LumiTag
                key={String(key)}
                label={labelOf(key)}
                size="sm"
                closable={!unavailable}
                onClose={() => commit(chosen.filter(item => item !== key))}
              />
            ))}
      </div>
      <LumiButton
        appearance="outline"
        size="sm"
        label={chosen.length && !multiple ? t('lumi.recordPicker.change', 'Change') : t('lumi.recordPicker.choose', 'Choose…')}
        disabled={unavailable}
        aria-label={t('lumi.recordPicker.select', 'Select {name}', { name })}
        onClick={openDialog}
      />
      <LumiDialog
        open={open}
        onOpenChange={setOpen}
        title={title ?? t('lumi.recordPicker.title', 'Choose records')}
        description={description}
        size="xl"
        cancelText={t('lumi.common.cancel', 'Cancel')}
        confirmText={multiple ? t('lumi.recordPicker.confirm', 'Confirm') : undefined}
        footerStart={multiple ? <span className="lumi-record-picker__count">{t('lumi.recordPicker.selected', '{count} selected', { count: draft.length })}</span> : undefined}
        onConfirm={() => {
          commit(draft)
          setOpen(false)
        }}
      >
        <div className="lumi-record-picker__dialog">
          {searchField && (
            <LumiInput
              value={query}
              clearable
              placeholder={t('lumi.recordPicker.search', 'Search records')}
              ariaLabel={t('lumi.recordPicker.search', 'Search records')}
              onChange={setQuery}
            />
          )}
          <LumiDataGrid
            rows={rows}
            columns={columns}
            rowKey={rowKey}
            page={page}
            pageSize={size}
            total={list.data?.total ?? rows.length}
            loading={list.isLoading}
            disabled={list.isFetching && !list.isLoading}
            selectable={multiple}
            selectedKeys={multiple ? draft : chosen}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setSize(next)
              setPage(1)
            }}
            onSelectionChange={keys => setDraft(current => [...current.filter(key => !pageKeys.has(String(key))), ...keys])}
            onRowClick={(row) => {
              const key = row[rowKey] as ID
              if (multiple) {
                setDraft(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
                return
              }
              commit([key])
              setOpen(false)
            }}
          />
        </div>
      </LumiDialog>
    </div>
  )
}
