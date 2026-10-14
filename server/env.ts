import type { D1Database, KVNamespace } from '@cloudflare/workers-types'

/** Cloudflare bindings available to the Pages Functions API. */
export interface Bindings {
  /** D1 database (bound as `DB`). */
  DB: D1Database
  /** HMAC secret for signing session JWTs. Set via `wrangler pages secret put JWT_SECRET`. */
  JWT_SECRET: string
  /** Optional KV namespace used for rate limiting. Falls back to D1 when absent. */
  RATE_LIMIT?: KVNamespace
  /** "production" | "preview" — informational only. */
  ENVIRONMENT?: string
  /**
   * Override the password-hashing work factor (PBKDF2 iterations). Defaults to
   * a value that fits the Workers free-tier CPU limit. Raise it on a paid plan.
   */
  PBKDF2_ITERATIONS?: string
}

/** Per-request variables populated by middleware. */
export interface Variables {
  userId: string
  sessionId: string | null
  tokenId: string | null
  authMethod: 'session' | 'api_token'
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
