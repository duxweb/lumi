import type { ReactElement, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { DayPickerProps, MonthCaptionProps, MonthsProps } from 'react-day-picker'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isDateAfterType, isDateBeforeType, isDateInterval, useDayPicker } from 'react-day-picker'
import { useUiText } from '../components/text.js'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons.js'
import { Button, buttonVariants } from './shadcn/button.js'
import { cn } from './utils.js'

/**
 * Month and year panels for the day picker. A month caption is a button that
 * swaps the day grids for a grid of the year's months; the panel caption in
 * turn swaps to a page of years. Picking a year returns to its months, picking
 * a month returns to the days. The panel covers the day grids, which stay laid
 * out (only hidden) so the popover keeps its size while the views change.
 */

type PanelView = 'month' | 'year'

interface PanelState {
  view: PanelView
  /** Display index of the month whose caption opened the panel. */
  index: number
  /** The year the month grid shows. */
  year: number
  /** First year of the year grid's page. */
  start: number
  /** The cell holding the roving tab stop. */
  focus: number
}

const PAGE = 12
const pageStart = (year: number): number => Math.floor(year / PAGE) * PAGE
const ordinal = (date: Date): number => date.getFullYear() * 12 + date.getMonth()

type Bounds = [min: number | undefined, max: number | undefined]

/** The first and last navigable months, from start/end months and before/after day matchers. */
function monthBounds({ startMonth, endMonth, disabled }: DayPickerProps): Bounds {
  let min = startMonth ? ordinal(startMonth) : undefined
  let max = endMonth ? ordinal(endMonth) : undefined
  for (const matcher of disabled === undefined ? [] : Array.isArray(disabled) ? disabled : [disabled]) {
    if (isDateInterval(matcher))
      continue
    if (isDateBeforeType(matcher))
      min = Math.max(min ?? -Infinity, ordinal(matcher.before))
    else if (isDateAfterType(matcher))
      max = Math.min(max ?? Infinity, ordinal(matcher.after))
  }
  return [min, max]
}

/** Whether the months `from`..`to` (as ordinals) all fall outside the bounds. */
const outside = (from: number, to: number, [min, max]: Bounds): boolean => (min !== undefined && to < min) || (max !== undefined && from > max)

const PanelOpenContext = createContext<((index: number) => void) | undefined>(undefined)

// The thin keyboard-only focus ring shared with the day buttons.
const FOCUS_CLASS = 'focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring/50'
const NAV_CLASS = cn(buttonVariants({ variant: 'ghost' }), 'size-(--cell-size) p-0 select-none rtl:[&>svg]:rotate-180', FOCUS_CLASS)
// Positioned so it stacks above the day picker's absolutely placed navigation.
// Only colours transition: a transitioned visibility would keep the caption
// unfocusable for a frame when the panel closes and focus returns to it.
const CAPTION_CLASS = cn(buttonVariants({ variant: 'ghost' }), 'relative h-(--cell-size) gap-1 px-2 text-sm transition-colors [&>svg]:size-3.5 [&>svg]:text-muted-foreground', FOCUS_CLASS)
// Hover, focus, selected and current states match the day buttons.
const CELL_CLASS = cn('h-(--cell-size) w-full px-1 font-normal tabular-nums data-[current=true]:font-medium data-[current=true]:text-foreground data-[current=true]:inset-ring data-[current=true]:inset-ring-muted-foreground/40 data-[selected=true]:bg-selected data-[selected=true]:font-medium data-[selected=true]:text-selected-foreground dark:hover:text-foreground', FOCUS_CLASS)

/** The month caption as a button that opens the month grid. */
export function CalendarMonthCaption({ calendarMonth, displayIndex, children, ...props }: MonthCaptionProps): ReactElement {
  const open = useContext(PanelOpenContext)
  const { formatters } = useDayPicker()
  const { t } = useUiText()
  if (!open)
    return <div {...props}>{children}</div>
  const caption = String(formatters.formatCaption(calendarMonth.date))
  return (
    <div {...props}>
      {/* The caption label stays as the polite live region announcing month changes. */}
      <span className="sr-only">{children}</span>
      <button
        type="button"
        data-slot="calendar-caption"
        data-index={displayIndex}
        className={CAPTION_CLASS}
        aria-label={t('lumi.calendar.showMonths', '{date}, choose the month', { date: caption })}
        onClick={() => open(displayIndex)}
      >
        {caption}
        <ChevronDownIcon aria-hidden />
      </button>
    </div>
  )
}

