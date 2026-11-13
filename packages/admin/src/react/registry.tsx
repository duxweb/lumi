import type { BaseComponentProps } from '@json-render/react'
import type { ReactElement } from 'react'
import type { z } from 'zod'
import { composeDefinitions, connectOptions, connectTree, connectUpload, lumiRegistry, useForm, useLumiSpec, useOne, useTable } from '@duxweb/lumi'
import { connectPromptInput, LumiAutoComplete, LumiCascader, LumiCascaderPanel, LumiImageGrid, LumiMention, LumiMultiSelect, LumiSelect, LumiTransfer, LumiTree, LumiTreeSelect, LumiUpload, rowActionsRenderer, uiRegistry, useUiText } from '@duxweb/lumi-ui'
import { chartRegistry } from '@duxweb/lumi-ui/charts'
import { defineCatalog } from '@json-render/core'
import {
  defineRegistry,
  useBoundProp,
  useValidation,
  ValidationProvider,
} from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { useMemo } from 'react'
import {
  adminCatalogDefinitions,
  adminComponentDefinitions,
} from '../catalog/index.js'
import { AdminPromptMentionPicker, AgentMentionPickerBody } from './agent-mention.js'
import { AssistantContextElement } from './assistant-context.js'
import { AdminInclude } from './include.js'
import { LumiAgentWorkspace } from './pages/LumiAgentWorkspace.js'
import { LumiArticle } from './pages/LumiArticle.js'
import { LumiAuditLog } from './pages/LumiAuditLog.js'
import { LumiBarChart } from './pages/LumiBarChart.js'
import { LumiDashboardCard } from './pages/LumiDashboardCard.js'
import { LumiDashboardPage } from './pages/LumiDashboardPage.js'
import { LumiDataGrid } from './pages/LumiDataGrid.js'
import { LumiDetailPage } from './pages/LumiDetailPage.js'
import { exampleSpec, LumiExample } from './pages/LumiExample.js'
import { LumiFilterBar } from './pages/LumiFilterBar.js'
import { LumiFormPage } from './pages/LumiFormPage.js'
import { LumiFunnelChart } from './pages/LumiFunnelChart.js'
import { LumiKanban } from './pages/LumiKanban.js'
import { LumiListPage } from './pages/LumiListPage.js'
import { LumiMatrixChart } from './pages/LumiMatrixChart.js'
import { LumiMetricCard } from './pages/LumiMetricCard.js'
import { LumiPage, LumiPageHeader } from './pages/LumiPage.js'
import { LumiPageFrame } from './pages/LumiPageFrame.js'
import { LumiPipeline } from './pages/LumiPipeline.js'
import { LumiProportionList } from './pages/LumiProportionList.js'
import { LumiRecordList } from './pages/LumiRecordList.js'
import { LumiScheduleCalendar } from './pages/LumiScheduleCalendar.js'
import { LumiSegmented } from './pages/LumiSegmented.js'
import { LumiSettingsForm } from './pages/LumiSettingsForm.js'
import { LumiSettingsPage } from './pages/LumiSettingsPage.js'
import { LumiSkuEditor } from './pages/LumiSkuEditor.js'
import { LumiStatStrip } from './pages/LumiStatStrip.js'
import { LumiEmptyState } from './pages/state.js'
import { RecordPickerBody, TreeFilterBody } from './tree-fields.js'

