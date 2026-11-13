import type { ReactElement, ReactNode } from 'react'
import type { DateRange, DayButtonProps, Matcher } from 'react-day-picker'
import type { CalendarProps } from '../catalog/types-public.js'
import { format, isValid, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import { Calendar, CalendarDayButton } from '../internal/shadcn/calendar.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

type Mark = NonNullable<CalendarProps['marks']>[number]

const DATE = 'yyyy-MM-dd'
const MONTH = /^\d{4}-\d{2}$/

function parse(value: string | null | undefined): Date | undefined {
  if (!value)
    return undefined
  const date = parseISO(MONTH.test(value) ? `${value}-01` : value)
  return isValid(date) ? date : undefined
}

const asList = (value: string | readonly string[] | null | undefined): string[] => value == null ? [] : typeof value === 'string' ? (value ? [value] : []) : [...value]
const ordered = (left: Date, right: Date): [Date, Date] => left <= right ? [left, right] : [right, left]

/**
 * An inline month calendar bound to a value. Range picking follows the date
 * range picker: the first press anchors a new range, the second completes it,
 * and only a complete range is written back.
 */
export function LumiCalendar(props: CalendarProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { mode: modeProp, value, defaultValue = null, onChange, min, max, disabledDates, disabledWeekdays, marks, months, month, captionLayout, appearance, disabled, readonly, invalid, ariaLabel, className, children: _children, 'aria-label': hostLabel, 'data-testid': testId } = props
  const mode = modeProp ?? 'single'
  const [selected, setSelected] = useControllableValue<string | string[] | null>(value as string | string[] | null | undefined, defaultValue as string | string[] | null, next => onChange?.(next))
  const [anchor, setAnchor] = useState<Date>()
  const dates = asList(selected).map(parse).filter((date): date is Date => Boolean(date))
  const blocked = useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = []
    const minDate = parse(min)
    const maxDate = parse(max)
    if (minDate)
      matchers.push({ before: minDate })
    if (maxDate)
      matchers.push({ after: maxDate })
    const list = (disabledDates ?? []).map(parse).filter((date): date is Date => Boolean(date))
    if (list.length)
      matchers.push(list)
    if (disabledWeekdays?.length)
      matchers.push({ dayOfWeek: [...disabledWeekdays] })
    if (disabled)
      matchers.push(() => true)
    return matchers
  }, [min, max, disabledDates, disabledWeekdays, disabled])
  const marksByDay = useMemo(() => {
    const map = new Map<string, Mark[]>()
    for (const mark of marks ?? []) {
      const date = parse(mark.date)
      if (!date)
        continue
      const key = format(date, DATE)
      map.set(key, [...(map.get(key) ?? []), mark])
    }
    return map
  }, [marks])
  const DayButton = useMemo(() => function MarkedDayButton(dayProps: DayButtonProps): ReactElement {
    const dayMarks = marksByDay.get(format(dayProps.day.date, DATE))
    return (
      <CalendarDayButton {...dayProps}>
        {dayProps.children}
        {dayMarks && (
          <>
            <i aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center gap-0.5 not-italic" data-slot="calendar-marks">
              {dayMarks.slice(0, 3).map((mark, index) => <b key={`${mark.date}:${index}`} className="size-1 rounded-full" data-slot="calendar-mark" data-tone={mark.tone ?? 'brand'} />)}
            </i>
            <i className="sr-only not-italic">{`, ${dayMarks.map(mark => mark.label ?? t('lumi.calendar.event', 'Event')).join(', ')}`}</i>
          </>
        )}
      </CalendarDayButton>
    )
  }, [marksByDay, t])
  const components = useMemo(() => ({ DayButton }), [DayButton])
  const first = dates[0] ?? parse(month)
  const shared = {
    numberOfMonths: months ?? 1,
    defaultMonth: first,
    disabled: blocked,
    captionLayout: captionLayout ?? undefined,
    components,
  }
  const write = (next: string | string[] | null): void => {
    if (!readonly && !disabled)
      setSelected(next)
  }
  let picker: ReactElement
  if (mode === 'range') {
    const [start, end] = dates
    const shown: DateRange | undefined = anchor ? { from: anchor, to: undefined } : start ? { from: start, to: end ?? start } : undefined
    picker = (
      <Calendar
        {...shared}
        mode="range"
        selected={shown}
        onSelect={(_, day) => {
          if (readonly || disabled)
            return
          if (anchor) {
            const [from, to] = ordered(anchor, day)
            setAnchor(undefined)
            write([format(from, DATE), format(to, DATE)])
          }
          else {
            setAnchor(day)
          }
        }}
      />
    )
  }
  else if (mode === 'multiple') {
    picker = <Calendar {...shared} mode="multiple" selected={dates} onSelect={next => write((next ?? []).map(date => format(date, DATE)).sort())} />
  }
  else {
    picker = <Calendar {...shared} mode="single" selected={dates[0]} onSelect={next => write(next ? format(next, DATE) : null)} />
  }
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? hostLabel ?? t('lumi.calendar.name', 'Calendar')}
      aria-invalid={invalid || undefined}
      aria-readonly={readonly || undefined}
      aria-disabled={disabled || undefined}
      data-slot="calendar-inline"
      data-mode={mode}
      data-appearance={appearance ?? 'outline'}
      data-testid={testId}
      className={cn('w-fit max-w-full', (appearance ?? 'outline') === 'outline' && 'rounded-control border border-border p-(--lumi-popover-padding)', invalid && 'border-destructive', className)}
    >
      {picker}
    </div>
  )
}
