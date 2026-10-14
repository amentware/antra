import { describe, expect, it } from 'vitest'
import type { Account, Budget, Category, Expense } from '@shared/types'
import {
  activeExpenses,
  budgetRows,
  cardStats,
  expensesOnDay,
  nextMonthlyDate,
  rangeStats,
  totalOutstanding,
} from '@/lib/stats'
import { formatMinor } from '@shared/currency'

const USER = 'u1'
const ISO = '2026-03-01T00:00:00.000Z'
const NOW = new Date(2026, 2, 15, 12, 0, 0) // 15 Mar 2026, local

function localIso(y: number, m: number, d: number, hh = 12): string {
  return new Date(y, m, d, hh, 0, 0).toISOString()
}

let seq = 0
const nextId = () => `id_${++seq}`

function makeCategory(id: string, name: string, sort_order = 0): Category {
  return { id, user_id: USER, name, emoji: '🍽️', color: '#8A8F98', sort_order, created_at: ISO, updated_at: ISO, deleted_at: null }
}

function makeBudget(category_id: string, amount_minor: number): Budget {
  return { id: nextId(), user_id: USER, category_id, amount_minor, period: 'monthly', created_at: ISO, updated_at: ISO, deleted_at: null }
}

function makeExpense(partial: Pick<Expense, 'amount_minor' | 'category_id' | 'account_id' | 'spent_at'> & Partial<Expense>): Expense {
  return {
    id: nextId(),
    user_id: USER,
    merchant: null,
    note: null,
    paid: 0,
    paid_at: null,
    source: 'app',
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    ...partial,
  }
}

function makeCard(partial: Partial<Account> = {}): Account {
  return {
    id: nextId(),
    user_id: USER,
    name: 'Credit Card',
    type: 'credit_card',
    last4: '4321',
    color: '#0A84FF',
    icon: '💳',
    credit_limit_minor: 1000000,
    statement_day: 5,
    due_day: 20,
    archived: 0,
    sort_order: 0,
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    ...partial,
  }
}

describe('activeExpenses', () => {
  it('drops tombstoned rows', () => {
    const rows = [
      makeExpense({ amount_minor: 100, category_id: 'c', account_id: 'a', spent_at: ISO }),
      makeExpense({ amount_minor: 200, category_id: 'c', account_id: 'a', spent_at: ISO, deleted_at: '2026-03-02T00:00:00.000Z' }),
    ]
    expect(activeExpenses(rows)).toHaveLength(1)
    expect(activeExpenses(rows)[0].amount_minor).toBe(100)
  })
})

describe('budgetRows', () => {
  const food = makeCategory('c_food', 'Food & Dining', 0)
  const groceries = makeCategory('c_groceries', 'Groceries', 1)
  const rent = makeCategory('c_rent', 'Rent', 2)
  const categories = [food, groceries, rent]
  const budgets = [makeBudget('c_food', 500000), makeBudget('c_groceries', 100000)]
  const expenses = [
    // Food this month → 250000 + 60000 = 310000 (62%)
    makeExpense({ amount_minor: 250000, category_id: 'c_food', account_id: 'a', spent_at: localIso(2026, 2, 10) }),
    makeExpense({ amount_minor: 60000, category_id: 'c_food', account_id: 'a', spent_at: localIso(2026, 2, 12) }),
    // Groceries this month → 90000 (90%)
    makeExpense({ amount_minor: 90000, category_id: 'c_groceries', account_id: 'a', spent_at: localIso(2026, 2, 5) }),
    // Last month — must be excluded
    makeExpense({ amount_minor: 999999, category_id: 'c_food', account_id: 'a', spent_at: localIso(2026, 1, 20) }),
    // Tombstoned this month — must be excluded
    makeExpense({ amount_minor: 500000, category_id: 'c_food', account_id: 'a', spent_at: localIso(2026, 2, 9), deleted_at: ISO }),
  ]

  it('sums only current-month, live expenses per category', () => {
    const rows = budgetRows(categories, budgets, expenses, NOW)
    const foodRow = rows.find((r) => r.category.id === 'c_food')!
    const groceryRow = rows.find((r) => r.category.id === 'c_groceries')!
    expect(foodRow.spentMinor).toBe(310000)
    expect(groceryRow.spentMinor).toBe(90000)
  })

  it('computes progress + status for budgeted categories', () => {
    const rows = budgetRows(categories, budgets, expenses, NOW)
    const foodRow = rows.find((r) => r.category.id === 'c_food')!
    const groceryRow = rows.find((r) => r.category.id === 'c_groceries')!
    expect(foodRow.progress!.percentUsed).toBe(62)
    expect(foodRow.progress!.status).toBe('safe')
    expect(groceryRow.progress!.percentUsed).toBe(90)
    expect(groceryRow.progress!.status).toBe('warning')
  })

  it('returns null budget/progress for categories without a budget', () => {
    const rows = budgetRows(categories, budgets, expenses, NOW)
    const rentRow = rows.find((r) => r.category.id === 'c_rent')!
    expect(rentRow.budget).toBeNull()
    expect(rentRow.progress).toBeNull()
  })

  it('sorts by percent used desc, unbudgeted categories last', () => {
    const rows = budgetRows(categories, budgets, expenses, NOW)
    expect(rows.map((r) => r.category.id)).toEqual(['c_groceries', 'c_food', 'c_rent'])
  })
})

