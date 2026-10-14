import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sheet } from './Sheet'
import { AmountDisplay, KeypadGrid, expressionToMinor } from './Keypad'
import { Chip, ChipRow, Switch } from './Chips'
import { IconButton } from './Buttons'
import { CalendarIcon, CheckIcon, CloseIcon } from './Icons'
import { createExpense, deleteExpense, updateExpense } from '../lib/repo'
import { getMeta, setMeta } from '../lib/db'
import { useAccounts, useCategories, useExpenses } from '../hooks/useData'
import { successFeedback, warningFeedback } from '../lib/haptics'
import { toast } from '../store/useToastStore'
import { useUiStore } from '../store/useUiStore'
import { formatMonthLabel } from '../lib/date'
import { formatMinor } from '../lib/format'
import { minorToMajor } from '@shared/money'
import { cn } from '../lib/cn'
import type { Expense } from '@shared/types'

interface AddExpenseSheetProps {
  open: boolean
  onClose: () => void
  currency: string
  onSaved?: (id: string) => void
}

/**
 * The fast add-expense flow: amount on the custom keypad, category + account
 * chips, optional details, then Save. Three taps for the common case.
 */
export function AddExpenseSheet({ open, onClose, currency, onSaved }: AddExpenseSheetProps) {
  const categories = useCategories()
  const accounts = useAccounts()
  const expenses = useExpenses()
  const prefill = useUiStore((s) => s.prefill)

  const [expression, setExpression] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [spentAt, setSpentAt] = useState<string>(() => new Date().toISOString())
  const [paid, setPaid] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const editing: Expense | undefined = useMemo(
    () => (prefill?.expenseId ? expenses.find((e) => e.id === prefill.expenseId) : undefined),
    [prefill?.expenseId, expenses],
  )

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const isCard = selectedAccount?.type === 'credit_card'

  // Categories ordered by most recently used, then declaration order.
  const orderedCategories = useMemo(() => {
    const lastUsed = new Map<string, string>()
    for (const e of expenses) {
      if (!lastUsed.has(e.category_id) || e.spent_at > (lastUsed.get(e.category_id) ?? '')) {
        lastUsed.set(e.category_id, e.spent_at)
      }
    }
    return [...categories].sort((a, b) => {
      const aTime = lastUsed.get(a.id)
      const bTime = lastUsed.get(b.id)
      if (aTime && bTime) return aTime < bTime ? 1 : -1
      if (aTime) return -1
      if (bTime) return 1
      return a.sort_order - b.sort_order
    })
  }, [categories, expenses])

  // Initialise the form whenever the sheet opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const lastAccountId = await getMeta<string>('ui.lastAccountId')
      if (cancelled) return
      if (editing) {
        setExpression(String(minorToMajor(editing.amount_minor, currency)).replace(/\.0+$/, ''))
        setCategoryId(editing.category_id)
        setAccountId(editing.account_id)
        setMerchant(editing.merchant ?? '')
        setNote(editing.note ?? '')
        setSpentAt(editing.spent_at)
        setPaid(editing.paid === 1)
        setShowDetails(Boolean(editing.merchant || editing.note))
        return
      }
      const prefillCategory = prefill?.categoryId ?? orderedCategories[0]?.id ?? null
      const prefillAccount = prefill?.accountId ?? lastAccountId ?? accounts.find((a) => !a.archived)?.id ?? accounts[0]?.id ?? null
      setExpression(prefill?.amountMinor ? String(minorToMajor(prefill.amountMinor, currency)).replace(/\.0+$/, '') : '')
      setCategoryId(prefillCategory)
      setAccountId(prefillAccount)
      setMerchant(prefill?.merchant ?? '')
      setNote(prefill?.note ?? '')
      setSpentAt(prefill?.spentAt ?? new Date().toISOString())
      setPaid(prefill?.paid === 1)
      setShowDetails(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, currency])

  // Default the "already paid" toggle whenever the account changes.
  useEffect(() => {
    if (editing) return
    setPaid(isCard ? paid : false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCard])

  const minor = expressionToMinor(expression, currency) ?? 0
  const canSave = minor > 0 && Boolean(categoryId) && Boolean(accountId) && !saving

  const handleSave = async () => {
    if (!canSave || !categoryId || !accountId) {
      warningFeedback()
      toast('Enter an amount first', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        amount_minor: minor,
        category_id: categoryId,
        account_id: accountId,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        spent_at: spentAt,
        paid: isCard ? (paid ? 1 : 0) : 1,
      }

      if (editing) {
        const previous = { ...editing }
        await updateExpense(editing.id, payload)
        successFeedback()
        setCelebrate(true)
        toast('Expense updated', 'success', {
          label: 'Undo',
          onClick: () => void updateExpense(previous.id, previous),
        })
        setTimeout(() => {
          setCelebrate(false)
          onSaved?.(editing.id)
        }, 420)
      } else {
        const created = await createExpense(payload)
        await setMeta('ui.lastAccountId', accountId)
        successFeedback()
        setCelebrate(true)
        toast(`Saved ${formatMinor(minor, currency)}`, 'success', {
          label: 'Undo',
          onClick: () => void deleteExpense(created.id),
        })
        setTimeout(() => {
          setCelebrate(false)
          onSaved?.(created.id)
        }, 420)
      }
    } catch (error) {
      warningFeedback()
      toast(error instanceof Error ? error.message : 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const dateValue = toLocalDateInput(spentAt)
  const timeValue = toLocalTimeInput(spentAt)

  return (
    <Sheet open={open} onClose={onClose} fullHeight labelledBy="add-expense-title">
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <IconButton label="Close" onClick={onClose} variant="ghost">
          <CloseIcon size={20} />
        </IconButton>
        <h2 id="add-expense-title" className="text-[16px] font-semibold text-ink">
          {editing ? 'Edit expense' : 'Add expense'}
        </h2>
        <IconButton
          label="Details"
          variant="ghost"
          onClick={() => setShowDetails((v) => !v)}
          className={cn(showDetails && 'text-link')}
        >
          <CalendarIcon size={20} />
        </IconButton>
      </div>

      <div className="px-5 pb-1">
        <AmountDisplay expression={expression} currency={currency} />
      </div>

      <div className="scroll-y min-h-0 flex-1 pb-2">
        <div className="mt-2">
          <div className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Category</div>
          <ChipRow>
            {orderedCategories.map((category) => (
              <Chip key={category.id} selected={categoryId === category.id} color={category.color} onClick={() => setCategoryId(category.id)}>
                <span aria-hidden>{category.emoji}</span>
                {category.name}
              </Chip>
            ))}
            {orderedCategories.length === 0 ? (
              <span className="px-1 py-3 text-[13px] text-muted">Add a category in Settings first.</span>
            ) : null}
          </ChipRow>
        </div>

        <div className="mt-2">
          <div className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Account</div>
          <ChipRow>
            {accounts.map((account) => (
              <Chip key={account.id} selected={accountId === account.id} color={account.color} onClick={() => setAccountId(account.id)}>
                <span aria-hidden>{account.icon}</span>
                {account.name}
                {account.last4 ? <span className="text-[12px] opacity-70">••{account.last4}</span> : null}
              </Chip>
            ))}
            {accounts.length === 0 ? (
              <span className="px-1 py-3 text-[13px] text-muted">Add an account in Settings first.</span>
            ) : null}
          </ChipRow>
        </div>

        <AnimatePresence initial={false}>
          {showDetails ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-col gap-3 px-4">
                <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-hairline/70">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Merchant / title</span>
                    <input
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      placeholder="e.g. Swiggy"
                      enterKeyHint="next"
                      className="bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
                    />
                  </label>
                  <div className="my-3 h-px bg-hairline" />
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Note</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note"
                      rows={2}
                      className="resize-none bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
                    />
                  </label>
                </div>

                <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-hairline/70">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[14px] font-medium text-ink">Date</span>
                    <input
                      type="date"
                      value={dateValue}
                      onChange={(e) => setSpentAt(combineDateAndTime(e.target.value, timeValue))}
                      className="rounded-xl bg-surface-2 px-3 py-2 text-[14px] text-ink outline-none"
                    />
                    <input
                      type="time"
                      value={timeValue}
                      onChange={(e) => setSpentAt(combineDateAndTime(dateValue, e.target.value))}
                      className="rounded-xl bg-surface-2 px-3 py-2 text-[14px] text-ink outline-none"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isCard ? (
          <div className="mt-3 px-4">
            <div className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-hairline/70">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-positive/12 text-positive">
                <CheckIcon size={18} />
              </span>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">Already paid</div>
                <div className="text-[12px] text-muted">Otherwise this stays as an unpaid card due.</div>
              </div>
              <Switch checked={paid} onChange={setPaid} label="Already paid" />
            </div>
          </div>
        ) : null}

        {showDetails ? null : (
          <div className="mt-3 px-4">
            <div className="flex items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card ring-1 ring-hairline/70">
              <span className="text-[13px] text-muted">
                {formatMonthLabel(spentAt)} · {timeValue}
              </span>
              <button type="button" className="pressable text-[13px] font-semibold text-link" onClick={() => setShowDetails(true)}>
                Add details
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <KeypadGrid
          expression={expression}
          onExpressionChange={setExpression}
          onSave={handleSave}
          saveLabel={editing ? 'Update' : 'Save'}
          saveDisabled={!canSave}
          safePadding
        />
        <AnimatePresence>
          {celebrate ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/70"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-positive text-white shadow-float"
              >
                <CheckIcon size={38} />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Sheet>
  )
}

function toLocalDateInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toLocalTimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function combineDateAndTime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const result = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
  return Number.isNaN(result.getTime()) ? new Date().toISOString() : result.toISOString()
}
