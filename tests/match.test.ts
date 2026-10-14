import { describe, expect, it } from 'vitest'
import {
  levenshtein,
  matchByName,
  MATCH_THRESHOLD,
  normalizeName,
  resolveRef,
  similarity,
} from '@shared/match'

describe('normalizeName', () => {
  it('lowercases, strips punctuation and expands &', () => {
    expect(normalizeName('Food & Dining')).toBe('food and dining')
    expect(normalizeName('  HDFC   Credit-Card ')).toBe('hdfc credit card')
    expect(normalizeName('Café!')).toBe('cafe')
  })

  it('is empty-safe', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName('   ')).toBe('')
  })
})

describe('levenshtein', () => {
  it('computes the classic edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })
})

describe('similarity', () => {
  it('returns 1 for identical names after normalisation', () => {
    expect(similarity('Food & Dining', 'food and dining')).toBe(1)
  })

  it('returns 0 when one side is empty', () => {
    expect(similarity('', 'food')).toBe(0)
    expect(similarity('food', '')).toBe(0)
  })

  it('scores reordered tokens highly (Jaccard)', () => {
    expect(similarity('dining food', 'food dining')).toBeGreaterThanOrEqual(0.9)
  })

  it('scores containment (abbreviation) highly', () => {
    expect(similarity('card', 'hdfc card')).toBeGreaterThanOrEqual(0.9)
  })

  it('still clears the threshold when a word is dropped from the middle', () => {
    const score = similarity('hdfc card', 'hdfc credit card')
    expect(score).toBeGreaterThan(MATCH_THRESHOLD)
    expect(score).toBeLessThan(0.9)
  })

  it('scores typos below an exact match but often above threshold', () => {
    const score = similarity('grocerys', 'groceries')
    expect(score).toBeGreaterThan(MATCH_THRESHOLD)
    expect(score).toBeLessThan(1)
  })
})

describe('matchByName', () => {
  const categories = [
    { id: 'c_food', name: 'Food & Dining' },
    { id: 'c_groceries', name: 'Groceries' },
    { id: 'c_fuel', name: 'Fuel' },
  ]

  it('matches a normalized name exactly', () => {
    const m = matchByName(categories, 'food and dining', (c) => c.name)
    expect(m?.item.id).toBe('c_food')
    expect(m?.score).toBe(1)
  })

  it('matches a fuzzy Shortcuts-style phrase above the threshold', () => {
    expect(matchByName(categories, 'food dining', (c) => c.name)?.item.id).toBe('c_food')
    expect(matchByName(categories, 'grocery', (c) => c.name)?.item.id).toBe('c_groceries')
  })

  it('returns null when nothing clears the threshold', () => {
    expect(matchByName(categories, 'xyzzy', (c) => c.name)).toBeNull()
    expect(matchByName(categories, '', (c) => c.name)).toBeNull()
  })
})

describe('resolveRef (id or fuzzy name, as used by the public API)', () => {
  const accounts = [
    { id: 'acc_hdfc', name: 'HDFC Credit Card' },
    { id: 'acc_cash', name: 'Cash' },
  ]

  it('resolves an exact id first', () => {
    expect(resolveRef(accounts, 'acc_cash', (a) => a.name)?.item.id).toBe('acc_cash')
    // An id wins even if its name would match a different row.
    expect(resolveRef(accounts, 'acc_hdfc', (a) => a.name)?.score).toBe(1)
  })

  it('falls back to a case-insensitive fuzzy name', () => {
    expect(resolveRef(accounts, 'hdfc credit card', (a) => a.name)?.item.id).toBe('acc_hdfc')
    expect(resolveRef(accounts, 'cash', (a) => a.name)?.item.id).toBe('acc_cash')
  })

  it('returns null for undefined / empty / unknown refs', () => {
    expect(resolveRef(accounts, undefined, (a) => a.name)).toBeNull()
    expect(resolveRef(accounts, '', (a) => a.name)).toBeNull()
    expect(resolveRef(accounts, 'zzz-unknown', (a) => a.name)).toBeNull()
  })
})
