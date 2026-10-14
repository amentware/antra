import { cn } from '../lib/cn'
import { formatMinorParts } from '../lib/format'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'

interface AmountTextProps {
  minor: number
  currency: string
  /** Tailwind classes for the integer part. */
  className?: string
  /** Scale of the decimal suffix relative to the integer part. */
  decimalClassName?: string
  animate?: boolean
  showSign?: boolean
  /** Override sign, e.g. to always show "−" for expenses. */
  forceNegative?: boolean
  symbolClassName?: string
}

/**
 * Big confident number with a smaller, muted decimal part — the design
 * reference's signature treatment of money (e.g. ₹12,892 + small ".90").
 */
export function AmountText({
  minor,
  currency,
  className,
  decimalClassName,
  animate = false,
  showSign = false,
  forceNegative = false,
  symbolClassName,
}: AmountTextProps) {
  const animated = useAnimatedNumber(animate ? minor : minor, animate ? 560 : 0)
  const value = animate ? Math.round(animated) : minor
  const signed = forceNegative ? -Math.abs(value) : value
  const parts = formatMinorParts(signed, currency)

  return (
    <span className={cn('tabular inline-flex items-baseline', className)} data-selectable>
      {(showSign || forceNegative) && parts.sign ? <span className="mr-0.5">{parts.sign}</span> : null}
      {parts.symbolPlacement === 'prefix' ? <span className={symbolClassName}>{parts.symbol}</span> : null}
      <span>{parts.integer}</span>
      {parts.decimal ? (
        <span className={cn('text-[0.6em] font-medium text-muted', decimalClassName)}>
          {parts.decimalSeparator}
          {parts.decimal}
        </span>
      ) : null}
      {parts.symbolPlacement === 'suffix' ? <span className={cn('ml-1', symbolClassName)}>{parts.symbol}</span> : null}
    </span>
  )
}

interface CompactAmountProps {
  minor: number
  currency: string
  className?: string
}

/** Small inline amount, e.g. list rows and chips. */
export function CompactAmount({ minor, currency, className }: CompactAmountProps) {
  const parts = formatMinorParts(minor, currency)
  return (
    <span className={cn('tabular', className)} data-selectable>
      {parts.sign}
      {parts.symbolPlacement === 'prefix' ? parts.symbol : ''}
      {parts.integer}
      {parts.decimal ? (
        <span className="text-muted">
          {parts.decimalSeparator}
          {parts.decimal}
        </span>
      ) : null}
      {parts.symbolPlacement === 'suffix' ? ` ${parts.symbol}` : ''}
    </span>
  )
}
