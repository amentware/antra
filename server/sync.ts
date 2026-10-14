/**
 * Antra — delta sync.
 *
 * Pull: `GET /api/sync?since=<cursor>` returns every row (including soft-delete
 * tombstones) whose `updated_at` is newer than the cursor, across all tables.
 * Push: `POST /api/sync` applies a batch of upsert/delete ops with
 * last-write-wins by `updated_at`.
 *
 * This is the only read path that touches D1 for user data; the client serves
 * every screen from its local IndexedDB cache.
 */
import type { Context } from 'hono'
import type { AppEnv } from './env'
import { randomId } from './crypto'

export type SyncTableName = 'accounts' | 'categories' | 'expenses' | 'budgets' | 'settings'

export const TABLE_COLUMNS: Record<SyncTableName, string[]> = {
  accounts: [
    'id', 'user_id', 'name', 'type', 'last4', 'color', 'icon',
    'credit_limit_minor', 'statement_day', 'due_day', 'archived', 'sort_order',
    'created_at', 'updated_at', 'deleted_at',
  ],
  categories: ['id', 'user_id', 'name', 'emoji', 'color', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  expenses: [
    'id', 'user_id', 'amount_minor', 'category_id', 'account_id', 'merchant', 'note',
    'spent_at', 'paid', 'paid_at', 'source', 'idempotency_key', 'created_at', 'updated_at', 'deleted_at',
  ],
  budgets: ['id', 'user_id', 'category_id', 'amount_minor', 'period', 'created_at', 'updated_at', 'deleted_at'],
  settings: ['id', 'user_id', 'currency', 'theme', 'timezone', 'week_start', 'created_at', 'updated_at', 'deleted_at'],
}

/** Columns the client is allowed to write (user_id/ids are managed server-side). */
const CLIENT_WRITABLE: Record<SyncTableName, Set<string>> = {
  accounts: new Set(['name', 'type', 'last4', 'color', 'icon', 'credit_limit_minor', 'statement_day', 'due_day', 'archived', 'sort_order']),
  categories: new Set(['name', 'emoji', 'color', 'sort_order']),
  expenses: new Set(['amount_minor', 'category_id', 'account_id', 'merchant', 'note', 'spent_at', 'paid', 'paid_at', 'source']),
  budgets: new Set(['category_id', 'amount_minor', 'period']),
  settings: new Set(['currency', 'theme', 'timezone', 'week_start']),
}

const NOT_NULL_DEFAULTS: Record<SyncTableName, Record<string, unknown>> = {
  accounts: { type: 'bank', color: '#0A84FF', icon: '🏦', archived: 0, sort_order: 0 },
  categories: { emoji: '📦', color: '#8A8F98', sort_order: 0 },
  expenses: { paid: 0, source: 'app' },
  budgets: { period: 'monthly' },
  settings: { currency: 'INR', theme: 'system', timezone: 'Asia/Kolkata', week_start: 1 },
}

const REQUIRED: Record<SyncTableName, string[]> = {
  accounts: ['name'],
  categories: ['name'],
  expenses: ['amount_minor', 'category_id', 'account_id', 'spent_at'],
  budgets: ['category_id', 'amount_minor'],
  settings: [],
}

export interface SyncOp {
  table: SyncTableName
  op: 'upsert' | 'delete'
  row: Record<string, unknown>
}

export function isSyncTable(value: unknown): value is SyncTableName {
  return typeof value === 'string' && value in TABLE_COLUMNS
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function asBoolInt(value: unknown): number {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1
  return 0
}

type SanitizeResult = { ok: true; row: Record<string, unknown> } | { ok: false; error: string }

function sanitizeRow(table: SyncTableName, raw: Record<string, unknown>, userId: string, now: string): SanitizeResult {
  const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64 ? raw.id : null
  if (!id) return { ok: false, error: 'Missing or invalid `id`' }

  const out: Record<string, unknown> = {
    id,
    user_id: userId,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : now,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : now,
    deleted_at: typeof raw.deleted_at === 'string' ? raw.deleted_at : null,
  }

  for (const [col, def] of Object.entries(NOT_NULL_DEFAULTS[table])) out[col] = def

  for (const col of TABLE_COLUMNS[table]) {
    if (!CLIENT_WRITABLE[table].has(col)) continue
    if (!(col in raw)) continue
    let value = raw[col]
    if (value === undefined) continue

    if (col.endsWith('_minor') || col === 'sort_order' || col === 'archived' || col === 'paid' || col === 'statement_day' || col === 'due_day' || col === 'week_start') {
      value = col === 'archived' || col === 'paid' ? asBoolInt(value) : asInt(value)
    } else if (typeof value === 'string') {
      value = value.trim()
      if (value === '') value = null
    }
    out[col] = value ?? null
  }

  for (const col of REQUIRED[table]) {
    const v = out[col]
    if (v === null || v === undefined) return { ok: false, error: `Missing required field \`${col}\`` }
  }
  if (table === 'accounts' && out.type !== 'bank' && out.type !== 'credit_card') return { ok: false, error: '`type` must be bank or credit_card' }
  if (table === 'expenses' && (typeof out.amount_minor !== 'number' || out.amount_minor <= 0)) return { ok: false, error: '`amount_minor` must be a positive integer' }
  if (table === 'budgets' && (typeof out.amount_minor !== 'number' || out.amount_minor < 0)) return { ok: false, error: '`amount_minor` must be a non-negative integer' }

  return { ok: true, row: out }
}

function upsertStatement(db: D1Database, table: SyncTableName, row: Record<string, unknown>): D1PreparedStatement {
  const cols = TABLE_COLUMNS[table]
  const placeholders = cols.map(() => '?').join(', ')
  const updates = cols
    .filter((c) => c !== 'id' && c !== 'user_id' && c !== 'created_at')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')
  const sql =
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates} WHERE excluded.updated_at > ${table}.updated_at`
  return db.prepare(sql).bind(...cols.map((c) => (row[c] === undefined ? null : row[c])))
}

export interface PushResult {
  applied: number
  errors: Array<{ index: number; table: string; message: string }>
  cursor: string
}

export async function applyOps(c: Context<AppEnv>, userId: string, ops: SyncOp[]): Promise<PushResult> {
  const now = new Date().toISOString()
  const errors: PushResult['errors'] = []
  const statements: D1PreparedStatement[] = []
  let applied = 0
  let maxUpdated = now

  ops.forEach((op, index) => {
    if (!op || !isSyncTable(op.table) || !op.row || typeof op.row !== 'object') {
      errors.push({ index, table: String(op?.table ?? 'unknown'), message: 'Unknown table or malformed row' })
      return
    }
    if (op.op === 'delete') {
      const id = typeof op.row.id === 'string' ? op.row.id : null
      if (!id) {
        errors.push({ index, table: op.table, message: 'Delete requires `id`' })
        return
      }
      const updatedAt = typeof op.row.updated_at === 'string' ? op.row.updated_at : now
      if (updatedAt > maxUpdated) maxUpdated = updatedAt
      statements.push(
        c.env.DB.prepare(
          `UPDATE ${op.table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND (updated_at < ? OR deleted_at IS NULL)`,
        ).bind(updatedAt, updatedAt, id, userId, updatedAt),
      )
      applied++
      return
    }

    const sanitized = sanitizeRow(op.table, op.row, userId, now)
    if (!sanitized.ok) {
      errors.push({ index, table: op.table, message: sanitized.error })
      return
    }
    const row = sanitized.row
    const updatedAt = row.updated_at as string
    if (updatedAt > maxUpdated) maxUpdated = updatedAt
    statements.push(upsertStatement(c.env.DB, op.table, row))
    applied++
  })

  if (statements.length) await c.env.DB.batch(statements)
  return { applied, errors, cursor: maxUpdated }
}

export interface PullResult {
  cursor: string
  server_time: string
  accounts: unknown[]
  categories: unknown[]
  expenses: unknown[]
  budgets: unknown[]
  settings: unknown[]
}

/** Per-table row cap for a single delta pull; bounds the response size. */
const PULL_LIMIT = 2000

export async function pullSince(c: Context<AppEnv>, userId: string, since: string): Promise<PullResult> {
  const tables: SyncTableName[] = ['accounts', 'categories', 'expenses', 'budgets', 'settings']
  const result: PullResult = {
    cursor: since,
    server_time: new Date().toISOString(),
    accounts: [],
    categories: [],
    expenses: [],
    budgets: [],
    settings: [],
  }
  let maxUpdated = since
  const cursorFrom = since || '1970-01-01T00:00:00.000Z'

  for (const table of tables) {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT ?`,
    )
      .bind(userId, cursorFrom, PULL_LIMIT)
      .all<Record<string, unknown>>()
    ;(result as unknown as Record<string, unknown[]>)[table] = results ?? []
    for (const row of results ?? []) {
      const updated = String(row.updated_at ?? '')
      if (updated > maxUpdated) maxUpdated = updated
    }
  }
  result.cursor = maxUpdated
  return result
}

export function newRowDefaults(): { id: string; now: string } {
  return { id: randomId(), now: new Date().toISOString() }
}