describe('nextMonthlyDate', () => {
  it('returns this month when the day is still ahead', () => {
    const d = nextMonthlyDate(20, new Date(2026, 2, 15))
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 20])
  })

  it('rolls to next month when the day has passed', () => {
    const d = nextMonthlyDate(5, new Date(2026, 2, 15))
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 3, 5])
  })

  it('treats today as this month', () => {
    const d = nextMonthlyDate(15, new Date(2026, 2, 15))
    expect(d.getDate()).toBe(15)
    expect(d.getMonth()).toBe(2)
  })

  it('clamps to the short month length (day 31 in February)', () => {
    const d = nextMonthlyDate(31, new Date(2026, 1, 1))
    expect(d.getDate()).toBe(28) // 2026 is not a leap year
  })
})

describe('cardStats', () => {
  it('computes outstanding, utilization and due dates from unpaid live expenses', () => {
    const card = makeCard({ id: 'card1', credit_limit_minor: 1000000, due_day: 20, statement_day: 5 })
    const bank = makeCard({ id: 'bank1', type: 'bank', credit_limit_minor: null, due_day: null, statement_day: null })
    const expenses = [
      makeExpense({ amount_minor: 300000, category_id: 'c', account_id: 'card1', spent_at: localIso(2026, 2, 2), paid: 0 }),
      makeExpense({ amount_minor: 200000, category_id: 'c', account_id: 'card1', spent_at: localIso(2026, 2, 3), paid: 0 }),
      makeExpense({ amount_minor: 100000, category_id: 'c', account_id: 'card1', spent_at: localIso(2026, 2, 4), paid: 1 }),
      // Tombstoned unpaid expense must not count toward outstanding.
      makeExpense({ amount_minor: 500000, category_id: 'c', account_id: 'card1', spent_at: localIso(2026, 2, 5), paid: 0, deleted_at: ISO }),
      makeExpense({ amount_minor: 70000, category_id: 'c', account_id: 'bank1', spent_at: localIso(2026, 2, 6), paid: 1 }),
    ]

    const stats = cardStats([card, bank], expenses, NOW)
    expect(stats).toHaveLength(1) // banks are not cards
    const s = stats[0]
    expect(s.outstandingMinor).toBe(500000)
    expect(s.unpaidCount).toBe(2)
    expect(s.totalMinor).toBe(600000)
    expect(s.utilization).toBe(50)
    expect(s.limitMinor).toBe(1000000)
    expect([s.nextDueDate!.getMonth(), s.nextDueDate!.getDate()]).toEqual([2, 20])
    expect(s.daysUntilDue).toBe(5)
    // Statement day 5 already passed → next statement is April 5.
    expect([s.statementDate!.getMonth(), s.statementDate!.getDate()]).toEqual([3, 5])
  })

  it('reports 0% utilization when no limit is set', () => {
    const card = makeCard({ credit_limit_minor: null, due_day: null, statement_day: null })
    const stats = cardStats([card], [makeExpense({ amount_minor: 100, category_id: 'c', account_id: card.id, spent_at: ISO, paid: 0 })], NOW)
    expect(stats[0].utilization).toBe(0)
    expect(stats[0].nextDueDate).toBeNull()
    expect(stats[0].daysUntilDue).toBeNull()
  })

  it('totals outstanding across cards (used by the Home card)', () => {
    const a = makeCard({ id: 'a', credit_limit_minor: 100000 })
    const b = makeCard({ id: 'b', credit_limit_minor: 100000 })
    const expenses = [
      makeExpense({ amount_minor: 40000, category_id: 'c', account_id: 'a', spent_at: ISO, paid: 0 }),
      makeExpense({ amount_minor: 25000, category_id: 'c', account_id: 'b', spent_at: ISO, paid: 0 }),
    ]
    expect(totalOutstanding(cardStats([a, b], expenses, NOW))).toBe(65000)
  })
})

describe('rangeStats', () => {
  it('compares the range with the previous period', () => {
    const range = { kind: 'month' as const, start: new Date(2026, 2, 1, 0, 0, 0, 0), end: new Date(2026, 2, 31, 23, 59, 59, 999) }
    const expenses = [
      makeExpense({ amount_minor: 1000, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 2, 20) }),
      makeExpense({ amount_minor: 2000, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 2, 25), merchant: 'Swiggy' }),
      makeExpense({ amount_minor: 500, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 1, 5) }), // previous month
    ]
    const stats = rangeStats(expenses, range)
    expect(stats.totalMinor).toBe(3000)
    expect(stats.previousTotalMinor).toBe(500)
    expect(stats.count).toBe(2)
    expect(stats.activeDays).toBe(2)
    expect(stats.largest!.amount_minor).toBe(2000)
    expect(stats.deltaPercent).toBeCloseTo(500)
  })
})

describe('expensesOnDay', () => {
  it('returns only the live expenses for that local day, newest first', () => {
    const day = new Date(2026, 2, 25)
    const expenses = [
      makeExpense({ amount_minor: 1000, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 2, 25, 9) }),
      makeExpense({ amount_minor: 2000, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 2, 25, 18) }),
      makeExpense({ amount_minor: 3000, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 2, 24) }),
      makeExpense({ amount_minor: 4000, category_id: 'c', account_id: 'a', spent_at: localIso(2026, 2, 25, 12), deleted_at: ISO }),
    ]
    const items = expensesOnDay(expenses, day)
    expect(items.map((e) => e.amount_minor)).toEqual([2000, 1000])
  })
})

describe('formatMinor integration (display)', () => {
  it('renders a budget amount as INR with grouping', () => {
    expect(formatMinor(500000, 'INR')).toBe('₹5,000.00')
  })
})
