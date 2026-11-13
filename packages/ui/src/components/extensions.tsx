import type { ReactElement, ReactNode } from 'react'
import type { BadgeTone, FilterFieldDef, FilterModel, FilterOption, FiltersProps, FrameProps, Option, OptionValue, ProgressStatus, StepperProps, TextTranslator, TimelineProps } from '../catalog/types-public.js'
import type { UiText } from './text.js'
import { Children, useEffect, useId, useRef, useState } from 'react'
import { cloneFilterModel, filterConditionsToModel, filterModelToConditions } from '../catalog/types-public.js'
import { ClockIcon, SearchIcon } from '../icons.js'
import { Filters, FiltersActions, FiltersField } from '../internal/reui/filters.js'
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from '../internal/reui/frame.js'
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTrigger } from '../internal/reui/stepper.js'
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from '../internal/reui/timeline.js'
import { Button } from '../internal/shadcn/button.js'
import { Label } from '../internal/shadcn/label.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cascaderFindPath, LumiCascader } from './cascader.js'
import { text, useControllableValue } from './control.js'
import { LumiCheckboxGroup, LumiInput, LumiNumberInput, LumiSelect } from './controls.js'
import { LumiDateRangePicker } from './datetime.js'
import { LumiEmpty } from './empty.js'
import { useUiText } from './text.js'

interface HostProps {
  'aria-label'?: string
  'className'?: string
  'children'?: ReactNode
  'data-testid'?: string
}

function flattenOptions(options: FilterOption[] = []): Option[] {
  return options.flatMap(option => [
    { label: text(option.label), value: option.value, disabled: option.disabled },
    ...flattenOptions(option.children),
  ])
}

function scalarValue(value: unknown): OptionValue | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null
}

type FilterLayout = 'toolbar' | 'row'

/** Stands for "no condition" inside a select, which cannot hold an empty value. */
const ALL_OPTION = '__lumi_all__'

interface FilterControlProps {
  translate: TextTranslator
  disabled: boolean
  field: FilterFieldDef
  id: string
  value: unknown
  layout?: FilterLayout
  onChange: (value: unknown) => void
  /** Milliseconds a typed value waits before it is committed; 0 commits each keystroke. */
  settle?: number
}

const TYPING_SETTLE_MS = 300

/**
 * A typed filter keeps its own text and commits once typing pauses, so an
 * immediate list queries once per word rather than once per keystroke.
 */
function SettlingInput({ value, settle, onCommit, ...input }: { value: string, settle: number, onCommit: (next: string) => void } & Omit<Parameters<typeof LumiInput>[0], 'value' | 'onChange'>): ReactElement {
  const [local, setLocal] = useState(value)
  const [commits, setCommits] = useState(0)
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined)
  const sent = useRef(value)
  const latest = useRef(onCommit)
  latest.current = onCommit
  const send = (next: string): void => {
    sent.current = next
    latest.current(next)
    setCommits(count => count + 1)
  }
  // The field shows the owner's value whenever it differs from what was last
  // sent: an outside change (Reset, a saved view) or a commit the owner
  // declined. The echo of an accepted commit leaves newer typing alone.
  useEffect(() => {
    if (value === sent.current)
      return
    clearTimeout(pending.current)
    sent.current = value
    setLocal(value)
  }, [value, commits])
  useEffect(() => () => clearTimeout(pending.current), [])
  return (
    <LumiInput
      {...input}
      value={local}
      onChange={(next) => {
        setLocal(next)
        clearTimeout(pending.current)
        if (settle <= 0)
          send(next)
        else
          pending.current = setTimeout(send, settle, next)
      }}
    />
  )
}

function CascaderControl({ disabled, field, id, layout, value, onChange, translate }: FilterControlProps): ReactElement {
  const label = text(field.label)
  const selected = scalarValue(value)
  const options = field.options ?? []
  // A filter holds one value at any depth; the picker shows its whole path.
  return (
    <LumiCascader
      id={id}
      options={options}
      value={selected === null ? [] : cascaderFindPath(options, selected)}
      changeOnSelect
      searchable
      clearable
      placeholder={field.placeholder ? text(field.placeholder) : translate('lumi.filter.choose', undefined, 'Choose…')}
      disabled={disabled}
      ariaLabel={label}
      size={layout === 'row' ? 'sm' : 'md'}
      onChange={path => onChange(path?.at(-1))}
    />
  )
}

