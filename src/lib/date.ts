/**
 * Antra — date helpers.
 *
 * Boundaries ("today", "this month") use the *device* timezone, which is the
 * phone's own timezone — the sensible default for a single-user phone app. All
 * timestamps are still stored in UTC.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isSameMonth,
  isToday,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'

export type RangeKind = 'day' | 'week' | 'month' | 'year'

export interface DateRange {
  kind: RangeKind
  /** Inclusive start, local time. */
  start: Date
  /** Inclusive end, local time. */
  end: Date
}

export {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  isSameDay,
  isSameMonth,
  isToday,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfYear,
  endOfYear,
}

export function rangeFor(kind: RangeKind, date: Date, weekStartsOn: 0 | 1 = 1): DateRange {
  switch (kind) {
    case 'day':
      return { kind, start: startOfDay(date), end: endOfDay(date) }
    case 'week':
      return {
        kind,
        start: startOfWeek(date, { weekStartsOn }),
        end: endOfWeek(date, { weekStartsOn }),
      }
    case 'year':
      return { kind, start: startOfYear(date), end: endOfYear(date) }
    case 'month':
    default:
      return { kind, start: startOfMonth(date), end: endOfMonth(date) }
  }
}

/** The immediately preceding equivalent range (for "vs previous period"). */
export function previousRange(range: DateRange, weekStartsOn: 0 | 1 = 1): DateRange {
  switch (range.kind) {
    case 'day':
      return rangeFor('day', addDays(range.start, -1), weekStartsOn)
    case 'week':
      return rangeFor('week', addWeeks(range.start, -1), weekStartsOn)
    case 'year':
      return rangeFor('year', addYears(range.start, -1), weekStartsOn)
    case 'month':
    default:
      return rangeFor('month', addMonths(range.start, -1), weekStartsOn)
  }
}

export function shiftRange(range: DateRange, direction: 1 | -1, weekStartsOn: 0 | 1 = 1): DateRange {
  switch (range.kind) {
    case 'day':
      return rangeFor('day', addDays(range.start, direction), weekStartsOn)
    case 'week':
      return rangeFor('week', addWeeks(range.start, direction), weekStartsOn)
    case 'year':
      return rangeFor('year', addYears(range.start, direction), weekStartsOn)
    case 'month':
    default:
      return rangeFor('month', addMonths(range.start, direction), weekStartsOn)
  }
}

export function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

/** Local calendar key, e.g. "2026-10-14". */
export function dayKey(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'yyyy-MM-dd')
}

export function monthKey(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'yyyy-MM')
}

export function formatTime(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'h:mm a')
}

export function formatDayHeading(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, d MMM')
}

export function formatFullDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'd MMM yyyy')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'd MMM yyyy, h:mm a')
}

export function formatMonthLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMMM yyyy')
}

export function formatShortMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM')
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNowStrict(d, { addSuffix: true })
}

export function formatWeekdayShort(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'EEE')
}

export function eachDayOfRange(range: DateRange): Date[] {
  const days: Date[] = []
  let cursor = startOfDay(range.start)
  const last = startOfDay(range.end)
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

export function daysInMonthOf(date: Date): number {
  return endOfMonth(date).getDate()
}

export function dayOfMonth(date: Date): number {
  return date.getDate()
}

/** Days left in the month, including today. */
export function daysLeftInMonth(date: Date): number {
  return daysInMonthOf(date) - dayOfMonth(date) + 1
}

export function minutesOfDay(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.getHours() * 60 + d.getMinutes()
}

export function weekdayIndex(date: Date | string): number {
  return (typeof date === 'string' ? new Date(date) : date).getDay()
}

/** ISO range bounds for Dexie queries (inclusive). */
export function rangeBounds(range: DateRange): [string, string] {
  return [range.start.toISOString(), range.end.toISOString()]
}
