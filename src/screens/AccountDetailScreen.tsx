import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Pill, SectionLabel, Tile } from '../components/Card'
import { AmountText } from '../components/AmountText'
import { ProgressBar } from '../components/Progress'
import { Button, IconButton } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { EmptyState } from '../components/EmptyState'
import { ExpenseRow } from '../components/ExpenseRow'
import { Sheet } from '../components/Sheet'
import { AccountFormSheet, type AccountFormValues } from '../components/AccountFormSheet'
import { CheckIcon, EditIcon, TrashIcon } from '../components/Icons'
import { useAccounts, useExpenses, useLookups } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { formatFullDate } from '../lib/date'
import { formatMinor } from '../lib/format'
import { deleteAccount, payCardBill, setExpensePaid, updateAccount } from '../lib/repo'
import { nextMonthlyDate } from '../lib/stats'
import { db } from '../lib/db'
import { successFeedback } from '../lib/haptics'
import { toast } from '../store/useToastStore'
import { cn } from '../lib/cn'

export function AccountDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const preferences = usePreferences()
  const accounts = useAccounts({ includeArchived: true })
  const expenses = useExpenses()
  const lookups = useLookups()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const account = useMemo(() => accounts.find((a) => a.id === id), [accounts, id])
  const accountExpenses = useMemo(
    () => expenses.filter((e) => e.account_id === id).sort((a, b) => (a.spent_at < b.spent_at ? 1 : -1)),
    [expenses, id],
  )
  const unpaid = useMemo(() => accountExpenses.filter((e) => e.paid === 0), [accountExpenses])

  const isCard = account?.type === 'credit_card'
  const outstanding = useMemo(() => unpaid.reduce((sum, e) => sum + e.amount_minor, 0), [unpaid])
  const total = useMemo(() => accountExpenses.reduce((sum, e) => sum + e.amount_minor, 0), [accountExpenses])
  const limit = account?.credit_limit_minor ?? 0
  const utilization = limit > 0 ? (outstanding / limit) * 100 : 0

  const monthSpend = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    return accountExpenses.filter((e) => new Date(e.spent_at).getTime() >= start).reduce((sum, e) => sum + e.amount_minor, 0)
  }, [accountExpenses])

  if (!account) {
    return (
      <div className="flex h-full flex-col">
        <div className="pt-safe-3 px-4">
          <ScreenHeader title="Account" onBack={() => navigate(-1)} />
        </div>
        <div className="flex flex-1 items-center justify-center px-10 text-center text-[14px] text-muted">This account no longer exists.</div>
      </div>
    )
  }

  const nextDue = account.due_day ? nextMonthlyDate(account.due_day, new Date()) : null
  const daysUntilDue = nextDue ? Math.ceil((nextDue.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null

  const handleEdit = async (values: AccountFormValues) => {
    await updateAccount(account.id, {
      name: values.name,
      type: values.type,
      last4: values.last4 || null,
      color: values.color,
      icon: values.icon,
      credit_limit_minor: values.credit_limit_minor,
      statement_day: values.statement_day,
      due_day: values.due_day,
    })
    toast('Account updated', 'success')
  }

  const payBill = async () => {
    const unpaidIds = await db.expenses.where('account_id').equals(account.id).and((e) => !e.deleted_at && e.paid === 0).primaryKeys()
    if (unpaidIds.length === 0) {
      toast('Nothing pending', 'default')
      return
    }
    const count = await payCardBill(account.id, new Date().toISOString())
    successFeedback()
    toast(`Marked ${count} payment${count === 1 ? '' : 's'} as paid`, 'success', {
      label: 'Undo',
      onClick: () => void Promise.all(unpaidIds.map((key) => setExpensePaid(String(key), false))),
    })
  }

  const handleDelete = async () => {
    setDeleteOpen(false)
    await deleteAccount(account.id)
    navigate(-1)
    toast('Account removed', 'default')
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+32px)]">
      <div className="pt-safe-3 sticky top-0 z-20 bg-canvas/85 px-4 pb-2 backdrop-blur-xl">
        <ScreenHeader
          title={account.name}
          subtitle={isCard ? 'Credit card' : 'Bank account'}
          onBack={() => navigate(-1)}
          right={
            <IconButton label="Edit account" onClick={() => setEditOpen(true)}>
              <EditIcon size={19} />
            </IconButton>
          }
        />
      </div>

      <div className="px-4 pt-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Tile emoji={account.icon} color={account.color} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold text-ink">{account.name}</div>
              {account.last4 ? <div className="text-[13px] text-muted">•••• {account.last4}</div> : null}
            </div>
            {account.archived === 1 ? <Pill tone="neutral">Archived</Pill> : null}
          </div>

          <div className="mt-4">
            <SectionLabel>{isCard ? 'Outstanding' : 'Spent this month'}</SectionLabel>
            <div className="mt-1.5">
              <AmountText
                minor={isCard ? outstanding : monthSpend}
                currency={preferences.currency}
                animate
                className="text-display text-ink"
              />
            </div>
          </div>

          {isCard ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Credit limit" value={limit > 0 ? formatMinor(limit, preferences.currency) : '—'} />
                <Metric label="Utilisation" value={limit > 0 ? `${Math.round(utilization)}%` : '—'} tone={utilization >= 80 ? 'danger' : undefined} />
              </div>
              {limit > 0 ? (
                <div className="mt-3">
                  <ProgressBar percent={utilization} />
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Statement day" value={account.statement_day ? `Day ${account.statement_day}` : '—'} />
                <Metric
                  label="Next due"
                  value={nextDue ? formatFullDate(nextDue) : '—'}
                  hint={daysUntilDue !== null ? (daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days left`) : undefined}
                  tone={daysUntilDue !== null && daysUntilDue <= 3 ? 'danger' : undefined}
                />
              </div>
              {outstanding > 0 ? (
                <div className="mt-4">
                  <Button block size="lg" onClick={() => void payBill()}>
                    <CheckIcon size={18} /> Pay bill · {formatMinor(outstanding, preferences.currency)}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-[13px] font-medium text-positive">
                  <CheckIcon size={16} /> All settled — nothing pending
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Total logged" value={formatMinor(total, preferences.currency)} />
              <Metric label="Transactions" value={String(accountExpenses.length)} />
            </div>
          )}
        </Card>

        {isCard && unpaid.length > 0 ? (
          <section className="mt-4">
            <h2 className="px-1 pb-2 text-[17px] font-semibold text-ink">Pending payments</h2>
            <Card className="divide-y divide-hairline/60">
              {unpaid.map((expense) => (
                <div key={expense.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ExpenseRow
                      expense={expense}
                      category={lookups.categories.get(expense.category_id)}
                      account={account}
                      currency={preferences.currency}
                      onClick={() => navigate(`/expense/${expense.id}`)}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Mark as paid"
                    onClick={() => {
                      void setExpensePaid(expense.id, true)
                      successFeedback()
                      toast('Marked as paid', 'success')
                    }}
                    className="pressable mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive/12 text-positive"
                  >
                    <CheckIcon size={17} />
                  </button>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        <section className="mt-4">
          <h2 className="px-1 pb-2 text-[17px] font-semibold text-ink">All transactions</h2>
          {accountExpenses.length === 0 ? (
            <Card>
              <EmptyState title="No transactions" message="Expenses on this account will appear here." />
            </Card>
          ) : (
            <Card className="divide-y divide-hairline/60">
              {accountExpenses.slice(0, 40).map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  category={lookups.categories.get(expense.category_id)}
                  account={account}
                  currency={preferences.currency}
                  onClick={() => navigate(`/expense/${expense.id}`)}
                />
              ))}
            </Card>
          )}
        </section>

        <div className="mt-6">
          <Button block variant="danger" size="lg" onClick={() => setDeleteOpen(true)}>
            <TrashIcon size={18} /> Remove account
          </Button>
        </div>
      </div>

      <AccountFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        currency={preferences.currency}
        account={account}
        onSubmit={handleEdit}
      />

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="px-5 pb-2 pt-1">
          <h2 className="text-[17px] font-semibold text-ink">Remove this account?</h2>
          <p className="mt-1 text-[14px] text-muted">
            Existing expenses stay in your history but will no longer be linked to an active account. This cannot be undone.
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 pb-6">
          <Button block variant="danger" size="lg" onClick={() => void handleDelete()}>
            Remove account
          </Button>
          <Button block variant="secondary" size="lg" onClick={() => setDeleteOpen(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className={cn('mt-1 text-[15px] font-semibold tabular', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</div>
      {hint ? <div className={cn('mt-0.5 text-[11px]', tone === 'danger' ? 'text-danger' : 'text-muted')}>{hint}</div> : null}
    </div>
  )
}