/**
 * Chips are a segmented choice, not a form control: at filter density a column
 * of radio dots costs more room than the words beside them, so the chip itself
 * carries the state. The radio roles stay, so keyboard and screen-reader
 * behaviour is unchanged.
 */
/**
 * One laid-out filter option — the design's `.fopt`. Enumerations and range
 * presets are the same control on purpose: to a reader they are one row of
 * values to pick from, and only the shape of what they set differs.
 */
function FilterOptionButton({ active, children, disabled, onSelect, role }: { active: boolean, children: ReactNode, disabled?: boolean, onSelect: () => void, role?: 'radio' }): ReactElement {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? active : undefined}
      aria-pressed={role ? undefined : active}
      data-state={active ? 'checked' : 'unchecked'}
      disabled={disabled}
      className="inline-flex h-control-sm items-center rounded-control border border-border px-inset-sm text-meta whitespace-nowrap text-muted-foreground hover:border-input hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-choice-border data-[state=checked]:bg-choice data-[state=checked]:text-choice-foreground data-[state=checked]:hover:border-choice-border data-[state=checked]:hover:text-choice-foreground"
      onClick={onSelect}
    >
      {children}
    </button>
  )
}

function ChipsControl({ disabled, field, id, value, onChange, translate }: FilterControlProps): ReactElement {
  const label = text(field.label)
  const selected = scalarValue(value)
  const options = flattenOptions(field.options)
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" id={id} aria-label={label} data-slot="filters-chips">
      {[{ label: translate('lumi.common.all', undefined, 'All'), value: null }, ...options].map((option) => {
        const active = option.value === null ? selected === null || selected === undefined : selected === option.value
        return (
          <FilterOptionButton
            key={String(option.value)}
            role="radio"
            active={active}
            disabled={disabled || ('disabled' in option && option.disabled)}
            onSelect={() => onChange(option.value ?? undefined)}
          >
            {option.label}
          </FilterOptionButton>
        )
      })}
    </div>
  )
}

function FilterControl({ disabled, field, id, layout, value, onChange, translate, settle = 0 }: FilterControlProps): ReactElement {
  const label = text(field.label)
  const placeholder = field.placeholder ? text(field.placeholder) : undefined
  // The toolbar is a 32px row of full-size controls; inside the panel every
  // control drops to the 28px the laid-out options are set in.
  const size = layout === 'row' ? 'sm' : 'md'
  // In a panel row the two ends of a range trail the presets as a custom tail,
  // so they are sized to their content rather than sharing the row's width.
  const rangeWidth = layout === 'row' ? (field.widget === 'dateRange' ? 'w-33' : 'w-26') : undefined
  if (field.widget === 'cascader')
    return <CascaderControl disabled={disabled} field={field} id={id} layout={layout} value={value} onChange={onChange} translate={translate} />
  if (field.widget === 'select') {
    // In the toolbar a select reads as `Status  To ship`: the label leads inside
    // the control, and `All` is a real option because there is no other way back
    // to no condition short of resetting every filter.
    if (layout !== 'row') {
      const allOptions = [{ label: translate('lumi.common.all', undefined, 'All'), value: ALL_OPTION }, ...flattenOptions(field.options)]
      return <LumiSelect id={id} value={scalarValue(value) ?? ALL_OPTION} options={allOptions} labelPrefix={label} disabled={disabled} ariaLabel={label} size={size} onChange={next => onChange(next === ALL_OPTION ? undefined : next)} />
    }
    return <LumiSelect id={id} value={scalarValue(value)} options={flattenOptions(field.options)} placeholder={placeholder} disabled={disabled} ariaLabel={label} size={size} onChange={onChange} />
  }
  if (field.widget === 'chips')
    return <ChipsControl disabled={disabled} field={field} id={id} value={value} onChange={onChange} translate={translate} />

  if (field.widget === 'tags') {
    return <LumiCheckboxGroup id={id} value={Array.isArray(value) ? value.filter(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') : []} options={flattenOptions(field.options)} disabled={disabled} ariaLabel={label} direction="row" onChange={onChange} />
  }
  if (field.widget === 'numberRange') {
    const range = Array.isArray(value) ? value : []
    return (
      <div className="flex items-center gap-1" role="group" aria-label={label} data-slot="filters-range" data-kind="number">
        <LumiNumberInput id={id} className={rangeWidth} value={typeof range[0] === 'number' ? range[0] : null} disabled={disabled} ariaLabel={`${label} ${translate('lumi.filter.min', undefined, 'Min')}`} size={size} onChange={next => onChange([next, range[1]])} />
        <span className="px-0.5 text-muted-foreground" aria-hidden>–</span>
        <LumiNumberInput className={rangeWidth} value={typeof range[1] === 'number' ? range[1] : null} disabled={disabled} ariaLabel={`${label} ${translate('lumi.filter.max', undefined, 'Max')}`} size={size} onChange={next => onChange([range[0], next])} />
      </div>
    )
  }
  if (field.widget === 'dateRange') {
    const range = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return <LumiDateRangePicker id={id} className={layout === 'row' ? 'w-64' : undefined} value={range} disabled={disabled} ariaLabel={label} size={size} placeholder={translate('lumi.filter.anyDate', undefined, 'Any date')} onChange={next => onChange(next ?? undefined)} />
  }

  const input = <SettlingInput id={id} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} settle={settle} placeholder={placeholder} disabled={disabled} ariaLabel={label} size={size} onCommit={onChange} />
  if (field.widget === 'search') {
    return (
      <div className="relative w-full" data-slot="filters-search">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 z-1 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        {input}
      </div>
    )
  }
  return input
}

function filterValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) || Array.isArray(right))
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => filterValuesEqual(item, right[index]))
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false
  if (Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype)
    return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.hasOwn(rightRecord, key) && filterValuesEqual(leftRecord[key], rightRecord[key]))
}

