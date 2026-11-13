'use client'

import type { DayButton, Locale, Modifiers } from 'react-day-picker'

import * as React from 'react'
import {

  DayPicker,
  getDefaultClassNames,

} from 'react-day-picker'
import { useUiText } from '../../components/text.js'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../../icons.js'
import { CalendarMonthCaption, CalendarMonths } from '../calendar-panel.js'
import { cn } from '../utils.js'
import { Button, buttonVariants } from './button.js'

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** The first weekday the locale uses, where the browser exposes week data. */
function firstDayOfWeek(tag: string): WeekDay | undefined {
  try {
    const parsed = new Intl.Locale(tag) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }, weekInfo?: { firstDay: number } }
    const firstDay = parsed.getWeekInfo?.().firstDay ?? parsed.weekInfo?.firstDay
    return firstDay === undefined ? undefined : (firstDay % 7) as WeekDay
  }
  catch {
    return undefined
  }
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'panel',
  buttonVariant = 'ghost',
  locale,
  formatters,
  labels,
  weekStartsOn,
  components,
  ...props
}: DistributiveOmit<React.ComponentProps<typeof DayPicker>, 'captionLayout'> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
  /** `panel` makes the caption open month and year grids; the others are the day picker's own. */
  captionLayout?: React.ComponentProps<typeof DayPicker>['captionLayout'] | 'panel'
}): React.ReactElement | null {
  const defaultClassNames = getDefaultClassNames()
  const { t, locale: uiLocale } = useUiText()
  const tag = locale?.code ?? uiLocale
  const dates = React.useMemo(() => ({
    full: new Intl.DateTimeFormat(tag, { dateStyle: 'full' }),
    month: new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }),
    weekday: new Intl.DateTimeFormat(tag, { weekday: 'long' }),
  }), [tag])
  // The day picker's default labels are English date-fns text.
  const dayLabel = (date: Date, modifiers?: Partial<Modifiers>): string => {
    let label = dates.full.format(date)
    if (modifiers?.today)
      label = t('lumi.calendar.today', 'Today, {date}', { date: label })
    if (modifiers?.selected)
      label = t('lumi.calendar.selected', '{date}, selected', { date: label })
    return label
  }
  const panels = captionLayout === 'panel'
  // Stable component types, so a re-render neither remounts the grids nor closes the month panel.
  const dayPickerComponents = React.useMemo<React.ComponentProps<typeof DayPicker>['components']>(() => ({
    Root: ({ className, rootRef, ...props }) => {
      return (
        <div
          data-slot="calendar"
          ref={rootRef}
          className={cn(className)}
          {...props}
        />
      )
    },
    Chevron: ({ className, orientation, ...props }) => {
      if (orientation === 'left') {
        return (
          <ChevronLeftIcon className={cn('size-4', className)} {...props} />
        )
      }

      if (orientation === 'right') {
        return (
          <ChevronRightIcon className={cn('size-4', className)} {...props} />
        )
      }

      return (
        <ChevronDownIcon className={cn('size-4', className)} {...props} />
      )
    },
    DayButton: ({ ...props }) => (
      <CalendarDayButton locale={locale} {...props} />
    ),
    WeekNumber: ({ children, ...props }) => {
      return (
        <td {...props}>
          <div className="flex size-(--cell-size) items-center justify-center text-center">
            {children}
          </div>
        </td>
      )
    },
    ...(panels && { Months: CalendarMonths, MonthCaption: CalendarMonthCaption }),
    ...components,
  }), [locale, panels, components])

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        // No surface of its own: it always sits on the popover or card it opens in.
        'group/calendar bg-transparent p-0 [--cell-radius:var(--lumi-radius-md)] [--cell-size:var(--lumi-control-md)]',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout === 'panel' ? 'label' : captionLayout}
      locale={locale}
      weekStartsOn={weekStartsOn ?? firstDayOfWeek(tag)}
      labels={{
        labelPrevious: () => t('lumi.calendar.previousMonth', 'Go to the previous month'),
        labelNext: () => t('lumi.calendar.nextMonth', 'Go to the next month'),
        labelNav: () => t('lumi.calendar.nav', 'Navigation bar'),
        labelGrid: date => dates.month.format(date),
        labelGridcell: (date, modifiers) => dayLabel(date, { today: modifiers?.today }),
        labelDayButton: (date, modifiers) => dayLabel(date, modifiers),
        labelWeekday: date => dates.weekday.format(date),
        labelMonthDropdown: () => t('lumi.calendar.chooseMonth', 'Choose the month'),
        labelYearDropdown: () => t('lumi.calendar.chooseYear', 'Choose the year'),
        labelWeekNumber: week => t('lumi.calendar.week', 'Week {week}', { week }),
        labelWeekNumberHeader: () => t('lumi.calendar.weekNumber', 'Week number'),
        ...labels,
      }}
      formatters={{
        formatCaption: date => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }).format(date),
        formatMonthDropdown: date => date.toLocaleString(tag, { month: 'short' }),
        formatWeekdayName: date => new Intl.DateTimeFormat(tag, { weekday: 'short' }).format(date),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          // styles/calendar.css lays two months side by side once there is room.
          'relative flex gap-4',
          defaultClassNames.months,
        ),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-control font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative rounded-(--cell-radius)',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          'absolute inset-0 bg-popover opacity-0',
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          'font-medium select-none',
          captionLayout === 'label' || captionLayout === 'panel'
            ? 'text-sm'
            : 'flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 rounded-(--cell-radius) text-xs font-normal text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-0.5 flex w-full', defaultClassNames.week),
        week_number_header: cn(
          'w-(--cell-size) select-none',
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          'text-xs text-muted-foreground select-none',
          defaultClassNames.week_number,
        ),
        day: cn(
          // The 1px inset separates neighbouring day chips; styles/calendar.css
          // draws the range band on the cell so it runs across the gaps.
          'group/day relative w-full px-px py-0 text-center select-none',
          defaultClassNames.day,
        ),
        range_start: cn(defaultClassNames.range_start),
        range_middle: cn(defaultClassNames.range_middle),
        range_end: cn(defaultClassNames.range_end),
        today: cn('text-foreground', defaultClassNames.today),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={dayPickerComponents}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }): React.ReactElement | null {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused)
      ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected
        && !modifiers.range_start
        && !modifiers.range_end
        && !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-today-mark={(modifiers.today && (!modifiers.selected || modifiers.range_middle)) || undefined}
      className={cn(
        'relative isolate z-10 flex size-auto h-(--cell-size) w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal focus-visible:ring-2 focus-visible:ring-ring/50 data-[today-mark=true]:font-medium data-[today-mark=true]:inset-ring data-[today-mark=true]:inset-ring-muted-foreground/40 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-selected data-[range-end=true]:font-medium data-[range-end=true]:text-selected-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-selected data-[range-start=true]:font-medium data-[range-start=true]:text-selected-foreground data-[selected-single=true]:bg-selected data-[selected-single=true]:font-medium data-[selected-single=true]:text-selected-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
