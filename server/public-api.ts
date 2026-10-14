/**
 * Antra — public API v1 for iOS Shortcuts. Bearer-token authenticated.
 *
 *   GET  /api/v1/meta           → accounts + categories (+ currency)
 *   POST /api/v1/expenses       → create an expense, echo back budget status
 *   GET  /api/v1/expenses?limit → recent expenses
 */
import type { Context } from 'hono'
import type { AppEnv } from './env'
import { badRequest, notFound, readJson, tooMany } from './http'
import { apiExpenseCreateSchema, apiTokenCreateSchema } from '../shared/schemas'
import { parseMajorToMinor } from '../shared/money'
import { getCurrency, isKnownCurrency } from '../shared/currency'
import { resolveRef } from '../shared/match'
import { FALLBACK_CATEGORY_NAME } from '../shared/categories'
import { computeBudgetProgress } from '../shared/budget'
import { randomId, sha256Hex } from './crypto'
import { memoryRateLimit } from './ratelimit'
import { API_RATE_LIMIT } from './constants'
import { localDayOfMonth, localMonthLength, startOfDayUtc, startOfMonthUtc } from './tz'
import type { Account, Category, Expense, SettingsRow } from '../shared/types'

interface CtxUser {
  settings: SettingsRow
  currency: string
  timeZone: string
}

async function loadContext(c: Context<AppEnv>, userId: string): Promise<CtxUser> {
  const settings = await c.env.DB.prepare(`SELECT * FROM settings WHERE user_id = ?`)
    .bind(userId)
    .first<SettingsRow>()
  const currency = settings?.currency && isKnownCurrency(settings.currency) ? settings.currency : 'INR'
  return { settings: settings ?? defaultSettings(userId), currency, timeZone: settings?.timezone || 'Asia/Kolkata' }
}

function defaultSettings(userId: string): SettingsRow {
  const now = new Date().toISOString()
  return {
    id: `settings_${userId}`,
    user_id: userId,
    currency: 'INR',
    theme: 'system',
    timezone: 'Asia/Kolkata',
    week_start: 1,
    updated_at: now,
    deleted_at: null,
  }
}

async function loadAccounts(c: Context<AppEnv>, userId: string): Promise<Account[]> {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(userId)
    .all<Account>()
  return results ?? []
}

async function loadCategories(c: Context<AppEnv>, userId: string): Promise<Category[]> {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(userId)
    .all<Category>()
  return results ?? []
}

function rateLimitPublic(c: Context<AppEnv>, tokenId: string | null): boolean {
  const key = `pub:${tokenId ?? 'anon'}`
  const result = memoryRateLimit(key, API_RATE_LIMIT.max, API_RATE_LIMIT.windowSeconds)
  if (!result.allowed) {
    c.header('Retry-After', String(result.retryAfterSeconds))
    return false
  }
  c.header('X-RateLimit-Remaining', String(result.remaining))
  return true
}

export async function handleMeta(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId')
  if (!rateLimitPublic(c, c.get('tokenId'))) return tooMany(c)
  const [accounts, categories, ctx] = await Promise.all([
    loadAccounts(c, userId),
    loadCategories(c, userId),
    loadContext(c, userId),
  ])
  return c.json({
    currency: ctx.currency,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, last4: a.last4 })),
    categories: categories.map((cat) => ({ id: cat.id, name: cat.name, emoji: cat.emoji })),
  })
}

export async function handleListExpenses(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId')
  if (!rateLimitPublic(c, c.get('tokenId'))) return tooMany(c)
  const limitRaw = Number(c.req.query('limit') ?? '20')
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20))

  const { results } = await c.env.DB.prepare(
    `SELECT e.*, c.name AS category_name, c.emoji AS category_emoji, a.name AS account_name, a.type AS account_type
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN accounts a ON a.id = e.account_id
     WHERE e.user_id = ? AND e.deleted_at IS NULL
     ORDER BY e.spent_at DESC LIMIT ?`,
  )
    .bind(userId, limit)
    .all<Expense & { category_name: string | null; category_emoji: string | null; account_name: string | null; account_type: string | null }>()

  return c.json({ expenses: results ?? [] })
}

