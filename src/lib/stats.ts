/**
 * Antra — analytics. Every function here is pure and operates on already-loaded
 * arrays, so it can be wrapped in `useMemo` and never touches the network.
 */
import { computeBudgetProgress, type BudgetProgress } from '@shared/budget'
import type { Account, Budget, Category, Expense } from '@shared/types'
import {
  addDays,
  dayKey,
  dayOfMonth,
  daysInMonthOf,
  differenceInCalendarDays,
  eachDayOfRange,
  inRange,
  minutesOfDay,
  previousRange,
  startOfDay,
  startOfMonth,
  weekdayIndex,
  type DateRange,
} from './date'

export const activeExpenses = (expenses: Expense[]): Expense[] => expenses.filter((e) => !e.deleted_at)

export function inRangeList(expenses: Expense[], range: DateRange): Expense[] {
  return activeExpenses(expenses).filter((e) => inRange(e.spent_at, range))
}

export function sumMinor(expenses: Expense[]): number {
  let total = 0
  for (const e of expenses) total += e.amount_minor
  return total
}

export interface MerchantStat {
  name: string
  count: number
  totalMinor: number
}

export function merchantStats(expenses: Expense[]): MerchantStat[] {
  const map = new Map<string, MerchantStat>()
  for (const e of expenses) {
    const name = (e.merchant || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.count++
      existing.totalMinor += e.amount_minor
    } else {
      map.set(key, { name, count: 1, totalMinor: e.amount_minor })
    }
  }
  return [...map.values()].sort((a, b) => b.totalMinor - a.totalMinor)
}

export interface RangeStats {
  totalMinor: number
  previousTotalMinor: number
  deltaPercent: number
  count: number
  dailyAverageMinor: number
  largest: Expense | null
  topMerchant: MerchantStat | null
  activeDays: number
}

export function rangeStats(expenses: Expense[], range: DateRange, weekStartsOn: 0 | 1 = 1): RangeStats {
  const current = inRangeList(expenses, range)
  const previous = inRangeList(expenses, previousRange(range, weekStartsOn))
  const totalMinor = sumMinor(current)
  const previousTotalMinor = sumMinor(previous)
  const dayCount = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1)
  const uniqueDays = new Set(current.map((e) => dayKey(e.spent_at))).size

  let largest: Expense | null = null
  for (const e of current) if (!largest || e.amount_minor > largest.amount_minor) largest = e

  const merchants = merchantStats(current)
  const topMerchant = merchants.length ? merchants.reduce((best, m) => (m.count > best.count ? m : best), merchants[0]) : null

  return {
    totalMinor,
    previousTotalMinor,
    deltaPercent: previousTotalMinor > 0 ? ((totalMinor - previousTotalMinor) / previousTotalMinor) * 100 : totalMinor > 0 ? 100 : 0,
    count: current.length,
    dailyAverageMinor: Math.round(totalMinor / dayCount),
    largest,
    topMerchant,
    activeDays: uniqueDays,
  }
}

export interface DayTotal {
  key: string
  date: Date
  minor: number
  cumulativeMinor: number
}

/** Per-day totals across the range, with a running cumulative sum. */
export function dailyTotals(expenses: Expense[], range: DateRange): DayTotal[] {
  const within = inRangeList(expenses, range)
  const byDay = new Map<string, number>()
  for (const e of within) byDay.set(dayKey(e.spent_at), (byDay.get(dayKey(e.spent_at)) ?? 0) + e.amount_minor)

  let cumulative = 0
  return eachDayOfRange(range).map((date) => {
    const key = dayKey(date)
    const minor = byDay.get(key) ?? 0
    cumulative += minor
    return { key, date, minor, cumulativeMinor: cumulative }
  })
}

export interface CategorySlice {
  category: Category | undefined
  categoryId: string
  minor: number
  count: number
  percent: number
}

