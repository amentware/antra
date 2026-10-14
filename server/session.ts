/**
 * Antra — session cookie issuing/verification + bearer API-token auth.
 *
 * Session JWT lives in an HttpOnly, Secure, SameSite=Strict cookie. The
 * `sessions` row is checked on every authenticated request so tokens can be
 * revoked (logout / "sign out everywhere") before their natural expiry.
 */
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from './env'
import { jwtExpirySeconds, SESSION_COOKIE, SESSION_TTL_SECONDS } from './constants'
import { randomId, sha256Hex } from './crypto'
import { signJwt, verifyJwt } from './jwt'
import { unauthorized } from './http'

export interface SessionUser {
  id: string
  email: string
  name: string
}

function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ]
  return attrs.join('; ')
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

/** Create a session row + signed JWT. Returns the token and the row id. */
export async function createSession(
  c: Context<AppEnv>,
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; sessionId: string }> {
  const sessionId = randomId()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString()
  const token = await signJwt(
    { sub: userId, sid: sessionId, iat: Math.floor(now.getTime() / 1000), exp: jwtExpirySeconds() },
    c.env.JWT_SECRET,
  )
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(sessionId, userId, await sha256Hex(token), userAgent, now.toISOString(), expiresAt, now.toISOString())
    .run()
  return { token, sessionId }
}

export async function revokeSession(c: Context<AppEnv>, sessionId: string): Promise<void> {
  await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), sessionId)
    .run()
}

/**
 * Sliding renewal: re-sign the session JWT with a fresh expiry and extend the
 * session row, so an actively-used phone is never asked to sign in again.
 */
export async function rotateSession(c: Context<AppEnv>, sessionId: string, userId: string): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString()
  const token = await signJwt(
    { sub: userId, sid: sessionId, iat: Math.floor(now.getTime() / 1000), exp: jwtExpirySeconds(now.getTime()) },
    c.env.JWT_SECRET,
  )
  await c.env.DB.prepare(`UPDATE sessions SET token_hash = ?, expires_at = ?, last_seen_at = ? WHERE id = ?`)
    .bind(await sha256Hex(token), expiresAt, now.toISOString(), sessionId)
    .run()
  c.header('Set-Cookie', sessionCookie(token))
  return token
}

/** Age of the current session in seconds, parsed from the cookie's JWT. */
export async function sessionAgeSeconds(c: Context<AppEnv>): Promise<number> {
  const header = c.req.header('Cookie') ?? c.req.header('cookie')
  const token = parseCookies(header)[SESSION_COOKIE]
  if (!token) return 0
  const payload = await verifyJwt(token, c.env.JWT_SECRET).catch(() => null)
  if (!payload) return 0
  return Math.max(0, Math.floor(Date.now() / 1000) - payload.iat)
}

async function resolveSession(c: Context<AppEnv>, token: string): Promise<string | null> {
  const payload = await verifyJwt(token, c.env.JWT_SECRET)
  if (!payload) return null
  const row = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE id = ?`,
  )
    .bind(payload.sid)
    .first<{ id: string; user_id: string; expires_at: string; revoked_at: string | null }>()
  if (!row || row.revoked_at) return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null
  if (row.user_id !== payload.sub) return null
  // Best-effort sliding "last seen" touch (throttled to once per hour of drift).
  await c.env.DB.prepare(`UPDATE sessions SET last_seen_at = ? WHERE id = ? AND last_seen_at < ?`)
    .bind(new Date().toISOString(), row.id, new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .run()
    .catch(() => undefined)
  c.set('sessionId', row.id)
  return row.user_id
}

async function resolveBearer(c: Context<AppEnv>, token: string): Promise<string | null> {
  const hash = await sha256Hex(token)
  const row = await c.env.DB.prepare(`SELECT id, user_id, revoked_at FROM api_tokens WHERE token_hash = ?`)
    .bind(hash)
    .first<{ id: string; user_id: string; revoked_at: string | null }>()
  if (!row || row.revoked_at) return null
  c.set('tokenId', row.id)
  c.env.DB.prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), row.id)
    .run()
    .catch(() => undefined)
  return row.user_id
}

/**
 * Auth middleware accepting either the session cookie or a Bearer API token.
 * Use `requireSession` where only interactive sessions should be allowed
 * (creating tokens, changing settings, etc.).
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization') ?? c.req.header('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const raw = authHeader.slice(7).trim()
    const userId = await resolveBearer(c, raw)
    if (!userId) return unauthorized(c, 'Invalid or revoked API token')
    c.set('userId', userId)
    c.set('authMethod', 'api_token')
    await next()
    return
  }

  const cookieHeader = c.req.header('Cookie') ?? c.req.header('cookie')
  const token = parseCookies(cookieHeader)[SESSION_COOKIE]
  if (!token) return unauthorized(c)
  const userId = await resolveSession(c, token)
  if (!userId) return unauthorized(c, 'Session expired, please sign in again')
  c.set('userId', userId)
  c.set('authMethod', 'session')
  await next()
}

/** Restrict a route to cookie-based sessions only. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('authMethod') !== 'session') return unauthorized(c, 'This action requires an interactive session')
  await next()
}
