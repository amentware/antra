import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Pill, Tile } from '../components/Card'
import { AmountText } from '../components/AmountText'
import { Button, IconButton } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { Sheet } from '../components/Sheet'
import { CheckIcon, DownloadIcon, EditIcon, MoreIcon, TrashIcon } from '../components/Icons'
import { useAccounts, useCategories, useExpense } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { useUiStore } from '../store/useUiStore'
import { formatDateTime, formatFullDate, formatTime } from '../lib/date'
import { deleteExpense, restoreExpense, setExpensePaid } from '../lib/repo'
import { successFeedback } from '../lib/haptics'
import { toast } from '../store/useToastStore'

export function ExpenseDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const preferences = usePreferences()
  const openAdd = useUiStore((s) => s.openAdd)

  const expense = useExpense(id)
  const categories = useCategories()
  const accounts = useAccounts({ includeArchived: true })

  const [menuOpen, setMenuOpen] = useState(false)

  const category = useMemo(() => categories.find((c) => c.id === expense?.category_id), [categories, expense])
  const account = useMemo(() => accounts.find((a) => a.id === expense?.account_id), [accounts, expense])
  const isCard = account?.type === 'credit_card'

  if (!expense) {
    return (
      <div className="flex h-full flex-col">
        <div className="safe-top px-4 pt-3">
          <ScreenHeader title="Expense" onBack={() => navigate(-1)} />
        </div>
        <div className="flex flex-1 items-center justify-center px-10 text-center text-[14px] text-muted">
          This expense no longer exists.
        </div>
      </div>
    )
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    await deleteExpense(expense.id)
    navigate(-1)
    toast('Expense deleted', 'default', { label: 'Undo', onClick: () => void restoreExpense(expense.id) })
  }

  const togglePaid = async () => {
    const next = expense.paid === 1 ? 0 : 1
    await setExpensePaid(expense.id, next === 1)
    if (next === 1) successFeedback()
    toast(next === 1 ? 'Marked as paid' : 'Marked as unpaid', 'success')
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+32px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-2 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="Expense"
          onBack={() => navigate(-1)}
          right={
            <>
              <IconButton label="Edit expense" onClick={() => openAdd({ expenseId: expense.id })}>
                <EditIcon size={19} />
              </IconButton>
              <IconButton label="More actions" onClick={() => setMenuOpen(true)}>
                <MoreIcon size={19} />
              </IconButton>
            </>
          }
        />
      </div>

      <div className="px-4 pt-2">
        <Card className="flex flex-col items-center gap-3 p-6">
          <Tile emoji={category?.emoji ?? '📦'} color={category?.color ?? '#8A8F98'} size={56} />
          <div className="text-center">
            <div className="text-[15px] font-semibold text-ink">{expense.merchant || category?.name || 'Expense'}</div>
            <div className="text-[13px] text-muted">{category?.name ?? 'Uncategorised'}</div>
          </div>
          <AmountText minor={expense.amount_minor} currency={preferences.currency} className="text-display-lg text-ink" />
          <div className="flex items-center gap-2">
            {expense.source === 'api' ? (
              <Pill tone="link">
                <DownloadIcon size={12} /> Shortcut
              </Pill>
            ) : null}
            {isCard ? (
              <Pill tone={expense.paid === 1 ? 'positive' : 'warning'}>{expense.paid === 1 ? 'Paid' : 'Unpaid'}</Pill>
            ) : (
              <Pill tone="neutral">Paid</Pill>
            )}
          </div>
        </Card>

        <Card className="mt-3 divide-y divide-hairline/60">
          <Row label="Account">
            <span className="flex items-center gap-2 font-medium text-ink">
              <span aria-hidden>{account?.icon ?? '💳'}</span>
              {account?.name ?? 'Account'}
              {account?.last4 ? <span className="text-muted">••{account.last4}</span> : null}
            </span>
          </Row>
          <Row label="Date">
            <span className="font-medium text-ink">{formatFullDate(expense.spent_at)}</span>
          </Row>
          <Row label="Time">
            <span className="font-medium text-ink">{formatTime(expense.spent_at)}</span>
          </Row>
          {expense.paid_at ? (
            <Row label="Paid on">
              <span className="font-medium text-ink">{formatDateTime(expense.paid_at)}</span>
            </Row>
          ) : null}
          <Row label="Added">
            <span className="font-medium text-ink">{formatDateTime(expense.created_at)}</span>
          </Row>
        </Card>

        {expense.note ? (
          <Card className="mt-3 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Note</div>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink" data-selectable>
              {expense.note}
            </p>
          </Card>
        ) : null}

        {isCard ? (
          <div className="mt-4">
            <Button block size="lg" variant={expense.paid === 1 ? 'secondary' : 'primary'} onClick={() => void togglePaid()}>
              <CheckIcon size={18} />
              {expense.paid === 1 ? 'Mark as unpaid' : 'Mark as paid'}
            </Button>
          </div>
        ) : null}
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} dismissible>
        <div className="px-4 pb-2 pt-1">
          <h2 className="text-[16px] font-semibold text-ink">Actions</h2>
        </div>
        <div className="px-4 pb-6">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              openAdd({ expenseId: expense.id })
            }}
            className="pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-ink"
          >
            <EditIcon size={19} /> Edit expense
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-danger"
          >
            <TrashIcon size={19} /> Delete expense
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right text-[14px]">{children}</span>
    </div>
  )
}
