import type { ValidationCheck } from '@json-render/core'
import type { BaseComponentProps } from '@json-render/react'
import type { ComponentType, ReactElement } from 'react'
import { defineCatalog } from '@json-render/core'
import {
  defineRegistry,
  useBoundProp,
  useFieldValidation,
  useRepeatScope,
  useValidation,
  ValidationProvider,
} from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { Children, useMemo } from 'react'
import { uiComponentDefinitions } from '../catalog/index.js'
import { LumiActivityFeed } from '../components/activity-feed.js'
import { LumiAutoComplete } from '../components/autocomplete.js'
import { LumiAvatar, LumiAvatarGroup } from '../components/avatar.js'
import {
  LumiButton,
  LumiCard,
  LumiFragment,
  LumiGrid,
  LumiHeading,
  LumiProgress,
  LumiSeparator,
  LumiStack,
  LumiTabs,
} from '../components/base.js'
import { LumiBreadcrumb } from '../components/breadcrumb.js'
import { LumiCalendar } from '../components/calendar.js'
import { LumiCarousel } from '../components/carousel.js'
import { LumiCascaderPanel } from '../components/cascader-panel.js'
import { LumiCascader } from '../components/cascader.js'
import { LumiCheckboxCards, LumiRadioCards } from '../components/choice-cards.js'
import { LumiCodeBlock } from '../components/code-block.js'
import { LumiCodeEditor } from '../components/code-editor.js'
import { LumiColorPicker } from '../components/color-picker.js'
import { LumiColorSwatches } from '../components/color-swatches.js'
import { LumiHtml, LumiMarkdownContent, LumiProse } from '../components/content.js'
import {
  LumiCheckbox,
  LumiCheckboxGroup,
  LumiImageGrid,
  LumiInput,
  LumiMultiSelect,
  LumiNumberInput,
  LumiRadioGroup,
  LumiRichText,
  LumiSelect,
  LumiSwitch,
  LumiTagsInput,
  LumiTextarea,
  LumiUpload,
} from '../components/controls.js'
import { LumiDatePicker, LumiDateRangePicker, LumiDateTimePicker, LumiTimePicker } from '../components/datetime.js'
import { LumiAlert, LumiBadge, LumiDescriptionList, LumiPagination, LumiTable, LumiText } from '../components/display.js'
import { LumiEmpty } from '../components/empty.js'
import {
  LumiFilters,
  LumiFrame,
  LumiStepper,
  LumiTimeline,
} from '../components/extensions.js'
import { LumiForm, LumiFormField } from '../components/form.js'
import { LumiIconPicker } from '../components/icon-picker.js'
import { LumiIframe } from '../components/iframe.js'
import { LumiInputOTP } from '../components/input-otp.js'
import { LumiAccordion, LumiMenu, LumiTooltip } from '../components/interactive.js'
import { LumiKbd } from '../components/kbd.js'
import { LumiListbox } from '../components/listbox.js'
import { LumiImage, LumiLightbox } from '../components/media.js'
import { LumiMention } from '../components/mention.js'
import { LumiDialog, LumiDrawer } from '../components/overlays.js'
import { LumiPopconfirm, LumiPopover } from '../components/popover.js'
import { LumiRating } from '../components/rating.js'
import { LumiRepeater, LumiRepeaterRow } from '../components/repeater.js'
import { LumiScrollArea } from '../components/scroll-area.js'
import { LumiSignaturePad } from '../components/signature-pad.js'
import { LumiSkeleton } from '../components/skeleton.js'
import { LumiSlider } from '../components/slider.js'
import { LumiLoading, LumiSpinner } from '../components/spinner.js'
import { LumiTagSelect } from '../components/tag-select.js'
import { LumiTag, LumiTagGroup } from '../components/tag.js'
import { LumiTransfer } from '../components/transfer.js'
import { LumiTreeSelect } from '../components/tree-select.js'
import { LumiTree } from '../components/tree.js'
import { LumiIcon } from '../icons.js'
import { agentRegistryComponents } from './agent-registry.js'
import { rowActionsRenderer } from './row-actions.js'

const ICON_SIZE = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const
const ICON_TONE = { default: 'text-current', muted: 'text-muted-foreground', brand: 'text-brand', success: 'text-[color:var(--lumi-text-success)]', warning: 'text-[color:var(--lumi-text-warning)]', danger: 'text-destructive', info: 'text-[color:var(--lumi-ui-tone-info)]' } as const

export const uiCatalog = defineCatalog(schema, {
  components: uiComponentDefinitions,
  actions: {},
})

function display(Component: ComponentType<any>) {
  return ({ props, children, slots }: BaseComponentProps) => (
    <Component {...props} {...slots}>
      {children}
    </Component>
  )
}

