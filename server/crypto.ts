/**
 * Antra — Worker cryptography helpers (WebCrypto only, zero dependencies).
 *
 * Passwords use PBKDF2-HMAC-SHA256 with a per-user salt and a high iteration
 * count. API tokens are stored as SHA-256 hashes and are only ever shown once.
 */

const encoder = new TextEncoder()

/**
 * Password-hashing work factor.
 *
 * Cloudflare Workers (including the free plan that Pages Functions run on)
 * enforce a CPU-time limit per request — roughly 10 ms on the free plan.
 * PBKDF2-HMAC-SHA256 is pure CPU work, so a high iteration count blows the
 * budget and the request is aborted (surfaced as "Error 1102" / a generic
 * "something went wrong" on the sign-up and sign-in screens).
 *
 * Empirically ~100k iterations already consumes the whole free-tier allowance,
 * so we default to a value that fits with comfortable headroom while keeping a
 * meaningful work factor. On a paid Workers plan (far more CPU time) you can
 * raise this by setting the `PBKDF2_ITERATIONS` var.
 */
export const PBKDF2_ITERATIONS = 70_000
const MIN_ITERATIONS = 10_000
const SALT_BYTES = 16
const KEY_BITS = 256

/** Parse/validate an iteration-count override from env; falls back to the default. */
export function resolveIterations(raw?: string | number | null): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n < MIN_ITERATIONS) return PBKDF2_ITERATIONS
  return Math.floor(n)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return base64ToBytes(padded + pad)
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  crypto.getRandomValues(out)
  return out
}

export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newSalt(): string {
  return bytesToBase64(randomBytes(SALT_BYTES))
}

export async function hashPassword(password: string, saltB64: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64) as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  )
  return bytesToBase64(new Uint8Array(bits))
}

/** Constant-time comparison of two strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still perform a comparison to keep timing roughly constant.
    let diff = a.length ^ b.length
    const max = Math.max(a.length, b.length)
    for (let i = 0; i < max; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0)
    return diff === 0
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(password: string, saltB64: string, expectedHash: string, iterations: number): Promise<boolean> {
  const hash = await hashPassword(password, saltB64, iterations)
  return timingSafeEqual(hash, expectedHash)
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Create a new opaque API token: `antra_<32 hex>`. Returns the plaintext + hash + prefix. */
export async function createApiToken(): Promise<{ token: string; hash: string; prefix: string }> {
  const raw = toBase64Url(randomBytes(24)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
  const token = `antra_${raw}`
  return { token, hash: await sha256Hex(token), prefix: token.slice(0, 12) }
}
