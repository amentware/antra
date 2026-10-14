import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PullToRefresh } from '../components/PullToRefresh'
import { Card, Pill, SectionLabel, Tile } from '../components/Card'
import { AmountText, CompactAmount } from '../components/AmountText'
import { ExpenseRow } from '../components/ExpenseRow'
import { IconButton } from '../components/Buttons'
import { BellIcon, ChevronRight, SearchIcon, SparkleIcon, TargetIcon } from '../components/Icons'
import { SyncIndicator } from '../components/SyncIndicator'
import { EmptyState } from '../components/EmptyState'
import { useAccounts, useBudgets, useCategories, useExpenses, useLookups } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { useSessionStore } from '../store/useSessionStore'
import { formatMinor } from '../lib/format'
import { dayTotal, budgetRows, cardStats, groupByDay, rangeStats, totalOutstanding } from '../lib/stats'
import { computeBudgetSummary, insightText, pickInsight, type InsightCandidate } from '@shared/budget'
import { formatDayHeading, rangeFor, startOfMonth } from '../lib/date'
import { syncNow } from '../lib/sync'

export function HomeScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const user = useSessionStore((s) => s.user)

  const expenses = useExpenses()
  const categories = useCategories()
  const accounts = useAccounts()
  const budgets = useBudgets()
  const lookups = useLookups()

  const now = useMemo(() => new Date(), [])
  const monthRange = useMemo(() => rangeFor('month', now), [now])

  const monthStats = useMemo(() => rangeStats(expenses, monthRange, preferences.weekStart), [expenses, monthRange, preferences.weekStart])
  const rows = useMemo(() => budgetRows(categories, budgets, expenses, now), [categories, budgets, expenses, now])
  const bSummary = useMemo(() => computeBudgetSummary(rows.filter((r) => r.progress).map((r) => ({ limitMinor: r.progress!.limitMinor, spentMinor: r.spentMinor }))), [rows])
  const cards = useMemo(() => cardStats(accounts, expenses, now), [accounts, expenses, now])
  const outstanding = useMemo(() => totalOutstanding(cards), [cards])

  const insight = useMemo(() => {
    const candidates: InsightCandidate[] = rows
      .filter((r) => r.progress && r.category)
      .map((r) => ({
        categoryName: r.category.name,
        projectedOverMinor: r.progress!.projectedOverMinor,
        percentUsed: r.progress!.percentUsed,
        status: r.progress!.status,
        safeToSpendMinor: r.progress!.safeToSpendMinor,
        daysLeft: r.progress!.daysLeft,
      }))
    return pickInsight(candidates)
  }, [rows])

  const topCategories = useMemo(() => {
    const totals = new Map<string, number>()
    const monthStart = startOfMonth(now).getTime()
    for (const e of expenses) {
      if (new Date(e.spent_at).getTime() < monthStart) continue
      totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + e.amount_minor)
    }
    return [...totals.entries()]
      .map(([id, minor]) => ({ category: lookups.categories.get(id), minor }))
      .filter((entry) => entry.category)
      .sort((a, b) => b.minor - a.minor)
      .slice(0, 8)
  }, [expenses, lookups.categories, now])

  const recentGroups = useMemo(() => groupByDay(expenses).slice(0, 3), [expenses])
  const todayMinor = useMemo(() => dayTotal(expenses, now), [expenses, now])

  const greeting = useMemo(() => {
    const hour = now.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [now])

  return (
    <PullToRefresh onRefresh={() => syncNow({ force: true })} className="pb-[calc(var(--safe-bottom)+96px)]">
      <div className="pt-safe-3 px-4">
        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-muted">{greeting},</p>
            <h1 className="truncate text-[22px] font-semibold text-ink">{user?.name ?? 'there'}</h1>
          </div>
          <IconButton label="Search transactions" onClick={() => navigate('/transactions')}>
            <SearchIcon size={20} />
          </IconButton>
          <IconButton label="Insights and alerts" onClick={() => navigate('/insights')}>
            <BellIcon size={20} />
          </IconButton>
        </header>

        <div className="mt-3 flex justify-end">
          <SyncIndicator />
        </div>

        {/* Hero */}
        <Card className="mt-3 p-5">
          <SectionLabel>Spent this month</SectionLabel>
          <div className="mt-2">
            <AmountText minor={monthStats.totalMinor} currency={preferences.currency} animate className="text-display text-ink" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <HeroStat
              label="Budget left"
              value={bSummary.totalLimitMinor > 0 ? formatMinor(Math.max(0, bSummary.remainingMinor), preferences.currency) : '—'}
              tone={bSummary.status === 'over' ? 'danger' : 'default'}
            />
            <HeroStat label="Today" value={formatMinor(todayMinor, preferences.currency)} />
            <HeroStat label="Daily avg" value={formatMinor(monthStats.dailyAverageMinor, preferences.currency)} />
          </div>
        </Card>

        {insight ? (
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="pressable mt-3 flex w-full items-center gap-3 rounded-card bg-accent/10 px-4 py-3 text-left ring-1 ring-accent/15"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <SparkleIcon size={17} />
            </span>
            <span className="flex-1 text-[13px] font-medium leading-snug text-ink">
              {insightText(insight, (minor) => formatMinor(minor, preferences.currency))}
            </span>
            <ChevronRight size={16} className="shrink-0 text-accent" />
          </button>
        ) : null}

        {outstanding > 0 ? (
          <button
            type="button"
            onClick={() => navigate('/cards')}
            className="pressable mt-3 flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left shadow-card ring-1 ring-hairline/70"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
              <SparkleIcon size={17} />
            </span>
            <span className="flex-1 text-[13px] font-medium text-ink">
              {formatMinor(outstanding, preferences.currency)} pending across {cards.filter((c) => c.outstandingMinor > 0).length}{' '}
              {cards.filter((c) => c.outstandingMinor > 0).length === 1 ? 'card' : 'cards'}
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </button>
        ) : null}

        {/* Budgets shortcut */}
        {bSummary.budgetCount > 0 ? (
          <Card interactive className="mt-3 p-4" onClick={() => navigate('/budgets')}>
            <div className="flex items-center justify-between">
              <SectionLabel>Monthly budget</SectionLabel>
              <Pill tone={bSummary.status === 'over' ? 'danger' : bSummary.status === 'warning' ? 'warning' : 'positive'}>
                {Math.round(bSummary.percentUsed)}% used
              </Pill>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-ink">
                {formatMinor(bSummary.totalSpentMinor, preferences.currency)}
                <span className="font-normal text-muted"> / {formatMinor(bSummary.totalLimitMinor, preferences.currency)}</span>
              </span>
              {bSummary.overCount > 0 ? <span className="text-[12px] font-semibold text-danger">{bSummary.overCount} over</span> : null}
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="pressable mt-3 flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-left shadow-card ring-1 ring-hairline/70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <TargetIcon size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold text-ink">Set monthly budgets</span>
              <span className="block text-[12px] text-muted">Track pace, safe-to-spend and projections per category.</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </button>
        )}

        {/* Categories */}
        {topCategories.length > 0 ? (
          <section className="mt-5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[19px] font-semibold text-ink">Spending by category</h2>
              <button type="button" className="pressable text-[14px] font-medium text-link" onClick={() => navigate('/insights')}>
                See all
              </button>
            </div>
            <div className="scroll-x no-scrollbar mt-3 flex gap-3 pb-1">
              {topCategories.map(({ category, minor }, index) => (
                <motion.button
                  key={category!.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.28 }}
                  onClick={() => navigate('/insights')}
                  className="pressable flex w-[132px] shrink-0 flex-col gap-3 rounded-card bg-surface p-4 text-left shadow-card ring-1 ring-hairline/70"
                >
                  <Tile emoji={category!.emoji} color={category!.color} size={38} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-ink">{category!.name}</div>
                    <CompactAmount minor={minor} currency={preferences.currency} className="text-[13px] font-medium text-muted" />
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Recent transactions */}
        <section className="mt-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[19px] font-semibold text-ink">Recent transactions</h2>
            <button type="button" className="pressable text-[14px] font-medium text-link" onClick={() => navigate('/transactions')}>
              See all
            </button>
          </div>

          {recentGroups.length === 0 ? (
            <Card className="mt-3">
              <EmptyState
                title="No expenses yet"
                message="Tap the + button to log your first expense. It'll show up here instantly."
              />
            </Card>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {recentGroups.map((group) => (
                <Card key={group.key} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 pb-1 pt-3">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                      {formatDayHeading(group.date)}
                    </span>
                    <CompactAmount minor={group.totalMinor} currency={preferences.currency} className="text-[12px] font-semibold text-muted" />
                  </div>
                  <div className="divide-y divide-hairline/60">
                    {group.items.map((expense) => (
                      <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        category={lookups.categories.get(expense.category_id)}
                        account={lookups.accounts.get(expense.account_id)}
                        currency={preferences.currency}
                        onClick={() => navigate(`/expense/${expense.id}`)}
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </PullToRefresh>
  )
}

function HeroStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'positive' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{label}</span>
      <span
        className={
          tone === 'danger' ? 'text-[14px] font-semibold tabular text-danger' : tone === 'positive' ? 'text-[14px] font-semibold tabular text-positive' : 'text-[14px] font-semibold tabular text-ink'
        }
      >
        {value}
      </span>
    </div>
  )
}