/** `events` maps a host callback prop to the catalog event it emits, beyond `change`. */
/**
 * Binds a control's `value` to the StateStore. `field: false` marks a bound
 * control that is not a form field (tabs, steppers): it gets no validation
 * props, which it would otherwise pass to the DOM.
 */
function control(Component: ComponentType<any>, events: Record<string, string> = {}, { field = true }: { field?: boolean } = {}) {
  return function BoundControl({
    props,
    bindings,
    emit,
    children,
    slots,
  }: BaseComponentProps): ReactElement {
    const { checks, ...rest } = props
    const [value, setValue] = useBoundProp(props.value, bindings?.value)
    const config = useMemo(
      () => (checks ? { checks: checks as ValidationCheck[] } : undefined),
      [checks],
    )
    const validation = useFieldValidation(bindings?.value ?? '', config)
    const handlers = Object.fromEntries(Object.entries(events).map(([prop, event]) => [prop, () => emit(event)]))
    // An unbound control with no value stays uncontrolled, so its
    // `defaultValue` applies; some controls treat a present `value` key as
    // controlled even when it is undefined.
    const controlled = bindings?.value !== undefined || props.value !== undefined
    // Controls name themselves through `ariaLabel`; the native `aria-label` a
    // Spec may write instead means the same.
    const named = rest.ariaLabel ?? rest['aria-label']
    return (
      <Component
        {...rest}
        {...(named === undefined ? {} : { ariaLabel: named })}
        {...slots}
        {...handlers}
        {...(controlled ? { value } : {})}
        {...(field ? { invalid: props.invalid || !validation.isValid, error: props.error ?? validation.errors[0] } : {})}
        onChange={(next: unknown) => {
          setValue(next)
          emit('change')
        }}
      >
        {Children.count(children) ? children : undefined}
      </Component>
    )
  }
}

/**
 * A select whose options arrive in pages: with `hasMore` it emits `loadMore`
 * when the list is scrolled to its end. Without it the select stays as it is,
 * since a load handler alone changes how the control draws its list.
 */
function pageable(Component: ComponentType<any>) {
  const Paged = control(Component, { onLoadMore: 'loadMore' })
  const Plain = control(Component)
  return (args: BaseComponentProps): ReactElement => (args.props.hasMore === undefined ? <Plain {...args} /> : <Paged {...args} />)
}

const BoundTree = control(LumiTree)

function TreeBody(args: BaseComponentProps): ReactElement {
  const { props, bindings, emit } = args
  const [expanded, setExpanded] = useBoundProp(props.expandedValue, bindings?.expandedValue)
  const tracked = bindings?.expandedValue !== undefined || props.expandedValue !== undefined
  return (
    <BoundTree
      {...args}
      props={{
        ...props,
        ...(tracked ? { expandedValue: expanded ?? [] } : {}),
        onExpandedChange: (next: unknown) => {
          setExpanded(next)
          emit('expandedChange')
        },
      }}
    />
  )
}

function FormBody({ props, emit, children }: BaseComponentProps): ReactElement {
  const validation = useValidation()
  return (
    <LumiForm
      {...props}
      onSubmit={() => {
        if (validation.validateAll())
          emit('submit')
      }}
    >
      {children}
    </LumiForm>
  )
}

