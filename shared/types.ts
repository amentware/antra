/**
 * Antra — shared entity types. These mirror the D1 rows 1:1 so the client
 * (Dexie/IndexedDB) and the Worker (D1) speak the same shapes over the delta
 * sync wire format.
 *
 * Booleans are stored as SQLite 0/1 integers. Timestamps are UTC ISO-8601
 * strings; `deleted_at` non-null is a soft-delete tombstone.
 */

export type AccountType = 'bank' | 'credit_card'
export type ExpenseSource = 'app' | 'api'
export type BudgetPeriod = 'monthly'
export type SyncTable = 'accounts' | 'categories' | 'expenses' | 'budgets' | 'settings'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  last4: string | null
  color: string
  icon: string
  credit_limit_minor: number | null
  /** Credit card billing/statement day of month (1-31). */
  statement_day: number | null
  /** Credit card payment due day of month (1-31). */
  due_day: number | null
  archived: number
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Category {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Expense {
  id: string
  user_id: string
  amount_minor: number
  category_id: string
  account_id: string
  merchant: string | null
  note: string | null
  /** UTC ISO timestamp of when the money was spent. */
  spent_at: string
  /** 0 = unpaid, 1 = paid. Bank expenses are always 1. */
  paid: number
  paid_at: string | null
  source: ExpenseSource
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount_minor: number
  period: BudgetPeriod
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SettingsRow {
  id: string
  user_id: string
  currency: string
  theme: 'system' | 'light' | 'dark'
  timezone: string
  week_start: number
  updated_at: string
  deleted_at: string | null
}

/** Per-user profile returned by `/api/auth/me`. */
export interface UserProfile {
  id: string
  email: string
  name: string
  created_at: string
}

export interface PublicAccount {
  id: string
  name: string
  type: AccountType
  last4: string | null
  color: string
  icon: string
  credit_limit_minor: number | null
  statement_day: number | null
  due_day: number | null
  archived: number
  sort_order: number
}

export interface PublicCategory {
  id: string
  name: string
  emoji: string
  color: string
  sort_order: number
}

export interface PublicBudget {
  id: string
  category_id: string
  amount_minor: number
  period: BudgetPeriod
}

/** Wire format for the delta-sync endpoint. */
export interface SyncPullResponse {
  cursor: string
  server_time: string
  accounts: Account[]
  categories: Category[]
  expenses: Expense[]
  budgets: Budget[]
  settings: SettingsRow[]
}

export interface ApiError {
  error: string
  message: string
  details?: unknown
}

/** Canonical table list used by sync + full-pull. */
export const SYNC_TABLES: SyncTable[] = ['accounts', 'categories', 'expenses', 'budgets', 'settings']
