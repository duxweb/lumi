export type LumiScheduleTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface LumiScheduleEvent {
  id: string | number
  title: string
  /** `YYYY-MM-DD` for an all-day event, or a date-time such as `2026-08-10T09:30`. */
  start: string
  /** Exclusive end; an all-day end date is inclusive. Defaults to one hour, or the start day. */
  end?: string | undefined
  allDay?: boolean | undefined
  tone?: LumiScheduleTone | undefined
}

export interface PlacedEvent<T extends LumiScheduleEvent = LumiScheduleEvent> {
  event: T
  start: Date
  end: Date
  allDay: boolean
}

export interface TimedLayout<T extends LumiScheduleEvent = LumiScheduleEvent> extends PlacedEvent<T> {
  /** Offset and length as fractions of the visible hours. */
  top: number
  height: number
  /** Column inside its overlap group, and how many columns the group needs. */
  lane: number
  lanes: number
}

const DAY_MS = 86_400_000
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Dates without a zone are wall-clock times in the viewer's zone — `new Date`
 * would read a bare date as UTC midnight and shift it a day west of Greenwich.
 */
export function parseScheduleDate(value: string): Date | undefined {
  const day = DATE_ONLY_RE.exec(value)
  if (day)
    return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
  const local = LOCAL_DATE_TIME_RE.exec(value)
  if (local)
    return new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6] ?? 0))
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes())
}

export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last))
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function sameDay(left: Date, right: Date): boolean {
  return dayKey(left) === dayKey(right)
}

/** 0 = Sunday … 6 = Saturday, from the locale's own week where the runtime knows it. */
export function localeWeekStart(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }, weekInfo?: { firstDay: number } }
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay
    if (firstDay)
      return firstDay % 7
  }
  catch {}
  const region = (() => {
    try {
      return new Intl.Locale(locale).maximize().region
    }
    catch {
      return undefined
    }
  })()
  return region && ['US', 'CA', 'JP', 'BR', 'IL', 'MX', 'PH', 'KR', 'TW', 'HK', 'SA', 'IN'].includes(region) ? 0 : 1
}

export function startOfWeek(date: Date, weekStartsOn: number): Date {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() - weekStartsOn + 7) % 7))
}

/** Whole weeks covering the month of `anchor`: four to six rows of seven days. */
export function monthGrid(anchor: Date, weekStartsOn: number): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const weeks: Date[][] = []
  for (let cursor = startOfWeek(first, weekStartsOn); cursor <= last; cursor = addDays(cursor, 7))
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)))
  return weeks
}

export function weekDays(anchor: Date, weekStartsOn: number): Date[] {
  const start = startOfWeek(anchor, weekStartsOn)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** Resolves start/end; unparsable events are dropped rather than drawn at the epoch. */
export function placeEvents<T extends LumiScheduleEvent>(events: readonly T[]): PlacedEvent<T>[] {
  return events.flatMap((event): PlacedEvent<T>[] => {
    const parsedStart = parseScheduleDate(event.start)
    if (!parsedStart)
      return []
    const allDay = event.allDay ?? DATE_ONLY_RE.test(event.start)
    const parsedEnd = event.end ? parseScheduleDate(event.end) : undefined
    if (!allDay) {
      const end = parsedEnd && parsedEnd > parsedStart ? parsedEnd : new Date(parsedStart.getTime() + 3_600_000)
      return [{ event, start: parsedStart, end, allDay }]
    }
    const start = startOfDay(parsedStart)
    const last = parsedEnd && parsedEnd >= start ? parsedEnd : start
    const lastDay = startOfDay(last)
    // A bare end date names the last day; a date-time end at midnight already excludes it.
    const inclusive = !event.end || DATE_ONLY_RE.test(event.end) || last.getTime() !== lastDay.getTime()
    const end = addDays(lastDay, inclusive ? 1 : 0)
    return [{ event, start, end: end > start ? end : addDays(start, 1), allDay }]
  }).sort((left, right) => left.start.getTime() - right.start.getTime() || right.end.getTime() - left.end.getTime())
}

/** Events touching the day `[day, day + 1)`, all-day ones first. */
export function eventsOnDay<T extends LumiScheduleEvent>(placed: readonly PlacedEvent<T>[], day: Date): PlacedEvent<T>[] {
  const from = startOfDay(day).getTime()
  const to = from + DAY_MS
  return placed
    .filter(item => item.start.getTime() < to && item.end.getTime() > from)
    .sort((left, right) => Number(right.allDay) - Number(left.allDay))
}

/**
 * Week-view geometry for one day's timed events. Events that overlap, directly
 * or through a chain, form one group; each gets the first free lane and the
 * whole group shares the group's lane count, so chips never cover each other.
 */
export function layoutTimedEvents<T extends LumiScheduleEvent>(placed: readonly PlacedEvent<T>[], day: Date, startHour = 0, endHour = 24): TimedLayout<T>[] {
  const base = startOfDay(day).getTime()
  const from = base + startHour * 3_600_000
  const to = base + endHour * 3_600_000
  const span = to - from
  const timed = placed
    .filter(item => !item.allDay && item.start.getTime() < to && item.end.getTime() > from)
    .map(item => ({ ...item, s: Math.max(item.start.getTime(), from), e: Math.min(item.end.getTime(), to) }))
    .sort((left, right) => left.s - right.s || right.e - left.e)

  const result: TimedLayout<T>[] = []
  let group: (TimedLayout<T> & { e: number })[] = []
  let groupEnd = -Infinity
  const flush = (): void => {
    const lanes = Math.max(1, ...group.map(item => item.lane + 1))
    for (const { e: _e, ...item } of group)
      result.push({ ...item, lanes })
    group = []
  }
  for (const item of timed) {
    if (item.s >= groupEnd && group.length)
      flush()
    const laneEnds: number[] = []
    for (const placedItem of group)
      laneEnds[placedItem.lane] = Math.max(laneEnds[placedItem.lane] ?? -Infinity, placedItem.e)
    let lane = laneEnds.findIndex(end => end <= item.s)
    if (lane === -1)
      lane = laneEnds.length
    const { s, e, ...rest } = item
    group.push({ ...rest, e, top: (s - from) / span, height: Math.max(e - s, 900_000) / span, lane, lanes: 1 })
    groupEnd = Math.max(groupEnd, e)
  }
  if (group.length)
    flush()
  return result
}
