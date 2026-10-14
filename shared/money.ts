/**
 * Antra — money math. Everything is integer minor units; no floating point is
 * ever used to store or compare money.
 */

import { minorUnits } from './currency'

/** Round half-away-from-zero, the intuitive behaviour for money. */
export function roundHalfUp(value: number): number {
  const magnitude = Math.round(Math.abs(value))
  if (magnitude === 0) return 0 // never surface -0
  return value < 0 ? -magnitude : magnitude
}

/**
 * Convert a decimal string (e.g. user input or a Shortcut payload) to minor
 * units exactly, without binary floating-point rounding error.
 * Accepts grouping separators, a leading sign and a currency symbol.
 */
export function parseMajorToMinor(value: string | number, currency?: string): number {
  const dec = minorUnits(currency)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0
    return roundHalfUp(value * Math.pow(10, dec))
  }
  let s = value.trim()
  if (!s) return 0
  const negative = /^[-−]/.test(s) || /\(.*\)$/.test(s)
  // Keep digits, separators and a single dot.
  s = s.replace(/[^0-9.,]/g, '')
  // If both , and . appear, assume the last one is the decimal separator.
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const groupSep = decimalSep === '.' ? ',' : '.'
    s = s.split(groupSep).join('')
    if (decimalSep === ',') s = s.replace(',', '.')
  } else if (lastComma >= 0) {
    // A lone comma: decimal separator if it has <= dec digits after it, else grouping.
    const after = s.length - lastComma - 1
    s = after > 0 && after <= dec ? s.replace(',', '.') : s.split(',').join('')
  }

  const [intPartRaw = '', fracPartRaw = ''] = s.split('.')
  const intPart = intPartRaw.replace(/[^0-9]/g, '') || '0'
  const fracDigits = fracPartRaw.replace(/[^0-9]/g, '')
  const frac = (fracDigits + '0'.repeat(dec)).slice(0, dec)
  let minor = Number(intPart) * Math.pow(10, dec) + (dec > 0 ? Number(frac || '0') : 0)
  // Round half-up on the first digit beyond the currency's precision.
  if (fracDigits.length > dec) {
    const nextDigit = fracDigits.charCodeAt(dec) - 48
    if (nextDigit >= 5) minor += 1
  }
  if (!Number.isFinite(minor)) return 0
  return negative ? -minor : minor
}

/** Minor units → major-unit number (only for non-money display / chart math). */
export function minorToMajor(minor: number, currency?: string): number {
  return minor / Math.pow(10, minorUnits(currency))
}

/** Convert major-unit number → minor units using banker-safe rounding. */
export function majorToMinor(major: number, currency?: string): number {
  return roundHalfUp(major * Math.pow(10, minorUnits(currency)))
}

export function sumMinor(values: number[]): number {
  let total = 0
  for (const v of values) total += Math.round(v)
  return total
}

/** Percentage of `part` relative to `whole`, clamped to [0, 1e9]; 0 when whole is 0. */
export function ratio(part: number, whole: number): number {
  if (!whole) return 0
  return part / whole
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0
  return (part / whole) * 100
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Safe divide that never returns NaN/Infinity. */
export function safeDiv(numerator: number, denominator: number): number {
  if (!denominator) return 0
  const r = numerator / denominator
  return Number.isFinite(r) ? r : 0
}

/**
 * Evaluate the keypad's arithmetic expression (e.g. "250+80", "12×3", "100÷4-5").
 * Returns the numeric result in MAJOR units, or null if the expression is
 * incomplete/invalid. Supports + − × ÷ * / and parentheses-free left-to-right
 * precedence (× ÷ before + −), matching the on-screen calculator.
 */
export function evaluateExpression(input: string): number | null {
  const s = input.replace(/[×✕xX]/g, '*').replace(/[÷]/g, '/').replace(/[−–—]/g, '-').replace(/,/g, '')
  if (!s) return null
  if (/[^0-9+\-*/.() ]/.test(s)) return null

  // Tokenize
  const tokens: Array<{ t: 'num'; v: number } | { t: 'op'; v: string }> = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ') {
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const raw = s.slice(i, j)
      if ((raw.match(/\./g) ?? []).length > 1) return null
      const num = Number(raw)
      if (!Number.isFinite(num)) return null
      tokens.push({ t: 'num', v: num })
      i = j
      continue
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ t: 'op', v: ch })
      i++
      continue
    }
    return null
  }
  if (tokens.length === 0) return null
  if (tokens[tokens.length - 1].t === 'op') return null
  if (tokens[0]?.t === 'op') tokens.unshift({ t: 'num', v: 0 })

  // First pass: × and ÷
  const pass1: Array<{ t: 'num'; v: number } | { t: 'op'; v: string }> = []
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k]
    if (tok.t === 'op' && (tok.v === '*' || tok.v === '/')) {
      const prev = pass1[pass1.length - 1]
      const next = tokens[k + 1]
      if (!prev || prev.t !== 'num' || !next || next.t !== 'num') return null
      const result = tok.v === '*' ? prev.v * next.v : next.v === 0 ? NaN : prev.v / next.v
      if (!Number.isFinite(result)) return null
      pass1[pass1.length - 1] = { t: 'num', v: result }
      k++
      continue
    }
    pass1.push(tok)
  }

  // Second pass: + and −
  let acc = 0
  let op = '+'
  for (const tok of pass1) {
    if (tok.t === 'op') {
      op = tok.v
      continue
    }
    acc = op === '+' ? acc + tok.v : acc - tok.v
  }
  if (!Number.isFinite(acc)) return null
  return acc
}

/** Integer-percent helper for progress bars: 0..100. */
export function progressPercent(spentMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) return 0
  return clampPercent((spentMinor / limitMinor) * 100)
}
