import { describe, expect, it } from 'vitest'
import {
  appendKey,
  balancedExpression,
  containsOperator,
  currentTerm,
  displayMinor,
  expressionToMinor,
  isInvalidExpression,
} from '../src/lib/expression'

describe('appendKey', () => {
  it('builds a simple number', () => {
    let e = ''
    for (const k of ['2', '5', '0']) e = appendKey(e, k)
    expect(e).toBe('250')
  })

  it('avoids leading zeros but keeps a single 0', () => {
    expect(appendKey('0', '5')).toBe('5')
    expect(appendKey('0', '0')).toBe('0')
    expect(appendKey('10', '0')).toBe('100')
  })

  it('allows one decimal point per term', () => {
    expect(appendKey('12', '.')).toBe('12.')
    expect(appendKey('12.', '5')).toBe('12.5')
    expect(appendKey('12.5', '.')).toBe('12.5')
    expect(appendKey('12+', '.')).toBe('12+0.')
  })

  it('replaces a trailing operator instead of stacking them', () => {
    expect(appendKey('12', '+')).toBe('12+')
    expect(appendKey('12+', '×')).toBe('12×')
    expect(appendKey('12.', '−')).toBe('12−')
  })

  it('ignores an operator when the expression is empty', () => {
    expect(appendKey('', '+')).toBe('')
  })

  it('backspaces and clears', () => {
    expect(appendKey('250+8', '⌫')).toBe('250+')
    expect(appendKey('250', 'C')).toBe('')
  })

  it('caps a single term at 9 digits', () => {
    const nine = '123456789'
    expect(appendKey(nine, '9')).toBe(nine)
    expect(appendKey(`${nine}+1`, '9')).toBe(`${nine}+19`)
  })
})

describe('currentTerm / containsOperator', () => {
  it('returns the text after the last operator', () => {
    expect(currentTerm('250+80')).toBe('80')
    expect(currentTerm('12×3')).toBe('3')
    expect(currentTerm('100÷4−5')).toBe('5')
    expect(currentTerm('250')).toBe('250')
  })

  it('detects unicode and ascii operators', () => {
    expect(containsOperator('250+80')).toBe(true)
    expect(containsOperator('12×3')).toBe(true)
    expect(containsOperator('100÷4')).toBe(true)
    expect(containsOperator('50−20')).toBe(true)
    expect(containsOperator('12/3')).toBe(true)
    expect(containsOperator('250')).toBe(false)
  })

  it('balances an in-progress expression', () => {
    expect(balancedExpression('250+')).toBe('250')
    expect(balancedExpression('250+80')).toBe('250+80')
    expect(balancedExpression('250×')).toBe('250')
  })
})

describe('displayMinor', () => {
  it('shows the number being typed when there is no operator', () => {
    expect(displayMinor('', 'INR')).toBe(0)
    expect(displayMinor('.', 'INR')).toBe(0)
    expect(displayMinor('250', 'INR')).toBe(25000)
    expect(displayMinor('12.5', 'INR')).toBe(1250)
  })

  it('evaluates complete expressions (this is the keypad calculator)', () => {
    expect(displayMinor('250+80', 'INR')).toBe(33000)
    expect(displayMinor('12×3', 'INR')).toBe(3600)
    expect(displayMinor('100÷4', 'INR')).toBe(2500)
    expect(displayMinor('50−20', 'INR')).toBe(3000)
    expect(displayMinor('250+80−30', 'INR')).toBe(30000)
  })

  it('keeps the running total while an expression is incomplete', () => {
    expect(displayMinor('250+', 'INR')).toBe(25000)
    expect(displayMinor('250+80×', 'INR')).toBe(33000)
  })

  it('respects zero-decimal currencies', () => {
    expect(displayMinor('1000', 'JPY')).toBe(1000)
    expect(displayMinor('250+80', 'JPY')).toBe(330)
  })
})

describe('expressionToMinor', () => {
  it('returns null for empty or incomplete expressions', () => {
    expect(expressionToMinor('', 'INR')).toBeNull()
    expect(expressionToMinor('250+', 'INR')).toBeNull()
  })

  it('converts the evaluated result to minor units', () => {
    expect(expressionToMinor('250+80', 'INR')).toBe(33000)
    expect(expressionToMinor('12.5', 'USD')).toBe(1250)
  })

  it('returns null for invalid maths (divide by zero)', () => {
    expect(expressionToMinor('12÷0', 'INR')).toBeNull()
  })
})

describe('isInvalidExpression', () => {
  it('flags only genuinely invalid expressions', () => {
    expect(isInvalidExpression('250')).toBe(false)
    expect(isInvalidExpression('250+')).toBe(false)
    expect(isInvalidExpression('250+80')).toBe(false)
    expect(isInvalidExpression('12÷0')).toBe(true)
  })
})
