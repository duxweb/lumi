import type { ColumnDef, RowSelectionState, SortingState, TableOptions } from '@tanstack/react-table'
import type { FormEvent, ReactElement, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import type { AlertProps, AvatarGroupProps, AvatarProps, BadgeProps, BadgeTone, DescriptionListProps, PaginationProps, TableAction, TableColumn, TableProps, TextProps } from '../catalog/types-public.js'
import type { LumiDataTableFeatures } from '../internal/data-table/features.js'
import { functionalUpdate, useTable } from '@tanstack/react-table'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircleIcon, ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CheckCircleIcon, InfoIcon, LumiIcon, MoreHorizontalIcon, XIcon } from '../icons.js'
import { lumiDataTableFeatures } from '../internal/data-table/features.js'
import { paginationRange } from '../internal/pagination-range.js'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../internal/shadcn/alert.js'
import { Badge } from '../internal/shadcn/badge.js'
import { Button } from '../internal/shadcn/button.js'
import { Checkbox } from '../internal/shadcn/checkbox.js'
import { Input } from '../internal/shadcn/input.js'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../internal/shadcn/pagination.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../internal/shadcn/table.js'
import { cn } from '../internal/utils.js'
import { MENU_PANEL_CLASS, OPTION_CLASS, text } from './control.js'
import { LumiSelect } from './controls.js'
import { LumiEmpty } from './empty.js'
import { LumiSkeletonShape } from './skeleton.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'role'?: string }

const serializeRowId = (key: string | number): string => `${typeof key}:${String(key)}`

const badgeVariant = (tone: BadgeTone | undefined, appearance: BadgeProps['appearance']): 'default' | 'secondary' | 'outline' | 'destructive' => tone === 'danger' ? 'destructive' : appearance === 'outline' ? 'outline' : appearance === 'solid' && tone === 'primary' ? 'default' : 'secondary'

/** Host-side composition slot; absent from BadgeProps, so JSON cannot set it. */
interface BadgeSlots {
  /**
   * Leads the label with a dot in the badge's own tone. Used where a badge is a
   * status rather than a count, so the row reads as a state at a glance.
   */
  dot?: boolean
}

/** Marks the stand-in id of a row that lacks its `rowKey`. */
const UNKEYED_ROW = '\u0000row:'

export function LumiBadge(props: BadgeProps & BadgeSlots & HostProps): ReactElement {
  const { label, tone = 'neutral', appearance = 'soft', dot, children, ...rest } = props
  return (
    <Badge {...rest} variant={badgeVariant(tone, appearance)} data-tone={tone} data-appearance={appearance}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden data-slot="badge-dot" />}
      {label ?? children}
    </Badge>
  )
}

export function LumiText(props: TextProps & HostProps): ReactElement {
  const { text: value, variant, className, children, ...rest } = props
  const kind = variant ?? 'body'
  if (kind === 'code')
    return <code {...rest} data-slot="text" data-variant="code" className={cn('w-fit self-start rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]', className)}>{value ?? children}</code>
  return (
    <p
      {...rest}
      data-slot="text"
      data-variant={kind}
      className={cn(
        'm-0 max-w-[68ch] whitespace-pre-line break-words',
        kind === 'caption' ? 'text-[length:var(--lumi-fs-caption)] text-muted-foreground' : kind === 'lead' ? 'text-base leading-relaxed text-muted-foreground' : 'text-sm leading-relaxed',
        kind === 'muted' && 'text-muted-foreground',
        kind === 'body' && 'text-foreground',
        className,
      )}
    >
      {value ?? children}
    </p>
  )
}

const WHITESPACE = /\s+/
// Avatars line up with the control beside them: sm/md/lg match the control heights.
// xl leads a profile header, two control rows tall.
const avatarSize = { sm: 'size-control-sm text-[0.625rem]', md: 'size-control-md text-xs', lg: 'size-control-lg text-label', xl: 'size-[calc(var(--lumi-control-md)*2)] text-(length:--lumi-fs-page)' } as const

// A name always gets the same tint, so a person is recognisable across pages.
const AVATAR_TINTS = 5
function avatarTint(name: string): number {
  let hash = 0
  for (const char of name)
    hash = (hash * 31 + char.codePointAt(0)!) | 0
  return Math.abs(hash) % AVATAR_TINTS
}

function initials(name: string): string {
  const parts = name.trim().split(WHITESPACE).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase() || '?'
}

