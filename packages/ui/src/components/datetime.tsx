import type { ComponentType, ReactElement, ReactNode, SVGProps } from 'react'
import type { DateRange, Matcher } from 'react-day-picker'
import type { ControlAppearance, DatePickerProps, DateRangePickerProps, DateTimePickerProps, Size, TimePickerProps } from '../catalog/types-public.js'
import { format, isSameDay, isValid, parseISO } from 'date-fns'
import { useLayoutEffect, useRef, useState } from 'react'
import { CalendarIcon, ClockIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Calendar } from '../internal/shadcn/calendar.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { cn } from '../internal/utils.js'
import { CHOICE_CLASS, CONTENT_PANEL_CLASS, CONTROL_HEIGHT, FIELD_PLACEHOLDER_CLASS, FIELD_TRIGGER_CLASS, MENU_PANEL_CLASS, OPTION_CLASS, useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string, 'aria-describedby'?: string, 'id'?: string }

const DATE = 'yyyy-MM-dd'
// Wide panels flip and shift inside the viewport; a short one scrolls rather than clip.
const FIT_VIEWPORT_CLASS = 'max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain'
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

function validDate(value: string | undefined | null): Date | undefined {
  if (!value)
    return undefined
  const date = parseISO(value)
  return isValid(date) ? date : undefined
}

/**
 * The calendar day a value names. A date picker reads the date as written, so
 * `2026-11-11T00:00:00Z` is the 11th in every time zone, not the 10th west of UTC.
 */
function validDay(value: string | undefined | null): Date | undefined {
  return validDate(value?.slice(0, 10))
}

const ZONED_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i

function dayBounds(min?: string | null, max?: string | null): Matcher[] | undefined {
  const matchers: Matcher[] = []
  const minDate = validDay(min)
  const maxDate = validDay(max)
  if (minDate)
    matchers.push({ before: minDate })
  if (maxDate)
    matchers.push({ after: maxDate })
  return matchers.length ? matchers : undefined
}

interface TriggerProps extends HostProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  text: string | undefined
  placeholder: string
  size?: Size | undefined
  appearance?: ControlAppearance | undefined
  disabled?: boolean | undefined
  readonly?: boolean | undefined
  invalid?: boolean | undefined
  ariaLabel?: string | undefined
}

/**
 * Pickers open from a field-shaped button: left-aligned like an Input, full
 * width, and muted while it only shows the placeholder.
 */
function PickerTrigger({ icon: Icon, text, placeholder, size, appearance = 'outline', disabled, readonly, invalid, ariaLabel, className, id, ...rest }: TriggerProps): ReactElement {
  return (
    <PopoverTrigger asChild>
      <Button
        id={id}
        type="button"
        variant="outline"
        className={cn('w-full min-w-0 justify-start px-inset-md font-normal tabular-nums', FIELD_TRIGGER_CLASS, CONTROL_HEIGHT[size ?? 'md'], !text && FIELD_PLACEHOLDER_CLASS, className)}
        disabled={disabled || readonly}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={rest['aria-describedby']}
        data-appearance={appearance}
        data-lumi-control-size={size ?? 'md'}
        data-testid={rest['data-testid']}
      >
        <Icon data-icon="inline-start" className="text-muted-foreground" aria-hidden />
        <span className="truncate">{text ?? placeholder}</span>
      </Button>
    </PopoverTrigger>
  )
}

/** The popover sizes to its picker instead of shadcn's fixed 18rem. */

