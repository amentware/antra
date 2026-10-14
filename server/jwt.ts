/**
 * Antra — minimal HS256 JWT implementation on WebCrypto. No dependencies.
 */
import { fromBase64Url, toBase64Url } from './crypto'

const encoder = new TextEncoder()

export interface JwtPayload {
  /** Subject — user id. */
  sub: string
  /** Session id (used for revocation). */
  sid: string
  /** Issued-at (seconds). */
  iat: number
  /** Expiry (seconds). */
  exp: number
}

function encodeSegment(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)))
}

function decodeSegment<T>(segment: string): T | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(segment))
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = encodeSegment({ alg: 'HS256', typ: 'JWT' })
  const body = encodeSegment(payload)
  const data = `${header}.${body}`
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(data))
  return `${data}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const headerObj = decodeSegment<{ alg?: string }>(header)
  if (headerObj?.alg !== 'HS256') return null
  const valid = await crypto.subtle.verify(
    'HMAC',
    await key(secret),
    fromBase64Url(signature),
    encoder.encode(`${header}.${body}`),
  )
  if (!valid) return null
  const payload = decodeSegment<JwtPayload>(body)
  if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp * 1000 < Date.now()) return null
  return payload
}
