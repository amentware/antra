import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Button, IconButton } from './Buttons'
import { Chip } from './Chips'
import { CloseIcon } from './Icons'
import { AmountInputSheet } from './AmountInputSheet'
import { CATEGORY_PALETTE } from '@shared/categories'
import { formatMinor } from '../lib/format'
import { cn } from '../lib/cn'
import type { Account, AccountType } from '@shared/types'

const ACCOUNT_ICONS = ['🏦', '💳', '💵', '🪙', '📱', '🏧', '👛', '🏢', '🟣', '🟠', '🔵', '🟢']

export interface AccountFormValues {
  name: string
  type: AccountType
  last4: string
  color: string
  icon: string
  credit_limit_minor: number | null
  statement_day: number | null
  due_day: number | null
}

interface AccountFormSheetProps {
  open: boolean
  onClose: () => void
  currency: string
  /** When present the sheet edits this account. */
  account?: Account | null
  onSubmit: (values: AccountFormValues) => Promise<void> | void
}

export function AccountFormSheet({ open, onClose, currency, account, onSubmit }: AccountFormSheetProps) {
  const [type, setType] = useState<AccountType>('bank')
  const [name, setName] = useState('')
  const [last4, setLast4] = useState('')
  const [color, setColor] = useState(CATEGORY_PALETTE[6])
  const [icon, setIcon] = useState('🏦')
  const [limitMinor, setLimitMinor] = useState<number | null>(null)
  const [statementDay, setStatementDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [limitOpen, setLimitOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (account) {
      setType(account.type)
      setName(account.name)
      setLast4(account.last4 ?? '')
      setColor(account.color)
      setIcon(account.icon)
      setLimitMinor(account.credit_limit_minor)
      setStatementDay(account.statement_day ? String(account.statement_day) : '')
      setDueDay(account.due_day ? String(account.due_day) : '')
    } else {
      setType('bank')
      setName('')
      setLast4('')
      setColor(CATEGORY_PALETTE[6])
      setIcon('🏦')
      setLimitMinor(null)
      setStatementDay('')
      setDueDay('')
    }
  }, [open, account])

  const isCard = type === 'credit_card'
  const canSave = name.trim().length > 0

  const parseDay = (value: string): number | null => {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 1 || n > 31) return null
    return Math.round(n)
  }

  const handleSubmit = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        last4: last4.trim(),
        color,
        icon,
        credit_limit_minor: isCard ? limitMinor : null,
        statement_day: isCard ? parseDay(statementDay) : null,
        due_day: isCard ? parseDay(dueDay) : null,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} fullHeight>
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <IconButton label="Close" variant="ghost" onClick={onClose}>
          <CloseIcon size={20} />
        </IconButton>
        <h2 className="text-[16px] font-semibold text-ink">{account ? 'Edit account' : 'New account'}</h2>
        <span className="min-w-[44px]" />
      </div>

      <div className="scroll-y min-h-0 flex-1 px-4 pb-4">
        <div className="mt-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Type</div>
          <div className="mt-2 flex gap-2">
            <Chip selected={type === 'bank'} onClick={() => setType('bank')}>
              🏦 Bank
            </Chip>
            <Chip selected={isCard} onClick={() => setType('credit_card')}>
              💳 Credit card
            </Chip>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Name</div>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={isCard ? 'HDFC Credit Card' : 'HDFC Savings'}
            autoComplete="off"
            className="mt-2 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none placeholder:text-faint"
          />
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Icon</div>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {ACCOUNT_ICONS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setIcon(candidate)}
                className={cn(
                  'pressable flex h-12 items-center justify-center rounded-2xl text-[22px]',
                  icon === candidate ? 'bg-ink/10 ring-2 ring-ink' : 'bg-surface-2',
                )}
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Colour</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Colour ${swatch}`}
                onClick={() => setColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={cn('pressable h-10 w-10 rounded-full', color === swatch && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas')}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Last 4 digits (optional)</div>
          <input
            value={last4}
            onChange={(event) => setLast4(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="1234"
            inputMode="numeric"
            className="mt-2 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] tabular text-ink outline-none placeholder:text-faint"
          />
        </div>

        {isCard ? (
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setLimitOpen(true)}
              className="pressable flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3.5 text-left"
            >
              <span className="text-[14px] font-medium text-ink">Credit limit</span>
              <span className="text-[14px] font-semibold tabular text-link">
                {limitMinor && limitMinor > 0 ? formatMinor(limitMinor, currency) : 'Set'}
              </span>
            </button>

            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Statement day</span>
                <input
                  value={statementDay}
                  onChange={(event) => setStatementDay(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="1–31"
                  inputMode="numeric"
                  className="mt-2 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] tabular text-ink outline-none placeholder:text-faint"
                />
              </label>
              <label className="flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Due day</span>
                <input
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="1–31"
                  inputMode="numeric"
                  className="mt-2 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] tabular text-ink outline-none placeholder:text-faint"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <Button block size="lg" disabled={!canSave || busy} onClick={() => void handleSubmit()}>
            {account ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </div>

      <AmountInputSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="Credit limit"
        currency={currency}
        valueMinor={limitMinor}
        allowClear
        onConfirm={(minor) => setLimitMinor(minor)}
      />
    </Sheet>
  )
}