function statusLabels(t: UiText['t']): Record<ProgressStatus, string> {
  return {
    complete: t('lumi.status.complete', 'Complete'),
    current: t('lumi.status.current', 'Current'),
    upcoming: t('lumi.status.upcoming', 'Upcoming'),
    loading: t('lumi.status.loading', 'Loading'),
    error: t('lumi.status.error', 'Error'),
  }
}

const STATUS_SYMBOLS = {
  complete: '✓',
  current: '●',
  upcoming: '○',
  loading: '…',
  error: '!',
} as const satisfies Record<ProgressStatus, string>

function toneLabels(t: UiText['t']): Record<BadgeTone, string> {
  return {
    neutral: t('lumi.tone.neutral', 'Neutral'),
    primary: t('lumi.tone.primary', 'Primary'),
    success: t('lumi.tone.success', 'Success'),
    warning: t('lumi.tone.warning', 'Warning'),
    danger: t('lumi.tone.danger', 'Danger'),
    info: t('lumi.tone.info', 'Info'),
    brand: t('lumi.tone.brand', 'Brand'),
  }
}

/**
 * Host-side composition slots, the same status `children` has: absent from
 * FrameProps, so a JSON document can never reach them.
 */
interface FrameSlots {
  headerStart?: ReactNode
  headerEnd?: ReactNode
  /** Rides beside the title, e.g. the record's status. */
  titleEnd?: ReactNode
  /** A panel beside the main one, for navigation that selects what it shows. */
  aside?: ReactNode
  /**
   * Replaces the single panel with the host's own arrangement of surfaces, for
   * pages whose body is several panels rather than one.
   */
  body?: ReactNode
}

export function LumiFrame(props: FrameProps & FrameSlots & HostProps): ReactElement {
  const { title, description, summary, content, appearance = 'outline', headerStart, headerEnd, titleEnd, aside, body, children, ...rest } = props
  const hasHeader = Boolean(title || description || headerStart || headerEnd)
  const panel = body ?? <FramePanel>{content ?? children}</FramePanel>
  return (
    <Frame {...rest} variant={appearance === 'filled' ? 'inverse' : 'default'}>
      {hasHeader && (
        <FrameHeader className="flex-row items-center gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {headerStart}
            {(title || titleEnd) && (
              <div className="flex min-w-0 items-center gap-2">
                {title && <FrameTitle>{title}</FrameTitle>}
                {titleEnd}
              </div>
            )}
            {description && <FrameDescription>{description}</FrameDescription>}
          </div>
          {headerEnd && <div className="ml-auto flex flex-none items-center gap-2">{headerEnd}</div>}
        </FrameHeader>
      )}
      {aside
        ? (
            <div className="flex min-h-0 grow gap-0.75">
              <FramePanel className="grow-0" data-slot="frame-aside">{aside}</FramePanel>
              {panel}
            </div>
          )
        : panel}
      {summary && <FrameFooter>{summary}</FrameFooter>}
    </Frame>
  )
}

/**
 * Host-side composition slot, the same status `children` has: absent from
 * FiltersProps, so a JSON document can never reach it.
 */
