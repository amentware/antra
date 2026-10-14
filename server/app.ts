/**
 * Antra — Hono application. Mounted at `/api` by the Pages Function.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './env'
import { badRequest, forbidden, notFound, readJson, serverError, tooMany, unauthorized } from './http'
import { authLoginSchema, authSetupSchema, apiTokenCreateSchema } from '../shared/schemas'
import { DEFAULT_CATEGORIES } from '../shared/categories'
import { createApiToken, hashPassword, newSalt, randomId, resolveIterations, verifyPassword } from './crypto'
import { clearSessionCookie, createSession, requireAuth, requireSession, revokeSession, rotateSession, sessionAgeSeconds, sessionCookie } from './session'
import { LOGIN_RATE_LIMIT, SESSION_COOKIE, SESSION_ROTATE_AFTER_SECONDS } from './constants'
import { rateLimit } from './ratelimit'
import { applyOps, isSyncTable, pullSince, type SyncOp } from './sync'
import { handleCreateExpense, handleListExpenses, handleMeta } from './public-api'

export const app = new Hono<AppEnv>().basePath('/api')

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
  // API responses may contain user data; never cache them. (Pages' `_headers`
  // only applies to static assets, not Function responses, so set it here too.)
  c.header('Cache-Control', 'no-store')
  c.header('X-Robots-Tag', 'noindex')
})

// Shortcuts don't need CORS, but a permissive policy keeps the API usable from
// other tools. Bearer tokens are required regardless, so this is not a risk.
app.use('/v1/*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'], allowMethods: ['GET', 'POST', 'OPTIONS'] }))

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/health', (c) => c.json({ ok: true, service: 'antra', time: new Date().toISOString() }))

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function userCount(c: { env: AppEnv['Bindings'] }): Promise<number> {
  const row = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>()
  return row?.n ?? 0
}

function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
}

app.get('/auth/status', async (c) => {
  const n = await userCount(c)
  return c.json({ setup_required: n === 0, registration_open: n === 0 })
})

app.post('/auth/setup', async (c) => {
  const existing = await userCount(c)
  if (existing > 0) return forbidden(c, 'Registration is closed. An account already exists.')

  const body = await readJson(c)
  const parsed = authSetupSchema.safeParse(body)
  if (!parsed.success) return badRequest(c, 'Please check the form', parsed.error.flatten().fieldErrors)
  const { email, password, name } = parsed.data

  const now = new Date().toISOString()
  const userId = randomId()
  const salt = newSalt()
  const iterations = resolveIterations(c.env.PBKDF2_ITERATIONS)
  const hash = await hashPassword(password, salt, iterations)

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, password_salt, iterations, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(userId, email.toLowerCase(), name, hash, salt, iterations, now, now)
    .run()

  await seedDefaults(c, userId)

  const { token } = await createSession(c, userId, c.req.header('User-Agent') ?? null)
  c.header('Set-Cookie', sessionCookie(token))
  return c.json({ user: { id: userId, email: email.toLowerCase(), name, created_at: now } }, 201)
})

app.post('/auth/login', async (c) => {
  const body = await readJson(c)
  const parsed = authLoginSchema.safeParse(body)
  if (!parsed.success) return badRequest(c, 'Please check the form')
  const { email, password } = parsed.data

  const limit = await rateLimit(c, `login:${clientIp(c)}:${email.toLowerCase()}`, LOGIN_RATE_LIMIT.max, LOGIN_RATE_LIMIT.windowSeconds)
  if (!limit.allowed) {
    c.header('Retry-After', String(limit.retryAfterSeconds))
    return tooMany(c, 'Too many sign-in attempts. Try again in a few minutes.')
  }

  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; name: string; password_hash: string; password_salt: string; iterations: number; created_at: string }>()
  if (!user) return unauthorized(c, 'Incorrect email or password')

  const ok = await verifyPassword(password, user.password_salt, user.password_hash, user.iterations)
  if (!ok) return unauthorized(c, 'Incorrect email or password')

  const { token } = await createSession(c, user.id, c.req.header('User-Agent') ?? null)
  c.header('Set-Cookie', sessionCookie(token))
  return c.json({ user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at } })
})

app.post('/auth/logout', async (c) => {
  const sessionId = c.get('sessionId')
  if (sessionId) await revokeSession(c, sessionId)
  c.header('Set-Cookie', clearSessionCookie())
  return c.json({ ok: true })
})

app.get('/auth/me', requireAuth, async (c) => {
  const user = await c.env.DB.prepare(`SELECT id, email, name, created_at FROM users WHERE id = ?`)
    .bind(c.get('userId'))
    .first<{ id: string; email: string; name: string; created_at: string }>()
  if (!user) return unauthorized(c)
  // Slide the session forward for active users so they rarely sign in again.
  if (c.get('authMethod') === 'session') {
    const age = await sessionAgeSeconds(c)
    if (age > SESSION_ROTATE_AFTER_SECONDS && c.get('sessionId')) {
      await rotateSession(c, c.get('sessionId')!, user.id)
    }
  }
  return c.json({ user })
})

// ---------------------------------------------------------------------------
// Delta sync
// ---------------------------------------------------------------------------
app.get('/sync', requireAuth, async (c) => {
  const since = c.req.query('since') ?? '1970-01-01T00:00:00.000Z'
  const data = await pullSince(c, c.get('userId'), since)
  return c.json(data)
})

app.post('/sync', requireAuth, async (c) => {
  const body = await readJson<{ ops?: unknown }>(c)
  const opsRaw = Array.isArray(body?.ops) ? body!.ops : null
  if (!opsRaw) return badRequest(c, 'Expected `{ ops: [...] }`')
  if (opsRaw.length > 500) return badRequest(c, 'Too many operations in one batch (max 500)')

  const ops: SyncOp[] = []
  for (const raw of opsRaw) {
    const op = raw as SyncOp
    if (!op || !isSyncTable(op.table) || (op.op !== 'upsert' && op.op !== 'delete') || typeof op.row !== 'object' || op.row === null) {
      return badRequest(c, 'Each op needs { table, op: "upsert"|"delete", row }')
    }
    ops.push(op)
  }
  const result = await applyOps(c, c.get('userId'), ops)
  return c.json(result)
})

// ---------------------------------------------------------------------------
// API tokens
// ---------------------------------------------------------------------------
app.get('/tokens', requireAuth, requireSession, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_tokens
     WHERE user_id = ? ORDER BY created_at DESC`,
  )
    .bind(c.get('userId'))
    .all()
  return c.json({ tokens: results ?? [] })
})

app.post('/tokens', requireAuth, requireSession, async (c) => {
  const parsed = apiTokenCreateSchema.safeParse(await readJson(c))
  if (!parsed.success) return badRequest(c, 'Give your token a name')
  const { token, hash, prefix } = await createApiToken()
  const id = randomId()
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO api_tokens (id, user_id, name, prefix, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, c.get('userId'), parsed.data.name, prefix, hash, now)
    .run()
  // The plaintext token is returned exactly once.
  return c.json({ token: { id, name: parsed.data.name, prefix, created_at: now }, plaintext: token }, 201)
})

app.delete('/tokens/:id', requireAuth, requireSession, async (c) => {
  const id = c.req.param('id')
  const res = await c.env.DB.prepare(
    `UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(new Date().toISOString(), id, c.get('userId'))
    .run()
  if (!res.meta.changes) return notFound(c, 'Token not found')
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Public API v1 (Bearer token)
// ---------------------------------------------------------------------------
app.get('/v1/meta', requireAuth, handleMeta)
app.get('/v1/expenses', requireAuth, handleListExpenses)
app.post('/v1/expenses', requireAuth, handleCreateExpense)

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------
app.notFound((c) => notFound(c, `No API route for ${c.req.method} ${new URL(c.req.url).pathname}`))

app.onError((err, c) => {
  console.error('[antra] unhandled error', err)
  return serverError(c)
})

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
async function seedDefaults(c: { env: AppEnv['Bindings'] }, userId: string): Promise<void> {
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = []

  DEFAULT_CATEGORIES.forEach((cat, index) => {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO categories (id, user_id, name, emoji, color, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      ).bind(randomId(), userId, cat.name, cat.emoji, cat.color, index, now, now),
    )
  })

  statements.push(
    c.env.DB.prepare(
      `INSERT INTO settings (id, user_id, currency, theme, timezone, week_start, created_at, updated_at, deleted_at)
       VALUES (?, ?, 'INR', 'system', 'Asia/Kolkata', 1, ?, ?, NULL)`,
    ).bind(`settings_${userId}`, userId, now, now),
  )

  await c.env.DB.batch(statements)
}

export { SESSION_COOKIE }

// Re-exported helpers kept for potential future routes.
export const __internals = { hashPassword, newSalt, verifyPassword }