export const adminCatalog = defineCatalog(schema, adminCatalogDefinitions)
const pageCatalog = defineCatalog(schema, {
  components: {
    ...adminComponentDefinitions,
    Upload: adminCatalogDefinitions.components.Upload,
    ImageGrid: adminCatalogDefinitions.components.ImageGrid,
    Tree: adminCatalogDefinitions.components.Tree,
    TreeSelect: adminCatalogDefinitions.components.TreeSelect,
    Cascader: adminCatalogDefinitions.components.Cascader,
    CascaderPanel: adminCatalogDefinitions.components.CascaderPanel,
    Select: adminCatalogDefinitions.components.Select,
    MultiSelect: adminCatalogDefinitions.components.MultiSelect,
    AutoComplete: adminCatalogDefinitions.components.AutoComplete,
    Mention: adminCatalogDefinitions.components.Mention,
    Transfer: adminCatalogDefinitions.components.Transfer,
    PromptInput: adminCatalogDefinitions.components.PromptInput,
    AgentMentionPicker: adminCatalogDefinitions.components.AgentMentionPicker,
  },
  actions: {},
})
const { registry: pages } = defineRegistry(pageCatalog, {
  components: {
    DashboardPage: ({ props, children, slots }) => (
      <LumiDashboardPage {...props} {...slots}>
        {children}
      </LumiDashboardPage>
    ),
    DetailPage: ({ props, children, slots }) => (
      <LumiDetailPage {...props} {...slots}>
        {children}
      </LumiDetailPage>
    ),
    EmptyState: ({ props, slots }) => <LumiEmptyState {...props} {...slots} />,
    SettingsPage: ({ props, children, slots, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      return (
        <LumiSettingsPage
          {...props}
          {...slots}
          sections={props.sections.map(section => ({
            ...section,
            content: section.content ?? children,
          }))}
          value={value}
          onChange={(next) => {
            setValue(next)
            emit('change')
          }}
        />
      )
    },
    FilterBar: ({ props, slots, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      return (
        <LumiFilterBar
          {...props}
          {...slots}
          value={value}
          onChange={(next) => {
            setValue(next)
            emit('change')
          }}
        />
      )
    },
    DataGrid: ({ props, bindings, emit, slots }) => {
      const [page, setPage] = useBoundProp(props.page, bindings?.page)
      const [pageSize, setPageSize] = useBoundProp(
        props.pageSize,
        bindings?.pageSize,
      )
      const [sorters, setSorters] = useBoundProp(
        props.sorters,
        bindings?.sorters,
      )
      const [selectedKeys, select] = useBoundProp(
        props.selectedKeys,
        bindings?.selectedKeys,
      )
      const [, row] = useBoundProp(props.activeRow, bindings?.activeRow)
      const [, action] = useBoundProp(
        props.activeAction,
        bindings?.activeAction,
      )
      return (
        <LumiDataGrid
          {...props}
          page={page ?? props.page}
          pageSize={pageSize ?? props.pageSize}
          sorters={sorters}
          selectedKeys={selectedKeys}
          onPageChange={(next) => {
            setPage(next)
            emit('pageChange')
          }}
          onPageSizeChange={(next) => {
            setPageSize(next)
            emit('pageSizeChange')
          }}
          onSort={(next) => {
            setSorters(next)
            emit('sort')
          }}
          onSelectionChange={(next) => {
            select(next)
            emit('selectionChange')
          }}
          onRowClick={(next) => {
            row(next)
            emit('rowClick')
          }}
          onRowAction={(next) => {
            row(next.row)
            action(next.action)
            emit('rowAction')
          }}
          onBulkAction={(next) => {
            action(next.action)
            emit('bulkAction')
          }}
          renderRowActions={rowActionsRenderer(slots?.rowActions, row, bindings?.rows)}
        />
      )
    },
    Page: ({ props, children }) => <LumiPage {...props}>{children}</LumiPage>,
    PageHeader: ({ props, slots }) => <LumiPageHeader {...props} {...slots} />,
    PageFrame: ({ props, children, slots }) => (
      <LumiPageFrame {...props} {...slots}>
        {children}
      </LumiPageFrame>
    ),
    Example: ExampleBody,
    Upload: connectUpload(LumiUpload),
    ImageGrid: connectUpload(LumiImageGrid),
    Tree: connectTree(LumiTree, { expanded: true }),
    TreeSelect: connectTree(LumiTreeSelect),
    Cascader: connectTree(LumiCascader, { itemsProp: 'options' }),
    CascaderPanel: connectTree(LumiCascaderPanel, { itemsProp: 'options' }),
    Select: connectOptions(LumiSelect),
    MultiSelect: connectOptions(LumiMultiSelect, { mode: 'multiple' }),
    AutoComplete: connectOptions(LumiAutoComplete, { mode: 'text', events: { onSelect: 'select' } }),
    Mention: connectOptions(LumiMention, { mode: 'text', events: { onSelect: 'select' } }),
    Transfer: connectOptions(LumiTransfer, { mode: 'multiple' }),
    PromptInput: connectPromptInput(AdminPromptMentionPicker),
    AgentMentionPicker: AgentMentionPickerBody,
    AgentWorkspace: ({ props }) => <LumiAgentWorkspace {...props} />,
    TreeFilter: TreeFilterBody,
    RecordPicker: RecordPickerBody,
    AssistantContext: AssistantContextElement,
    AuditLog: ({ props }) => <LumiAuditLog {...props} />,
    Include: ({ props }) => <AdminInclude src={props.src} params={props.params} />,
    ListPage: ({ props, bindings, emit, slots }) => {
      // The element's flat `pageSize` is the hook's first page size.
      const { pageSize, ...rest } = props
      const table = useTable({ ...rest, ...(pageSize ? { pagination: { pageSize } } : {}) })
      const [selectedKeys, select] = useBoundProp(
        props.selectedKeys,
        bindings?.selectedKeys,
      )
      const { t } = useUiText()
      const [, row] = useBoundProp(props.activeRow, bindings?.activeRow)
      const [, action] = useBoundProp(
        props.activeAction,
        bindings?.activeAction,
      )
      return (
        <LumiListPage
          title={props.title}
          description={props.description}
          state={props.state}
          actions={slots?.actions}
          aside={slots?.aside}
          toolbar={slots?.toolbar}
          grid={{
            rows: table.rows,
            columns: props.columns,
            rowKey: props.rowKey,
            page: table.page,
            pageSize: table.pageSize,
            total: table.total,
            loading: table.query.isPending,
            sorters: table.sorters,
            selectedKeys,
            selectable: props.selectable,
            bulkActions: props.bulkActions,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
            onSort: table.setSorters,
            onSelectionChange: (values) => {
              select(values)
              emit('selectionChange')
            },
            onRowClick: (value) => {
              row(value)
              emit('rowClick')
            },
            onRowAction: (value) => {
              row(value.row)
              action(value.action)
              emit('rowAction')
            },
            onBulkAction: (value) => {
              action(value.action)
              emit('bulkAction')
            },
            renderRowActions: rowActionsRenderer(slots?.rowActions, row),
            state: table.query.error
              ? {
                  kind: 'error',
                  title: t('lumi.list.loadFailed', 'Could not load records'),
                  reason: table.query.error.message,
                  nextStep: t('lumi.page.tryRefresh', 'Try refreshing the page.'),
                }
              : undefined,
          }}
        />
      )
    },
    FormPage: context => (
      <ValidationProvider>
        <NativeFormPage {...context} />
      </ValidationProvider>
    ),
    SettingsForm: NativeSettingsForm,
    DashboardCard: ({ props, children, slots }) => (
      <LumiDashboardCard {...props} action={slots?.action} footer={slots?.footer}>
        {children}
      </LumiDashboardCard>
    ),
    MetricCard: ({ props }) => <LumiMetricCard {...props} />,
    StatStrip: ({ props }) => <LumiStatStrip {...props} />,
    MatrixChart: ({ props }) => <LumiMatrixChart {...props} />,
    BarChart: ({ props }) => <LumiBarChart {...props} />,
    ProportionList: ({ props }) => <LumiProportionList {...props} />,
    RecordList: ({ props }) => <LumiRecordList {...props} />,
    Article: ({ props, children, slots }) => <LumiArticle {...props} {...slots}>{children}</LumiArticle>,
    Pipeline: ({ props }) => <LumiPipeline {...props} />,
    FunnelChart: ({ props }) => <LumiFunnelChart {...props} />,
    Segmented: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      return (
        <LumiSegmented
          {...props}
          value={value ?? props.value}
          onChange={(next) => {
            setValue(next)
            emit('change')
          }}
        />
      )
    },
    SkuEditor: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      const [errors, setErrors] = useBoundProp(props.errors, bindings?.errors)
      return (
        <LumiSkuEditor
          {...props}
          value={value}
          errors={errors}
          onErrorsChange={bindings?.errors ? setErrors : undefined}
          onChange={(next) => {
            setValue(next)
            emit('change')
          }}
        />
      )
    },
    Kanban: ({ props, bindings, emit }) => {
      const { value: _value, move: _move, activeColumn: _column, activeCard: _card, ...rest } = props
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      const [, setMove] = useBoundProp(props.move, bindings?.move)
      const [, setColumn] = useBoundProp(props.activeColumn, bindings?.activeColumn)
      const [, setCard] = useBoundProp(props.activeCard, bindings?.activeCard)
      return (
        <LumiKanban
          {...rest}
          value={value ?? props.value}
          onValueChange={next => setValue(next as typeof props.value)}
          onMove={(next) => {
            setMove(next)
            emit('move')
          }}
          onAdd={(next) => {
            setColumn(next)
            emit('add')
          }}
          onCardClick={(next) => {
            setCard(next.id)
            emit('cardClick')
          }}
        />
      )
    },
    ScheduleCalendar: ({ props, bindings, emit }) => {
      const { view: _view, date: _date, activeDate: _day, activeEvent: _event, ...rest } = props
      const [view, setView] = useBoundProp(props.view, bindings?.view)
      const [date, setDate] = useBoundProp(props.date, bindings?.date)
      const [, setDay] = useBoundProp(props.activeDate, bindings?.activeDate)
      const [, setEvent] = useBoundProp(props.activeEvent, bindings?.activeEvent)
      return (
        <LumiScheduleCalendar
          {...rest}
          view={view}
          date={date}
          onViewChange={(next) => {
            setView(next)
            emit('viewChange')
          }}
          onDateChange={(next) => {
            setDate(next)
            emit('dateChange')
          }}
          onDayClick={(next) => {
            setDay(next)
            emit('dayClick')
          }}
          onEventClick={(next) => {
            setEvent(next.id)
            emit('eventClick')
          }}
        />
      )
    },
  },
})
// Admin pages replace the plain UI Upload and ImageGrid with the service-connected ones.
export const adminRegistry = composeDefinitions(
  lumiRegistry,
  uiRegistry,
  chartRegistry,
  pages,
  { override: ['Upload', 'ImageGrid', 'Tree', 'TreeSelect', 'Cascader', 'CascaderPanel', 'Select', 'MultiSelect', 'AutoComplete', 'Mention', 'Transfer', 'PromptInput', 'AgentMentionPicker'] },
)