/** The months container, which also hosts the month and year panel above the day grids. */
export function CalendarMonths({ children, className, ...props }: MonthsProps): ReactElement {
  const { months, goToMonth } = useDayPicker()
  const [panel, setPanel] = useState<PanelState>()
  const root = useRef<HTMLDivElement>(null)
  const restore = useRef<number>(undefined)
  const open = useCallback((index: number): void => {
    const date = (months[index] ?? months[0])!.date
    setPanel({ view: 'month', index, year: date.getFullYear(), start: pageStart(date.getFullYear()), focus: date.getMonth() })
  }, [months])
  const close = (): void => {
    restore.current = panel?.index
    setPanel(undefined)
  }
  useEffect(() => {
    if (panel || restore.current === undefined)
      return
    root.current?.querySelector<HTMLElement>(`[data-slot="calendar-caption"][data-index="${restore.current}"]`)?.focus()
    restore.current = undefined
  }, [panel])
  return (
    <PanelOpenContext.Provider value={open}>
      <div
        ref={root}
        {...props}
        data-view={panel?.view}
        className={cn(className, '[&[data-view]>:not([data-slot=calendar-panel])]:invisible')}
      >
        {children}
        {panel && (
          <CalendarPanel
            state={panel}
            onState={setPanel}
            onClose={close}
            onPick={(month) => {
              goToMonth(new Date(panel.year, month - panel.index, 1))
              close()
            }}
          />
        )}
      </div>
    </PanelOpenContext.Provider>
  )
}

interface PanelProps {
  state: PanelState
  onState: (next: PanelState) => void
  onPick: (month: number) => void
  onClose: () => void
}

interface Cell { key: number, text: string, label: string, selected: boolean, current: boolean, disabled: boolean }

