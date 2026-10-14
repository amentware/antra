/**
 * Antra — local PIN lock. The PIN never leaves the device; only a salted
 * PBKDF2 hash is stored in IndexedDB metadata.
 */
import { getMeta, META_KEYS, setMeta } from './db'

const ITERATIONS = 120_000
const KEY_BITS = 256

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  )
  return toBase64(new Uint8Array(bits))
}

export interface PinRecord {
  salt: string
  hash: string
  iterations: number
}

export async function hashPin(pin: string): Promise<PinRecord> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const hash = await derive(pin, salt, ITERATIONS)
  return { salt: toBase64(salt), hash, iterations: ITERATIONS }
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await derive(pin, fromBase64(record.salt), record.iterations)
  if (hash.length !== record.hash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ record.hash.charCodeAt(i)
  return diff === 0
}

export async function getPinRecord(): Promise<PinRecord | null> {
  return (await getMeta<PinRecord>(META_KEYS.pinHash)) ?? null
}

export async function setPin(pin: string): Promise<void> {
  await setMeta(META_KEYS.pinHash, await hashPin(pin))
  await setMeta(META_KEYS.pinEnabled, true)
}

export async function clearPin(): Promise<void> {
  await setMeta(META_KEYS.pinHash, null)
  await setMeta(META_KEYS.pinEnabled, false)
}

export async function isPinEnabled(): Promise<boolean> {
  return Boolean(await getMeta<boolean>(META_KEYS.pinEnabled))
}

export async function getLockTimeoutMinutes(): Promise<number> {
  return (await getMeta<number>(META_KEYS.lockTimeout)) ?? 5
}

export async function setLockTimeoutMinutes(minutes: number): Promise<void> {
  await setMeta(META_KEYS.lockTimeout, minutes)
}