export const { registry: uiRegistry } = defineRegistry(uiCatalog, {
  components: {
    ...agentRegistryComponents,
    Skeleton: ({ props }) => <LumiSkeleton {...props} />,
    Spinner: ({ props }) => <LumiSpinner {...props} />,
    Loading: ({ props }) => <LumiLoading {...props} />,
    Empty: display(LumiEmpty),
    Kbd: ({ props }) => <LumiKbd {...props} />,
    ScrollArea: ({ props, children }) => <LumiScrollArea {...props}>{children}</LumiScrollArea>,
    Tag: ({ props, bindings, emit }) => {
      const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked)
      return (
        <LumiTag
          {...props}
          checked={checked ?? false}
          onClose={() => emit('close')}
          onCheckedChange={(next) => {
            setChecked(next)
            emit('change')
          }}
        />
      )
    },
    TagGroup: control(LumiTagGroup, {}, { field: false }),
    Calendar: control(LumiCalendar),
    Listbox: control(LumiListbox),
    Fragment: display(LumiFragment),
    Button: ({ props, emit }) => (
      <LumiButton {...props} onClick={() => emit('press')} />
    ),
    Card: display(LumiCard),
    Badge: display(LumiBadge),
    Icon: ({ props }) => {
      const { size, tone, label, ...rest } = props
      return <LumiIcon {...rest} label={label ?? undefined} data-size={size ?? 'md'} data-tone={tone ?? 'default'} className={[ICON_SIZE[size ?? 'md'], ICON_TONE[tone ?? 'default'], rest.className].filter(Boolean).join(' ')} />
    },
    Stack: ({ props, children }) => <LumiStack {...props}>{children}</LumiStack>,
    Grid: ({ props, children }) => <LumiGrid {...props}>{children}</LumiGrid>,
    Progress: ({ props }) => <LumiProgress {...props} />,
    Separator: ({ props }) => <LumiSeparator {...props} />,
    Heading: ({ props }) => <LumiHeading {...props} />,
    Text: ({ props }) => <LumiText {...props} />,
    Avatar: ({ props }) => <LumiAvatar {...props} />,
    AvatarGroup: ({ props }) => <LumiAvatarGroup {...props} />,
    CodeBlock: ({ props }) => <LumiCodeBlock {...props} />,
    Prose: ({ props, children }) => <LumiProse {...props}>{children}</LumiProse>,
    Markdown: ({ props }) => <LumiMarkdownContent {...props} />,
    Html: ({ props }) => <LumiHtml {...props} />,
    CodeEditor: control(LumiCodeEditor),
    Alert: ({ props, emit }) => (
      <LumiAlert {...props} onClose={() => emit('close')} />
    ),
    Input: control(LumiInput),
    Textarea: control(LumiTextarea),
    RichText: control(LumiRichText),
    NumberInput: control(LumiNumberInput),
    Select: pageable(LumiSelect),
    MultiSelect: pageable(LumiMultiSelect),
    Checkbox: control(LumiCheckbox),
    CheckboxGroup: control(LumiCheckboxGroup),
    RadioGroup: control(LumiRadioGroup),
    Switch: control(LumiSwitch),
    DatePicker: control(LumiDatePicker),
    Cascader: control(LumiCascader),
    CascaderPanel: control(LumiCascaderPanel),
    TreeSelect: control(LumiTreeSelect),
    Tree: TreeBody,
    TimePicker: control(LumiTimePicker),
    DateTimePicker: control(LumiDateTimePicker),
    DateRangePicker: control(LumiDateRangePicker),
    FormField: control(LumiFormField),
    Form: context => (
      <ValidationProvider>
        <FormBody {...context} />
      </ValidationProvider>
    ),
    DescriptionList: display(LumiDescriptionList),
    Frame: display(LumiFrame),
    Filters: control(LumiFilters),
    Tabs: control(LumiTabs, {}, { field: false }),
    Stepper: control(LumiStepper, {}, { field: false }),
    Timeline: display(LumiTimeline),
    ActivityFeed: ({ props }) => <LumiActivityFeed {...props} />,
    Upload: control(LumiUpload),
    TagsInput: control(LumiTagsInput),
    AutoComplete: control(LumiAutoComplete, { onSelect: 'select' }),
    Mention: control(LumiMention, { onSelect: 'select' }),
    Transfer: control(LumiTransfer),
    Slider: control(LumiSlider),
    RadioCards: control(LumiRadioCards),
    CheckboxCards: control(LumiCheckboxCards),
    TagSelect: control(LumiTagSelect),
    Rating: control(LumiRating),
    ColorPicker: control(LumiColorPicker),
    ColorSwatches: control(LumiColorSwatches),
    InputOTP: control(LumiInputOTP, { onComplete: 'complete' }),
    SignaturePad: control(LumiSignaturePad),
    IconPicker: control(LumiIconPicker),
    ImageGrid: control(LumiImageGrid),
    Repeater: ({ props, bindings, emit, children }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      const [errors, setErrors] = useBoundProp(props.errors, bindings?.errors)
      return (
        <LumiRepeater
          {...props}
          value={value ?? []}
          errors={errors}
          onErrorsChange={bindings?.errors ? setErrors : undefined}
          onChange={(next) => {
            setValue(next)
            emit('change')
          }}
        >
          {children}
        </LumiRepeater>
      )
    },
    RepeaterRow: ({ props, children }) => {
      const scope = useRepeatScope()
      return <LumiRepeaterRow {...props} index={scope?.index ?? 0}>{children}</LumiRepeaterRow>
    },
    Tooltip: ({ props, children }) => <LumiTooltip {...props}>{children}</LumiTooltip>,
    Popover: ({ props, bindings, emit, children, slots }) => {
      const [open, setOpen] = useBoundProp(props.open, bindings?.open)
      return (
        <LumiPopover
          {...props}
          {...slots}
          open={bindings?.open ? Boolean(open) : props.open}
          onOpenChange={(value) => {
            setOpen(value)
            emit('openChange')
          }}
          onConfirm={() => emit('confirm')}
          onCancel={() => emit('cancel')}
        >
          {Children.count(children) ? children : undefined}
        </LumiPopover>
      )
    },
    Popconfirm: ({ props, bindings, emit, children }) => {
      const [open, setOpen] = useBoundProp(props.open, bindings?.open)
      return (
        <LumiPopconfirm
          {...props}
          open={bindings?.open ? Boolean(open) : props.open}
          onOpenChange={(value) => {
            setOpen(value)
            emit('openChange')
          }}
          onConfirm={() => emit('confirm')}
          onCancel={() => emit('cancel')}
        >
          {Children.count(children) ? children : undefined}
        </LumiPopconfirm>
      )
    },
    Image: ({ props }) => <LumiImage {...props} />,
    Iframe: ({ props }) => <LumiIframe {...props} />,
    Lightbox: ({ props, bindings, emit }) => {
      const [open, setOpen] = useBoundProp(props.open, bindings?.open)
      const [index, setIndex] = useBoundProp(props.index, bindings?.index)
      return (
        <LumiLightbox
          {...props}
          open={bindings?.open ? Boolean(open) : props.open}
          index={bindings?.index ? (index ?? 0) : props.index}
          onOpenChange={(value) => {
            setOpen(value)
            emit('openChange')
          }}
          onIndexChange={(value) => {
            setIndex(value)
            emit('change')
          }}
        />
      )
    },
    Carousel: ({ props, bindings, emit, children }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value)
      return (
        <LumiCarousel
          {...props}
          value={bindings?.value ? value : props.value}
          onChange={(next) => {
            setValue(next)
            emit('change')
          }}
        >
          {children}
        </LumiCarousel>
      )
    },
    Breadcrumb: ({ props, bindings, emit }) => {
      const [, setValue] = useBoundProp(props.value, bindings?.value)
      return (
        <LumiBreadcrumb
          {...props}
          onSelect={(key) => {
            setValue(key)
            emit('select')
          }}
        />
      )
    },
    Accordion: ({ props }) => <LumiAccordion {...props} />,
    Menu: ({ props, bindings, emit }) => {
      const [, setValue] = useBoundProp(props.value, bindings?.value)
      return (
        <LumiMenu
          {...props}
          onSelect={(key) => {
            setValue(key)
            emit('select')
          }}
        />
      )
    },
    Pagination: ({ props, bindings, emit }) => {
      const [page, setPage] = useBoundProp(props.page, bindings?.page)
      const [pageSize, setPageSize] = useBoundProp(
        props.pageSize,
        bindings?.pageSize,
      )
      return (
        <LumiPagination
          {...props}
          page={page ?? 1}
          pageSize={pageSize ?? 10}
          onPageChange={(value) => {
            setPage(value)
            emit('pageChange')
          }}
          onPageSizeChange={(value) => {
            setPageSize(value)
            emit('pageSizeChange')
          }}
        />
      )
    },
    Table: ({ props, bindings, emit, slots }) => {
      const [, setRow] = useBoundProp(props.activeRow, bindings?.activeRow)
      const [, setAction] = useBoundProp(
        props.activeAction,
        bindings?.activeAction,
      )
      const [sorters, setSorters] = useBoundProp(
        props.sorters,
        bindings?.sorters,
      )
      const [selectedKeys, setSelectedKeys] = useBoundProp(
        props.selectedKeys,
        bindings?.selectedKeys,
      )
      const { activeRow, activeAction, ...rest } = props
      return (
        <LumiTable
          {...rest}
          sorters={sorters}
          selectedKeys={selectedKeys}
          onSort={(value) => {
            setSorters(value)
            emit('sort')
          }}
          onSelectionChange={(value) => {
            setSelectedKeys(value)
            emit('selectionChange')
          }}
          onRowClick={(row) => {
            setRow(row)
            emit('rowClick')
          }}
          onRowAction={({ row, action }) => {
            setRow(row)
            setAction(action)
            emit('rowAction')
          }}
          onBulkAction={({ action }) => {
            setAction(action)
            emit('bulkAction')
          }}
          renderRowActions={rowActionsRenderer(slots?.rowActions, setRow, bindings?.rows)}
        />
      )
    },
    Dialog: ({ props, bindings, emit, children, slots }) => {
      const [open, setOpen] = useBoundProp(props.open, bindings?.open)
      return (
        <LumiDialog
          {...props}
          {...slots}
          open={open}
          onOpenChange={(value) => {
            setOpen(value)
            emit('openChange')
          }}
          onConfirm={() => emit('confirm')}
          onCancel={() => emit('cancel')}
        >
          {children}
        </LumiDialog>
      )
    },
    Drawer: ({ props, bindings, emit, children, slots }) => {
      const [open, setOpen] = useBoundProp(props.open, bindings?.open)
      return (
        <LumiDrawer
          {...props}
          {...slots}
          open={open}
          onOpenChange={(value) => {
            setOpen(value)
            emit('openChange')
          }}
        >
          {children}
        </LumiDrawer>
      )
    },
  },
})
