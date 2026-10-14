/** Client-side id generation. Ids are created on the client so retries are idempotent. */

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // RFC 4122 v4 fallback for older WebKit.
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * A monotonically increasing timestamp so rows written in the same batch get
 * strictly increasing `updated_at` values (keeps last-write-wins deterministic).
 */
let lastStamp = 0
export function nowIso(): string {
  const t = Math.max(Date.now(), lastStamp + 1)
  lastStamp = t
  return new Date(t).toISOString()
}