async function spentBetween(c: Context<AppEnv>, userId: string, fromIso: string, toIso: string | null): Promise<number> {
  const row = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM expenses
     WHERE user_id = ? AND deleted_at IS NULL AND spent_at >= ? ${toIso ? 'AND spent_at < ?' : ''}`,
  )
    .bind(...(toIso ? [userId, fromIso, toIso] : [userId, fromIso]))
    .first<{ total: number }>()
  return row?.total ?? 0
}

export async function handleCreateExpense(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId')
  if (!rateLimitPublic(c, c.get('tokenId'))) return tooMany(c)

  const raw = await readJson(c)
  const parsed = apiExpenseCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return badRequest(c, 'Invalid payload', parsed.error.flatten().fieldErrors)
  }
  const body = parsed.data
  const ctx = await loadContext(c, userId)

  // Idempotency: header wins, body key falls back.
  const idemKey = (c.req.header('Idempotency-Key') ?? body.idempotency_key ?? '').trim() || null
  if (idemKey) {
    const existing = await c.env.DB.prepare(
      `SELECT * FROM expenses WHERE user_id = ? AND idempotency_key = ? AND deleted_at IS NULL`,
    )
      .bind(userId, idemKey)
      .first<Expense>()
    if (existing) {
      return c.json(await buildResponse(c, userId, ctx, existing, true), 200)
    }
  }

  const [accounts, categories] = await Promise.all([loadAccounts(c, userId), loadCategories(c, userId)])

  // Resolve account (id or fuzzy name).
  let account: Account | null = null
  if (body.account) {
    const match = resolveRef(accounts, body.account, (a) => a.name)
    account = match?.item ?? null
  }
  if (!account) account = accounts.find((a) => !a.archived) ?? accounts[0] ?? null
  if (!account) {
    return badRequest(c, 'You have no accounts yet. Add an account in Antra first.')
  }
  if (body.account && !resolveRef(accounts, body.account, (a) => a.name)) {
    return badRequest(c, `Unknown account "${body.account}".`, {
      valid_accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    })
  }

  // Resolve category (id or fuzzy name), with "Other" fallback / auto-create.
  let category: Category | null = null
  if (body.category) {
    const match = resolveRef(categories, body.category, (x) => x.name)
    category = match?.item ?? null
    if (!category && body.create_missing) {
      category = await createCategory(c, userId, body.category, categories.length)
    }
  }
  if (!category) {
    category = categories.find((x) => x.name.toLowerCase() === FALLBACK_CATEGORY_NAME.toLowerCase()) ?? null
    if (!category) category = await createCategory(c, userId, FALLBACK_CATEGORY_NAME, categories.length)
  }

  const currency = ctx.currency
  const amountMinor = parseMajorToMinor(body.amount, currency)
  if (amountMinor <= 0) return badRequest(c, '`amount` must be greater than zero')

  const spentAt = body.date && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date).toISOString() : new Date().toISOString()
  const isCard = account.type === 'credit_card'
  const paid = body.paid === undefined ? (isCard ? 0 : 1) : body.paid ? 1 : 0

  const now = new Date().toISOString()
  const id = randomId()
  await c.env.DB.prepare(
    `INSERT INTO expenses
      (id, user_id, amount_minor, category_id, account_id, merchant, note, spent_at, paid, paid_at, source, idempotency_key, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'api', ?, ?, ?, NULL)`,
  )
    .bind(
      id, userId, amountMinor, category.id, account.id,
      body.merchant ?? null, body.note ?? null, spentAt,
      paid, paid ? now : null, idemKey, now, now,
    )
    .run()

  const created = await c.env.DB.prepare(`SELECT * FROM expenses WHERE id = ?`).bind(id).first<Expense>()
  return c.json(await buildResponse(c, userId, ctx, created!, false), 201)
}

async function createCategory(c: Context<AppEnv>, userId: string, name: string, sortOrder: number): Promise<Category> {
  const now = new Date().toISOString()
  const id = randomId()
  await c.env.DB.prepare(
    `INSERT INTO categories (id, user_id, name, emoji, color, sort_order, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, '📦', '#8A8F98', ?, ?, ?, NULL)`,
  )
    .bind(id, userId, name, sortOrder, now, now)
    .run()
  return {
    id, user_id: userId, name, emoji: '📦', color: '#8A8F98', sort_order: sortOrder,
    created_at: now, updated_at: now, deleted_at: null,
  }
}

async function buildResponse(
  c: Context<AppEnv>,
  userId: string,
  ctx: CtxUser,
  expense: Expense | null,
  idempotentReplay: boolean,
) {
  const now = new Date()
  const tz = ctx.timeZone
  const dayStart = startOfDayUtc(now, tz).toISOString()
  const monthStart = startOfMonthUtc(now, tz).toISOString()

  const [todayMinor, monthMinor] = await Promise.all([
    spentBetween(c, userId, dayStart, null),
    spentBetween(c, userId, monthStart, null),
  ])

  let budget: Record<string, unknown> | null = null
  if (expense) {
    const row = await c.env.DB.prepare(
      `SELECT b.amount_minor AS limit_minor, c.name AS category_name
       FROM budgets b JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ? AND b.category_id = ? AND b.deleted_at IS NULL LIMIT 1`,
    )
      .bind(userId, expense.category_id)
      .first<{ limit_minor: number; category_name: string }>()
    if (row) {
      const categorySpent = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM expenses
         WHERE user_id = ? AND category_id = ? AND deleted_at IS NULL AND spent_at >= ?`,
      )
        .bind(userId, expense.category_id, monthStart)
        .first<{ total: number }>()
      const progress = computeBudgetProgress({
        spentMinor: categorySpent?.total ?? 0,
        limitMinor: row.limit_minor,
        dayOfMonth: localDayOfMonth(now, tz),
        daysInMonth: localMonthLength(now, tz),
      })
      budget = {
        category: row.category_name,
        limit_minor: progress.limitMinor,
        spent_minor: progress.spentMinor,
        remaining_minor: progress.remainingMinor,
        percent_used: Math.round(progress.percentUsed * 10) / 10,
        status: progress.status,
        safe_to_spend_minor: progress.safeToSpendMinor,
        days_left: progress.daysLeft,
        projected_minor: progress.projectedMinor,
        currency: ctx.currency,
      }
    }
  }

  const meta = getCurrency(ctx.currency)
  return {
    expense: expense
      ? {
          id: expense.id,
          amount_minor: expense.amount_minor,
          amount: expense.amount_minor / Math.pow(10, meta.decimals),
          category_id: expense.category_id,
          account_id: expense.account_id,
          merchant: expense.merchant,
          note: expense.note,
          spent_at: expense.spent_at,
          paid: !!expense.paid,
          currency: ctx.currency,
        }
      : null,
    idempotent_replay: idempotentReplay,
    totals: {
      today_minor: todayMinor,
      month_minor: monthMinor,
      today: todayMinor / Math.pow(10, meta.decimals),
      month: monthMinor / Math.pow(10, meta.decimals),
      currency: ctx.currency,
    },
    budget,
  }
}

/** Used by the Settings screen to verify a token belongs to the caller. */
export async function verifyTokenBelongsTo(c: Context<AppEnv>, userId: string, token: string): Promise<boolean> {
  const hash = await sha256Hex(token)
  const row = await c.env.DB.prepare(`SELECT user_id FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL`)
    .bind(hash)
    .first<{ user_id: string }>()
  return row?.user_id === userId
}

export function validateTokenName(input: unknown) {
  return apiTokenCreateSchema.safeParse(input)
}

export { notFound as _notFound }
