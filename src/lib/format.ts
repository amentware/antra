/**
 * Antra — display formatting. Thin wrappers over the shared currency helpers so
 * components can format with a currency string they already have.
 */
export {
  formatMinor,
  formatCompactMinor,
  formatMinorParts,
  formatNumber,
  getCurrency,
  currencyExample,
  CURRENCIES,
  DEFAULT_CURRENCY,
} from '@shared/currency'

export type { CurrencyParts } from '@shared/currency'

/** Percentage with at most one decimal, e.g. "82.4%". */
export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(digits)}%`
}

/** Signed percentage delta, e.g. "+12%" / "−8%". */
export function formatDelta(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0%'
  const sign = value > 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(0)}%`
}

/** Compact count, e.g. "1.2K". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
