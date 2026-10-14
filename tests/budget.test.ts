import { describe, expect, it } from 'vitest'
import {
  budgetStatus,
  computeBudgetProgress,
  computeBudgetSummary,
  insightText,
  pickInsight,
  WARNING_THRESHOLD,
  type InsightCandidate,
} from '@shared/budget'

describe('budgetStatus thresholds', () => {
  it('is safe below the warning threshold', () => {
    expect(WARNING_THRESHOLD).toBe(80)
    expect(budgetStatus(0)).toBe('safe')
    expect(budgetStatus(79.999)).toBe('safe')
  })

  it('is warning from 80% up to (but not including) 100%', () => {
    expect(budgetStatus(80)).toBe('warning')
    expect(budgetStatus(99.99)).toBe('warning')
  })

  it('is over at exactly 100% and beyond', () => {
    expect(budgetStatus(100)).toBe('over')
    expect(budgetStatus(150)).toBe('over')
  })
})

describe('computeBudgetProgress', () => {
  it('computes percent, remaining, pace and projection for a mid-month budget', () => {
    const p = computeBudgetProgress({ spentMinor: 250000, limitMinor: 500000, dayOfMonth: 15, daysInMonth: 30 })
    expect(p.percentUsed).toBe(50)
    expect(p.remainingMinor).toBe(250000)
    expect(p.daysLeft).toBe(16) // inclusive of today
    expect(p.safeToSpendMinor).toBe(15625) // 250000 / 16
    expect(p.elapsedFraction).toBeCloseTo(0.5)
    expect(p.paceDelta).toBeCloseTo(0)
    expect(p.projectedMinor).toBe(500000)
    expect(p.projectedOverMinor).toBe(0)
    expect(p.status).toBe('safe')
  })

  it('flags an over-budget category with a projected overspend', () => {
    const p = computeBudgetProgress({ spentMinor: 600000, limitMinor: 500000, dayOfMonth: 15, daysInMonth: 30 })
    expect(p.percentUsed).toBe(120)
    expect(p.remainingMinor).toBe(-100000)
    expect(p.safeToSpendMinor).toBe(0) // never negative
    expect(p.projectedMinor).toBe(1200000)
    expect(p.projectedOverMinor).toBe(700000)
    expect(p.status).toBe('over')
    expect(p.paceDelta).toBeCloseTo(70)
  })

  it('never reports fewer than one day left (last day of a 31-day month)', () => {
    const p = computeBudgetProgress({ spentMinor: 10, limitMinor: 100, dayOfMonth: 31, daysInMonth: 31 })
    expect(p.daysLeft).toBe(1)
  })

  it('treats a zero limit as 0% and no safe-to-spend', () => {
    const p = computeBudgetProgress({ spentMinor: 5000, limitMinor: 0, dayOfMonth: 10, daysInMonth: 30 })
    expect(p.percentUsed).toBe(0)
    expect(p.safeToSpendMinor).toBe(0)
  })

  it('rounds the month-end projection to whole minor units', () => {
    const p = computeBudgetProgress({ spentMinor: 33333, limitMinor: 100000, dayOfMonth: 10, daysInMonth: 30 })
    expect(Number.isInteger(p.projectedMinor)).toBe(true)
    expect(p.projectedMinor).toBe(Math.round(33333 / (10 / 30)))
  })
})

describe('computeBudgetSummary', () => {
  it('rolls up limits, spend and status counts', () => {
    const s = computeBudgetSummary([
      { limitMinor: 500000, spentMinor: 250000 }, // 50% safe
      { limitMinor: 300000, spentMinor: 330000 }, // 110% over
      { limitMinor: 100000, spentMinor: 80000 }, // 80% warning
    ])
    expect(s.totalLimitMinor).toBe(900000)
    expect(s.totalSpentMinor).toBe(660000)
    expect(s.remainingMinor).toBe(240000)
    expect(s.percentUsed).toBeCloseTo(73.333, 3)
    expect(s.status).toBe('safe')
    expect(s.budgetCount).toBe(3)
    expect(s.overCount).toBe(1)
    expect(s.warningCount).toBe(1)
  })

  it('is safe and empty for no budgets', () => {
    const s = computeBudgetSummary([])
    expect(s).toMatchObject({
      totalLimitMinor: 0,
      totalSpentMinor: 0,
      remainingMinor: 0,
      percentUsed: 0,
      status: 'safe',
      budgetCount: 0,
      overCount: 0,
      warningCount: 0,
    })
  })

  it('counts a category with a zero limit as neither over nor warning', () => {
    const s = computeBudgetSummary([{ limitMinor: 0, spentMinor: 5000 }])
    expect(s.overCount).toBe(0)
    expect(s.warningCount).toBe(0)
    expect(s.percentUsed).toBe(0)
  })
})

describe('pickInsight', () => {
  const base: Omit<InsightCandidate, 'categoryName' | 'projectedOverMinor' | 'percentUsed' | 'status' | 'daysLeft' | 'safeToSpendMinor'> = {}

  it('returns null when nothing is actionable', () => {
    expect(pickInsight([])).toBeNull()
    const safe: InsightCandidate = { ...base, categoryName: 'Food', projectedOverMinor: 0, percentUsed: 40, status: 'safe', safeToSpendMinor: 100, daysLeft: 10 }
    expect(pickInsight([safe])).toBeNull()
  })

  it('prefers the largest projected overspend', () => {
    const items: InsightCandidate[] = [
      { ...base, categoryName: 'Food', projectedOverMinor: 42000, percentUsed: 60, status: 'safe', safeToSpendMinor: 0, daysLeft: 5 },
      { ...base, categoryName: 'Shopping', projectedOverMinor: 120000, percentUsed: 90, status: 'warning', safeToSpendMinor: 0, daysLeft: 5 },
    ]
    expect(pickInsight(items)?.categoryName).toBe('Shopping')
  })

  it('falls back to the highest-used warning when nothing is projected over', () => {
    const items: InsightCandidate[] = [
      { ...base, categoryName: 'Food', projectedOverMinor: 0, percentUsed: 82, status: 'warning', safeToSpendMinor: 0, daysLeft: 5 },
      { ...base, categoryName: 'Fuel', projectedOverMinor: 0, percentUsed: 95, status: 'warning', safeToSpendMinor: 0, daysLeft: 5 },
    ]
    expect(pickInsight(items)?.categoryName).toBe('Fuel')
  })
})

describe('insightText', () => {
  const fmt = (minor: number) => `₹${minor / 100}`

  it('describes a projected overspend', () => {
    const item: InsightCandidate = { categoryName: 'Dining', projectedOverMinor: 42000, percentUsed: 60, status: 'safe', safeToSpendMinor: 0, daysLeft: 8 }
    expect(insightText(item, fmt)).toBe('You may exceed your Dining budget by ₹420 this month.')
  })

  it('describes a warning with days left', () => {
    const item: InsightCandidate = { categoryName: 'Fuel', projectedOverMinor: 0, percentUsed: 82.4, status: 'warning', safeToSpendMinor: 0, daysLeft: 8 }
    expect(insightText(item, fmt)).toBe("You've used 82% of your Fuel budget with 8 days left.")
  })

  it('describes an on-track category', () => {
    const item: InsightCandidate = { categoryName: 'Food', projectedOverMinor: 0, percentUsed: 20, status: 'safe', safeToSpendMinor: 0, daysLeft: 8 }
    expect(insightText(item, fmt)).toBe("You're on track with Food.")
  })
})