export function LumiAvatar(props: AvatarProps & HostProps): ReactElement {
  const { name, src, description, showName, size: sizeProp, className, children: _children, role: _role, ...rest } = props
  const size = sizeProp ?? 'md'
  const mark = src
    ? <img src={src} alt={showName ? '' : name} className={cn('shrink-0 rounded-full object-cover', avatarSize[size])} data-slot="avatar" />
    : (
        <span role={showName ? undefined : 'img'} aria-label={showName ? undefined : name} aria-hidden={showName || undefined} className={cn('grid shrink-0 place-items-center rounded-full font-medium', avatarSize[size])} data-slot="avatar" data-tint={avatarTint(name)}>
          {initials(name)}
        </span>
      )
  if (!showName)
    return <span {...rest} className={cn('inline-flex', className)}>{mark}</span>
  return (
    <span {...rest} className={cn('inline-flex min-w-0 items-center gap-2.5', className)} data-slot="avatar-persona">
      {mark}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        {description && <span className="truncate text-[length:var(--lumi-fs-caption)] text-muted-foreground">{description}</span>}
      </span>
    </span>
  )
}

export function LumiAvatarGroup(props: AvatarGroupProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items, max, size: sizeProp, label, className, children: _children, role: _role, ...rest } = props
  const size = sizeProp ?? 'md'
  const shown = max && items.length > max ? items.slice(0, max - 1) : items
  const hidden = items.length - shown.length
  return (
    <span
      {...rest}
      role="group"
      aria-label={label ?? items.map(item => item.name).join(', ')}
      className={cn('inline-flex items-center', className)}
      data-slot="avatar-group"
      data-size={size}
    >
      {shown.map(item => <LumiAvatar key={item.name} name={item.name} src={item.src} size={size} />)}
      {hidden > 0 && (
        <span role="img" aria-label={t('lumi.avatar.more', '+{count}', { count: hidden })} className={cn('grid shrink-0 place-items-center rounded-full bg-muted font-medium text-foreground tabular-nums', avatarSize[size])} data-slot="avatar" data-overflow="">
          +
          {hidden}
        </span>
      )}
    </span>
  )
}

export function LumiAlert(props: AlertProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { tone = 'neutral', title, message, closable, onClose, children, role, ...rest } = props
  const Icon = tone === 'success' ? CheckCircleIcon : tone === 'info' ? InfoIcon : AlertCircleIcon
  return (
    <Alert {...rest} role={role ?? (tone === 'danger' ? 'alert' : 'status')} variant={tone === 'danger' ? 'destructive' : 'default'} data-tone={tone}>
      <Icon />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{message ?? children}</AlertDescription>
      {closable && <AlertAction><Button type="button" variant="ghost" size="icon-sm" aria-label={t('lumi.common.close', 'Close')} onClick={onClose}><XIcon /></Button></AlertAction>}
    </Alert>
  )
}

function cellValue(row: Record<string, unknown>, field: string, valueMap?: Record<string, string>): ReactNode {
  const value = row[field]
  if (value === null || value === undefined)
    return null
  if (typeof value === 'object')
    return JSON.stringify(value)
  // `valueMap` turns a stored code into what a reader calls it. That is not a
  // badge's job — a plain column carrying `cod` needs it just as much.
  return valueMap?.[String(value)] ?? String(value)
}

function stringValue(row: Record<string, unknown>, field: string | undefined): string | undefined {
  if (!field)
    return undefined
  const value = row[field]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

// Money and timestamps are read by comparison, so they are formatted here rather
// than left to the caller: the host locale decides separators and symbol
// placement, and the raw value stays in the DOM for machines to read.
function currencyCell(row: Record<string, unknown>, column: TableColumn, locale: string): ReactNode {
  const raw = row[column.field]
  const amount = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN
  if (Number.isNaN(amount))
    return cellValue(row, column.field)
  // No ISO code means no symbol: guessing one would print money in a currency
  // the data never claimed. The amount still lines up with the column.
  const options: Intl.NumberFormatOptions = column.currency
    ? { style: 'currency', currency: column.currency }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  let text: string
  try {
    text = new Intl.NumberFormat(locale, options).format(amount)
  }
  catch {
    // Not an ISO 4217 code (`USDT`, `¥`): the amount still shows, without a symbol.
    text = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }
  return <span className="tabular-nums" data-slot="table-currency">{text}</span>
}

/**
 * A timestamp column is scanned, not read: `08/10 07:00` in a fixed width lets
 * the eye compare rows, where a full locale date wraps and pushes the columns
 * that matter off the screen. The complete value stays in `title` and
 * `dateTime` for anyone who needs it.
 */
function dateTimeCell(row: Record<string, unknown>, column: TableColumn, locale: string): ReactNode {
  const raw = row[column.field]
  const value = typeof raw === 'string' || typeof raw === 'number' ? raw : undefined
  if (value === undefined)
    return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()))
    return String(value)
  const parts = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(parsed)
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(entry => entry.type === type)?.value ?? ''
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
  return (
    <time className="tabular-nums text-muted-foreground" dateTime={parsed.toISOString()} title={full}>
      {`${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`}
    </time>
  )
}

/** Money and timestamps read down the column, so they hang on the right unless told otherwise. */
const columnAlign = (column: TableColumn): TableColumn['align'] => column.align ?? (column.kind === 'currency' || column.kind === 'date' || column.kind === 'datetime' ? 'right' : undefined)