export function categoryBreakdown(expenses: Expense[], categories: Category[], limit?: number): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, { minor: number; count: number }>()
  for (const e of activeExpenses(expenses)) {
    const entry = totals.get(e.category_id) ?? { minor: 0, count: 0 }
    entry.minor += e.amount_minor
    entry.count++
    totals.set(e.category_id, entry)
  }
  const grand = [...totals.values()].reduce((sum, v) => sum + v.minor, 0)
  const slices: CategorySlice[] = [...totals.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      category: byId.get(categoryId),
      minor: v.minor,
      count: v.count,
      percent: grand > 0 ? (v.minor / grand) * 100 : 0,
    }))
    .sort((a, b) => b.minor - a.minor)
  return limit ? slices.slice(0, limit) : slices
}

export function categoryTotalsMap(expenses: Expense[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of activeExpenses(expenses)) map.set(e.category_id, (map.get(e.category_id) ?? 0) + e.amount_minor)
  return map
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface DistributionBucket {
  label: string
  minor: number
  count: number
}

export function weekdayDistribution(expenses: Expense[]): DistributionBucket[] {
  const buckets: DistributionBucket[] = WEEKDAYS.map((label) => ({ label, minor: 0, count: 0 }))
  for (const e of activeExpenses(expenses)) {
    const idx = weekdayIndex(e.spent_at)
    buckets[idx].minor += e.amount_minor
    buckets[idx].count++
  }
  return buckets
}

const TIME_BUCKETS: Array<{ label: string; from: number; to: number }> = [
  { label: 'Night', from: 0, to: 6 * 60 },
  { label: 'Morning', from: 6 * 60, to: 12 * 60 },
  { label: 'Afternoon', from: 12 * 60, to: 17 * 60 },
  { label: 'Evening', from: 17 * 60, to: 21 * 60 },
  { label: 'Night', from: 21 * 60, to: 24 * 60 },
]

export function timeOfDayDistribution(expenses: Expense[]): DistributionBucket[] {
  const buckets: DistributionBucket[] = [
    { label: 'Night', minor: 0, count: 0 },
    { label: 'Morning', minor: 0, count: 0 },
    { label: 'Afternoon', minor: 0, count: 0 },
    { label: 'Evening', minor: 0, count: 0 },
  ]
  for (const e of activeExpenses(expenses)) {
    const minutes = minutesOfDay(e.spent_at)
    const idx = minutes < 6 * 60 ? 0 : minutes < 12 * 60 ? 1 : minutes < 17 * 60 ? 2 : 3
    buckets[idx].minor += e.amount_minor
    buckets[idx].count++
  }
  return buckets
}

export { TIME_BUCKETS }

export interface AccountSlice {
  account: Account | undefined
  accountId: string
  minor: number
  count: number
  percent: number
  isCard: boolean
}

export function accountBreakdown(expenses: Expense[], accounts: Account[], limit?: number): AccountSlice[] {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const totals = new Map<string, { minor: number; count: number }>()
  for (const e of activeExpenses(expenses)) {
    const entry = totals.get(e.account_id) ?? { minor: 0, count: 0 }
    entry.minor += e.amount_minor
    entry.count++
    totals.set(e.account_id, entry)
  }
  const grand = [...totals.values()].reduce((sum, v) => sum + v.minor, 0)
  const slices = [...totals.entries()]
    .map(([accountId, v]) => ({
      accountId,
      account: byId.get(accountId),
      minor: v.minor,
      count: v.count,
      percent: grand > 0 ? (v.minor / grand) * 100 : 0,
      isCard: byId.get(accountId)?.type === 'credit_card',
    }))
    .sort((a, b) => b.minor - a.minor)
  return limit ? slices.slice(0, limit) : slices
}

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------
export interface CardStats {
  account: Account
  outstandingMinor: number
  unpaidCount: number
  totalMinor: number
  utilization: number
  nextDueDate: Date | null
  daysUntilDue: number | null
  statementDate: Date | null
  limitMinor: number
}

/** Next occurrence of a day-of-month, clamped to the month length. */
export function nextMonthlyDate(day: number, from: Date): Date {
  const clamped = (year: number, month: number) => {
    const last = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, last))
  }
  const thisMonth = clamped(from.getFullYear(), from.getMonth())
  if (thisMonth.getTime() >= startOfDay(from).getTime()) return thisMonth
  return clamped(from.getFullYear(), from.getMonth() + 1)
}

