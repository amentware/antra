/** Shared Worker constants. */

export const SESSION_COOKIE = 'antra_session'
/** Sessions are long-lived so the phone rarely asks you to sign in again. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
/** Refresh the cookie when it is older than this many seconds. */
export const SESSION_ROTATE_AFTER_SECONDS = 60 * 60 * 24 * 7 // 7 days

/** JWT expiry (seconds since epoch) — kept in sync with the session TTL. */
export function jwtExpirySeconds(from = Date.now()): number {
  return Math.floor(from / 1000) + SESSION_TTL_SECONDS
}

export const LOGIN_RATE_LIMIT = { max: 8, windowSeconds: 15 * 60 }
export const API_RATE_LIMIT = { max: 120, windowSeconds: 60 }