function CalendarPanel({ state, onState, onPick, onClose }: PanelProps): ReactElement {
  const { months, dayPickerProps } = useDayPicker()
  const { t, locale } = useUiText()
  const tag = dayPickerProps.locale?.code ?? locale
  const formats = useMemo(() => ({
    year: new Intl.DateTimeFormat(tag, { year: 'numeric' }),
    month: new Intl.DateTimeFormat(tag, { month: 'short' }),
    monthYear: new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }),
    number: new Intl.NumberFormat(tag, { useGrouping: false }),
  }), [tag])
  const root = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  // Focus follows the grid only after opening, switching view or keyboard moves,
  // so paging with the header buttons leaves focus on them.
  const moveFocus = useRef(true)
  const bounds = monthBounds(dayPickerProps)
  const today = dayPickerProps.today ?? new Date()
  const shown = (months[state.index] ?? months[0])!.date
  const monthView = state.view === 'month'

  const cells: Cell[] = monthView
    ? Array.from({ length: 12 }, (_, month) => {
        const date = new Date(state.year, month, 1)
        const value = ordinal(date)
        return { key: month, text: formats.month.format(date), label: formats.monthYear.format(date), selected: value === ordinal(shown), current: value === ordinal(today), disabled: outside(value, value, bounds) }
      })
    : Array.from({ length: PAGE }, (_, offset) => {
        const year = state.start + offset
        return { key: year, text: formats.number.format(year), label: formats.year.format(new Date(year, 0, 1)), selected: year === state.year, current: year === today.getFullYear(), disabled: outside(year * 12, year * 12 + 11, bounds) }
      })
  const first = cells.findIndex(cell => !cell.disabled)
  const last = cells.reduce((found, cell, index) => cell.disabled ? found : index, -1)
  const tabStop = cells[state.focus]?.disabled === false ? state.focus : first

  const canPage = (step: number): boolean => {
    const first = monthView ? state.year + step : state.start + step * PAGE
    return !outside(first * 12, (first + (monthView ? 1 : PAGE)) * 12 - 1, bounds)
  }
  const page = (step: number, focus = state.focus): void => {
    if (canPage(step))
      onState(monthView ? { ...state, year: state.year + step, focus } : { ...state, start: state.start + step * PAGE, focus })
  }
  const showYears = (): void => {
    moveFocus.current = true
    onState({ ...state, view: 'year', start: pageStart(state.year), focus: state.year - pageStart(state.year) })
  }
  const pick = (index: number): void => {
    if (monthView) {
      onPick(index)
      return
    }
    moveFocus.current = true
    onState({ ...state, view: 'month', year: state.start + index, focus: shown.getMonth() })
  }

  useEffect(() => {
    if (!moveFocus.current)
      return
    moveFocus.current = false
    const buttons = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const target = buttons[state.focus]
    ;(target && !target.disabled ? target : buttons.find(button => !button.disabled))?.focus()
  })

  // Escape steps back one view. The listener runs in the window capture phase,
  // ahead of the popover's own Escape handling, so the popover stays open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !(event.target instanceof Node) || !root.current?.contains(event.target))
        return
      event.preventDefault()
      event.stopPropagation()
      if (state.view === 'year') {
        moveFocus.current = true
        onState({ ...state, view: 'month', focus: shown.getMonth() })
      }
      else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state, shown, onState, onClose])

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const template = grid.current ? getComputedStyle(grid.current).gridTemplateColumns : ''
    const columns = template && template !== 'none' ? template.split(' ').length : 3
    const rtl = dayPickerProps.dir === 'rtl'
    const steps: Record<string, number> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -columns, ArrowDown: columns }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const direction = event.key === 'PageUp' ? -1 : 1
      if (canPage(direction)) {
        moveFocus.current = true
        page(direction)
      }
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const edge = event.key === 'Home' ? first : last
      if (edge >= 0) {
        moveFocus.current = true
        onState({ ...state, focus: edge })
      }
      return
    }
    const step = steps[event.key]
    if (step === undefined)
      return
    event.preventDefault()
    const next = state.focus + step
    if (next < 0 || next >= cells.length) {
      // Moving off the grid's edge turns the page, landing on the matching cell.
      const direction = next < 0 ? -1 : 1
      if (canPage(direction)) {
        moveFocus.current = true
        page(direction, next - direction * cells.length)
      }
      return
    }
    if (cells[next]?.disabled !== false)
      return
    moveFocus.current = true
    onState({ ...state, focus: next })
  }

  const heading = monthView
    ? formats.year.format(new Date(state.year, 0, 1))
    : `${formats.number.format(state.start)} – ${formats.number.format(state.start + PAGE - 1)}`
  return (
    <div ref={root} data-slot="calendar-panel" data-view={state.view} className="absolute inset-0 z-10 flex flex-col gap-2 @container">
      <span role="status" aria-live="polite" className="sr-only">{heading}</span>
      <div className="flex h-(--cell-size) items-center justify-between gap-1">
        <button
          type="button"
          className={NAV_CLASS}
          disabled={!canPage(-1)}
          aria-label={monthView ? t('lumi.calendar.previousYear', 'Go to the previous year') : t('lumi.calendar.previousYears', 'Go to the previous {count} years', { count: PAGE })}
          onClick={() => page(-1)}
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        {monthView
          ? (
              <button
                type="button"
                data-slot="calendar-panel-caption"
                className={CAPTION_CLASS}
                aria-label={t('lumi.calendar.showYears', '{year}, choose the year', { year: heading })}
                onClick={showYears}
              >
                {heading}
                <ChevronDownIcon aria-hidden />
              </button>
            )
          : <span data-slot="calendar-panel-caption" aria-hidden className="text-sm font-medium tabular-nums select-none">{heading}</span>}
        <button
          type="button"
          className={NAV_CLASS}
          disabled={!canPage(1)}
          aria-label={monthView ? t('lumi.calendar.nextYear', 'Go to the next year') : t('lumi.calendar.nextYears', 'Go to the next {count} years', { count: PAGE })}
          onClick={() => page(1)}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      <div
        ref={grid}
        role="radiogroup"
        aria-label={monthView ? t('lumi.calendar.chooseMonth', 'Choose the month') : t('lumi.calendar.chooseYear', 'Choose the year')}
        className="grid max-h-64 flex-1 grid-cols-3 content-evenly gap-x-2 gap-y-1 @min-[24rem]:grid-cols-4"
        onKeyDown={onGridKeyDown}
      >
        {cells.map((cell, index) => (
          <Button
            key={cell.key}
            type="button"
            variant="ghost"
            role="radio"
            aria-checked={cell.selected}
            aria-current={cell.current ? 'date' : undefined}
            aria-label={cell.label}
            data-selected={cell.selected || undefined}
            data-current={(cell.current && !cell.selected) || undefined}
            disabled={cell.disabled}
            tabIndex={index === tabStop ? 0 : -1}
            className={CELL_CLASS}
            onClick={() => pick(index)}
          >
            {cell.text}
          </Button>
        ))}
      </div>
    </div>
  )
}
