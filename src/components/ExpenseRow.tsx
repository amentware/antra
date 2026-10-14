import { memo } from 'react'
import { Tile, Pill } from './Card'
import { CompactAmount } from './AmountText'
import { cn } from '../lib/cn'
import { formatRelative } from '../lib/date'
import type { Account, Category, Expense } from '@shared/types'

interface ExpenseRowProps {
  expense: Expense
  category: Category | undefined
  account: Account | undefined
  currency: string
  onClick?: () => void
  showTime?: boolean
  className?: string
}

/** A single transaction row: tile, merchant, category chip, amount, status. */
export const ExpenseRow = memo(function ExpenseRow({
  expense,
  category,
  account,
  currency,
  onClick,
  showTime = true,
  className,
}: ExpenseRowProps) {
  const isCard = account?.type === 'credit_card'
  const unpaid = isCard && expense.paid === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('pressable flex w-full items-center gap-3 px-4 py-3 text-left', className)}
    >
      <Tile emoji={category?.emoji ?? '📦'} color={category?.color ?? '#8A8F98'} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{expense.merchant || category?.name || 'Expense'}</span>
          {unpaid ? <Pill tone="warning">Unpaid</Pill> : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
          <span
            className="inline-flex items-center rounded-pill px-2 py-[3px] text-[11px] font-semibold leading-none"
            style={{ backgroundColor: `${category?.color ?? '#8A8F98'}1A`, color: category?.color ?? '#8A8F98' }}
          >
            {category?.name ?? 'Uncategorised'}
          </span>
          <span className="truncate">
            {account?.name ?? 'Account'}
            {account?.last4 ? ` ••${account.last4}` : ''}
          </span>
          {showTime ? <span className="shrink-0">· {formatRelative(expense.spent_at)}</span> : null}
        </div>
      </div>
      <CompactAmount minor={expense.amount_minor} currency={currency} className="text-[15px] font-semibold text-ink" />
    </button>
  )
})
