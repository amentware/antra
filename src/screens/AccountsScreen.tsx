import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, Pill, SectionLabel, Tile } from '../components/Card'
import { CompactAmount } from '../components/AmountText'
import { ProgressBar } from '../components/Progress'
import { Button, IconButton } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { EmptyState } from '../components/EmptyState'
import { SyncIndicator } from '../components/SyncIndicator'
import { AccountFormSheet, type AccountFormValues } from '../components/AccountFormSheet'
import { ChevronRight, PlusIcon, WalletIcon } from '../components/Icons'
import { useAccounts, useExpenses } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { formatMinor } from '../lib/format'
import { formatMonthLabel } from '../lib/date'
import { cardStats, totalOutstanding } from '../lib/stats'
import { createAccount, payCardBill, setExpensePaid } from '../lib/repo'
import { db } from '../lib/db'
import { toast } from '../store/useToastStore'
import { successFeedback } from '../lib/haptics'
import { cn } from '../lib/cn'
import type { Account } from '@shared/types'

export function AccountsScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const accounts = useAccounts({ includeArchived: false })
  const allAccounts = useAccounts({ includeArchived: true })
  const expenses = useExpenses()

  const [formOpen, setFormOpen] = useState(false)

  const cards = useMemo(() => cardStats(accounts, expenses), [accounts, expenses])
  const cardsTotalOutstanding = useMemo(() => totalOutstanding(cards), [cards])
  const cardsLimit = useMemo(() => cards.reduce((sum, c) => sum + c.limitMinor, 0), [cards])
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'bank'), [accounts])

  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), [])

  const bankSpend = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of expenses) {
      if (new Date(expense.spent_at).getTime() < monthStart) continue
      map.set(expense.account_id, (map.get(expense.account_id) ?? 0) + expense.amount_minor)
    }
    return map
  }, [expenses, monthStart])

  const handleCreate = async (values: AccountFormValues) => {
    await createAccount({
      name: values.name,
      type: values.type,
      last4: values.last4 || null,
      color: values.color,
      icon: values.icon,
      credit_limit_minor: values.credit_limit_minor,
      statement_day: values.statement_day,
      due_day: values.due_day,
    })
    toast('Account added', 'success')
  }

  const payBill = async (account: Account) => {
    const unpaidIds = await db.expenses
      .where('account_id')
      .equals(account.id)
      .and((e) => !e.deleted_at && e.paid === 0)
      .primaryKeys()
    if (unpaidIds.length === 0) {
      toast('Nothing pending on this card', 'default')
      return
    }
    const count = await payCardBill(account.id, new Date().toISOString())
    successFeedback()
    toast(`Marked ${count} payment${count === 1 ? '' : 's'} as paid`, 'success', {
      label: 'Undo',
      onClick: () => {
        void Promise.all(unpaidIds.map((id) => setExpensePaid(String(id), false)))
      },
    })
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="Cards & accounts"
          large
          right={
            <>
              <SyncIndicator />
              <IconButton label="Add account" onClick={() => setFormOpen(true)}>
                <PlusIcon size={20} />
              </IconButton>
            </>
          }
        />
      </div>

      <div className="flex flex-col gap-4 px-4">
        {accounts.length === 0 ? (
          <Card className="mt-2">
            <EmptyState
              icon={<WalletIcon size={24} />}
              title="No accounts yet"
              message="Add a bank account or credit card to start tracking where your money goes."
              action={
                <Button onClick={() => setFormOpen(true)}>
                  <PlusIcon size={16} /> Add account
                </Button>
              }
            />
          </Card>
        ) : null}

        {cards.length > 0 ? (
          <>
            <Card className="bg-ink p-5 text-canvas">
              <SectionLabel className="text-canvas/60">Total outstanding</SectionLabel>
              <div className="mt-2 text-[34px] font-semibold tabular">{formatMinor(cardsTotalOutstanding, preferences.currency)}</div>
              <div className="mt-1 text-[13px] text-canvas/70">
                {cardsLimit > 0
                  ? `${Math.round((cardsTotalOutstanding / cardsLimit) * 100)}% of ${formatMinor(cardsLimit, preferences.currency)} limit`
                  : 'Set a credit limit to see utilisation'}
              </div>
              {cardsLimit > 0 ? (
                <div className="mt-3">
                  <ProgressBar percent={(cardsTotalOutstanding / cardsLimit) * 100} tone="accent" />
                </div>
              ) : null}
            </Card>

            <section>
              <h2 className="px-1 pb-2 text-[19px] font-semibold text-ink">Credit cards</h2>
              <div className="flex flex-col gap-3">
                {cards.map((card, index) => (
                  <motion.div key={card.account.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Card interactive onClick={() => navigate(`/cards/${card.account.id}`)} className="p-4 text-left">
                      <div className="flex items-start gap-3">
                        <Tile emoji={card.account.icon} color={card.account.color} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold text-ink">{card.account.name}</span>
                            {card.account.last4 ? <span className="shrink-0 text-[12px] text-muted">••{card.account.last4}</span> : null}
                          </div>
                          <div className="mt-0.5 text-[12px] text-muted">
                            {card.unpaidCount > 0 ? `${card.unpaidCount} unpaid` : 'All settled'}
                            {card.daysUntilDue !== null ? (
                              <span className={cn(card.daysUntilDue <= 3 && card.unpaidCount > 0 && 'font-semibold text-danger')}>
                                {' '}
                                · due in {card.daysUntilDue}d
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-faint" />
                      </div>

                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Outstanding</div>
                          <CompactAmount minor={card.outstandingMinor} currency={preferences.currency} className="text-[20px] font-semibold text-ink" />
                        </div>
                        {card.limitMinor > 0 ? (
                          <div className="text-right">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Utilisation</div>
                            <div className="text-[15px] font-semibold tabular text-ink">{Math.round(card.utilization)}%</div>
                          </div>
                        ) : null}
                      </div>

                      {card.limitMinor > 0 ? (
                        <div className="mt-2">
                          <ProgressBar percent={card.utilization} height={6} />
                        </div>
                      ) : null}

                      {card.outstandingMinor > 0 ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="md"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => {
                              void payBill(card.account)
                            }}
                          >
                            Pay bill
                          </Button>
                        </div>
                      ) : null}
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {bankAccounts.length > 0 ? (
          <section>
            <h2 className="px-1 pb-2 text-[19px] font-semibold text-ink">Bank accounts</h2>
            <Card className="divide-y divide-hairline/60">
              {bankAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => navigate(`/cards/${account.id}`)}
                  className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <Tile emoji={account.icon} color={account.color} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-ink">{account.name}</div>
                    <div className="text-[12px] text-muted">
                      Spent in {formatMonthLabel(new Date())} · {formatMinor(bankSpend.get(account.id) ?? 0, preferences.currency)}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-faint" />
                </button>
              ))}
            </Card>
          </section>
        ) : null}

        {allAccounts.some((a) => a.archived === 1) ? (
          <button
            type="button"
            onClick={() => navigate('/settings/accounts')}
            className="pressable flex items-center justify-between rounded-card bg-surface px-4 py-3.5 shadow-card ring-1 ring-hairline/70"
          >
            <span className="text-[14px] font-medium text-ink">Manage archived accounts</span>
            <Pill tone="neutral">{allAccounts.filter((a) => a.archived === 1).length} archived</Pill>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => navigate('/settings/accounts')}
          className="pressable flex items-center justify-between rounded-card bg-surface px-4 py-3.5 shadow-card ring-1 ring-hairline/70"
        >
          <span className="text-[14px] font-medium text-ink">Manage accounts</span>
          <ChevronRight size={16} className="text-faint" />
        </button>
      </div>

      <AccountFormSheet open={formOpen} onClose={() => setFormOpen(false)} currency={preferences.currency} onSubmit={handleCreate} />
    </div>
  )
}
