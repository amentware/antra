/**
 * Antra — lightweight rate limiting.
 *
 * Login attempts use a persistent fixed-window counter (KV when bound, D1
 * otherwise) so the limit holds across isolates. High-volume public-API calls
 * use a per-isolate in-memory counter, which is enough to stop runaway loops
 * without writing to D1 on every request.
 */
import type { Context } from 'hono'
import type { AppEnv } from './env'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

async function limitWithKV(env: AppEnv['Bindings'], key: string, max: number, windowSeconds: number): Promise<RateLimitResult | null> {
  if (!env.RATE_LIMIT) return null
  try {
    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds)
    const kvKey = `rl:${key}:${windowStart}`
    const current = Number((await env.RATE_LIMIT.get(kvKey)) ?? '0')
    if (current >= max) return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds }
    await env.RATE_LIMIT.put(kvKey, String(current + 1), { expirationTtl: windowSeconds * 2 })
    return { allowed: true, remaining: Math.max(0, max - current - 1), retryAfterSeconds: 0 }
  } catch {
    return null
  }
}

async function limitWithD1(c: Context<AppEnv>, key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now()
  const bucketStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000
  const bucketIso = new Date(bucketStart).toISOString()
  const retryAfter = Math.ceil((bucketStart + windowSeconds * 1000 - now) / 1000)

  const row = await c.env.DB.prepare(`SELECT count, window_start FROM rate_limits WHERE key = ?`)
    .bind(key)
    .first<{ count: number; window_start: string }>()

  if (!row || row.window_start !== bucketIso) {
    await c.env.DB.prepare(`INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`)
      .bind(key, bucketIso)
      .run()
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 }
  }
  if (row.count >= max) return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter }
  await c.env.DB.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).bind(key).run()
  return { allowed: true, remaining: Math.max(0, max - row.count - 1), retryAfterSeconds: 0 }
}

/** Fixed-window limiter. Falls back to a permissive result if storage errors. */
export async function rateLimit(c: Context<AppEnv>, key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  const viaKV = await limitWithKV(c.env, key, max, windowSeconds)
  if (viaKV) return viaKV
  try {
    return await limitWithD1(c, key, max, windowSeconds)
  } catch {
    return { allowed: true, remaining: max, retryAfterSeconds: 0 }
  }
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

/** Per-isolate limiter for high-volume endpoints. */
export function memoryRateLimit(key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now()
  const existing = memoryBuckets.get(key)
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 }
  }
  if (existing.count >= max) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }
  existing.count++
  return { allowed: true, remaining: max - existing.count, retryAfterSeconds: 0 }
}
