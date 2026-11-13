import type { CSSProperties, ReactElement } from 'react'
import type { LumiScheduleEvent, PlacedEvent } from './scheduleModel.js'
import { LumiButton as Button, LumiMenu as Menu, useUiText } from '@duxweb/lumi-ui'
import { useMemo, useState } from 'react'
import { ChevronRightIcon } from '../icons.js'
import { LumiSegmented } from './LumiSegmented.js'
import { addDays, addMonths, dayKey, eventsOnDay, layoutTimedEvents, localeWeekStart, monthGrid, parseScheduleDate, placeEvents, sameDay, startOfDay, weekDays } from './scheduleModel.js'

export type { LumiScheduleEvent, LumiScheduleTone } from './scheduleModel.js'

export type LumiScheduleView = 'month' | 'week'

export interface LumiScheduleCalendarProps {
  events: readonly LumiScheduleEvent[] | null | undefined
  view?: LumiScheduleView
  onViewChange?: (view: LumiScheduleView) => void
  /** A day inside the visible month or week, `YYYY-MM-DD`; defaults to today. */
  date?: string
  onDateChange?: (date: string) => void
  /** 0 = Sunday … 6 = Saturday; defaults to the locale's first day of the week. */
  weekStartsOn?: number
  /** Overrides the UI locale for weekday and month names. */
  locale?: string
  /** The day drawn as today, `YYYY-MM-DD`; defaults to the current date. */
  today?: string
  /** Visible hours of the week view, 0–24. */
  startHour?: number
  endHour?: number
  /** Chips per month cell before the rest fold into "+N more". */
  maxEvents?: number
  onDayClick?: (date: string) => void
  onEventClick?: (event: LumiScheduleEvent) => void
  ariaLabel?: string
  loading?: boolean
  className?: string
}

const HOUR_HEIGHT = 44
const NO_EVENTS: readonly LumiScheduleEvent[] = []
const eventKey = (event: LumiScheduleEvent): string => `${typeof event.id}:${event.id}`

/**
 * Month and week views of dated events. Navigation and the view are
 * controlled when the page binds them, so a Query can read the visible range;
 * the calendar never fetches.
 */