export function LumiDatePicker(props: DatePickerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, min, max, captionLayout, placeholder = t('lumi.date.pick', 'Pick a date'), name, ...trigger } = props
  const [selected, setSelected] = useControllableValue(value, defaultValue, next => onChange?.(next || null))
  const [open, setOpen] = useState(false)
  const date = validDay(selected)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={selected ?? ''} disabled={props.disabled} />}
      <PickerTrigger {...trigger} icon={CalendarIcon} text={date && format(date, DATE)} placeholder={placeholder} />
      <PopoverContent align="start" className={CONTENT_PANEL_CLASS}>
        <Calendar
          mode="single"
          captionLayout={captionLayout}
          selected={date}
          defaultMonth={date}
          disabled={dayBounds(min, max)}
          onSelect={(next) => {
            setSelected(next ? format(next, DATE) : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface TimeParts { hour: number, minute: number, second: number }

function parseTime(value: string | undefined | null): TimeParts | undefined {
  const match = TIME_RE.exec(value ?? '')
  if (!match)
    return undefined
  const [hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
  return hour < 24 && minute < 60 && second < 60 ? { hour, minute, second } : undefined
}

const pad = (value: number): string => String(value).padStart(2, '0')

function formatTime(time: TimeParts, seconds: boolean): string {
  return `${pad(time.hour)}:${pad(time.minute)}${seconds ? `:${pad(time.second)}` : ''}`
}

const range = (end: number, step: number): number[] => Array.from({ length: Math.ceil(end / step) }, (_, index) => index * step)

type TimeUnit = 'hour' | 'minute' | 'second'

interface TimeColumnsProps {
  value: TimeParts | undefined
  step: number
  seconds: boolean
  min?: TimeParts | undefined
  max?: TimeParts | undefined
  onPick: (next: TimeParts, unit: TimeUnit) => void
  /** Beside a calendar: take the panel's height instead of a fixed one. */
  fill?: boolean
}

/**
 * Hour / minute / second columns. Each column scrolls its selection to the top
 * when the panel opens; trailing space lets the last value reach the top too.
 * Items match the day chips: the calendar's cell height, radius and selected
 * tone. styles/calendar.css sizes the lists and fades their edges.
 */
function TimeColumns({ value, step, seconds, min, max, onPick, fill }: TimeColumnsProps): ReactElement {
  const { t } = useUiText()
  const unitLabel: Record<TimeUnit, string> = { hour: t('lumi.time.hours', 'Hours'), minute: t('lumi.time.minutes', 'Minutes'), second: t('lumi.time.seconds', 'Seconds') }
  const unitShort: Record<TimeUnit, string> = { hour: t('lumi.time.hourShort', 'Hr'), minute: t('lumi.time.minuteShort', 'Min'), second: t('lumi.time.secondShort', 'Sec') }
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    for (const column of root.current?.querySelectorAll<HTMLElement>('[role=listbox]') ?? []) {
      const option = column.querySelector<HTMLElement>('[aria-selected=true]')
      // Clear of the list's top padding, where the edge fade starts.
      column.scrollTop = option ? option.offsetTop - column.offsetTop - 8 : 0
    }
  }, [])
  const current = value ?? { hour: 0, minute: 0, second: 0 }
  const total = (time: TimeParts): number => time.hour * 3600 + time.minute * 60 + time.second
  const outside = (from: number, to: number): boolean => (max !== undefined && from > total(max)) || (min !== undefined && to < total(min))
  // An hour is offered when any minute of it is allowed; the time picked with
  // it still has to land inside the bounds (09 with a 09:30 minimum is 09:30).
  const bounded = (time: TimeParts): TimeParts => (min !== undefined && total(time) < total(min) ? min : max !== undefined && total(time) > total(max) ? max : time)
  const columns: { unit: TimeUnit, values: number[], disabled: (item: number) => boolean }[] = [
    { unit: 'hour', values: range(24, 1), disabled: hour => outside(hour * 3600, hour * 3600 + 3599) },
    { unit: 'minute', values: range(60, Math.max(1, Math.min(30, step))), disabled: minute => outside(current.hour * 3600 + minute * 60, current.hour * 3600 + minute * 60 + 59) },
  ]
  if (seconds)
    columns.push({ unit: 'second', values: range(60, 1), disabled: second => outside(total({ ...current, second }), total({ ...current, second })) })
  return (
    <div ref={root} className="flex justify-center gap-1" data-slot="time-columns" data-fill={fill || undefined}>
      {columns.map(column => (
        <div key={column.unit} className="flex w-12 flex-col gap-1" data-slot="time-column">
          <div aria-hidden className="flex h-control-md shrink-0 items-center justify-center text-xs text-muted-foreground select-none">
            {unitShort[column.unit]}
          </div>
          <div
            role="listbox"
            aria-label={unitLabel[column.unit]}
            data-slot="time-column-list"
            className="flex flex-col gap-0.5 overflow-y-auto overscroll-contain py-2 [scrollbar-width:none] after:block after:h-48 after:shrink-0 after:content-['']"
          >
            {column.values.map((item) => {
              const selected = value !== undefined && current[column.unit] === item
              return (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={column.disabled(item)}
                  className={cn(OPTION_CLASS, 'justify-center rounded-md px-0 font-normal tabular-nums aria-selected:font-medium')}
                  onClick={() => onPick(bounded({ ...current, [column.unit]: item }), column.unit)}
                >
                  {pad(item)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LumiTimePicker(props: TimePickerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, min, max, step = 5, seconds = false, placeholder = t('lumi.time.pick', 'Pick a time'), name, ...trigger } = props
  const [selected, setSelected] = useControllableValue(value, defaultValue, next => onChange?.(next || null))
  const [open, setOpen] = useState(false)
  const time = parseTime(selected)
  const last: TimeUnit = seconds ? 'second' : 'minute'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={selected ?? ''} disabled={props.disabled} />}
      <PickerTrigger {...trigger} icon={ClockIcon} text={time && formatTime(time, seconds)} placeholder={placeholder} />
      <PopoverContent align="start" className={cn(MENU_PANEL_CLASS, 'min-w-0')}>
        <TimeColumns
          value={time}
          step={step}
          seconds={seconds}
          min={parseTime(min)}
          max={parseTime(max)}
          onPick={(next, unit) => {
            setSelected(formatTime(next, seconds))
            if (unit === last)
              setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function LumiDateTimePicker(props: DateTimePickerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, min, max, step = 5, seconds = false, captionLayout, placeholder = t('lumi.dateTime.pick', 'Pick a date and time'), name, ...trigger } = props
  const [selected, setSelected] = useControllableValue(value, defaultValue, next => onChange?.(next || null))
  const [open, setOpen] = useState(false)
  const date = validDate(selected)
  const time: TimeParts | undefined = date ? { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() } : undefined
  const pattern = seconds ? `${DATE}'T'HH:mm:ss` : `${DATE}'T'HH:mm`
  const minDate = validDate(min)
  const maxDate = validDate(max)
  const parts = (bound: Date): TimeParts => ({ hour: bound.getHours(), minute: bound.getMinutes(), second: bound.getSeconds() })
  // The time columns are bounded on the first and last allowed day only.
  const shownDay = date ?? new Date()
  const timeMin = minDate && isSameDay(shownDay, minDate) ? parts(minDate) : undefined
  const timeMax = maxDate && isSameDay(shownDay, maxDate) ? parts(maxDate) : undefined
  // A value written with an offset (`…Z`, `…+08:00`) is an instant and goes
  // back as one, in UTC; one written without is wall-clock time and stays so.
  const zoned = ZONED_RE.test(selected ?? '')
  const commit = (day: Date, time: TimeParts): void => {
    let next = new Date(day)
    next.setHours(time.hour, time.minute, time.second, 0)
    // Picking a day keeps the time shown, which may fall outside the bounds on a boundary day.
    if (minDate && next < minDate)
      next = minDate
    if (maxDate && next > maxDate)
      next = maxDate
    setSelected(zoned ? next.toISOString() : format(next, pattern))
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={selected ?? ''} disabled={props.disabled} />}
      <PickerTrigger {...trigger} icon={CalendarIcon} text={date && format(date, seconds ? `${DATE} HH:mm:ss` : `${DATE} HH:mm`)} placeholder={placeholder} />
      <PopoverContent align="start" collisionPadding={8} className={cn(CONTENT_PANEL_CLASS, FIT_VIEWPORT_CLASS)}>
        <div data-slot="datetime-panel">
          <Calendar
            mode="single"
            captionLayout={captionLayout}
            selected={date}
            defaultMonth={date}
            disabled={dayBounds(minDate && format(minDate, DATE), maxDate && format(maxDate, DATE))}
            onSelect={next => next && commit(next, time ?? { hour: 0, minute: 0, second: 0 })}
          />
          <div data-slot="datetime-time">
            <TimeColumns
              fill
              value={time}
              step={step}
              seconds={seconds}
              min={timeMin}
              max={timeMax}
              onPick={(parts, unit) => {
                commit(date ?? new Date(), parts)
                if (unit === (seconds ? 'second' : 'minute'))
                  setOpen(false)
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const ordered = (left: Date, right: Date): DateRange => left <= right ? { from: left, to: right } : { from: right, to: left }

export function LumiDateRangePicker(props: DateRangePickerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = [], onChange, min, max, presets, months = 2, captionLayout, placeholder = t('lumi.dateRange.pick', 'Pick a date range'), name, ...trigger } = props
  const [selected, setSelected] = useControllableValue<readonly string[]>(value, defaultValue, next => onChange?.(next.length ? [...next] : null))
  const [open, setOpen] = useState(false)
  // The first click after opening starts a new range; the second closes it.
  const [anchor, setAnchor] = useState<Date>()
  const start = validDay(selected[0])
  const end = validDay(selected[1])
  const shown: DateRange | undefined = anchor ? { from: anchor, to: undefined } : start ? { from: start, to: end ?? start } : undefined
  const text = start ? `${format(start, DATE)} – ${end ? format(end, DATE) : '…'}` : undefined
  const commit = (next: DateRange): void => {
    setSelected([format(next.from!, DATE), format(next.to ?? next.from!, DATE)])
    setAnchor(undefined)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setAnchor(undefined)
      }}
    >
      {name && <input type="hidden" name={name} value={selected.join(',')} disabled={props.disabled} />}
      <PickerTrigger {...trigger} icon={CalendarIcon} text={text} placeholder={placeholder} />
      <PopoverContent align="start" collisionPadding={8} className={cn(CONTENT_PANEL_CLASS, FIT_VIEWPORT_CLASS)}>
        <div data-slot="date-range-panel">
          {presets?.length
            ? (
                <div data-slot="date-range-presets" role="group" aria-label={t('lumi.dateRange.presets', 'Presets')}>
                  {presets.map((preset) => {
                    const from = validDay(preset.value[0])
                    const to = validDay(preset.value[1])
                    const active = selected[0] === preset.value[0] && selected[1] === preset.value[1]
                    return (
                      <Button
                        key={preset.label}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn('justify-start font-normal', active && CHOICE_CLASS)}
                        aria-pressed={active}
                        disabled={!from || !to}
                        onClick={() => from && to && commit(ordered(from, to))}
                      >
                        {preset.label}
                      </Button>
                    )
                  })}
                </div>
              )
            : null}
          <Calendar
            mode="range"
            captionLayout={captionLayout}
            numberOfMonths={months}
            selected={shown}
            defaultMonth={start}
            disabled={dayBounds(min, max)}
            onSelect={(_, day) => {
              if (anchor)
                commit(ordered(anchor, day))
              else
                setAnchor(day)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
