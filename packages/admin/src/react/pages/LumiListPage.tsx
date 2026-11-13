import type { ReactElement, ReactNode } from 'react'
import type { LumiDataGridProps } from './LumiDataGrid.js'
import type { LumiFilterBarProps } from './LumiFilterBar.js'
import type { LumiMetricCardProps } from './LumiMetricCard.js'
import type { LumiPageHeaderProps } from './LumiPage.js'
import type { LumiListStat } from './LumiStatStrip.js'
import type { LumiPageState } from './state.js'
import { LumiSelectionExtras, LumiPagination as Pagination, LumiSelectionBar as SelectionBar, useUiText } from '@duxweb/lumi-ui'
import { useEffect, useState } from 'react'
import { LumiColumnsMenu } from './LumiColumnsMenu.js'
import { gridSelection, LumiDataGrid } from './LumiDataGrid.js'
import { LumiFilterBar } from './LumiFilterBar.js'
import { LumiMetricCard } from './LumiMetricCard.js'
import { LumiPage, LumiPageHeader } from './LumiPage.js'
import { LumiPresetTabs } from './LumiPresetTabs.js'
import { LumiStatStrip } from './LumiStatStrip.js'

export interface LumiListPagePager {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  disabled?: boolean
  pageSizeOptions?: number[]
  onPageChange: LumiDataGridProps['onPageChange']
  onPageSizeChange?: LumiDataGridProps['onPageSizeChange']
}

export interface LumiListPageProps extends LumiPageHeaderProps {
  grid?: LumiDataGridProps
  /**
   * Replaces the data grid. Card and search lists share the list chrome
   * (title, filters, stats) but not the table.
   */
  results?: ReactNode
  /** Pagination for a custom `results` body. Ignored when `grid` is rendering. */
  pager?: LumiListPagePager
  filters?: LumiFilterBarProps
  /** What sits between the header and the results in place of `filters`, e.g. a FilterBar element of a JSON page. */
  toolbar?: ReactNode
  batchActions?: ReactNode
  state?: LumiPageState
  frameTitle?: string
  frameDescription?: string
  /**
   * Figures that summarise the rows below, shown as independent summary cards.
   * Use this or `kpis`, never both: they say the same thing at two scales.
   */
  stats?: readonly LumiListStat[]
  /** Standalone cards above the results, for figures the table only samples. */
  kpis?: readonly (LumiMetricCardProps & { key: string })[]
  /**
   * Offers the reader a column-visibility menu in the toolbar. Ignored when the
   * caller drives `grid.visibleColumns` itself, or when there is no grid.
   */
  columnsMenu?: boolean
  /** Rows behind the leading `All` view, shown as its count. */
  allCount?: number
  /** A side panel beside the results, e.g. a TreeFilter; it stacks above them on narrow screens. */
  aside?: ReactNode
}