export function LumiScheduleCalendar(props: LumiScheduleCalendarProps): ReactElement {
  const ui = useUiText()
  const { t } = ui
  const events = props.events ?? NO_EVENTS
  const { onViewChange, onDateChange, onDayClick, onEventClick, startHour = 7, endHour = 20, maxEvents = 3, ariaLabel, loading, className } = props
  const locale = props.locale ?? ui.locale
  const [ownView, setOwnView] = useState<LumiScheduleView>('month')
  const [ownDate, setOwnDate] = useState<string>()
  const view = props.view ?? ownView
  const today = useMemo(() => startOfDay((props.today && parseScheduleDate(props.today)) || new Date()), [props.today])
  const anchor = parseScheduleDate(props.date ?? ownDate ?? '') ?? today
  const weekStartsOn = props.weekStartsOn ?? localeWeekStart(locale)
  const placed = useMemo(() => placeEvents(events), [events])

  const formats = useMemo(() => ({
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    weekdayLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
    month: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    range: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    day: new Intl.DateTimeFormat(locale, { day: 'numeric' }),
    full: new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    hour: new Intl.DateTimeFormat(locale, { hour: 'numeric' }),
  }), [locale])

  const days = weekDays(anchor, weekStartsOn)
  const title = view === 'month' ? formats.month.format(anchor) : formats.range.formatRange(days[0]!, days[6]!)

  const go = (next: Date): void => {
    setOwnDate(dayKey(next))
    onDateChange?.(dayKey(next))
  }
  const step = (direction: 1 | -1): void => go(view === 'month' ? addMonths(anchor, direction) : addDays(anchor, 7 * direction))
  const changeView = (next: string): void => {
    setOwnView(next as LumiScheduleView)
    onViewChange?.(next as LumiScheduleView)
  }

  const chip = (item: PlacedEvent, day: Date, showTime: boolean): ReactElement => {
    const time = !item.allDay && showTime && sameDay(item.start, day) ? formats.time.format(item.start) : undefined
    return (
      <button
        key={eventKey(item.event)}
        type="button"
        className="lumi-schedule__event"
        data-tone={item.event.tone ?? 'primary'}
        data-all-day={item.allDay || undefined}
        title={item.event.title}
        onClick={() => onEventClick?.(item.event)}
      >
        {time && <span className="lumi-schedule__time">{time}</span>}
        <span className="lumi-schedule__event-title">{item.event.title}</span>
      </button>
    )
  }

  const dayButton = (day: Date, label: string): ReactElement => (
    <button
      type="button"
      className="lumi-schedule__day"
      aria-label={formats.full.format(day)}
      aria-current={sameDay(day, today) ? 'date' : undefined}
      data-today={sameDay(day, today) || undefined}
      onClick={() => onDayClick?.(dayKey(day))}
    >
      {label}
    </button>
  )

  return (
    <section className={['lumi-schedule', className].filter(Boolean).join(' ')} aria-label={ariaLabel ?? t('lumi.schedule.name', 'Schedule')} aria-busy={loading || undefined} data-view={view}>
      <div className="lumi-schedule__toolbar">
        <div className="lumi-schedule__nav">
          <Button appearance="outline" size="sm" onClick={() => go(today)}>{t('lumi.schedule.today', 'Today')}</Button>
          <Button appearance="ghost" size="sm" shape="square" aria-label={view === 'month' ? t('lumi.schedule.previousMonth', 'Previous month') : t('lumi.schedule.previousWeek', 'Previous week')} onClick={() => step(-1)}>
            <ChevronRightIcon aria-hidden className="lumi-schedule__back" />
          </Button>
          <Button appearance="ghost" size="sm" shape="square" aria-label={view === 'month' ? t('lumi.schedule.nextMonth', 'Next month') : t('lumi.schedule.nextWeek', 'Next week')} onClick={() => step(1)}>
            <ChevronRightIcon aria-hidden />
          </Button>
          <h3 className="lumi-schedule__title" aria-live="polite">{title}</h3>
        </div>
        <LumiSegmented
          ariaLabel={t('lumi.schedule.view', 'Calendar view')}
          value={view}
          onChange={changeView}
          options={[{ value: 'month', label: t('lumi.schedule.month', 'Month') }, { value: 'week', label: t('lumi.schedule.week', 'Week') }]}
        />
      </div>

      {view === 'month'
        ? (
            <div className="lumi-schedule__scroll">
              <table className="lumi-schedule__month">
                <thead>
                  <tr>
                    {days.map(day => <th key={day.getDay()} scope="col"><abbr title={formats.weekdayLong.format(day)}>{formats.weekday.format(day)}</abbr></th>)}
                  </tr>
                </thead>
                <tbody>
                  {monthGrid(anchor, weekStartsOn).map(week => (
                    <tr key={dayKey(week[0]!)}>
                      {week.map((day) => {
                        const list = eventsOnDay(placed, day)
                        const shown = list.length > maxEvents ? list.slice(0, maxEvents - 1) : list
                        const hidden = list.slice(shown.length)
                        return (
                          <td key={dayKey(day)} data-outside={day.getMonth() !== anchor.getMonth() || undefined} data-today={sameDay(day, today) || undefined}>
                            {dayButton(day, dayNumber(formats.day, day))}
                            <div className="lumi-schedule__events">
                              {shown.map(item => chip(item, day, true))}
                              {hidden.length > 0 && (
                                <Menu
                                  label={t('lumi.schedule.more', '+{count} more', { count: hidden.length })}
                                  appearance="ghost"
                                  size="sm"
                                  className="lumi-schedule__more"
                                  items={hidden.map(item => ({ key: eventKey(item.event), label: item.allDay ? item.event.title : `${formats.time.format(item.start)} ${item.event.title}` }))}
                                  onSelect={(key) => {
                                    const match = hidden.find(item => eventKey(item.event) === key)
                                    if (match)
                                      onEventClick?.(match.event)
                                  }}
                                />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        : (
            <WeekGrid
              days={days}
              today={today}
              placed={placed}
              startHour={Math.max(0, Math.min(startHour, 23))}
              endHour={Math.max(startHour + 1, Math.min(endHour, 24))}
              formats={formats}
              chip={chip}
              dayButton={dayButton}
              allDayLabel={t('lumi.schedule.allDay', 'All day')}
            />
          )}
      {loading && <p className="lumi-schedule__note" role="status">{t('lumi.select.loading', 'Loading…')}</p>}
    </section>
  )
}

/** The day of the month alone: some locales add a unit, e.g. zh-CN "27日". */
function dayNumber(format: Intl.DateTimeFormat, date: Date): string {
  return format.formatToParts(date).find(part => part.type === 'day')?.value ?? String(date.getDate())
}

interface WeekGridProps {
  days: Date[]
  today: Date
  placed: PlacedEvent[]
  startHour: number
  endHour: number
  formats: { weekday: Intl.DateTimeFormat, day: Intl.DateTimeFormat, time: Intl.DateTimeFormat, hour: Intl.DateTimeFormat }
  chip: (item: PlacedEvent, day: Date, showTime: boolean) => ReactElement
  dayButton: (day: Date, label: string) => ReactElement
  allDayLabel: string
}

function WeekGrid({ days, today, placed, startHour, endHour, formats, chip, dayButton, allDayLabel }: WeekGridProps): ReactElement {
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  return (
    <div className="lumi-schedule__scroll">
      <div className="lumi-schedule__week" style={{ '--lumi-schedule-hour': `${HOUR_HEIGHT}px`, '--lumi-schedule-hours': hours.length } as CSSProperties}>
        <div className="lumi-schedule__corner" aria-hidden />
        {days.map(day => (
          <div key={dayKey(day)} className="lumi-schedule__head" data-today={sameDay(day, today) || undefined}>
            <span className="lumi-schedule__weekday" aria-hidden>{formats.weekday.format(day)}</span>
            {dayButton(day, dayNumber(formats.day, day))}
          </div>
        ))}
        <div className="lumi-schedule__gutter lumi-schedule__all-day-label">{allDayLabel}</div>
        {days.map(day => (
          <div key={dayKey(day)} className="lumi-schedule__all-day" data-today={sameDay(day, today) || undefined}>
            {eventsOnDay(placed, day).filter(item => item.allDay).map(item => chip(item, day, false))}
          </div>
        ))}
        <div className="lumi-schedule__gutter lumi-schedule__hours" aria-hidden>
          {hours.map(hour => <span key={hour}>{formats.hour.format(new Date(2000, 0, 1, hour))}</span>)}
        </div>
        {days.map(day => (
          <div key={dayKey(day)} className="lumi-schedule__column" data-today={sameDay(day, today) || undefined}>
            {layoutTimedEvents(placed, day, startHour, endHour).map(item => (
              <div
                key={eventKey(item.event)}
                className="lumi-schedule__slot"
                style={{ top: `${item.top * 100}%`, height: `${item.height * 100}%`, left: `${(item.lane / item.lanes) * 100}%`, width: `${100 / item.lanes}%` }}
              >
                {chip(item, day, true)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
