import type { PaginationProps, SelectionExtra, TableProps, TableSelection, TableSlots } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { LumiRecoverablePageState } from './state.js'
import { LumiSelectionExtras, LumiPagination as Pagination, LumiSelectionBar as SelectionBar, LumiTable as Table, useSelectionExtras, useUiText } from '@duxweb/lumi-ui'
import { LumiEmptyState } from './state.js'

const ignorePageChange: NonNullable<PaginationProps['onPageChange']> = () => {}

export interface LumiDataGridProps extends Omit<TableProps, 'loading' | 'empty' | 'total'>, TableSlots {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  disabled?: boolean
  pageSizeOptions?: number[]
  state?: LumiRecoverablePageState
  onPageChange: NonNullable<PaginationProps['onPageChange']>
  onPageSizeChange?: NonNullable<PaginationProps['onPageSizeChange']>
  ariaLabel?: string
}

const NO_EXTRAS: readonly SelectionExtra[] = []

/** The selected keys with the row of each the grid has loaded, for a selection bar's added commands. */
export function gridSelection(keys: ReadonlyArray<string | number>, rows: ReadonlyArray<Record<string, unknown>>, rowKey = 'id'): TableSelection {
  return { keys: [...keys], rows: keys.map(key => rows.find(row => String(row[rowKey]) === String(key))) }
}

export function LumiDataGrid(props: LumiDataGridProps): ReactElement {
  const { t } = useUiText()
  const extras = useSelectionExtras()
  const {
    page,
    pageSize,
    total,
    loading,
    disabled,
    pageSizeOptions,
    state,
    onPageChange,
    onPageSizeChange,
    ariaLabel = t('lumi.list.pagination', 'Results pagination'),
    bulkActions,
    onBulkAction,
    ...tableProps
  } = props
  const inferredEmpty: LumiRecoverablePageState | undefined = !loading && !state && tableProps.rows.length === 0
    ? { kind: 'empty', title: t('lumi.list.noResults', 'No results'), reason: t('lumi.list.noRecords', 'No records match the current view.'), nextStep: t('lumi.list.adjustOrCreate', 'Adjust the filters or create a new record.') }
    : undefined
  const visibleState = state ?? inferredEmpty
  const unavailable = Boolean(loading || disabled)
  const guard = <A extends unknown[]>(handler: ((...args: A) => void) | undefined): ((...args: A) => void) | undefined =>
    handler && ((...args: A) => {
      if (!disabled)
        handler(...args)
    })
  // The row-action column is chrome, not data, so it drops its header rather
  // than naming itself. A menu is one 28px disclosure in a fixed 56px; inline
  // controls take the width they need.
  const shaped = tableProps.columns.map(column => column.kind === 'actions'
    ? { ...column, label: '', width: column.width ?? (tableProps.renderRowActions ? undefined : '56px'), align: 'right' as const }
    : column)
  // Only the skeleton drops interactive chrome. A refetch behind current rows
  // keeps the same columns and checkboxes — swapping them would make the table
  // jump on every filter change — and just ignores input until it settles.
  const columns = loading
    ? shaped.map(column => ({
        ...column,
        sortable: false,
        actions: column.actions ? [] : undefined,
      }))
    : shaped
  const displayedRows = loading
    ? Array.from({ length: 5 }, (_, index) => Object.fromEntries([
        ['__lumiSkeletonKey', `loading-${index}`],
        ...tableProps.columns.map(column => [column.field, '']),
      ]))
    : tableProps.rows
  return (
    <div className="lumi-data-grid" data-loading={loading || undefined} data-busy={(!loading && disabled) || undefined} aria-busy={unavailable || undefined}>
      {/* Above the scroller: a wide table must not carry the bar off-screen. */}
      {tableProps.selectable && (bulkActions || extras.length) && tableProps.selectedKeys?.length
        ? (
            <div className="lumi-list-page__batch">
              <SelectionBar
                count={tableProps.selectedKeys.length}
                actions={bulkActions ?? []}
                selection={gridSelection(tableProps.selectedKeys, tableProps.rows, tableProps.rowKey)}
                disabled={unavailable}
                onAction={action => onBulkAction?.({ action, keys: [...tableProps.selectedKeys!] })}
                onClear={() => tableProps.onSelectionChange?.([])}
              />
            </div>
          )
        : null}
      <div className="lumi-data-grid__scroll" tabIndex={loading ? undefined : 0} role="region" aria-label={t('lumi.list.scrollRegion', 'Scrollable data table')} aria-hidden={loading || undefined}>
        {/* The bar above is the grid's; the table must not draw a second one. */}
        <LumiSelectionExtras extras={NO_EXTRAS}>
          <Table
            {...tableProps}
            columns={columns}
            rows={displayedRows}
            rowKey={loading ? '__lumiSkeletonKey' : tableProps.rowKey}
            loading={false}
            empty=""
            selectable={loading ? false : tableProps.selectable}
            selectedKeys={loading ? [] : tableProps.selectedKeys}
            onSort={loading ? undefined : guard(tableProps.onSort)}
            onRowClick={loading ? undefined : guard(tableProps.onRowClick)}
            onRowAction={loading ? undefined : guard(tableProps.onRowAction)}
            renderRowActions={loading ? undefined : tableProps.renderRowActions}
            onSelectionChange={loading ? undefined : guard(tableProps.onSelectionChange)}
          />
        </LumiSelectionExtras>
      </div>
      {visibleState && <LumiEmptyState compact {...visibleState} />}
      <div className="lumi-data-grid__pagination">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          disabled={unavailable}
          pageSizeOptions={pageSizeOptions}
          ariaLabel={ariaLabel}
          showTotal
          onPageChange={unavailable ? ignorePageChange : onPageChange}
          onPageSizeChange={unavailable ? undefined : onPageSizeChange}
        />
      </div>
    </div>
  )
}
