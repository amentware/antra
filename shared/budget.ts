/**
 * Antra — budget math. Pure functions so they are trivially unit-testable and
 * can run both on the client (stats) and in the Worker (public-API responses).
 *
 * Convention: `daysInMonth`/`dayOfMonth` are computed in the user's local
 * timezone by the caller; when omitted we fall back to UTC.
 */

export type BudgetStatus = 'safe' | 'warning' | 'over'

export const WARNING_THRESHOLD = 80

export interface BudgetProgressInput {
  spentMinor: number
  limitMinor: number
  /** Local calendar day of month (1-31). Defaults to `now.getUTCDate()`. */
  dayOfMonth?: number
  /** Days in the current month. Defaults to the UTC month length. */
  daysInMonth?: number
}

export interface BudgetProgress {
  spentMinor: number
  limitMinor: number
  remainingMinor: number
  /** 0..∞ (may exceed 100 when over budget). */
  percentUsed: number
  status: BudgetStatus
  /** Whole days remaining in the month, *including* today. */
  daysLeft: number
  /** Average the user can still spend per remaining day. */
  safeToSpendMinor: number
  /** Fraction of the month elapsed (0..1). */
  elapsedFraction: number
  /** How far spending runs ahead (+) or behind (−) the calendar, in points. */
  paceDelta: number
  /** Straight-line projection of month-end spend at the current pace. */
  projectedMinor: number
  /** Projected overspend (0 when not projected to exceed). */
  projectedOverMinor: number
}

export function budgetStatus(percentUsed: number): BudgetStatus {
  if (percentUsed >= 100) return 'over'
  if (percentUsed >= WARNING_THRESHOLD) return 'warning'
  return 'safe'
}

export function computeBudgetProgress(input: BudgetProgressInput): BudgetProgress {
  const { spentMinor, limitMinor } = input
  const dayOfMonth = input.dayOfMonth ?? new Date().getUTCDate()
  const daysInMonth = input.daysInMonth ?? new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0).getUTCDate()

  const percentUsed = limitMinor > 0 ? (spentMinor / limitMinor) * 100 : 0
  const remainingMinor = limitMinor - spentMinor
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1)
  const safeToSpendMinor = remainingMinor > 0 ? Math.floor(remainingMinor / daysLeft) : 0
  const elapsedFraction = daysInMonth > 0 ? dayOfMonth / daysInMonth : 0
  const projectedMinor = elapsedFraction > 0 ? Math.round(spentMinor / elapsedFraction) : spentMinor
  const paceDelta = percentUsed - elapsedFraction * 100

  return {
    spentMinor,
    limitMinor,
    remainingMinor,
    percentUsed,
    status: budgetStatus(percentUsed),
    daysLeft,
    safeToSpendMinor,
    elapsedFraction,
    paceDelta,
    projectedMinor,
    projectedOverMinor: Math.max(0, projectedMinor - limitMinor),
  }
}

export interface BudgetSummaryInput {
  limitMinor: number
  spentMinor: number
  count: number
}

export interface BudgetSummary {
  totalLimitMinor: number
  totalSpentMinor: number
  remainingMinor: number
  percentUsed: number
  status: BudgetStatus
  budgetCount: number
  overCount: number
  warningCount: number
}

/**
 * Overall summary across budgets. Uses `totalLimit` as the denominator so
 * categories without a budget are simply not counted (matches the spec's
 * per-category budgets with an overall rollup).
 */
export function computeBudgetSummary(items: Array<{ limitMinor: number; spentMinor: number }>): BudgetSummary {
  let totalLimitMinor = 0
  let totalSpentMinor = 0
  let overCount = 0
  let warningCount = 0
  for (const it of items) {
    totalLimitMinor += it.limitMinor
    totalSpentMinor += it.spentMinor
    const p = it.limitMinor > 0 ? (it.spentMinor / it.limitMinor) * 100 : 0
    if (p >= 100) overCount++
    else if (p >= WARNING_THRESHOLD) warningCount++
  }
  const percentUsed = totalLimitMinor > 0 ? (totalSpentMinor / totalLimitMinor) * 100 : 0
  return {
    totalLimitMinor,
    totalSpentMinor,
    remainingMinor: totalLimitMinor - totalSpentMinor,
    percentUsed,
    status: budgetStatus(percentUsed),
    budgetCount: items.length,
    overCount,
    warningCount,
  }
}

/**
 * Rule-based (fully local) insight for the Home banner. Mirrors the design
 * reference's "You may exceed your dining budget by ₹420 this month."
 * Returns null when nothing actionable is found.
 */
export interface InsightCandidate {
  categoryName: string
  projectedOverMinor: number
  percentUsed: number
  status: BudgetStatus
  safeToSpendMinor: number
  daysLeft: number
}

export function pickInsight(items: InsightCandidate[]): InsightCandidate | null {
  const over = items
    .filter((i) => i.projectedOverMinor > 0)
    .sort((a, b) => b.projectedOverMinor - a.projectedOverMinor)
  if (over.length > 0) return over[0]
  const warning = items.filter((i) => i.status === 'warning').sort((a, b) => b.percentUsed - a.percentUsed)
  return warning[0] ?? null
}

export function insightText(item: InsightCandidate, format: (minor: number) => string): string {
  if (item.projectedOverMinor > 0) {
    return `You may exceed your ${item.categoryName} budget by ${format(item.projectedOverMinor)} this month.`
  }
  if (item.status === 'warning') {
    return `You've used ${Math.round(item.percentUsed)}% of your ${item.categoryName} budget with ${item.daysLeft} days left.`
  }
  return `You're on track with ${item.categoryName}.`
}
