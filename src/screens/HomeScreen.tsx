import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PullToRefresh } from '../components/PullToRefresh'
import { Card, Pill, Tile } from '../components/Card'
import { AmountText, CompactAmount } from '../components/AmountText'
import { ExpenseRow } from '../components/ExpenseRow'
import { ProgressBar } from '../components/Progress'
import { IconButton } from '../components/Buttons'
import { BellIcon, ChevronRight, SearchIcon, SparkleIcon, TargetIcon } from '../components/Icons'
import { SyncIndicator } from '../components/SyncIndicator'
import { EmptyState } from '../components/EmptyState'
import { cn } from '../lib/cn'
import { useAccounts, useBudgets, useCategories, useExpenses, useLookups } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { useSessionStore } from '../store/useSessionStore'
import { formatMinor } from '../lib/format'
import { dayTotal, budgetRows, cardStats, groupByDay, rangeStats, totalOutstanding } from '../lib/stats'
import { computeBudgetSummary, insightText, pickInsight, type InsightCandidate } from '@shared/budget'
import { addDays, dayKey, formatDayHeading, formatMonthLabel, rangeFor, startOfDay, startOfMonth } from '../lib/date'
import { syncNow } from '../lib/sync'

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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
  const cardsLimit = useMemo(() => cards.reduce((sum, card) => sum + card.limitMinor, 0), [cards])
  const unpaidCount = useMemo(() => cards.reduce((sum, card) => sum + card.unpaidCount, 0), [cards])
  const budgetedRows = useMemo(() => rows.filter((row) => row.progress), [rows])

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

  // Last seven days, oldest → today, for the hero sparkline.
  const weekSeries = useMemo(() => {
    const totals = new Map<string, number>()
    for (const group of groupByDay(expenses)) totals.set(group.key, group.totalMinor)
    const today = startOfDay(now)
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6)
      const key = dayKey(date)
      return { key, label: WEEKDAY_LETTERS[date.getDay()], minor: totals.get(key) ?? 0, isToday: index === 6 }
    })
  }, [expenses, now])
  const weekMax = useMemo(() => Math.max(1, ...weekSeries.map((day) => day.minor)), [weekSeries])

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

  const overBudget = bSummary.status === 'over'

  return (
    <PullToRefresh onRefresh={() => syncNow({ force: true })} className="pb-[calc(var(--safe-bottom)+112px)]">
      <div className="pt-safe-4 px-4">
        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">{greeting},</p>
            <h1 className="truncate text-[24px] font-semibold tracking-tight text-ink">{user?.name ?? 'there'}</h1>
          </div>
          <IconButton label="Search transactions" onClick={() => navigate('/transactions')}>
            <SearchIcon size={20} />
          </IconButton>
          <IconButton label="Insights and alerts" onClick={() => navigate('/insights')}>
            <BellIcon size={20} />
          </IconButton>
        </header>

        <div className="mt-2 flex justify-end">
          <SyncIndicator />
        </div>

        {/* Hero — the one bold, brand-coloured surface on this screen. */}
        <div className="relative mt-3 overflow-hidden rounded-card bg-gradient-to-br from-[#2A5CF0] via-[#1546D9] to-[#0D2A8C] p-5 text-white shadow-float">
          <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-highlight/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">Spent this month</span>
              <span className="rounded-pill bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                {formatMonthLabel(now)}
              </span>
            </div>

            <div className="mt-2">
              <AmountText
                minor={monthStats.totalMinor}
                currency={preferences.currency}
                animate
                className="text-display text-white"
                symbolClassName="text-white/85"
                decimalClassName="text-white/60"
              />
            </div>

            <div className="mt-4 flex items-end justify-between gap-1.5" aria-hidden>
              {weekSeries.map((day) => (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={cn('w-full rounded-pill', day.isToday ? 'bg-highlight' : 'bg-white/35')}
                    style={{ height: day.minor > 0 ? Math.max(6, Math.round((day.minor / weekMax) * 46)) : 4 }}
                  />
                  <span className={cn('text-[10px] font-semibold', day.isToday ? 'text-white' : 'text-white/55')}>{day.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3.5">
              <HeroStat
                dark
                label="Budget left"
                value={bSummary.totalLimitMinor > 0 ? formatMinor(Math.max(0, bSummary.remainingMinor), preferences.currency) : '—'}
                tone={overBudget ? 'danger' : 'default'}
              />
              <HeroStat dark label="Today" value={formatMinor(todayMinor, preferences.currency)} />
              <HeroStat dark label="Daily avg" value={formatMinor(monthStats.dailyAverageMinor, preferences.currency)} />
            </div>
          </div>
        </div>

        {insight ? (
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="pressable mt-3 flex w-full items-center gap-3 rounded-card bg-highlight/15 px-4 py-3 text-left ring-1 ring-highlight/25"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-highlight/25 text-ink">
              <SparkleIcon size={17} />
            </span>
            <span className="flex-1 text-[13px] font-medium leading-snug text-ink">
              {insightText(insight, (minor) => formatMinor(minor, preferences.currency))}
            </span>
            <ChevronRight size={16} className="shrink-0 text-ink/60" />
          </button>
        ) : null}

        {cards.length > 0 ? (
          <Card className="mt-3 overflow-hidden">
            <button
              type="button"
              onClick={() => navigate('/cards')}
              className="flex w-full items-center justify-between px-4 pb-2 pt-4 text-left"
            >
              <h2 className="text-[17px] font-semibold text-ink">Card usage</h2>
              <span className="flex items-center gap-0.5 text-[14px] font-medium text-link">
                Cards
                <ChevronRight size={15} />
              </span>
            </button>
            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Outstanding</div>
                  <div className="mt-0.5 text-[26px] font-semibold tabular text-ink">
                    {formatMinor(outstanding, preferences.currency)}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[12px] leading-snug text-muted">
                  <div>{unpaidCount} unpaid</div>
                  {cardsLimit > 0 ? (
                    <div>
                      {Math.round((outstanding / cardsLimit) * 100)}% of {formatMinor(cardsLimit, preferences.currency)}
                    </div>
                  ) : null}
                </div>
              </div>
              {cardsLimit > 0 ? <ProgressBar className="mt-2" percent={(outstanding / cardsLimit) * 100} tone="auto" /> : null}

              <div className="mt-3 flex flex-col gap-2.5">
                {cards.slice(0, 3).map((card) => (
                  <button
                    key={card.account.id}
                    type="button"
                    onClick={() => navigate(`/cards/${card.account.id}`)}
                    className="flex items-center gap-3 text-left"
                  >
                    <Tile emoji={card.account.icon} color={card.account.color} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-ink">{card.account.name}</span>
                        <span className="shrink-0 text-[12px] tabular text-muted">
                          {formatMinor(card.outstandingMinor, preferences.currency)}
                        </span>
                      </div>
                      <ProgressBar
                        className="mt-1.5"
                        height={5}
                        percent={card.limitMinor > 0 ? card.utilization : 0}
                        tone="auto"
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11px] tabular text-faint">
                      {card.limitMinor > 0 ? `${Math.round(card.utilization)}%` : '—'}
                    </span>
                  </button>
                ))}
                {cards.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/cards')}
                    className="pressable pt-0.5 text-left text-[12px] font-medium text-link"
                  >
                    +{cards.length - 3} more {cards.length - 3 === 1 ? 'card' : 'cards'}
                  </button>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}

        {/* Budgets — deliberately separate from the category breakdown below. */}
        <section className="mt-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[19px] font-semibold text-ink">Budgets</h2>
            <button type="button" className="pressable text-[14px] font-medium text-link" onClick={() => navigate('/budgets')}>
              {budgetedRows.length > 0 ? 'Manage' : 'Set up'}
            </button>
          </div>

          {budgetedRows.length === 0 ? (
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
          ) : (
            <Card className="mt-3 overflow-hidden">
              <div className="px-4 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-muted">
                    {formatMinor(bSummary.totalSpentMinor, preferences.currency)}
                    <span className="text-faint"> of {formatMinor(bSummary.totalLimitMinor, preferences.currency)}</span>
                  </span>
                  <Pill tone={overBudget ? 'danger' : bSummary.status === 'warning' ? 'warning' : 'positive'}>
                    {Math.round(bSummary.percentUsed)}% used
                  </Pill>
                </div>
                <ProgressBar className="mt-2" percent={bSummary.percentUsed} />
                <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
                  <span>{formatMinor(Math.max(0, bSummary.remainingMinor), preferences.currency)} left</span>
                  {bSummary.overCount > 0 ? (
                    <span className="font-semibold text-danger">{bSummary.overCount} over budget</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 divide-y divide-hairline/60">
                {budgetedRows.slice(0, 4).map((row) => {
                  const progress = row.progress!
                  return (
                    <button
                      key={row.category.id}
                      type="button"
                      onClick={() => navigate('/budgets')}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="text-[18px]" aria-hidden>
                        {row.category.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-ink">{row.category.name}</span>
                          <span className="shrink-0 text-[12px] tabular text-muted">
                            {formatMinor(row.spentMinor, preferences.currency)}
                            <span className="text-faint"> / {formatMinor(progress.limitMinor, preferences.currency)}</span>
                          </span>
                        </div>
                        <ProgressBar className="mt-1.5" height={5} percent={progress.percentUsed} />
                      </div>
                      <span
                        className={cn(
                          'w-9 shrink-0 text-right text-[11px] font-semibold tabular',
                          progress.status === 'over'
                            ? 'text-danger'
                            : progress.status === 'warning'
                              ? 'text-warning'
                              : 'text-muted',
                        )}
                      >
                        {Math.round(progress.percentUsed)}%
                      </span>
                    </button>
                  )
                })}
                {budgetedRows.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/budgets')}
                    className="pressable w-full px-4 py-2.5 text-left text-[12px] font-medium text-link"
                  >
                    +{budgetedRows.length - 4} more budgets
                  </button>
                ) : null}
              </div>
            </Card>
          )}
        </section>

        {/* Spending by category */}
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
                  className="pressable flex w-[136px] shrink-0 flex-col gap-3 rounded-card bg-surface p-4 text-left shadow-card ring-1 ring-hairline/70"
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

function HeroStat({
  label,
  value,
  tone = 'default',
  dark,
}: {
  label: string
  value: string
  tone?: 'default' | 'danger' | 'positive'
  dark?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', dark ? 'text-white/60' : 'text-faint')}>
        {label}
      </span>
      <span
        className={cn(
          'font-semibold tabular',
          dark ? 'text-[15px]' : 'text-[14px]',
          tone === 'danger'
            ? dark
              ? 'text-highlight'
              : 'text-danger'
            : tone === 'positive'
              ? dark
                ? 'text-white'
                : 'text-positive'
              : dark
                ? 'text-white'
                : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  )
}