export function cardStats(accounts: Account[], expenses: Expense[], now = new Date()): CardStats[] {
  const live = activeExpenses(expenses)
  return accounts
    .filter((a) => a.type === 'credit_card' && !a.deleted_at)
    .map((account) => {
      const mine = live.filter((e) => e.account_id === account.id)
      const unpaid = mine.filter((e) => e.paid === 0)
      const outstandingMinor = sumMinor(unpaid)
      const limit = account.credit_limit_minor ?? 0
      const nextDueDate = account.due_day ? nextMonthlyDate(account.due_day, now) : null
      return {
        account,
        outstandingMinor,
        unpaidCount: unpaid.length,
        totalMinor: sumMinor(mine),
        utilization: limit > 0 ? (outstandingMinor / limit) * 100 : 0,
        nextDueDate,
        daysUntilDue: nextDueDate ? differenceInCalendarDays(nextDueDate, startOfDay(now)) : null,
        statementDate: account.statement_day ? nextMonthlyDate(account.statement_day, now) : null,
        limitMinor: limit,
      }
    })
    .sort((a, b) => b.outstandingMinor - a.outstandingMinor)
}

export function totalOutstanding(cards: CardStats[]): number {
  return cards.reduce((sum, c) => sum + c.outstandingMinor, 0)
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
export interface BudgetRow {
  category: Category
  budget: Budget | null
  spentMinor: number
  progress: BudgetProgress | null
}

export function budgetRows(
  categories: Category[],
  budgets: Budget[],
  expenses: Expense[],
  now = new Date(),
): BudgetRow[] {
  const monthStart = startOfMonth(now)
  const monthExpenses = activeExpenses(expenses).filter((e) => new Date(e.spent_at).getTime() >= monthStart.getTime())
  const byCategory = new Map<string, number>()
  for (const e of monthExpenses) byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + e.amount_minor)

  const budgetByCategory = new Map<string, Budget>()
  for (const b of budgets) if (!b.deleted_at && !budgetByCategory.has(b.category_id)) budgetByCategory.set(b.category_id, b)

  const dayOfMonthValue = dayOfMonth(now)
  const daysInMonthValue = daysInMonthOf(now)

  const rows: BudgetRow[] = categories.map((category) => {
    const budget = budgetByCategory.get(category.id) ?? null
    const spentMinor = byCategory.get(category.id) ?? 0
    return {
      category,
      budget,
      spentMinor,
      progress: budget
        ? computeBudgetProgress({
            spentMinor,
            limitMinor: budget.amount_minor,
            dayOfMonth: dayOfMonthValue,
            daysInMonth: daysInMonthValue,
          })
        : null,
    }
  })

  return rows.sort((a, b) => {
    const ap = a.progress?.percentUsed ?? -1
    const bp = b.progress?.percentUsed ?? -1
    if (ap !== bp) return bp - ap
    return a.category.sort_order - b.category.sort_order
  })
}

/** Spend in a single category this month (used by the add-expense flow). */
export function categoryMonthSpend(expenses: Expense[], categoryId: string, now = new Date()): number {
  const monthStart = startOfMonth(now)
  return activeExpenses(expenses)
    .filter((e) => e.category_id === categoryId && new Date(e.spent_at).getTime() >= monthStart.getTime())
    .reduce((sum, e) => sum + e.amount_minor, 0)
}

// ---------------------------------------------------------------------------
// Calendar heatmap
// ---------------------------------------------------------------------------
export interface HeatCell {
  date: Date
  key: string
  minor: number
  level: 0 | 1 | 2 | 3 | 4
  inMonth: boolean
  isFuture: boolean
}