interface FiltersSlots {
  toolbarStart?: ReactNode
  toolbarEnd?: ReactNode
}

export function LumiFilters(props: FiltersProps & FiltersSlots & HostProps): ReactElement {
  const { translate: uiTranslate } = useUiText()
  const { schema, applyMode, value, defaultValue = {}, disabled = false, loading = false, onChange, toolbarStart, toolbarEnd, className, translate: hostTranslate, ...rest } = props
  const translate: TextTranslator = hostTranslate ?? uiTranslate
  const controlled = value !== undefined
  const [committed, setCommitted] = useState<FilterModel>(() => cloneFilterModel(defaultValue))
  const [draft, setDraft] = useState<FilterModel>(() => cloneFilterModel(value ?? defaultValue))
  const controlledSnapshot = useRef<FilterModel>(cloneFilterModel(value ?? defaultValue))
  const idPrefix = useId()
  const advancedId = `${idPrefix}-advanced`
  const [advancedOpen, setAdvancedOpen] = useState(false)
  useEffect(() => {
    if (value !== undefined && !filterValuesEqual(value, controlledSnapshot.current)) {
      controlledSnapshot.current = cloneFilterModel(value)
      setDraft(cloneFilterModel(value))
    }
  }, [value])
  const current = controlled ? value : committed
  const displayed = applyMode === 'explicit' ? draft : current
  // A query in flight never locks the filters: the list keeps its rows until
  // the newest answer lands, so disabling and re-enabling every control on
  // each change would only make the whole bar blink.
  const unavailable = disabled || (loading && applyMode === 'explicit')
  const transition = (nextValue: FilterModel): void => {
    const next = cloneFilterModel(nextValue)
    setDraft(next)
    if (applyMode === 'immediate') {
      if (!controlled)
        setCommitted(next)
      onChange?.(cloneFilterModel(next))
    }
  }
  const update = (field: string, nextValue: unknown): void => transition({ ...displayed, [field]: nextValue })
  const apply = (): void => {
    if (!controlled)
      setCommitted(cloneFilterModel(draft))
    onChange?.(cloneFilterModel(draft))
  }
  const remove = (field: string): void => {
    const next = cloneFilterModel(displayed)
    delete next[field]
    transition(next)
  }
  // With nothing marked primary there is no second tier to hide behind: the
  // whole set is the toolbar.
  const tiered = schema.fields.some(field => field.primary)
  const primaryFields = tiered ? schema.fields.filter(field => field.primary) : schema.fields
  const advancedFields = tiered ? schema.fields.filter(field => !field.primary) : []
  const conditions = filterModelToConditions(schema.fields, displayed)
  const activeAdvanced = conditions.filter(condition => advancedFields.some(field => field.field === condition.field)).length
  const renderField = (field: FilterFieldDef, index: number, layout: FilterLayout): ReactElement => {
    const id = `${idPrefix}-${index}`
    const choice = field.widget === 'chips' || field.widget === 'tags'
    const label = text(field.label)
    // In the toolbar the control speaks for itself and a stack of labels would
    // double the row's height; in the panel every field gets a named row.
    const labelClass = layout === 'toolbar' ? 'sr-only' : 'w-21 shrink-0 pt-[5px] text-[length:var(--lumi-fs-label)] text-muted-foreground'
    const selected = displayed[field.field]
    return (
      <FiltersField
        key={field.field}
        className={layout !== 'toolbar' ? 'w-full flex-row items-start gap-3 py-1.5' : field.widget === 'select' ? 'w-auto min-w-0 gap-1' : field.widget === 'search' ? 'w-65 max-w-full min-w-0 gap-1' : 'min-w-0 basis-56 gap-1'}
        role={choice ? 'group' : undefined}
        aria-labelledby={choice ? `${id}-label` : undefined}
        data-primary={field.primary || undefined}
        data-layout={layout}
      >
        {choice ? <span id={`${id}-label`} className={labelClass}>{label}</span> : <Label className={labelClass} htmlFor={id}>{label}</Label>}
        <div className={layout === 'toolbar' ? 'contents' : 'flex min-w-0 flex-1 flex-wrap items-center gap-1'}>
          {/* A range's presets lead the row and read as the enumeration a reader
              scans first — `All` included, so the row can be put back the way it
              was picked. The two ends of the range follow as the custom tail. */}
          {field.presets?.length
            ? (
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label={translate('lumi.filter.presetsOf', { label }, '{label} presets')} data-slot="filters-field-presets">
                  <FilterOptionButton active={!Array.isArray(selected)} disabled={unavailable} onSelect={() => remove(field.field)}>{translate('lumi.common.all', undefined, 'All')}</FilterOptionButton>
                  {field.presets.map((preset, presetIndex) => (
                    <FilterOptionButton
                      key={presetIndex}
                      active={Array.isArray(selected) && selected.length === preset.value.length && preset.value.every((item, itemIndex) => selected[itemIndex] === item)}
                      disabled={unavailable}
                      onSelect={() => update(field.field, [...preset.value])}
                    >
                      {text(preset.label)}
                    </FilterOptionButton>
                  ))}
                </div>
              )
            : null}
          <FilterControl id={id} field={field} layout={layout} value={selected} disabled={unavailable} settle={applyMode === 'immediate' ? TYPING_SETTLE_MS : 0} onChange={next => update(field.field, next)} translate={translate} />
        </div>
      </FiltersField>
    )
  }
  // `flex-nowrap` undoes the primitive's `flex-wrap`, which belongs to its
  // one-row form: kept alongside `flex-col` it makes a wrapping column, and a
  // wrapping column takes its height from the column box rather than the row —
  // the toolbar then stood 40px taller than its controls, opening a dead band
  // between the stat band and the search field. Wrapping is the inner toolbar
  // row's own job, and it still has it.
  return (
    <Filters role="group" {...rest} className={['w-full flex-col flex-nowrap items-stretch gap-2', className].filter(Boolean).join(' ')} aria-busy={loading || undefined} aria-disabled={unavailable || undefined}>
      {/* One toolbar row holds the everyday filters and the controls that act on
          the whole set; everything rarer waits inside the panel below it. There
          is no summary row under it: every condition already shows as the marked
          option in its own row, and the count on the toggle carries the ones the
          panel is hiding — a third telling of it was the same news three times. */}
      <div className="flex flex-wrap items-center gap-2" data-slot="filters-toolbar">
        {toolbarStart && <div className="flex shrink-0 items-center" data-slot="filters-toolbar-start">{toolbarStart}</div>}
        {primaryFields.map(field => renderField(field, schema.fields.indexOf(field), 'toolbar'))}
        {/* The toggle belongs with the fields it extends; only what acts on the
            whole set sits at the far end. */}
        {advancedFields.length > 0 && (
          <Button
            type="button"
            variant="outline"
            data-slot="filters-advanced-toggle"
            className="data-[state=open]:border-foreground"
            data-state={advancedOpen ? 'open' : 'closed'}
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            disabled={unavailable}
            onClick={() => setAdvancedOpen(open => !open)}
          >
            {translate('lumi.filter.advanced', undefined, 'Advanced')}
            {activeAdvanced > 0 && <span className="grid h-4.5 min-w-4.5 place-items-center rounded-sm bg-foreground px-1 text-[length:var(--lumi-fs-micro)] text-background tabular-nums" data-slot="filters-advanced-count">{activeAdvanced}</span>}
          </Button>
        )}
        <FiltersActions className="ml-auto">
          <Button type="button" variant="ghost" data-slot="filters-reset" disabled={unavailable || conditions.length === 0} onClick={() => transition({})}>{translate('lumi.filter.reset', undefined, 'Reset')}</Button>
          {applyMode === 'explicit' && (
            <Button type="button" disabled={unavailable || loading} onClick={apply}>
              {loading && <Spinner data-icon="inline-start" />}
              {translate('lumi.filter.apply', undefined, 'Apply')}
            </Button>
          )}
          {toolbarEnd}
        </FiltersActions>
      </div>
      {advancedFields.length > 0 && advancedOpen && (
        <div id={advancedId} className="flex flex-col border-t border-border pt-1.5" data-slot="filters-advanced">
          {advancedFields.map(field => renderField(field, schema.fields.indexOf(field), 'row'))}
        </div>
      )}
      {schema.presets?.length
        ? <FiltersActions aria-label={translate('lumi.filter.presets', undefined, 'Filter presets')}>{schema.presets.map(preset => <Button key={preset.name} type="button" variant="outline" size="sm" disabled={unavailable} onClick={() => transition(filterConditionsToModel(preset.conditions))}>{text(preset.label)}</Button>)}</FiltersActions>
        : null}
    </Filters>
  )
}

