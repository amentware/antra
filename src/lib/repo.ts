/**
 * Antra — domain write helpers. Each one writes to Dexie and enqueues the
 * change for the server, so the UI stays instant and offline-safe.
 */
import { db } from './db'
import { newId, nowIso } from './id'
import { deleteRow, saveRow } from './sync'
import type { Account, AccountType, Budget, Category, Expense } from '@shared/types'

const LOCAL_USER = ''

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export interface AccountDraft {
  name: string
  type: AccountType
  last4?: string | null
  color: string
  icon: string
  credit_limit_minor?: number | null
  statement_day?: number | null
  due_day?: number | null
}

export async function createAccount(draft: AccountDraft): Promise<Account> {
  const now = nowIso()
  const maxOrder = (await db.accounts.orderBy('sort_order').last())?.sort_order ?? 0
  const isCard = draft.type === 'credit_card'
  const account: Account = {
    id: newId(),
    user_id: LOCAL_USER,
    name: draft.name.trim(),
    type: draft.type,
    last4: draft.last4?.trim() ? draft.last4.trim() : null,
    color: draft.color,
    icon: draft.icon,
    credit_limit_minor: isCard ? draft.credit_limit_minor ?? null : null,
    statement_day: isCard ? draft.statement_day ?? null : null,
    due_day: isCard ? draft.due_day ?? null : null,
    archived: 0,
    sort_order: maxOrder + 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveRow('accounts', account)
  return account
}

export async function updateAccount(id: string, patch: Partial<Account>): Promise<void> {
  const existing = await db.accounts.get(id)
  if (!existing) return
  const isCard = (patch.type ?? existing.type) === 'credit_card'
  const updated: Account = {
    ...existing,
    ...patch,
    type: isCard ? 'credit_card' : 'bank',
    credit_limit_minor: isCard ? patch.credit_limit_minor ?? existing.credit_limit_minor ?? null : null,
    statement_day: isCard ? patch.statement_day ?? existing.statement_day ?? null : null,
    due_day: isCard ? patch.due_day ?? existing.due_day ?? null : null,
    updated_at: nowIso(),
  }
  await saveRow('accounts', updated)
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  await updateAccount(id, { archived: archived ? 1 : 0 })
}

export async function deleteAccount(id: string): Promise<void> {
  await deleteRow('accounts', id)
}

export async function reorderAccounts(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const acc = await db.accounts.get(ids[i])
    if (!acc) continue
    await saveRow('accounts', { ...acc, sort_order: i, updated_at: nowIso() })
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export interface CategoryDraft {
  name: string
  emoji: string
  color: string
}

export async function createCategory(draft: CategoryDraft): Promise<Category> {
  const now = nowIso()
  const maxOrder = (await db.categories.orderBy('sort_order').last())?.sort_order ?? 0
  const category: Category = {
    id: newId(),
    user_id: LOCAL_USER,
    name: draft.name.trim(),
    emoji: draft.emoji || '📦',
    color: draft.color,
    sort_order: maxOrder + 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveRow('categories', category)
  return category
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  const existing = await db.categories.get(id)
  if (!existing) return
  await saveRow('categories', { ...existing, ...patch, id, updated_at: nowIso() })
}

/**
 * Delete a category. If it still has transactions they must be re-assigned to
 * another category first (the UI enforces this).
 */
export async function deleteCategory(id: string, reassignToId?: string): Promise<{ reassigned: number }> {
  if (reassignToId && reassignToId !== id) {
    const affected = await db.expenses.where('category_id').equals(id).and((e) => !e.deleted_at).toArray()
    for (const expense of affected) {
      await saveRow('expenses', { ...expense, category_id: reassignToId, updated_at: nowIso() })
    }
    const budget = await db.budgets.where('category_id').equals(id).and((b) => !b.deleted_at).first()
    if (budget) await deleteRow('budgets', budget.id)
    await deleteRow('categories', id)
    return { reassigned: affected.length }
  }
  await deleteRow('categories', id)
  return { reassigned: 0 }
}

export async function categoryUsage(id: string): Promise<number> {
  return db.expenses.where('category_id').equals(id).and((e) => !e.deleted_at).count()
}

export async function reorderCategories(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const category = await db.categories.get(ids[i])
    if (!category) continue
    await saveRow('categories', { ...category, sort_order: i, updated_at: nowIso() })
  }
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
export async function setBudget(categoryId: string, amountMinor: number): Promise<void> {
  const existing = await db.budgets.where('category_id').equals(categoryId).and((b) => !b.deleted_at).first()
  if (amountMinor <= 0) {
    if (existing) await deleteRow('budgets', existing.id)
    return
  }
  if (existing) {
    await saveRow('budgets', { ...existing, amount_minor: amountMinor, updated_at: nowIso() })
    return
  }
  const now = nowIso()
  const budget: Budget = {
    id: newId(),
    user_id: LOCAL_USER,
    category_id: categoryId,
    amount_minor: amountMinor,
    period: 'monthly',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveRow('budgets', budget)
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export interface ExpenseDraft {
  amount_minor: number
  category_id: string
  account_id: string
  merchant?: string | null
  note?: string | null
  spent_at?: string
  paid?: number
  source?: Expense['source']
}

export async function createExpense(draft: ExpenseDraft): Promise<Expense> {
  const now = nowIso()
  const account = await db.accounts.get(draft.account_id)
  const isCard = account?.type === 'credit_card'
  const paid = draft.paid !== undefined ? draft.paid : isCard ? 0 : 1
  const expense: Expense = {
    id: newId(),
    user_id: LOCAL_USER,
    amount_minor: Math.round(draft.amount_minor),
    category_id: draft.category_id,
    account_id: draft.account_id,
    merchant: draft.merchant?.trim() ? draft.merchant.trim() : null,
    note: draft.note?.trim() ? draft.note.trim() : null,
    spent_at: draft.spent_at ?? now,
    paid,
    paid_at: paid ? now : null,
    source: draft.source ?? 'app',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveRow('expenses', expense)
  return expense
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
  const existing = await db.expenses.get(id)
  if (!existing) return
  const next: Expense = { ...existing, ...patch, id, updated_at: nowIso() }
  if (patch.paid !== undefined) next.paid_at = patch.paid ? nowIso() : null
  await saveRow('expenses', next)
}

export async function setExpensePaid(id: string, paid: boolean): Promise<void> {
  await updateExpense(id, { paid: paid ? 1 : 0 })
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteRow('expenses', id)
}

export async function restoreExpense(id: string): Promise<void> {
  const { restoreRow } = await import('./sync')
  await restoreRow('expenses', id)
}

/** Bulk "Pay bill": mark every unpaid transaction on a card as paid. */
export async function payCardBill(accountId: string, upToIso: string): Promise<number> {
  const unpaid = await db.expenses
    .where('account_id')
    .equals(accountId)
    .and((e) => !e.deleted_at && e.paid === 0 && e.spent_at <= upToIso)
    .toArray()
  const now = nowIso()
  for (const expense of unpaid) {
    await saveRow('expenses', { ...expense, paid: 1, paid_at: now, updated_at: nowIso() })
  }
  return unpaid.length
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function ensureSettingsRow(): Promise<void> {
  const existing = await db.settings.toCollection().first()
  if (existing) return
  const now = nowIso()
  const row = {
    id: 'local-settings',
    user_id: LOCAL_USER,
    currency: 'INR',
    theme: 'system' as const,
    timezone: 'Asia/Kolkata',
    week_start: 1,
    updated_at: now,
    deleted_at: null,
  }
  await saveRow('settings', row)
}

export async function updateSettings(patch: Partial<{ currency: string; theme: string; timezone: string; week_start: number }>): Promise<void> {
  const existing = await db.settings.toCollection().first()
  const now = nowIso()
  const row = existing
    ? { ...existing, ...patch, updated_at: now }
    : {
        id: 'local-settings',
        user_id: LOCAL_USER,
        currency: 'INR',
        theme: 'system',
        timezone: 'Asia/Kolkata',
        week_start: 1,
        updated_at: now,
        deleted_at: null,
        ...patch,
      }
  await saveRow('settings', row)
}
