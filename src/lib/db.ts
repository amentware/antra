/**
 * Antra — local IndexedDB cache (Dexie).
 *
 * Every screen reads from here. The network is only ever used to push queued
 * writes and to pull deltas, so the app is instant and fully usable offline.
 */
import Dexie, { type Table } from 'dexie'
import type { Account, Budget, Category, Expense, SettingsRow } from '@shared/types'

export type SyncTable = 'accounts' | 'categories' | 'expenses' | 'budgets' | 'settings'

export interface OutboxItem {
  id?: number
  table: SyncTable
  op: 'upsert' | 'delete'
  rowId: string
  updatedAt: string
}

export interface MetaRow {
  key: string
  value: unknown
}

export class AntraDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  expenses!: Table<Expense, string>
  budgets!: Table<Budget, string>
  settings!: Table<SettingsRow, string>
  meta!: Table<MetaRow, string>
  outbox!: Table<OutboxItem, number>

  constructor() {
    super('antra')
    this.version(1).stores({
      accounts: 'id, updated_at, archived, sort_order, deleted_at',
      categories: 'id, updated_at, sort_order, deleted_at',
      expenses: 'id, spent_at, updated_at, category_id, account_id, paid, deleted_at',
      budgets: 'id, updated_at, category_id, deleted_at',
      settings: 'id, updated_at',
      meta: 'key',
      outbox: '++id, table, rowId',
    })
  }
}

export const db = new AntraDB()

export const META_KEYS = {
  cursor: 'sync.cursor',
  lastSyncAt: 'sync.lastSyncAt',
  fullPulled: 'sync.fullPulled',
  tokenOwner: 'auth.tokenOwner',
  pinHash: 'lock.pinHash',
  pinEnabled: 'lock.enabled',
  lockTimeout: 'lock.timeoutMinutes',
  lastActiveAt: 'lock.lastActiveAt',
} as const

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

/** Wipe every cached row (used by logout and "clear cache & resync"). */
export async function clearCache(): Promise<void> {
  await Promise.all([
    db.accounts.clear(),
    db.categories.clear(),
    db.expenses.clear(),
    db.budgets.clear(),
    db.settings.clear(),
    db.meta.clear(),
    db.outbox.clear(),
  ])
}

/** Wipe only synced data, keeping device-local preferences (PIN, lock timeout). */
export async function clearSyncedData(): Promise<void> {
  await Promise.all([
    db.accounts.clear(),
    db.categories.clear(),
    db.expenses.clear(),
    db.budgets.clear(),
    db.settings.clear(),
    db.outbox.clear(),
  ])
  await db.meta.bulkDelete([META_KEYS.cursor, META_KEYS.lastSyncAt, META_KEYS.fullPulled, META_KEYS.tokenOwner])
}
