import { describe, expect, it } from 'vitest'
import {
  PBKDF2_ITERATIONS,
  hashPassword,
  newSalt,
  resolveIterations,
  timingSafeEqual,
  verifyPassword,
} from '../server/crypto'

describe('resolveIterations', () => {
  it('falls back to the default for missing/invalid/too-small values', () => {
    expect(resolveIterations(undefined)).toBe(PBKDF2_ITERATIONS)
    expect(resolveIterations(null)).toBe(PBKDF2_ITERATIONS)
    expect(resolveIterations('')).toBe(PBKDF2_ITERATIONS)
    expect(resolveIterations('not-a-number')).toBe(PBKDF2_ITERATIONS)
    // Below the 10k floor → default.
    expect(resolveIterations('100')).toBe(PBKDF2_ITERATIONS)
  })

  it('accepts valid overrides', () => {
    expect(resolveIterations('120000')).toBe(120_000)
    expect(resolveIterations('50000')).toBe(50_000)
    expect(resolveIterations(25_000)).toBe(25_000)
  })

  it('keeps the free-tier default modest', () => {
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000)
  })
})

describe('password hashing', () => {
  it('round-trips a password against the stored salt + iterations', async () => {
    const salt = newSalt()
    const iterations = 12_000
    const hash = await hashPassword('correct horse battery staple', salt, iterations)

    expect(await verifyPassword('correct horse battery staple', salt, hash, iterations)).toBe(true)
    expect(await verifyPassword('wrong password', salt, hash, iterations)).toBe(false)
  })

  it('uses a fresh random salt each time', () => {
    expect(newSalt()).not.toBe(newSalt())
  })

  it('compares strings in constant time (length-independent result)', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})
