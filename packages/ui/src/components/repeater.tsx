import type { DragEvent, KeyboardEvent, ReactElement, ReactNode, RefObject } from 'react'
import type { RepeaterColumn, RepeaterProps, RepeaterRowProps, RepeaterSummary } from '../catalog/types-public.js'
import type { ErrorDisplay } from './field-error.js'
import { Children, createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { AddIcon, CopyIcon, DragHandleIcon, TrashIcon, useOutlineIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { cn } from '../internal/utils.js'
import { LumiEmpty } from './empty.js'
import { LumiFieldErrorTip } from './field-error.js'
import { LumiTooltip } from './interactive.js'
import { useUiText } from './text.js'

type Row = Record<string, unknown>
type Errors = Record<string, string>

interface HostProps {
  'className'?: string
  'children'?: ReactNode
  'id'?: string
  'data-testid'?: string
}

/**
 * Re-addresses `name.<index>…` errors after rows move, so a message keeps
 * pointing at the row it was raised for. `next` returns a row's new index, or
 * undefined when the row is gone.
 */
const NO_COLUMNS: readonly RepeaterColumn[] = []

/** A repeater's row errors moved to their rows' new indexes after rows were reordered or removed; a removed row's errors are dropped. */
export function remapRowErrors(errors: Errors, name: string, next: (index: number) => number | undefined): Errors {
  const prefix = `${name}.`
  const result: Errors = {}
  for (const [path, message] of Object.entries(errors)) {
    if (!path.startsWith(prefix)) {
      result[path] = message
      continue
    }
    const [head, ...rest] = path.slice(prefix.length).split('.')
    const index = Number(head)
    if (!Number.isInteger(index)) {
      result[path] = message
      continue
    }
    const moved = next(index)
    if (moved !== undefined)
      result[[name, moved, ...rest].join('.')] = message
  }
  return result
}

/** Moves one row, returning a new array. */
export function moveRow<T>(rows: readonly T[], from: number, to: number): T[] {
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, row!)
  return next
}

function numeric(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

/** A computed column's value for one row: the product or sum of other fields. */
export function computeCell(row: Row, column: Pick<RepeaterColumn, 'compute'>): number | undefined {
  const compute = column.compute
  if (!compute)
    return undefined
  const values = compute.fields.map(field => numeric(row[field]))
  if (values.includes(undefined))
    return undefined
  return compute.op === 'product'
    ? (values as number[]).reduce((total, value) => total * value, 1)
    : (values as number[]).reduce((total, value) => total + value, 0)
}

function cellNumber(row: Row, column: RepeaterColumn): number | undefined {
  return column.compute ? computeCell(row, column) : numeric(row[column.key])
}

/** The footer figure for one column over every row. */
export function summarize(rows: readonly Row[], column: RepeaterColumn, op: RepeaterSummary['op']): number | undefined {
  if (op === 'count')
    return rows.length
  const values = rows.map(row => cellNumber(row, column)).filter((value): value is number => value !== undefined)
  if (!values.length)
    return op === 'sum' ? 0 : undefined
  if (op === 'sum')
    return values.reduce((total, value) => total + value, 0)
  if (op === 'avg')
    return values.reduce((total, value) => total + value, 0) / values.length
  return op === 'min' ? Math.min(...values) : Math.max(...values)
}

function formatFigure(value: number | undefined, column: Pick<RepeaterColumn, 'precision' | 'prefix' | 'suffix'>): string {
  if (value === undefined)
    return '—'
  // Intl refuses a digit count outside 0–20.
  const digits = column.precision === undefined ? undefined : Math.min(20, Math.max(0, Math.trunc(column.precision)))
  const text = new Intl.NumberFormat(undefined, digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  return `${column.prefix ?? ''}${text}${column.suffix ?? ''}`
}

let rowSeq = 0
function rowId(): string {
  rowSeq += 1
  return `row-${Date.now().toString(36)}-${rowSeq}`
}

interface RepeaterContextValue {
  layout: 'table' | 'card'
  columns: RepeaterColumn[]
  rows: Row[]
  count: number
  locked: boolean
  sortable: boolean
  duplicable: boolean
  canRemove: boolean
  canAdd: boolean
  label: (index: number) => string
  cellError: (index: number, key: string) => string | undefined
  errorDisplay: (column: RepeaterColumn) => ErrorDisplay
  rowError: (index: number) => string | undefined
  move: (from: number, to: number) => void
  /** Keyboard reorder from a handle: keeps focus on that row's handle and announces the position. */
  keyMove: (from: number, to: number) => void
  focusHandle: RefObject<number | undefined>
  remove: (index: number) => void
  duplicate: (index: number) => void
  drag: { from?: number | undefined, over?: number | undefined, armed?: number | undefined }
  setDrag: (next: RepeaterContextValue['drag']) => void
}

const RepeaterContext = createContext<RepeaterContextValue | null>(null)

/** A column-wide command beside a header label, e.g. "apply the first row to all". */
export interface RepeaterColumnAction {
  /** Tooltip, and the accessible name unless `ariaLabel` names the column too. */
  label: string
  ariaLabel?: string | undefined
  /** An icon name `LumiButton` accepts. */
  icon: string
  disabled?: boolean | undefined
  /** A returned message is announced politely. */
  onSelect: () => string | void
}

/** Host-only composition, absent from the catalog so JSON cannot reach it. */
export interface RepeaterHostProps {
  columnActions?: Record<string, RepeaterColumnAction | undefined> | undefined
}

function ColumnAction({ action, announce }: { action: RepeaterColumnAction, announce: (message: string) => void }): ReactElement {
  const Icon = useOutlineIcon(action.icon)
  return (
    <LumiTooltip content={action.label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-slot="repeater-column-action"
        aria-label={action.ariaLabel ?? action.label}
        disabled={action.disabled}
        onClick={() => {
          const message = action.onSelect()
          if (message)
            announce(message)
        }}
      >
        {Icon && <Icon aria-hidden />}
      </Button>
    </LumiTooltip>
  )
}

/**
 * Rows over a bound array: a table of inline cells or a stack of cards. Each
 * row is a `LumiRepeaterRow` whose children are the editable cells, one per
 * column without `compute`, in column order. The array itself stays with the
 * host (the StateStore in JSON); this component only rewrites it.
 */
export function LumiRepeater(props: RepeaterProps & RepeaterHostProps & HostProps): ReactElement {
  const { t } = useUiText()
  const {
    columnActions,
    value,
    onChange,
    columns: inputColumns,
    layout = 'table',
    min = 0,
    max,
    newRow,
    rowKey,
    summary,
    summaryLabel = t('lumi.repeater.total', 'Total'),
    sortable = true,
    addable = true,
    removable = true,
    duplicable = true,
    addLabel = t('lumi.repeater.add', 'Add row'),
    rowLabel,
    emptyText = t('lumi.repeater.empty', 'No rows yet'),
    errors,
    onErrorsChange,
    name,
    errorDisplay,
    disabled,
    readonly,
    ariaLabel,
    className,
    children,
  } = props
  const rows = (value ?? []) as Row[]
  const columns = inputColumns ?? NO_COLUMNS
  const [drag, setDrag] = useState<RepeaterContextValue['drag']>({})
  const [announcement, setAnnouncement] = useState('')
  const focusHandle = useRef<number | undefined>(undefined)
  const locked = Boolean(disabled || readonly)
  const canAdd = !locked && addable && (max === undefined || rows.length < max)
  const canRemove = !locked && removable && rows.length > min
  const errorId = useId()
  const previous = useRef(rows)
  const structural = useRef(false)

  // A message belongs to the value it judged: editing a cell clears its error.
  useEffect(() => {
    const before = previous.current
    previous.current = rows
    if (structural.current) {
      structural.current = false
      return
    }
    if (!name || !errors || !onErrorsChange || before === rows)
      return
    const stale = Object.keys(errors).filter((path) => {
      const match = path.slice(name.length + 1).split('.')
      if (!path.startsWith(`${name}.`) || match.length < 2)
        return false
      const index = Number(match[0])
      return Number.isInteger(index) && before[index]?.[match[1]!] !== rows[index]?.[match[1]!]
    })
    if (stale.length)
      onErrorsChange(Object.fromEntries(Object.entries(errors).filter(([path]) => !stale.includes(path))))
  }, [rows, errors, name, onErrorsChange])

  const rewrite = (next: Row[], mapping?: (index: number) => number | undefined): void => {
    structural.current = true
    if (mapping && name && errors && onErrorsChange)
      onErrorsChange(remapRowErrors(errors, name, mapping))
    onChange?.(next)
  }
  const withKey = (row: Row): Row => rowKey ? { ...row, [rowKey]: rowId() } : row
  const add = (): void => {
    if (canAdd)
      rewrite([...rows, withKey(structuredClone(newRow ?? {}) as Row)])
  }
  const context: RepeaterContextValue = {
    layout,
    columns,
    rows,
    count: rows.length,
    locked,
    sortable: sortable && !locked,
    duplicable: duplicable && canAdd,
    canRemove,
    canAdd,
    label: index => rowLabel ? rowLabel.replaceAll('{index}', String(index + 1)) : t('lumi.repeater.row', 'Row {index}', { index: index + 1 }),
    cellError: (index, key) => name ? errors?.[`${name}.${index}.${key}`] : undefined,
    errorDisplay: column => column.errorDisplay ?? errorDisplay ?? (layout === 'table' ? 'tooltip' : 'inline'),
    rowError: index => name ? errors?.[`${name}.${index}`] : undefined,
    move: (from, to) => {
      if (from === to || to < 0 || to >= rows.length)
        return
      const order = moveRow(rows.map((_, index) => index), from, to)
      rewrite(moveRow(rows, from, to), index => order.indexOf(index))
    },
    keyMove: (from, to) => {
      const target = Math.min(Math.max(to, 0), rows.length - 1)
      if (target === from)
        return
      context.move(from, target)
      focusHandle.current = target
      setAnnouncement(t('lumi.repeater.moved', 'Moved to row {index} of {count}', { index: target + 1, count: rows.length }))
    },
    focusHandle,
    remove: (index) => {
      if (canRemove)
        rewrite(rows.filter((_, itemIndex) => itemIndex !== index), current => current === index ? undefined : current > index ? current - 1 : current)
    },
    duplicate: (index) => {
      if (!canAdd || !rows[index])
        return
      const copy = withKey(structuredClone(rows[index]))
      rewrite([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)], current => current > index ? current + 1 : current)
    },
    drag,
    setDrag,
  }
  const listError = name ? errors?.[name] : undefined
  const summaryCells = summary?.length
    ? columns.map((column) => {
        const entry = summary.find(item => item.key === column.key)
        return entry ? formatFigure(summarize(rows, column, entry.op), entry.op === 'count' ? {} : column) : undefined
      })
    : undefined
  const footer = (
    <div data-slot="repeater-footer">
      {addable && !readonly && (
        <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={add}>
          <AddIcon data-icon="inline-start" />
          {addLabel}
        </Button>
      )}
      {max !== undefined && <span data-slot="repeater-limit">{t('lumi.repeater.limit', '{count} of {max}', { count: rows.length, max })}</span>}
    </div>
  )

  return (
    <RepeaterContext.Provider value={context}>
      <div
        id={props.id}
        className={cn('min-w-0', className)}
        role="group"
        aria-label={ariaLabel}
        aria-describedby={listError ? errorId : undefined}
        data-slot="repeater"
        data-layout={layout}
        data-disabled={disabled || undefined}
        data-invalid={listError ? true : undefined}
        data-testid={props['data-testid']}
      >
        {layout === 'table'
          ? (
              <div data-slot="repeater-scroll">
                <table data-slot="repeater-table">
                  <thead>
                    <tr>
                      <th data-slot="repeater-lead" scope="col"><span className="sr-only">{t('lumi.repeater.row', 'Row {index}', { index: '#' })}</span></th>
                      {columns.map((column) => {
                        const action = locked ? undefined : columnActions?.[column.key]
                        return (
                          <th key={column.key} scope="col" data-align={column.align ?? (column.compute ? 'end' : undefined)} data-has-action={action ? true : undefined} style={column.width === undefined ? undefined : { width: typeof column.width === 'number' ? `${column.width}px` : column.width }}>
                            {column.label}
                            {column.required && <span data-slot="repeater-required" aria-hidden> *</span>}
                            {action && <ColumnAction action={action} announce={setAnnouncement} />}
                          </th>
                        )
                      })}
                      {!locked && <th data-slot="repeater-actions" scope="col"><span className="sr-only">{t('lumi.repeater.actions', 'Actions')}</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {children}
                    {!rows.length && (
                      <tr data-slot="repeater-empty-row">
                        <td colSpan={columns.length + (locked ? 1 : 2)}><LumiEmpty size="sm" title={emptyText} /></td>
                      </tr>
                    )}
                  </tbody>
                  {summaryCells && rows.length > 0 && (
                    <tfoot>
                      <tr>
                        <td data-slot="repeater-lead" />
                        {summaryCells.map((cell, index) => (
                          <td key={columns[index]!.key} data-align={columns[index]!.align ?? 'end'}>
                            {cell ?? (index === 0 ? <span data-slot="repeater-summary-label">{summaryLabel}</span> : null)}
                          </td>
                        ))}
                        {!locked && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          : (
              <div data-slot="repeater-cards">
                {children}
                {!rows.length && <div data-slot="repeater-empty"><LumiEmpty size="sm" title={emptyText} /></div>}
                {summaryCells && rows.length > 0 && (
                  <dl data-slot="repeater-summary">
                    <dt>{summaryLabel}</dt>
                    {summaryCells.map((cell, index) => cell === undefined
                      ? null
                      : (
                          <dd key={columns[index]!.key}>
                            <span>{columns[index]!.label}</span>
                            <strong>{cell}</strong>
                          </dd>
                        ))}
                  </dl>
                )}
              </div>
            )}
        {listError && <p id={errorId} role="alert" data-slot="repeater-error">{listError}</p>}
        {!locked && <span role="status" aria-live="polite" className="sr-only" data-slot="repeater-announcer">{announcement}</span>}
        {(addable && !readonly) || max !== undefined ? footer : null}
      </div>
    </RepeaterContext.Provider>
  )
}

function RowTools({ index, compact }: { index: number, compact?: boolean }): ReactElement | null {
  const { t } = useUiText()
  const context = useContext(RepeaterContext)!
  if (context.locked)
    return null
  const position = { index: index + 1 }
  return (
    <div data-slot="repeater-tools" data-compact={compact || undefined}>
      {context.duplicable && (
        <Button type="button" variant="ghost" size="icon-xs" aria-label={t('lumi.repeater.duplicate', 'Duplicate row {index}', position)} onClick={() => context.duplicate(index)}><CopyIcon /></Button>
      )}
      {context.canRemove && (
        <Button type="button" variant="ghost" size="icon-xs" data-slot="repeater-remove" aria-label={t('lumi.repeater.remove', 'Remove row {index}', position)} onClick={() => context.remove(index)}><TrashIcon /></Button>
      )}
    </div>
  )
}

/**
 * One row of a `LumiRepeater`. Inside JSON it is the template under the
 * Repeater's native `repeat`, and the registry passes the repeat index.
 */
export function LumiRepeaterRow({ index, children, className }: RepeaterRowProps & HostProps): ReactElement {
  const { t } = useUiText()
  const context = useContext(RepeaterContext)
  const tipId = useId()
  const handleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (context?.focusHandle.current === index) {
      context.focusHandle.current = undefined
      handleRef.current?.focus()
    }
  })
  // Outside a Repeater (an isolated docs preview) there are no columns to lay the cells into.
  if (!context)
    return <div className={cn('flex flex-wrap gap-2', className)} data-slot="repeater-row">{children}</div>
  const { layout, columns, rows, drag, setDrag, sortable } = context
  const row = rows[index] ?? {}
  const cells = Children.toArray(children)
  let cursor = 0
  const content = columns.map((column) => {
    if (column.compute)
      return <span data-slot="repeater-computed">{formatFigure(computeCell(row, column), column)}</span>
    const cell = cells[cursor]
    cursor += 1
    return cell ?? null
  })
  const rowError = context.rowError(index)
  const cell = (column: RepeaterColumn, columnIndex: number): ReactNode => {
    const error = context.cellError(index, column.key)
    if (column.compute || context.errorDisplay(column) === 'inline') {
      return (
        <>
          {content[columnIndex]}
          {error && <span role="alert" data-slot="repeater-cell-error">{error}</span>}
        </>
      )
    }
    return <LumiFieldErrorTip id={`${tipId}-${column.key}`} message={error} describe>{content[columnIndex]}</LumiFieldErrorTip>
  }
  const dragProps = sortable
    ? {
        'draggable': drag.armed === index,
        'data-dragging': drag.from === index || undefined,
        'data-drop-target': drag.from !== undefined && drag.over === index && drag.from !== index ? (drag.from < index ? 'after' : 'before') : undefined,
        'onDragStart': (event: DragEvent) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', String(index))
          setDrag({ from: index, over: index, armed: index })
        },
        'onDragOver': (event: DragEvent) => {
          if (drag.from === undefined)
            return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          if (drag.over !== index)
            setDrag({ ...drag, over: index })
        },
        'onDrop': (event: DragEvent) => {
          event.preventDefault()
          if (drag.from !== undefined)
            context.move(drag.from, index)
          setDrag({})
        },
        'onDragEnd': () => setDrag({}),
      }
    : {}
  // Only the handle starts a drag, so text in a cell can still be selected.
  const handleLabel = t('lumi.repeater.drag', 'Drag row {index} to reorder, or use the arrow keys', { index: index + 1 })
  const onHandleKey = (event: KeyboardEvent): void => {
    const targets: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: context.count - 1 }
    const to = targets[event.key]
    if (to === undefined)
      return
    event.preventDefault()
    context.keyMove(index, to)
  }
  const handle = sortable && (
    <button
      ref={handleRef}
      type="button"
      data-slot="repeater-handle"
      aria-label={handleLabel}
      title={handleLabel}
      onKeyDown={onHandleKey}
      onPointerDown={() => setDrag({ armed: index })}
      onPointerUp={() => drag.from === undefined && setDrag({})}
    >
      <DragHandleIcon />
    </button>
  )

  if (layout === 'card') {
    return (
      <section className={cn(className)} data-slot="repeater-card" aria-label={context.label(index)} data-invalid={rowError ? true : undefined} {...dragProps}>
        <header data-slot="repeater-card-header">
          {handle}
          <span data-slot="repeater-card-title">{context.label(index)}</span>
          <RowTools index={index} />
        </header>
        <div data-slot="repeater-card-body">
          {columns.map((column, columnIndex) => {
            const error = context.cellError(index, column.key)
            return (
              <label key={column.key} data-slot="repeater-field" data-span={column.span === 2 ? 2 : undefined} data-invalid={error ? true : undefined}>
                <span data-slot="repeater-field-label">
                  {column.label}
                  {column.required && <span data-slot="repeater-required" aria-hidden> *</span>}
                </span>
                {cell(column, columnIndex)}
              </label>
            )
          })}
        </div>
        {rowError && <p role="alert" data-slot="repeater-row-error">{rowError}</p>}
      </section>
    )
  }

  return (
    <>
      <tr className={cn(className)} data-slot="repeater-row" data-invalid={rowError ? true : undefined} {...dragProps}>
        <td data-slot="repeater-lead">
          <span data-slot="repeater-lead-inner">
            {handle}
            <span data-slot="repeater-index">{index + 1}</span>
          </span>
        </td>
        {columns.map((column, columnIndex) => {
          const error = context.cellError(index, column.key)
          return (
            <td key={column.key} data-slot="repeater-cell" data-align={column.align ?? (column.compute ? 'end' : undefined)} data-invalid={error ? true : undefined}>
              {cell(column, columnIndex)}
            </td>
          )
        })}
        {!context.locked && <td data-slot="repeater-actions"><RowTools index={index} compact /></td>}
      </tr>
      {rowError && (
        <tr data-slot="repeater-row-error-row">
          <td />
          <td colSpan={columns.length + 1}><p role="alert" data-slot="repeater-row-error">{rowError}</p></td>
        </tr>
      )}
    </>
  )
}
