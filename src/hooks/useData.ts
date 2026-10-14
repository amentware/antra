/**
 * Antra — live data hooks. Everything reads from Dexie so screens update
 * instantly and work offline.
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Account, Budget, Category, Expense } from '@shared/types'

const EMPTY: never[] = []

function active<T extends { deleted_at: string | null }>(rows: T[] | undefined): T[] {
  return (rows ?? EMPTY).filter((r) => !r.deleted_at)
}

export function useAccounts(options: { includeArchived?: boolean } = {}): Account[] {
  const includeArchived = options.includeArchived ?? false
  const rows = useLiveQuery(async () => {
    const all = active(await db.accounts.toArray())
    return all.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [includeArchived])
  return useMemo(() => {
    const list = rows ?? []
    return includeArchived ? list : list.filter((a) => !a.archived)
  }, [rows, includeArchived])
}

export function useAccount(id: string | undefined): Account | undefined {
  return useLiveQuery(() => (id ? db.accounts.get(id) : undefined), [id])
}

export function useCategories(): Category[] {
  const rows = useLiveQuery(async () => {
    const all = active(await db.categories.toArray())
    return all.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [])
  return useMemo(() => rows ?? [], [rows])
}

export function useCategory(id: string | undefined): Category | undefined {
  return useLiveQuery(() => (id ? db.categories.get(id) : undefined), [id])
}

/** All live expenses, newest first. Filtering happens in memory (personal scale). */
export function useExpenses(): Expense[] {
  const rows = useLiveQuery(async () => {
    const all = active(await db.expenses.toArray())
    return all.sort((a, b) => (a.spent_at < b.spent_at ? 1 : a.spent_at > b.spent_at ? -1 : 0))
  }, [])
  return useMemo(() => rows ?? [], [rows])
}

export function useExpense(id: string | undefined): Expense | undefined {
  return useLiveQuery(() => (id ? db.expenses.get(id) : undefined), [id])
}

export function useBudgets(): Budget[] {
  const rows = useLiveQuery(async () => active(await db.budgets.toArray()), [])
  return useMemo(() => rows ?? [], [rows])
}

/** Lookup maps so screens can resolve ids without O(n²) scans. */
export function useLookups(): {
  accounts: Map<string, Account>
  categories: Map<string, Category>
  budgets: Map<string, Budget>
} {
  const accounts = useAccounts({ includeArchived: true })
  const categories = useCategories()
  const budgets = useBudgets()
  return useMemo(() => {
    const budgetByCategory = new Map<string, Budget>()
    for (const b of budgets) if (!budgetByCategory.has(b.category_id)) budgetByCategory.set(b.category_id, b)
    return {
      accounts: new Map(accounts.map((a) => [a.id, a])),
      categories: new Map(categories.map((c) => [c.id, c])),
      budgets: budgetByCategory,
    }
  }, [accounts, categories, budgets])
}

export function useOutboxCount(): number {
  const count = useLiveQuery(() => db.outbox.count(), [], 0)
  return count ?? 0
}