function EntityCell({ column, row }: { column: TableColumn, row: Record<string, unknown> }): ReactElement {
  const image = stringValue(row, column.imageField)
  const description = stringValue(row, column.descriptionField)
  const name = stringValue(row, column.labelField) ?? cellValue(row, column.field, column.valueMap)
  const initial = !image && column.initials && typeof name === 'string' ? Array.from(name.trim())[0]?.toUpperCase() : undefined
  return (
    <span className="flex min-w-0 items-center gap-2" data-slot="table-entity">
      {image && <img className="size-9 shrink-0 rounded-item border object-cover" src={image} alt="" />}
      {initial && <span className="grid size-5.5 shrink-0 place-items-center rounded-full border border-border bg-muted text-[length:var(--lumi-fs-micro)] font-semibold text-muted-foreground" aria-hidden data-slot="table-entity-initial">{initial}</span>}
      <span className="min-w-0">
        <span className={cn('block truncate', !initial && 'font-medium')} data-slot="table-entity-name" title={column.truncate && typeof name === 'string' ? name : undefined}>{name}</span>
        {description && <span className="block truncate text-xs text-muted-foreground" data-slot="table-entity-description">{description}</span>}
      </span>
    </span>
  )
}

function RowActions(props: { actions: TableAction[], row: Record<string, unknown>, rowId: string | number, onAction?: TableProps['onRowAction'] }): ReactElement | null {
  const { t } = useUiText()
  const [open, setOpen] = useState(false)
  if (!props.actions.length)
    return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('lumi.table.rowActions', 'Row actions {id}', { id: props.rowId })} onClick={event => event.stopPropagation()}>
          <MoreHorizontalIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={MENU_PANEL_CLASS} align="end" aria-label={t('lumi.table.actionsForRow', 'Actions for row {id}', { id: props.rowId })} onClick={event => event.stopPropagation()}>
        {props.actions.map((action) => {
          // Menu items share the option row; a danger item is red text, not a filled button.
          return (
            <button
              key={action.value}
              type="button"
              className={cn(OPTION_CLASS, 'w-full [&_svg]:size-4 [&_svg]:shrink-0', action.tone === 'danger' && 'text-destructive hover:bg-destructive/10 hover:text-destructive')}
              disabled={action.disabled}
              data-tone={action.tone ?? 'neutral'}
              data-slot="menu-item"
              onClick={() => {
                props.onAction?.({ action: action.value, row: props.row })
                setOpen(false)
              }}
            >
              <LumiIcon name={action.icon} data-icon="inline-start" />
              {action.label}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

/** The rows a selection bar works on, for commands a host adds. */
export interface TableSelection {
  keys: Array<string | number>
  /** The row of each key, by position; undefined for rows selected on a page not loaded now. */
  rows: Array<Record<string, unknown> | undefined>
}

/**
 * A command a host adds to every selection bar below it, beside the table's
 * own bulk actions, such as referencing the rows in a conversation.
 */
export interface SelectionExtra {
  value: string
  label: string
  icon?: string
  onSelect: (selection: TableSelection) => void
}

const NO_EXTRAS: readonly SelectionExtra[] = []
const SelectionExtrasContext = createContext<readonly SelectionExtra[]>(NO_EXTRAS)

/** Adds commands to the selection bars of the tables below it. */
export function LumiSelectionExtras({ extras, children }: { extras: readonly SelectionExtra[], children?: ReactNode }): ReactElement {
  return <SelectionExtrasContext value={extras}>{children}</SelectionExtrasContext>
}

/** The commands a host added to selection bars; a table shows its bar for them even without bulk actions. */
export function useSelectionExtras(): readonly SelectionExtra[] {
  return useContext(SelectionExtrasContext)
}

/**
 * The window event that flags rows for a moment, e.g. when an agent points at
 * them: `detail.keys` holds the row keys. Every table on the page with those
 * rows marks them and scrolls the first into view.
 */
export const LUMI_HIGHLIGHT_EVENT = 'lumi:highlight'
const HIGHLIGHT_MS = 4000
const NO_KEYS: ReadonlySet<string> = new Set()

export interface SelectionBarProps {
  count: number
  actions: TableAction[]
  /** The selection itself, for the commands a host adds with LumiSelectionExtras. */
  selection?: TableSelection
  disabled?: boolean
  onAction?: (action: string) => void
  onClear?: () => void
  className?: string
}

/**
 * What a selection can do, in the place the table's own toolbar sat. Outline
 * commands lead; a `primary` command is the accent and trails on the right,
 * beside the way out of the selection.
 */
export function LumiSelectionBar({ count, actions, selection, disabled, onAction, onClear, className }: SelectionBarProps): ReactElement {
  const { t } = useUiText()
  const extras = useSelectionExtras()
  const button = (action: TableAction): ReactElement => {
    const accent = action.tone === 'primary'
    return (
      <Button
        key={action.value}
        type="button"
        size="sm"
        variant={accent ? 'brand' : 'outline'}
        // A destructive bulk action reads in red text; a solid red block would
        // outshout the bar the way the design never does.
        className={action.tone === 'danger' ? 'text-(--lumi-text-danger) hover:text-(--lumi-text-danger)' : undefined}
        disabled={disabled || action.disabled}
        data-tone={action.tone ?? 'neutral'}
        onClick={() => onAction?.(action.value)}
      >
        <LumiIcon name={action.icon} data-icon="inline-start" />
        {action.label}
      </Button>
    )
  }
  const secondary = actions.filter(action => action.tone !== 'primary')
  // The count is bold inside the sentence, so the template is split around it.
  const [before = '', after = ''] = t('lumi.table.selectedCount', '{count} selected').split('{count}')
  const countText = [before, after] as const
  return (
    <div className={cn('flex w-full min-w-0 flex-wrap items-center gap-2 text-control', className)} role="toolbar" aria-label={t('lumi.table.selectionActions', 'Selection actions')} data-slot="selection-bar">
      <span className="whitespace-nowrap" role="status" data-slot="selection-count">
        {countText[0]}
        <b className="font-semibold tabular-nums">{count}</b>
        {countText[1]}
      </span>
      {(secondary.length > 0 || (selection && extras.length > 0)) && <span className="mx-1 h-4 w-px bg-border" aria-hidden />}
      {secondary.map(button)}
      {selection && extras.map(extra => (
        <Button key={extra.value} type="button" size="sm" variant="outline" disabled={disabled} data-extra={extra.value} onClick={() => extra.onSelect(selection)}>
          <LumiIcon name={extra.icon} data-icon="inline-start" />
          {extra.label}
        </Button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        {actions.filter(action => action.tone === 'primary').map(button)}
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onClear}>{t('lumi.select.clear', 'Clear selection')}</Button>
      </div>
    </div>
  )
}

const EMPTY_ROWS: Record<string, unknown>[] = []

/** Host-side composition slot; absent from TableProps, so JSON reaches it only through the `rowActions` slot. */
export interface TableSlots {
  /**
   * Controls drawn inline in each row's `actions` column, in place of the
   * column's `actions` menu: each control carries its own command.
   */
  renderRowActions?: ((row: Record<string, unknown>, index: number) => ReactNode) | undefined
}

export function LumiTable(props: TableProps & TableSlots & HostProps): ReactElement {
  const { t, locale } = useUiText()
  const { rows: inputRows, columns, visibleColumns, columnOrder, sorters: controlledSorters, rowKey = 'id', highlightField, loading, empty = t('lumi.common.noData', 'No data'), showHeader, selectable, selectedKeys = [], total, summary, totals, bulkActions, onSelectionChange, onBulkAction, onSort, onRowClick, onRowAction, renderRowActions, className, ...rest } = props
  const rows = inputRows ?? EMPTY_ROWS
  const extras = useSelectionExtras()
  const frame = useRef<HTMLDivElement>(null)
  // Rows flagged through LUMI_HIGHLIGHT_EVENT, cleared after a moment. Keys
  // compare as text: an agent may name row 1042 as "1042".
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(NO_KEYS)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const flag = (event: Event): void => {
      const keys = (event as CustomEvent<{ keys?: unknown }>).detail?.keys
      if (!Array.isArray(keys))
        return
      setFlagged(new Set(keys.filter(key => typeof key === 'string' || typeof key === 'number').map(key => String(key))))
      clearTimeout(timer)
      timer = setTimeout(setFlagged, HIGHLIGHT_MS, NO_KEYS)
    }
    window.addEventListener(LUMI_HIGHLIGHT_EVENT, flag)
    return () => {
      window.removeEventListener(LUMI_HIGHLIGHT_EVENT, flag)
      clearTimeout(timer)
    }
  }, [])
  useEffect(() => {
    if (flagged.size)
      frame.current?.querySelector('[data-agent-highlight]')?.scrollIntoView?.({ block: 'nearest' })
  }, [flagged])
  // The count earns a row only when the table shows part of the set; with every row on screen it repeats what is visible.
  const countShown = total !== undefined && total !== rows.length
  const [internalSorters, setInternalSorters] = useState<NonNullable<TableProps['sorters']>>([])
  const sorters = controlledSorters ?? internalSorters
  // A row without its key has no identity of its own. Its place on the page
  // would name another row after a page change or a sort, so it is told apart
  // from real keys and never counts as selected or highlighted.
  const rowId = (row: Record<string, unknown>, index: number): string | number => typeof row[rowKey] === 'string' || typeof row[rowKey] === 'number' ? row[rowKey] as string | number : `${UNKEYED_ROW}${index}`
  const pageKeys = useMemo(() => rows.map((row, index) => rowId(row, index)), [rows, rowKey])
  const rowsById = useMemo(() => new Map(rows.map((row, index) => [serializeRowId(rowId(row, index)), row])), [rows, rowKey])
  const keysById = useMemo(() => new Map([...selectedKeys, ...pageKeys].map(key => [serializeRowId(key), key])), [pageKeys, selectedKeys])
  const sorting = useMemo<SortingState>(() => sorters.map(sorter => ({ id: sorter.field, desc: sorter.order === 'desc' })), [sorters])
  const rowSelection = useMemo<RowSelectionState>(() => Object.fromEntries(selectedKeys.map(key => [serializeRowId(key), true])), [selectedKeys])
  const columnVisibility = useMemo(() => visibleColumns
    ? Object.fromEntries(columns.map(column => [column.field, visibleColumns.includes(column.field)]))
    : {}, [columns, visibleColumns])
  const tableColumns = useMemo<Array<ColumnDef<LumiDataTableFeatures, Record<string, unknown>>>>(() => columns.map(column => ({
    id: column.field,
    accessorFn: row => row[column.field],
    enableHiding: true,
    enableSorting: Boolean(column.sortable),
  })), [columns])
  const tableOptions = useMemo<TableOptions<LumiDataTableFeatures, Record<string, unknown>>>(() => ({
    features: lumiDataTableFeatures,
    columns: tableColumns,
    data: rows,
    enableMultiSort: true,
    enableRowSelection: selectable ? row => !row.id.includes(UNKEYED_ROW) : false,
    enableSortingRemoval: false,
    getRowId: (row, index) => serializeRowId(rowId(row, index)),
    manualSorting: true,
    onRowSelectionChange: (updater) => {
      const next = functionalUpdate(updater, rowSelection)
      onSelectionChange?.(Object.keys(next).flatMap(id => next[id] && keysById.has(id) && !id.includes(UNKEYED_ROW) ? [keysById.get(id)!] : []))
    },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)
      const nextSorters = next.map(sorter => ({ field: sorter.id, order: sorter.desc ? 'desc' as const : 'asc' as const }))
      if (controlledSorters === undefined)
        setInternalSorters(nextSorters)
      onSort?.(nextSorters)
    },
    sortDescFirst: false,
    state: {
      columnOrder: columnOrder ?? [],
      columnVisibility,
      rowSelection,
      sorting,
    },
  }), [columnOrder, columnVisibility, controlledSorters, keysById, onSelectionChange, onSort, rowSelection, rows, selectable, sorting, tableColumns])
  const table = useTable(tableOptions)
  const shown = table.getVisibleLeafColumns().map(column => columns.find(candidate => candidate.field === column.id)!).filter(Boolean)
  const columnById = new Map(columns.map(column => [column.field, column]))
  const columnCount = shown.length + (selectable ? 1 : 0)
  const allSelected = table.getIsAllPageRowsSelected()
  const someSelected = table.getIsSomePageRowsSelected() && !allSelected
  const renderCell = (row: Record<string, unknown>, column: TableColumn, key: string | number, index: number): ReactNode => {
    if (column.kind === 'badge')
      return <LumiBadge dot label={stringValue(row, column.labelField) ?? column.valueMap?.[String(row[column.field])] ?? String(row[column.field] ?? '')} tone={column.toneMap?.[String(row[column.field])]} />
    if (column.kind === 'tags') {
      const value = row[column.field]
      const items = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
      return <span className="flex flex-wrap gap-1" data-slot="table-tags">{items.map(item => <LumiBadge key={String(item)} label={column.valueMap?.[String(item)] ?? String(item)} tone={column.toneMap?.[String(item)] ?? 'neutral'} appearance="soft" />)}</span>
    }
    if (column.kind === 'code')
      return <span className="text-[length:var(--lumi-fs-label)] text-muted-foreground tabular-nums" data-slot="table-code">{cellValue(row, column.field, column.valueMap)}</span>
    if (column.kind === 'entity')
      return <EntityCell column={column} row={row} />
    if (column.kind === 'date') {
      const value = stringValue(row, column.field)
      return value ? <time className="text-muted-foreground tabular-nums" dateTime={value}>{value}</time> : null
    }
    if (column.kind === 'datetime')
      return dateTimeCell(row, column, locale)
    if (column.kind === 'currency')
      return currencyCell(row, column, locale)
    if (column.kind === 'actions' && renderRowActions) {
      // The row opens on click; a control inside it must not open it too.
      return (
        <span className="inline-flex items-center justify-end gap-1" data-slot="table-row-actions" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
          {renderRowActions(row, index)}
        </span>
      )
    }
    if (column.kind === 'actions')
      return <RowActions actions={column.actions ?? []} row={row} rowId={key} onAction={onRowAction} />
    return stringValue(row, column.labelField) ?? cellValue(row, column.field, column.valueMap)
  }
  const selectionBar = selectable && (bulkActions?.length || extras.length) && selectedKeys.length > 0
    ? (
        <LumiSelectionBar
          className="min-h-12 px-4 py-1"
          count={selectedKeys.length}
          actions={bulkActions ?? []}
          selection={{ keys: [...selectedKeys], rows: selectedKeys.map(key => rowsById.get(serializeRowId(key))) }}
          disabled={loading}
          onAction={action => onBulkAction?.({ action, keys: [...selectedKeys] })}
          onClear={() => onSelectionChange?.([])}
        />
      )
    : null
  return (
    <div {...rest} ref={frame} className={className} aria-busy={loading || undefined}>
      {loading && <span className="sr-only" role="status">{t('lumi.table.loading', 'Loading table')}</span>}
      {selectionBar}
      <Table>
        {/* A hidden header still names the columns for assistive tech. */}
        <TableHeader className={showHeader === false ? 'sr-only' : undefined} data-hidden={showHeader === false || undefined}>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                {/* The adapter only receives the current server page, so this
                    feature's "all rows" scope is exactly the visible page. */}
                <Checkbox
                  aria-label={allSelected ? t('lumi.select.clear', 'Clear selection') : t('lumi.table.selectAll', 'Select all rows')}
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  disabled={rows.length === 0}
                  onCheckedChange={checked => table.toggleAllRowsSelected(checked === true, { deselectAll: true })}
                />
              </TableHead>
            )}
            {table.getHeaderGroups().flatMap(group => group.headers).map((header) => {
              const column = columnById.get(header.column.id)!
              const activeOrder = header.column.getIsSorted()
              const SortIcon = activeOrder === 'asc' ? ArrowUpIcon : activeOrder === 'desc' ? ArrowDownIcon : ArrowUpDownIcon
              // The label sits flush with the values below it, so a right-aligned
              // column keeps its arrow on the inner side of the label.
              const trailing = columnAlign(column) === 'right'
              return (
                <TableHead key={column.field} data-truncate={column.truncate || undefined} aria-sort={activeOrder ? (activeOrder === 'asc' ? 'ascending' : 'descending') : undefined} style={{ width: column.width, textAlign: columnAlign(column) }}>
                  {column.sortable
                    ? (
                        // The arrow marks the column that is sorting, not every
                        // column that could: a header full of arrows reads as
                        // decoration and steals the width the labels need.
                        <Button data-table-sort className={cn('group/sort font-medium', trailing ? '-mr-2.5' : '-ml-2.5')} type="button" variant="ghost" size="sm" disabled={loading || !onSort} aria-label={activeOrder === 'asc' ? t('lumi.table.sortDescending', 'Sort {name} descending', { name: column.label ?? column.field }) : t('lumi.table.sortAscending', 'Sort {name} ascending', { name: column.label ?? column.field })} onClick={header.column.getToggleSortingHandler()}>
                          {trailing && <SortIcon className={activeOrder ? undefined : 'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60'} aria-hidden data-icon="inline-start" />}
                          {column.label ?? column.field}
                          {!trailing && <SortIcon className={activeOrder ? undefined : 'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60'} aria-hidden data-icon="inline-end" />}
                        </Button>
                      )
                    : column.kind === 'actions' && column.label === undefined
                      // Row actions are chrome, so the column is unlabelled in
                      // the design — but it still needs a spoken name.
                      ? <span className="sr-only">{t('lumi.table.actions', 'Actions')}</span>
                      : column.label ?? column.field}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <TableRow key={`loading-${index}`} aria-hidden className="h-(--lumi-row-height)">
                  {selectable && <TableCell><LumiSkeletonShape className="size-4 rounded-sm" data-slot="table-skeleton" /></TableCell>}
                  {shown.map(column => <TableCell key={column.field}><LumiSkeletonShape className="h-3 w-full max-w-40 rounded-sm" data-slot="table-skeleton" /></TableCell>)}
                </TableRow>
              ))
            : rows.length === 0
              // An empty `empty` means the host draws its own empty state below
              // the table, so no blank row is left standing above it.
              ? empty
                ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columnCount} className="whitespace-normal" data-slot="table-empty">
                        <LumiEmpty size="sm" role="status" {...(typeof empty === 'string' ? { title: empty } : empty)} />
                      </TableCell>
                    </TableRow>
                  )
                : null
              : table.getRowModel().rows.map((tableRow) => {
                  const row = tableRow.original
                  const key = keysById.get(tableRow.id) ?? rowId(row, tableRow.index)
                  const activate = (): void => onRowClick?.(row)
                  return (
                    <TableRow
                      key={tableRow.id}
                      data-state={selectable && tableRow.getIsSelected() ? 'selected' : undefined}
                      data-highlighted={highlightField && (row as Record<string, unknown>)[highlightField] ? true : undefined}
                      data-agent-highlight={flagged.has(String(key)) || undefined}
                      aria-label={onRowClick ? t('lumi.table.openRow', 'Open row {id}', { id: key }) : undefined}
                      data-clickable={onRowClick ? true : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? activate : undefined}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          activate()
                        }
                      }}
                    >
                      {selectable && <TableCell onClick={event => event.stopPropagation()}><Checkbox aria-label={t('lumi.table.selectRow', 'Select row {id}', { id: key })} checked={tableRow.getIsSelected()} onCheckedChange={checked => tableRow.toggleSelected(checked === true)} /></TableCell>}
                      {tableRow.getVisibleCells().map((cell) => {
                        const column = columnById.get(cell.column.id)!
                        return (
                          <TableCell key={cell.id} style={{ textAlign: columnAlign(column) }} data-kind={column.kind} data-truncate={column.truncate || undefined} data-wrap={(column.wrap && !column.truncate) || undefined}>
                            {column.truncate && column.kind !== 'entity'
                              ? <span className="block truncate" data-slot="table-truncate" title={stringValue(row, column.labelField) ?? stringValue(row, column.field)}>{renderCell(row, column, key, tableRow.index)}</span>
                              : renderCell(row, column, key, tableRow.index)}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
        </TableBody>
        {/* Totals read like the foot of an invoice: label and amount side by
            side at the right edge, under the column they sum. */}
        {totals && totals.length > 0 && (
          <TableFooter>
            {totals.map(entry => (
              <TableRow key={text(entry.label)} data-emphasis={entry.emphasis || undefined}>
                <TableCell className="text-right text-muted-foreground" colSpan={Math.max(1, columnCount - 1)}>{text(entry.label)}</TableCell>
                <TableCell className={entry.emphasis ? 'text-right font-semibold tabular-nums text-foreground' : 'text-right tabular-nums'} data-slot="table-total">{entry.value}</TableCell>
              </TableRow>
            ))}
          </TableFooter>
        )}
      </Table>
      {(summary || countShown) && (
        <p data-slot="table-summary" className="m-0 flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-[length:var(--lumi-fs-label)] text-muted-foreground">
          <span>{summary}</span>
          {countShown && <span className="tabular-nums">{t('lumi.table.total', '{count} total', { count: total })}</span>}
        </p>
      )}
    </div>
  )
}

/**
 * A read-only record: label above value, wrapping into as many columns as the
 * container allows. Detail pages stack these where a form would put fields.
 */
export function LumiDescriptionList(props: DescriptionListProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items, layout = 'grid', bordered, className, ...rest } = props
  const rows = layout === 'rows'
  const display = (value: (typeof items)[number]['value']): string =>
    value === null || value === undefined
      ? '—'
      : typeof value === 'boolean'
        ? value ? t('lumi.common.yes', 'Yes') : t('lumi.common.no', 'No')
        : typeof value === 'object' ? text(value) : String(value)
  return (
    <dl {...rest} className={cn('grid', rows ? 'gap-y-2' : 'gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]', className)} data-slot="description-list" data-layout={layout} data-bordered={bordered || undefined}>
      {items.map((item) => {
        const full = item.span === 'full'
        return (
          <div key={text(item.label)} className={cn('min-w-0', rows ? 'grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-3' : 'flex flex-col gap-1', full && 'col-span-full')}>
            <dt className={cn('text-muted-foreground', rows ? 'text-sm' : 'text-xs')}>{text(item.label)}</dt>
            <dd className={cn('m-0 text-sm text-foreground tabular-nums', full ? 'whitespace-pre-line break-words' : 'truncate')}>{display(item.value)}</dd>
          </div>
        )
      })}
    </dl>
  )
}

const NON_DIGITS = /\D/g

/**
 * The gap between page numbers doubles as a page box. A mouse opens it by
 * hovering and it stays while the pointer is over the gap or the box, or while
 * the box has focus; click, Enter and Space open it with focus in the field,
 * so touch and keyboard reach it too. Enter goes to the page, Escape closes.
 */
function PaginationJump({ page, count, disabled, onJump }: { page: number, count: number, disabled?: boolean, onJump: (page: number) => void }): ReactElement {
  const { t } = useUiText()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const hovered = useRef(false)
  const closing = useRef<number | undefined>(undefined)
  const hold = (): void => window.clearTimeout(closing.current)
  useEffect(() => hold, [])

  const show = (next: boolean): void => {
    hold()
    setOpen(next)
    if (!next) {
      hovered.current = false
      setDraft('')
    }
  }
  const enter = (event: ReactPointerEvent): void => {
    if (event.pointerType !== 'mouse' || disabled)
      return
    hold()
    if (!open) {
      hovered.current = true
      setOpen(true)
    }
  }
  const leave = (event: ReactPointerEvent): void => {
    if (event.pointerType !== 'mouse' || !hovered.current)
      return
    hold()
    closing.current = window.setTimeout(() => {
      if (document.activeElement !== field.current)
        show(false)
    }, 200)
  }

  const target = Number(draft)
  const valid = draft !== '' && Number.isInteger(target) && target >= 1 && target <= count
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!valid)
      return
    show(false)
    if (target !== page)
      onJump(target)
  }

  return (
    <Popover open={open} onOpenChange={show}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="pagination-ellipsis"
          aria-label={t('lumi.pagination.jump', 'Go to page')}
          disabled={disabled}
          className="flex size-control-md items-center justify-center rounded-(--lumi-radius-control) text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground [&_svg]:size-4"
          onPointerEnter={enter}
          onPointerLeave={leave}
          onClick={(event) => {
            // A click on a box the hover opened keeps it and moves into the field.
            if (open && hovered.current) {
              event.preventDefault()
              hovered.current = false
              field.current?.focus()
            }
          }}
        >
          <MoreHorizontalIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={6}
        className="w-auto p-2"
        data-slot="pagination-jump"
        onPointerEnter={enter}
        onPointerLeave={leave}
        // A hover only offers the box; focus moves in on click or from the keyboard.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (!hovered.current)
            field.current?.focus()
        }}
      >
        <form className="flex items-center gap-2 text-(length:--lumi-fs-label) text-muted-foreground" onSubmit={submit}>
          <label className="flex items-center gap-2 whitespace-nowrap">
            {t('lumi.pagination.jumpTo', 'Go to')}
            <Input
              ref={field}
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="go"
              className="h-control-sm w-14 px-2 text-center tabular-nums"
              placeholder={String(page)}
              value={draft}
              aria-invalid={draft !== '' && !valid ? true : undefined}
              onChange={event => setDraft(event.target.value.replace(NON_DIGITS, ''))}
              onFocus={() => {
                hovered.current = false
                hold()
              }}
            />
            {t('lumi.pagination.jumpOf', 'of {count}', { count })}
          </label>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/**
 * One row under the table: what you are looking at on the left, how to move
 * through it on the right. `pages` numbers the pages for lists people jump
 * around in; `simple` says `3 / 12` in a fraction of the width for lists
 * walked a page at a time.
 */
export function LumiPagination(props: PaginationProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { page, pageSize, total, disabled, ariaLabel = t('lumi.pagination.name', 'Pagination'), pageSizeOptions, showTotal = true, variant = 'pages', onPageChange, onPageSizeChange, className } = props
  const count = pageSize > 0 && Number.isFinite(total) ? Math.max(1, Math.ceil(total / pageSize)) : 1
  const navigate = (next: number) => (event: React.MouseEvent): void => {
    event.preventDefault()
    // A page past the end (rows were deleted or filtered away) steps back to the last one.
    const target = Math.min(next, count)
    if (!disabled && target >= 1 && target !== page)
      onPageChange?.(target)
  }
  return (
    <div className={className} data-slot="pagination-controls" data-variant={variant}>
      {showTotal && (
        <span data-slot="pagination-total">
          {t('lumi.pagination.totalCount', '{total} total', { total })}
        </span>
      )}
      {pageSizeOptions && (
        <span data-slot="pagination-page-size-label">
          <span aria-hidden>{t('lumi.pagination.rowsPerPage', 'Rows per page')}</span>
          <LumiSelect
            className="lumi-pagination-size"
            size="sm"
            ariaLabel={t('lumi.pagination.pageSizeName', 'Page size')}
            value={pageSize}
            disabled={disabled}
            options={pageSizeOptions.map(option => ({ label: String(option), value: option }))}
            onChange={value => typeof value === 'number' && onPageSizeChange?.(value)}
          />
        </span>
      )}
      <Pagination aria-label={ariaLabel}>
        <PaginationContent>
          <PaginationItem><PaginationPrevious text={t('lumi.pagination.previous', 'Previous')} aria-label={t('lumi.pagination.previousPage', 'Go to previous page')} href="#" aria-disabled={disabled || page <= 1} tabIndex={disabled || page <= 1 ? -1 : undefined} onClick={navigate(page - 1)} /></PaginationItem>
          {variant === 'simple'
            ? (
                <PaginationItem>
                  <span className="px-1 tabular-nums text-foreground" aria-current="page" data-slot="pagination-position">
                    {`${page} / ${count}`}
                  </span>
                </PaginationItem>
              )
            : paginationRange(page, count).map((item, at) => (
                <PaginationItem key={item === 'gap' ? `gap-${at}` : item}>
                  {item === 'gap'
                    ? <PaginationJump page={page} count={count} disabled={disabled} onJump={next => onPageChange?.(next)} />
                    : (
                        <PaginationLink
                          href="#"
                          isActive={item === page}
                          aria-label={t('lumi.pagination.page', 'Page {page}', { page: item })}
                          aria-disabled={disabled || undefined}
                          tabIndex={disabled ? -1 : undefined}
                          onClick={navigate(item)}
                        >
                          {item}
                        </PaginationLink>
                      )}
                </PaginationItem>
              ))}
          <PaginationItem><PaginationNext text={t('lumi.pagination.next', 'Next')} aria-label={t('lumi.pagination.nextPage', 'Go to next page')} href="#" aria-disabled={disabled || page >= count} tabIndex={disabled || page >= count ? -1 : undefined} onClick={navigate(page + 1)} /></PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