export function LumiStepper(props: StepperProps & HostProps): ReactElement {
  const { t } = useUiText()
  const statuses = statusLabels(t)
  const { items, value, defaultValue, orientation = 'horizontal', linear = false, disabled = false, onChange, children, 'aria-label': ariaLabel = t('lumi.stepper.name', 'Progress'), ...rest } = props
  const initial = defaultValue ?? items[0]?.key ?? ''
  const [current, setCurrent] = useControllableValue(value, initial, onChange)
  const currentIndex = Math.max(0, items.findIndex(item => item.key === current))
  const childArray = Children.toArray(children)
  return (
    <Stepper
      {...rest}
      value={currentIndex + 1}
      orientation={orientation}
      onValueChange={(step) => {
        const key = items[step - 1]?.key
        if (key)
          setCurrent(key)
      }}
    >
      <StepperNav aria-label={ariaLabel}>
        {items.map((item, index) => {
          const state = item.status ?? (index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming')
          const stateLabel = statuses[state]
          const unavailable = disabled || (linear && index > currentIndex + 1)
          return (
            <StepperItem key={item.key} step={index + 1} state={state} data-orientation={orientation}>
              <StepperTrigger step={index + 1} disabled={unavailable} aria-label={t('lumi.stepper.step', '{step}; status: {status}', { step: item.description ? `${item.label}: ${item.description}` : item.label, status: stateLabel })}>
                <StepperIndicator>
                  {state === 'loading'
                    ? <Spinner />
                    : state === 'complete'
                      ? <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.25 2.25 2.25 4.75-5" /></svg>
                      : state === 'error' ? '!' : index + 1}
                </StepperIndicator>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-control" data-slot="stepper-label">{item.label}</span>
                  {item.description && <span className="block truncate text-(length:--lumi-fs-meta) text-muted-foreground">{item.description}</span>}
                  {/* The indicator already carries the state as a glyph, so the
                      word would be a third line on every step. It stays in the
                      DOM for anyone reading the step rather than seeing it. */}
                  <span className="sr-only" data-slot="stepper-status">{stateLabel}</span>
                </span>
              </StepperTrigger>
              {index < items.length - 1 && <StepperSeparator />}
            </StepperItem>
          )
        })}
      </StepperNav>
      {items.map((item, index) => <StepperPanel key={item.key} step={index + 1}>{childArray[index]}</StepperPanel>)}
    </Stepper>
  )
}

export function LumiTimeline(props: TimelineProps & HostProps): ReactElement {
  const { t } = useUiText()
  const statuses = statusLabels(t)
  const tones = toneLabels(t)
  const { items, loading = false, empty = t('lumi.timeline.empty', 'No timeline items'), marker = 'status', datePlacement = 'end', className, ...rest } = props
  if (loading) {
    return (
      <div className={className} role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t('lumi.timeline.loading', 'Loading timeline')}</span>
      </div>
    )
  }
  if (!items.length)
    return <LumiEmpty size="sm" role="status" icon={<ClockIcon />} title={empty} className={className} />
  return (
    <Timeline {...rest} className={className} data-marker={marker} data-date-placement={datePlacement}>
      {items.map((item) => {
        const status = item.status ?? 'upcoming'
        const tone = item.tone ?? 'neutral'
        return (
          <TimelineItem key={item.key} data-tone={tone} data-state={status}>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineHeader>
              <TimelineTitle>{item.title}</TimelineTitle>
              {item.timestamp && <TimelineDate dateTime={item.timestamp}>{item.timestamp}</TimelineDate>}
            </TimelineHeader>
            {/* State and tone are carried by the indicator glyph and the dot's
                colour; spelling both out in the row turned an activity feed
                into a debug dump. They stay as accessible names. */}
            <div className="sr-only" data-slot="timeline-meta">
              {/* A feed entry already happened; only announce a state it declares. */}
              {(marker !== 'dot' || item.status) && (
                <span role="status" aria-label={t('lumi.timeline.status', 'Status: {status}', { status: statuses[status] })} data-slot="timeline-status">
                  {STATUS_SYMBOLS[status]}
                  {' '}
                  {statuses[status]}
                </span>
              )}
              <span aria-label={t('lumi.timeline.tone', 'Tone: {tone}', { tone: tones[tone] })} data-slot="timeline-tone">
                {t('lumi.timeline.tone', 'Tone: {tone}', { tone: tones[tone] })}
              </span>
            </div>
            {item.description && <TimelineContent>{item.description}</TimelineContent>}
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}