/** Summary, filters and results each own a distinct surface. */
export function LumiListPage({ grid, results, pager, filters, toolbar, batchActions, state, frameTitle, frameDescription, stats, kpis, columnsMenu = true, allCount, aside, ...header }: LumiListPageProps): ReactElement {
  const { t } = useUiText()
  const showKpis = kpis && kpis.length > 0
  const showStats = !showKpis && stats && stats.length > 0
  const conflicting = Boolean(showKpis && stats && stats.length > 0)
  useEffect(() => {
    if (conflicting)
      console.warn('[lumi-admin] LumiListPage received both `stats` and `kpis`; rendering `kpis` only.')
  }, [conflicting])
  // Row actions are chrome, so they stay out of the column menu and out of the
  // hidden set the caller never asked about.
  const hideable = grid?.columns.filter(column => column.kind !== 'actions') ?? []
  const [visible, setVisible] = useState<string[]>(() => hideable.map(column => column.field))
  const managed = Boolean(grid) && columnsMenu && grid?.visibleColumns === undefined && hideable.length > 1
  const known = hideable.map(column => column.field).join('\u0000')
  useEffect(() => {
    setVisible(known === '' ? [] : known.split('\u0000'))
  }, [known])
  const visibleColumns = managed && grid
    ? [...visible, ...grid.columns.filter(column => column.kind === 'actions').map(column => column.field)]
    : grid?.visibleColumns
  const menu = managed ? <LumiColumnsMenu columns={hideable} value={visible} onChange={setVisible} /> : undefined
  // Saved views lead the results toolbar. The page title remains visible above
  // the surface so changing views never changes the page's identity.
  const presets = filters?.schema.presets
  const presetTabs = presets?.length && filters
    ? <LumiPresetTabs presets={presets} value={filters.value ?? {}} allCount={allCount} onChange={next => filters.onChange?.(next)} />
    : undefined
  const filterProps = filters && presets?.length
    ? { ...filters, schema: { ...filters.schema, presets: undefined } }
    : filters
  // A table always opens with its own band: saved views, or the result count,
  // on the left and the column menu on the right. The filter card then holds
  // filters only, and every list reads the same with or without presets.
  const viewsStart = presetTabs ?? (grid && grid.total !== undefined
    ? <span className="lumi-list-page__count" aria-live="polite">{t('lumi.list.count', '{count} records', { count: grid.total })}</span>
    : undefined)
  const showViews = Boolean(viewsStart || menu)
  const tools = filterProps
    ? <LumiFilterBar {...filterProps} />
    : toolbar
  // Selected rows take over the views row, so the bar lives here rather than in
  // the grid and the table below it never shifts.
  const selected = grid?.selectable ? grid.selectedKeys ?? [] : []
  const selectionBar = grid && selected.length > 0
    ? (
        <SelectionBar
          count={selected.length}
          actions={grid.bulkActions ?? []}
          selection={gridSelection(selected, grid.rows, grid.rowKey)}
          disabled={grid.loading || grid.disabled}
          onAction={action => grid.onBulkAction?.({ action, keys: [...selected] })}
          onClear={() => grid.onSelectionChange?.([])}
        />
      )
    : undefined
  const batch = batchActions ?? selectionBar
  const title = frameTitle ?? header.title
  const description = frameDescription ?? header.description
  const surface = <ListSurface grid={grid} results={results} pager={pager} batch={batch} showViews={showViews} viewsStart={viewsStart} menu={menu} visibleColumns={visibleColumns} title={title} />
  return (
    <LumiPage className="lumi-list-page" state={state} ariaLabel={header.title}>
      <LumiPageHeader
        title={title}
        description={description}
        actions={header.actions}
        meta={header.meta}
      />
      {showKpis && (
        <div className="lumi-metric-cards" data-scale="sm">
          {kpis.map(({ key, ...card }) => <LumiMetricCard key={key} {...card} scale="sm" />)}
        </div>
      )}
      {showStats && <LumiStatStrip items={stats} />}
      {tools && <div className="lumi-list-page__toolbar">{tools}</div>}
      {aside
        ? (
            <div className="lumi-list-page__layout">
              <aside className="lumi-list-page__aside">{aside}</aside>
              {surface}
            </div>
          )
        : surface}
    </LumiPage>
  )
}

function ListSurface({ grid, results, pager, batch, showViews, viewsStart, menu, visibleColumns, title }: {
  grid?: LumiDataGridProps
  results?: ReactNode
  pager?: LumiListPagePager
  batch?: ReactNode
  showViews: boolean
  viewsStart?: ReactNode
  menu?: ReactNode
  visibleColumns?: LumiDataGridProps['visibleColumns']
  title?: string
}): ReactElement {
  const { t } = useUiText()
  return (
    <section className="lumi-list-page__surface" data-layout={grid ? 'table' : 'custom'} aria-label={t('lumi.list.resultsOf', '{title} results', { title })}>
      {/* A selection takes over the views row, so the table never shifts. */}
      {batch
        ? <div className="lumi-list-page__batch">{batch}</div>
        : showViews && (
          <div className="lumi-list-page__views">
            {viewsStart ?? <span />}
            {menu && <div className="lumi-list-page__views-end">{menu}</div>}
          </div>
        )}
      {results
        ? <div className="lumi-list-page__results">{results}</div>
        : grid && (
          // The list draws the selection bar in its views row; the grid must not draw another.
          <LumiSelectionExtras extras={[]}>
            <LumiDataGrid {...grid} bulkActions={undefined} visibleColumns={visibleColumns} />
          </LumiSelectionExtras>
        )}
      {results && pager && (
        <div className="lumi-data-grid__pagination">
          <Pagination
            page={pager.page}
            pageSize={pager.pageSize}
            total={pager.total}
            disabled={pager.loading || pager.disabled}
            pageSizeOptions={pager.pageSizeOptions}
            ariaLabel={t('lumi.list.pagination', 'Results pagination')}
            showTotal
            onPageChange={pager.onPageChange}
            onPageSizeChange={pager.onPageSizeChange}
          />
        </div>
      )}
    </section>
  )
}