function ExampleBody({ props, children }: BaseComponentProps<z.input<typeof adminComponentDefinitions.Example.props>>): ReactElement {
  const spec = useLumiSpec()
  const source = useMemo(() => {
    const example = spec && exampleSpec(spec, props.id)
    return example && JSON.stringify(example, null, 2)
  }, [spec, props.id])
  return <LumiExample {...props} source={source}>{children}</LumiExample>
}

function NativeFormPage({
  props,
  children,
  emit,
  slots,
}: BaseComponentProps<
  z.input<typeof adminComponentDefinitions.FormPage.props>
>): ReactElement {
  const { t } = useUiText()
  const validation = useValidation()
  const record = useOne({
    resource: props.resource,
    id: props.id,
    dataProviderName: props.dataProviderName,
    meta: props.meta,
    enabled: props.id !== undefined,
  })
  const form = useForm({
    ...props,
    initialValues: props.initialValues ?? record.data?.data,
  })
  const state
    = props.id !== undefined && record.isPending
      ? { kind: 'loading' as const }
      : record.error
        ? {
            kind: 'error' as const,
            title: t('lumi.detail.loadFailed', 'Could not load record'),
            reason: record.error.message,
            nextStep: t('lumi.page.tryRefresh', 'Try refreshing the page.'),
          }
        : props.state
  return (
    <LumiFormPage
      title={props.title}
      description={props.description}
      layout={props.layout}
      saveLabel={props.saveLabel}
      state={state}
      form={form}
      aside={slots?.aside}
      actions={slots?.actions}
      beforeSubmit={() => validation.validateAll()}
      onSaved={() => emit('saved')}
    >
      {children}
    </LumiFormPage>
  )
}

function NativeSettingsForm({
  props,
  children,
  emit,
}: BaseComponentProps<
  z.input<typeof adminComponentDefinitions.SettingsForm.props>
>): ReactElement {
  const loads = props.id !== undefined && props.initialValues === undefined
  const record = useOne<Record<string, unknown>>({
    resource: props.resource,
    id: props.id,
    dataProviderName: props.dataProviderName,
    meta: props.meta,
    enabled: loads,
  })
  const data = record.data?.data
  const loaded = data && props.fields
    ? Object.fromEntries(props.fields.map(field => [field, data[field]]))
    : data
  const form = useForm({
    resource: props.resource,
    id: props.id,
    dataProviderName: props.dataProviderName,
    meta: props.meta,
    valuesPath: props.valuesPath,
    rules: props.rules as Parameters<typeof useForm>[0]['rules'],
    initialValues: props.initialValues ?? loaded,
  })
  return (
    <LumiSettingsForm
      form={form}
      label={props.title}
      description={props.description}
      columns={props.columns}
      saveMode={props.saveMode}
      saveLabel={props.saveLabel}
      disabled={loads && record.isPending}
      onSaved={() => emit('saved')}
    >
      {children}
    </LumiSettingsForm>
  )
}
