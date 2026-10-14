/**
 * Antra — timezone helpers for the Worker.
 *
 * Expense timestamps are stored in UTC. "Today" and "this month" boundaries are
 * resolved in the user's configured timezone (default Asia/Kolkata) so that a
 * late-night expense lands on the right day.
 */

export interface ZonedParts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number
  minute: number
  second: number
  weekday: number // 0 = Sunday
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  let dtf: Intl.DateTimeFormat
  try {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
  } catch {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
  }
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = p.value
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS[map.weekday ?? 'Sun'] ?? 0,
  }
}

/** Offset of a timezone (ms) at a given instant: localWallClock − UTC. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - date.getTime()
}

/** UTC instant of 00:00 local time on the given local calendar date. */
function utcFromLocalWallClock(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0)
  const offset = tzOffsetMs(new Date(guess), timeZone)
  let result = guess - offset
  // Re-check once for DST transitions.
  const offset2 = tzOffsetMs(new Date(result), timeZone)
  if (offset2 !== offset) result = guess - offset2
  return new Date(result)
}

export function startOfDayUtc(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone)
  return utcFromLocalWallClock(p.year, p.month, p.day, timeZone)
}

export function startOfMonthUtc(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone)
  return utcFromLocalWallClock(p.year, p.month, 1, timeZone)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function localDayOfMonth(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).day
}

export function localMonthLength(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  return daysInMonth(p.year, p.month)
}

export function isoWeekKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
