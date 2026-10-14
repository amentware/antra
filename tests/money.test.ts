import { describe, expect, it } from 'vitest'
import {
  evaluateExpression,
  majorToMinor,
  minorToMajor,
  parseMajorToMinor,
  percent,
  progressPercent,
  roundHalfUp,
  safeDiv,
  sumMinor,
} from '@shared/money'
import { formatMinor, formatMinorParts, minorUnits } from '@shared/currency'

describe('roundHalfUp', () => {
  it('rounds halves away from zero', () => {
    expect(roundHalfUp(0.5)).toBe(1)
    expect(roundHalfUp(1.5)).toBe(2)
    expect(roundHalfUp(2.5)).toBe(3)
    expect(roundHalfUp(-0.5)).toBe(-1)
    expect(roundHalfUp(-2.5)).toBe(-3)
  })

  it('rounds below half toward zero', () => {
    expect(roundHalfUp(0.49)).toBe(0)
    expect(roundHalfUp(-0.49)).toBe(0)
  })
})

describe('minorUnits', () => {
  it('knows zero-decimal currencies', () => {
    expect(minorUnits('JPY')).toBe(0)
    expect(minorUnits('KRW')).toBe(0)
  })

  it('knows three-decimal currencies', () => {
    expect(minorUnits('KWD')).toBe(3)
    expect(minorUnits('BHD')).toBe(3)
  })

  it('defaults to 2 decimals (and INR fallback for unknown codes)', () => {
    expect(minorUnits('INR')).toBe(2)
    expect(minorUnits('USD')).toBe(2)
    expect(minorUnits('ZZZ')).toBe(2)
    expect(minorUnits(undefined)).toBe(2)
  })
})

describe('parseMajorToMinor', () => {
  it('parses plain decimals exactly (no float drift)', () => {
    expect(parseMajorToMinor('250', 'INR')).toBe(25000)
    expect(parseMajorToMinor('250.5', 'INR')).toBe(25050)
    expect(parseMajorToMinor('250.55', 'INR')).toBe(25055)
    expect(parseMajorToMinor('0.1', 'INR')).toBe(10)
    expect(parseMajorToMinor('0.07', 'INR')).toBe(7)
  })

  it('handles the classic 0.1 + 0.2 style inputs without drift', () => {
    expect(parseMajorToMinor('0.2', 'INR')).toBe(20)
    expect(parseMajorToMinor('1.005', 'INR')).toBe(101) // rounded half-up at 2dp
  })

  it('accepts grouping separators and a currency symbol', () => {
    expect(parseMajorToMinor('₹1,28,929.20', 'INR')).toBe(12892920)
    expect(parseMajorToMinor('$1,234.56', 'USD')).toBe(123456)
    expect(parseMajorToMinor('1.234,56', 'EUR')).toBe(123456) // European format
  })

  it('handles negatives', () => {
    expect(parseMajorToMinor('-42.50', 'INR')).toBe(-4250)
    expect(parseMajorToMinor('(42.50)', 'INR')).toBe(-4250)
  })

  it('treats a numeric argument as major units', () => {
    expect(parseMajorToMinor(250.5, 'INR')).toBe(25050)
    expect(parseMajorToMinor(1200, 'JPY')).toBe(1200) // 0-decimal currency
  })

  it('returns 0 for junk / empty input', () => {
    expect(parseMajorToMinor('', 'INR')).toBe(0)
    expect(parseMajorToMinor('   ', 'INR')).toBe(0)
    expect(parseMajorToMinor('abc', 'INR')).toBe(0)
    expect(parseMajorToMinor(NaN, 'INR')).toBe(0)
  })

  it('respects the currency decimals when slicing the fraction', () => {
    expect(parseMajorToMinor('12.999', 'JPY')).toBe(13) // 0 decimals → round
    expect(parseMajorToMinor('1.2345', 'KWD')).toBe(1235) // 3 decimals → 1.235
  })
})

describe('majorToMinor / minorToMajor', () => {
  it('round-trips clean values', () => {
    expect(majorToMinor(250.5, 'INR')).toBe(25050)
    expect(minorToMajor(25050, 'INR')).toBe(250.5)
  })

  it('rounds safely', () => {
    expect(majorToMinor(0.005, 'INR')).toBe(1)
    expect(majorToMinor(19.999, 'INR')).toBe(2000)
  })
})

describe('sumMinor / percent / safeDiv', () => {
  it('sums integers only', () => {
    expect(sumMinor([100, 250, 3])).toBe(353)
    expect(sumMinor([1.4, 1.4])).toBe(2) // each rounded before summing
  })

  it('percent guards against zero', () => {
    expect(percent(25, 100)).toBe(25)
    expect(percent(5, 0)).toBe(0)
  })

  it('safeDiv never yields NaN/Infinity', () => {
    expect(safeDiv(10, 2)).toBe(5)
    expect(safeDiv(10, 0)).toBe(0)
    expect(safeDiv(0, 0)).toBe(0)
  })

  it('progressPercent clamps to 0..100', () => {
    expect(progressPercent(50, 100)).toBe(50)
    expect(progressPercent(150, 100)).toBe(100)
    expect(progressPercent(1, 0)).toBe(0)
  })
})

describe('evaluateExpression (keypad calculator)', () => {
  it('evaluates + − × ÷ with precedence', () => {
    expect(evaluateExpression('250+80')).toBe(330)
    expect(evaluateExpression('12×3')).toBe(36)
    expect(evaluateExpression('2+3*4')).toBe(14)
    expect(evaluateExpression('100÷4-5')).toBe(20)
    expect(evaluateExpression('10-2-3')).toBe(5)
  })

  it('normalises unicode operators and grouping commas', () => {
    expect(evaluateExpression('1,000+250')).toBe(1250)
    expect(evaluateExpression('6−2')).toBe(4) // U+2212 minus
  })

  it('returns null for incomplete or invalid expressions', () => {
    expect(evaluateExpression('250+')).toBeNull()
    expect(evaluateExpression('')).toBeNull()
    expect(evaluateExpression('abc')).toBeNull()
    expect(evaluateExpression('1..2')).toBeNull()
    expect(evaluateExpression('5/0')).toBeNull()
  })

  it('handles a leading operator as zero', () => {
    expect(evaluateExpression('+5')).toBe(5)
    expect(evaluateExpression('-5')).toBe(-5)
  })
})

describe('formatMinor', () => {
  it('formats INR with lakh grouping and the rupee symbol', () => {
    expect(formatMinor(12892920, 'INR')).toBe('₹1,28,929.20')
  })

  it('formats USD with thousands grouping', () => {
    expect(formatMinor(123456, 'USD')).toBe('$1,234.56')
  })

  it('formats zero-decimal currencies without a decimal part', () => {
    // ja-JP emits the fullwidth yen sign (￥), so assert on the digits.
    expect(formatMinor(1200, 'JPY')).toContain('1,200')
    expect(formatMinor(1200, 'JPY')).not.toContain('.')
  })
})

describe('formatMinorParts', () => {
  it('splits integer and decimal parts for a big INR amount', () => {
    const parts = formatMinorParts(12892920, 'INR')
    expect(parts.integer).toBe('1,28,929')
    expect(parts.decimal).toBe('20')
    expect(parts.symbol).toBe('₹')
    expect(parts.symbolPlacement).toBe('prefix')
    expect(parts.sign).toBe('')
  })

  it('reports a negative sign and 0-decimal currency correctly', () => {
    const parts = formatMinorParts(-1200, 'JPY')
    expect(parts.sign).toBe('-')
    expect(parts.decimal).toBe('')
    expect(parts.integer).toBe('1,200')
  })
})