export function calendarHeatmap(expenses: Expense[], monthDate: Date, now = new Date()): HeatCell[] {
  const first = startOfMonth(monthDate)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const gridStart = addDays(first, -first.getDay())
  const gridEnd = addDays(last, 6 - last.getDay())

  const byDay = new Map<string, number>()
  for (const e of activeExpenses(expenses)) byDay.set(dayKey(e.spent_at), (byDay.get(dayKey(e.spent_at)) ?? 0) + e.amount_minor)

  const values = [...byDay.values()].sort((a, b) => a - b)
  const quantile = (q: number) => (values.length ? values[Math.min(values.length - 1, Math.floor(q * values.length))] : 0)
  const t1 = quantile(0.25)
  const t2 = quantile(0.5)
  const t3 = quantile(0.75)
  const max = values.length ? values[values.length - 1] : 0

  const cells: HeatCell[] = []
  for (let d = gridStart; d.getTime() <= gridEnd.getTime(); d = addDays(d, 1)) {
    const key = dayKey(d)
    const minor = byDay.get(key) ?? 0
    let level: HeatCell['level'] = 0
    if (minor > 0) level = minor >= max ? 4 : minor >= t3 ? 3 : minor >= t2 ? 2 : 1
    void t1
    cells.push({
      date: d,
      key,
      minor,
      level,
      inMonth: d.getMonth() === first.getMonth(),
      isFuture: d.getTime() > endOfToday(now).getTime(),
    })
  }
  return cells
}

function endOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

// ---------------------------------------------------------------------------
// Month overlay for the trend chart
// ---------------------------------------------------------------------------
export interface TrendPoint {
  label: string
  day: number
  current: number
  previous: number
}

/**
 * Cumulative (or per-day) spend for the current month with last month overlaid,
 * bucketed into weeks for the x-axis when `granularity` is 'weekly'.
 */
export function monthTrend(
  expenses: Expense[],
  monthDate: Date,
  mode: 'daily' | 'cumulative' | 'weekly' = 'cumulative',
): TrendPoint[] {
  const current = dailyTotals(expenses, { kind: 'month', start: startOfMonth(monthDate), end: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999) })
  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)
  const previous = dailyTotals(expenses, { kind: 'month', start: startOfMonth(prevMonth), end: new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59, 999) })

  if (mode === 'weekly') {
    const points: TrendPoint[] = []
    for (let w = 0; w < Math.ceil(current.length / 7); w++) {
      const slice = current.slice(w * 7, w * 7 + 7)
      const prevSlice = previous.slice(w * 7, w * 7 + 7)
      points.push({
        label: `W${w + 1}`,
        day: w * 7 + 1,
        current: slice.reduce((s, d) => s + d.minor, 0),
        previous: prevSlice.reduce((s, d) => s + d.minor, 0),
      })
    }
    return points
  }

  return current.map((d, i) => ({
    label: String(d.date.getDate()),
    day: i + 1,
    current: mode === 'cumulative' ? d.cumulativeMinor : d.minor,
    previous: mode === 'cumulative' ? previous[i]?.cumulativeMinor ?? previous.at(-1)?.cumulativeMinor ?? 0 : previous[i]?.minor ?? 0,
  }))
}

/** Straight-line projection of this month's total from spend-to-date. */
export function projectMonthEnd(expenses: Expense[], now = new Date()): { projectedMinor: number; elapsedFraction: number } {
  const monthStart = startOfMonth(now)
  const spent = activeExpenses(expenses)
    .filter((e) => new Date(e.spent_at).getTime() >= monthStart.getTime())
    .reduce((sum, e) => sum + e.amount_minor, 0)
  const elapsedFraction = dayOfMonth(now) / daysInMonthOf(now)
  return { projectedMinor: elapsedFraction > 0 ? Math.round(spent / elapsedFraction) : spent, elapsedFraction }
}

/** Spend on a specific local day. */
export function dayTotal(expenses: Expense[], date: Date): number {
  const key = dayKey(date)
  return activeExpenses(expenses)
    .filter((e) => dayKey(e.spent_at) === key)
    .reduce((sum, e) => sum + e.amount_minor, 0)
}

export function groupByDay(expenses: Expense[]): Array<{ key: string; date: Date; items: Expense[]; totalMinor: number }> {
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    const key = dayKey(e.spent_at)
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      date: new Date(items[0].spent_at),
      items: items.sort((a, b) => (a.spent_at < b.spent_at ? 1 : -1)),
      totalMinor: sumMinor(items),
    }))
}
