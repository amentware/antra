/**
 * Antra — keypad expression grammar & evaluation for the calculator keypad.
 * Framework-free so it can be unit tested directly (the UI lives in Keypad.tsx).
 */
import { evaluateExpression } from '@shared/money'
import { minorFactor } from '@shared/currency'

export const OPERATORS = ['+', '−', '×', '÷'] as const
export type Operator = (typeof OPERATORS)[number]

export function isOperatorChar(ch: string): boolean {
  return (OPERATORS as readonly string[]).includes(ch)
}

/** The number the user is currently typing (text after the last operator). */
export function currentTerm(expression: string): string {
  let start = 0
  for (let i = 1; i < expression.length; i++) if (isOperatorChar(expression[i])) start = i + 1
  return expression.slice(start)
}

/** True when the expression contains any calculator operator (unicode or ASCII). */
export function containsOperator(expression: string): boolean {
  return /[+−×÷*/-]/.test(expression)
}

/** Strip trailing operators so an in-progress expression can still be evaluated. */
export function balancedExpression(expression: string): string {
  return expression.replace(/[+−×÷*/-]+$/, '')
}

/** Append a keypad key to the expression, enforcing sane input rules. */
export function appendKey(expression: string, key: string): string {
  if (key === '⌫') return expression.slice(0, -1)
  if (key === 'C') return ''

  if (key === '.') {
    const term = currentTerm(expression)
    if (term.includes('.')) return expression
    return term === '' ? `${expression}0.` : `${expression}.`
  }

  if (isOperatorChar(key)) {
    if (expression === '') return ''
    const last = expression[expression.length - 1]
    if (isOperatorChar(last)) return expression.slice(0, -1) + key
    if (last === '.') return expression.slice(0, -1) + key
    return expression + key
  }

  // Digit
  const term = currentTerm(expression)
  if (term === '0') return `${expression.slice(0, -1)}${key}`
  if (term.replace('.', '').length >= 9) return expression // cap the length
  return expression + key
}

/** Evaluate the expression to minor units, or null when incomplete/invalid. */
export function expressionToMinor(expression: string, currency: string): number | null {
  if (!expression.trim()) return null
  const result = evaluateExpression(expression)
  if (result === null || !Number.isFinite(result)) return null
  return Math.round(result * minorFactor(currency))
}

/**
 * The value to show on the keypad. When the expression has operators we show the
 * evaluated result; if it is still incomplete ("250+") we show the running total
 * of the complete part so the display never drops to zero mid-sum. Otherwise we
 * show the number currently being typed.
 */
export function displayMinor(expression: string, currency: string): number {
  const hasOperator = containsOperator(expression)
  const evaluated = evaluateExpression(expression)
  const running = hasOperator ? evaluateExpression(balancedExpression(expression)) : null
  const shown = evaluated ?? running
  const term = currentTerm(expression)
  const factor = minorFactor(currency)

  if (hasOperator && shown !== null) return Math.round(shown * factor)
  if (term === '' || term === '.') return 0
  return Math.round((Number(term) || 0) * factor)
}

/** True when the expression is complete-enough to evaluate but not valid (e.g. ÷0). */
export function isInvalidExpression(expression: string): boolean {
  if (!expression.trim()) return false
  if (!containsOperator(expression)) return false
  return evaluateExpression(expression) === null && evaluateExpression(balancedExpression(expression)) === null
}
