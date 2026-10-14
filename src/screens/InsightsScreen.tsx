import { Suspense, lazy, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, Pill, SectionLabel } from '../components/Card'
import { AmountText, CompactAmount } from '../components/AmountText'
import { ProgressBar, SegmentedControl } from '../components/Progress'
import { ExpenseRow } from '../components/ExpenseRow'
import { EmptyState } from '../components/EmptyState'
import { Sheet } from '../components/Sheet'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconButton } from '../components/Buttons'
import { ChevronLeft, ChevronRight, SearchIcon } from '../components/Icons'
import { SyncIndicator } from '../components/SyncIndicator'
import { useAccounts, useBudgets, useCategories, useExpenses, useLookups } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { formatCount, formatDelta, formatMinor, formatPercent } from '../lib/format'
import {
  accountBreakdown,
  budgetRows,
  calendarHeatmap,
  cardStats,
  categoryBreakdown,
  expensesOnDay,
  merchantStats,
  projectMonthEnd,
  rangeStats,
  rangeTrend,
  timeOfDayDistribution,
  weekdayDistribution,
  type HeatCell,
} from '../lib/stats'
import { formatDayHeading, formatMonthLabel, rangeFor, addMonths, addWeeks, addYears } from '../lib/date'
import { cn } from '../lib/cn'
import type { RangeKind } from '../lib/date'

const TrendChart = lazy(() => import('../components/charts/InsightsCharts').then((m) => ({ default: m.TrendChart })))
const CategoryDonut = lazy(() => import('../components/charts/InsightsCharts').then((m) => ({ default: m.CategoryDonut })))
const DistributionBars = lazy(() => import('../components/charts/InsightsCharts').then((m) => ({ default: m.DistributionBars })))

type Kind = Extract<RangeKind, 'week' | 'month' | 'year'>

export function InsightsScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const expenses = useExpenses()
  const categories = useCategories()
  const accounts = useAccounts()
  const budgets = useBudgets()
  const lookups = useLookups()

  const [kind, setKind] = useState<Kind>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [trendMode, setTrendMode] = useState<'daily' | 'cumulative'>('cumulative')
  const [selectedDay, setSelectedDay] = useState<HeatCell | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const range = useMemo(() => rangeFor(kind, anchor, preferences.weekStart), [kind, anchor, preferences.weekStart])
  const stats = useMemo(() => rangeStats(expenses, range, preferences.weekStart), [expenses, range, preferences.weekStart])

  const trend = useMemo(
    () => rangeTrend(expenses, kind, anchor, trendMode, preferences.weekStart),
    [expenses, kind, anchor, trendMode, preferences.weekStart],
  )

  const heatmap = useMemo(() => calendarHeatmap(expenses, anchor), [expenses, anchor])
  const slices = useMemo(() => {
    const within = expenses.filter((e) => {
      const t = new Date(e.spent_at).getTime()
      return !e.deleted_at && t >= range.start.getTime() && t <= range.end.getTime()
    })
    const all = categoryBreakdown(within, categories)
    const top = all.slice(0, 7)
    const restMinor = all.slice(7).reduce((sum, s) => sum + s.minor, 0)
    const list = top.map((s) => ({ name: s.category?.name ?? 'Uncategorised', value: s.minor, color: s.category?.color ?? '#8A8F98' }))
    if (restMinor > 0) list.push({ name: 'Other', value: restMinor, color: '#8A8F98' })
    return { ranked: all, donut: list }
  }, [expenses, categories, range])

  const merchants = useMemo(() => {
    const within = expenses.filter((e) => {
      const t = new Date(e.spent_at).getTime()
      return !e.deleted_at && t >= range.start.getTime() && t <= range.end.getTime()
    })
    return merchantStats(within).slice(0, 8)
  }, [expenses, range])

  const byAccount = useMemo(() => {
    const within = expenses.filter((e) => {
      const t = new Date(e.spent_at).getTime()
      return !e.deleted_at && t >= range.start.getTime() && t <= range.end.getTime()
    })
    return accountBreakdown(within, accounts)
  }, [expenses, accounts, range])

  const weekday = useMemo(() => {
    const within = expenses.filter((e) => {
      const t = new Date(e.spent_at).getTime()
      return !e.deleted_at && t >= range.start.getTime() && t <= range.end.getTime()
    })
    return weekdayDistribution(within)
  }, [expenses, range])

  const timeOfDay = useMemo(() => {
    const within = expenses.filter((e) => {
      const t = new Date(e.spent_at).getTime()
      return !e.deleted_at && t >= range.start.getTime() && t <= range.end.getTime()
    })
    return timeOfDayDistribution(within)
  }, [expenses, range])

  const rows = useMemo(() => budgetRows(categories, budgets, expenses).filter((r) => r.budget || r.spentMinor > 0), [categories, budgets, expenses])
  const cards = useMemo(() => cardStats(accounts, expenses), [accounts, expenses])
  const projection = useMemo(() => projectMonthEnd(expenses), [expenses])

  const label = useMemo(() => {
    if (kind === 'year') return String(anchor.getFullYear())
    if (kind === 'week') return `${formatDayHeading(range.start)} – ${formatDayHeading(range.end)}`
    return formatMonthLabel(anchor)
  }, [kind, anchor, range])

  const dayItems = useMemo(() => (selectedDay ? expensesOnDay(expenses, selectedDay.date) : []), [expenses, selectedDay])

  const prevLabel = stats.previousTotalMinor > 0 ? formatDelta(stats.deltaPercent) : null

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-2 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="Insights"
          large
          right={
            <>
              <SyncIndicator />
              <IconButton label="Search transactions" onClick={() => navigate('/transactions')}>
                <SearchIcon size={20} />
              </IconButton>
            </>
          }
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <IconButton label="Previous period" onClick={() => setAnchor((d) => shiftAnchor(d, kind, -1))}>
            <ChevronLeft size={20} />
          </IconButton>
          <button type="button" onClick={() => setPickerOpen(true)} className="pressable rounded-pill bg-surface-2 px-4 py-2 text-[14px] font-semibold text-ink">
            {label}
          </button>
          <IconButton label="Next period" onClick={() => setAnchor((d) => shiftAnchor(d, kind, 1))}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
        <SegmentedControl
          className="mt-3"
          layoutId="insights-kind"
          value={kind}
          onChange={(value) => setKind(value)}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1">
        {/* Headline */}
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>{kind === 'month' ? 'Spent this month' : kind === 'week' ? 'Spent this week' : 'Spent this year'}</SectionLabel>
              <div className="mt-2">
                <AmountText minor={stats.totalMinor} currency={preferences.currency} animate className="text-display text-ink" />
              </div>
            </div>
            {prevLabel ? (
              <Pill tone={stats.deltaPercent > 0 ? 'danger' : 'positive'}>
                {stats.deltaPercent > 0 ? '▲' : '▼'} {prevLabel} vs prev
              </Pill>
            ) : null}
          </div>
        </Card>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Daily average" value={formatMinor(stats.dailyAverageMinor, preferences.currency)} />
          <StatCard label="Transactions" value={formatCount(stats.count)} />
          <StatCard label="Active days" value={`${stats.activeDays}`} />
          <StatCard
            label="Largest expense"
            value={stats.largest ? formatMinor(stats.largest.amount_minor, preferences.currency) : '—'}
            hint={stats.largest ? stats.largest.merchant ?? lookups.categories.get(stats.largest.category_id)?.name : undefined}
          />
        </div>

        {/* Trend */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ink">Spending trend</h2>
            <SegmentedControl
              className="w-[190px]"
              layoutId="trend-mode"
              value={trendMode}
              onChange={(value) => setTrendMode(value)}
              options={[
                { value: 'daily', label: 'Expense' },
                { value: 'cumulative', label: 'Cumulative' },
              ]}
            />
          </div>
          <div className="mt-3">
            {stats.count === 0 ? (
              <EmptyState title="Nothing to chart yet" message="Log a few expenses and your trend will appear here." />
            ) : (
              <Suspense fallback={<ChartSkeleton height={190} />}>
                <TrendChart data={trend} currency={preferences.currency} />
              </Suspense>
            )}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted">
            <LegendDot color="rgb(var(--c-accent))" label="This period" />
            <LegendDot color="rgb(var(--c-faint))" dashed label="Previous period" />
          </div>
        </Card>

        {kind === 'month' ? (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <SectionLabel>Projected month-end</SectionLabel>
                <div className="mt-1 text-[24px] font-semibold tabular text-ink">{formatMinor(projection.projectedMinor, preferences.currency)}</div>
              </div>
              <div className="text-right text-[12px] text-muted">
                {Math.round(projection.elapsedFraction * 100)}% of month
                <br />
                elapsed
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar percent={projection.elapsedFraction * 100} tone="accent" />
            </div>
          </Card>
        ) : null}

        {/* Budgets vs actual */}
        {rows.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className="text-[17px] font-semibold text-ink">Budget vs actual</h2>
              <button type="button" className="pressable text-[14px] font-medium text-link" onClick={() => navigate('/budgets')}>
                Manage
              </button>
            </div>
            <div className="divide-y divide-hairline/60">
              {rows.slice(0, 6).map((row) => (
                <div key={row.category.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[20px]" aria-hidden>
                    {row.category.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-ink">{row.category.name}</span>
                      <span className="shrink-0 text-[13px] tabular text-muted">
                        {formatMinor(row.spentMinor, preferences.currency)}
                        {row.budget ? <span className="text-faint"> / {formatMinor(row.budget.amount_minor, preferences.currency)}</span> : null}
                      </span>
                    </div>
                    <ProgressBar className="mt-2" height={6} percent={row.progress?.percentUsed ?? 0} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Calendar heatmap */}
        {kind === 'month' ? (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-ink">Daily heatmap</h2>
              <span className="text-[12px] text-muted">Tap a day</span>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="text-center text-[10px] font-semibold uppercase text-faint">
                  {d}
                </span>
              ))}
              {heatmap.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  disabled={cell.isFuture}
                  onClick={() => setSelectedDay(cell)}
                  style={heatColor(cell.level)}
                  className={cn(
                    'pressable flex h-9 items-center justify-center rounded-lg text-[11px] font-medium tabular',
                    cell.inMonth ? 'text-ink' : 'text-faint opacity-50',
                    cell.isFuture && 'opacity-30',
                  )}
                >
                  {cell.date.getDate()}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-faint">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} className="h-3 w-3 rounded-[4px]" style={heatColor(level as HeatCell['level'])} />
              ))}
              <span>More</span>
            </div>
          </Card>
        ) : null}

        {/* Categories */}
        {slices.ranked.length > 0 ? (
          <Card className="p-4">
            <h2 className="text-[17px] font-semibold text-ink">By category</h2>
            <div className="mt-1">
              <Suspense fallback={<ChartSkeleton height={190} />}>
                <CategoryDonut data={slices.donut} currency={preferences.currency} centerLabel="Total" />
              </Suspense>
            </div>
            <div className="mt-2 flex flex-col gap-2.5">
              {slices.ranked.slice(0, 8).map((slice) => (
                <div key={slice.categoryId} className="flex items-center gap-3">
                  <span className="w-6 text-center text-[17px]" aria-hidden>
                    {slice.category?.emoji ?? '📦'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{slice.category?.name ?? 'Uncategorised'}</span>
                      <span className="shrink-0 text-[12px] tabular text-muted">{formatMinor(slice.minor, preferences.currency)}</span>
                    </div>
                    <ProgressBar className="mt-1.5" height={5} percent={slice.percent} tone="accent" />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular text-faint">{formatPercent(slice.percent, 0)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Top merchants */}
        {merchants.length > 0 ? (
          <Card className="overflow-hidden">
            <h2 className="px-4 pb-1 pt-4 text-[17px] font-semibold text-ink">Top merchants</h2>
            <div className="divide-y divide-hairline/60">
              {merchants.map((merchant) => (
                <div key={merchant.name} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink">{merchant.name}</div>
                    <div className="text-[12px] text-muted">
                      {merchant.count} {merchant.count === 1 ? 'visit' : 'visits'}
                    </div>
                  </div>
                  <CompactAmount minor={merchant.totalMinor} currency={preferences.currency} className="text-[14px] font-semibold text-ink" />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Accounts */}
        {byAccount.length > 0 ? (
          <Card className="overflow-hidden">
            <h2 className="px-4 pb-1 pt-4 text-[17px] font-semibold text-ink">Spend by account</h2>
            <div className="flex flex-col gap-3 p-4 pt-2">
              {byAccount.map((slice) => (
                <div key={slice.accountId}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <span aria-hidden>{slice.account?.icon ?? '💳'}</span>
                      {slice.account?.name ?? 'Account'}
                    </span>
                    <span className="tabular text-muted">{formatMinor(slice.minor, preferences.currency)}</span>
                  </div>
                  <ProgressBar className="mt-2" height={6} percent={slice.percent} tone="accent" />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Distributions */}
        <Card className="p-4">
          <h2 className="text-[17px] font-semibold text-ink">By day of week</h2>
          <div className="mt-2">
            <Suspense fallback={<ChartSkeleton height={150} />}>
              <DistributionBars data={weekday.map((b) => ({ label: b.label, value: b.minor }))} currency={preferences.currency} />
            </Suspense>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-[17px] font-semibold text-ink">By time of day</h2>
          <div className="mt-2">
            <Suspense fallback={<ChartSkeleton height={150} />}>
              <DistributionBars
                data={timeOfDay.map((b) => ({
                  label: b.label,
                  value: b.minor,
                  color: 'rgb(var(--c-link))',
                }))}
                currency={preferences.currency}
              />
            </Suspense>
          </div>
        </Card>

        {/* Credit cards */}
        {cards.length > 0 ? (
          <Card className="overflow-hidden">
            <h2 className="px-4 pb-1 pt-4 text-[17px] font-semibold text-ink">Credit cards</h2>
            <div className="flex flex-col gap-4 p-4 pt-2">
              {cards.map((card) => (
                <div key={card.account.id}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-ink">{card.account.name}</span>
                    <span className="tabular text-muted">
                      {formatMinor(card.outstandingMinor, preferences.currency)}
                      {card.limitMinor > 0 ? <span className="text-faint"> / {formatMinor(card.limitMinor, preferences.currency)}</span> : null}
                    </span>
                  </div>
                  <ProgressBar className="mt-2" height={6} percent={card.limitMinor > 0 ? (card.outstandingMinor / card.limitMinor) * 100 : 0} tone="auto" />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
                    <span>
                      {card.unpaidCount} unpaid · {Math.round(card.utilization)}% utilised
                    </span>
                    {card.daysUntilDue !== null ? (
                      <span className={cn(card.daysUntilDue <= 3 && 'font-semibold text-danger')}>
                        Due in {card.daysUntilDue} {card.daysUntilDue === 1 ? 'day' : 'days'}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {/* Month picker */}
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="px-4 pb-2 pt-1">
          <h2 className="text-[16px] font-semibold text-ink">Jump to</h2>
        </div>
        <div className="scroll-y max-h-[60vh] px-4 pb-6">
          {monthChoices(anchor).map((choice) => (
            <button
              key={choice.toISOString()}
              type="button"
              onClick={() => {
                setAnchor(choice)
                setKind('month')
                setPickerOpen(false)
              }}
              className="pressable flex w-full items-center justify-between border-b border-hairline/60 py-3.5 text-left last:border-0"
            >
              <span className="text-[15px] font-medium text-ink">{formatMonthLabel(choice)}</span>
              {choice.getMonth() === anchor.getMonth() && choice.getFullYear() === anchor.getFullYear() ? (
                <Pill tone="accent">Current</Pill>
              ) : null}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Day detail */}
      <Sheet open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)}>
        <div className="px-4 pb-2 pt-1">
          <h2 className="text-[16px] font-semibold text-ink">{selectedDay ? formatDayHeading(selectedDay.date) : ''}</h2>
          <p className="text-[13px] text-muted">
            {selectedDay ? formatMinor(selectedDay.minor, preferences.currency) : ''} · {dayItems.length} transactions
          </p>
        </div>
        <div className="scroll-y max-h-[65vh] px-2 pb-6">
          {dayItems.length === 0 ? (
            <EmptyState title="No expenses" message="Nothing was logged on this day." />
          ) : (
            dayItems.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                category={lookups.categories.get(expense.category_id)}
                account={lookups.accounts.get(expense.account_id)}
                currency={preferences.currency}
                onClick={() => {
                  setSelectedDay(null)
                  navigate(`/expense/${expense.id}`)
                }}
              />
            ))
          )}
        </div>
      </Sheet>
    </div>
  )
}

function shiftAnchor(anchor: Date, kind: Kind, direction: 1 | -1): Date {
  if (kind === 'week') return addWeeks(anchor, direction)
  if (kind === 'year') return addYears(anchor, direction)
  return addMonths(anchor, direction)
}

function monthChoices(anchor: Date): Date[] {
  const list: Date[] = []
  const base = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  for (let i = 0; i < 18; i++) list.push(new Date(base.getFullYear(), base.getMonth() - i, 1))
  return list
}

function heatColor(level: HeatCell['level']): CSSProperties {
  switch (level) {
    case 1:
      return { backgroundColor: 'rgb(var(--c-accent) / 0.14)' }
    case 2:
      return { backgroundColor: 'rgb(var(--c-accent) / 0.32)' }
    case 3:
      return { backgroundColor: 'rgb(var(--c-accent) / 0.55)', color: '#fff' }
    case 4:
      return { backgroundColor: 'rgb(var(--c-accent))', color: '#fff' }
    default:
      return { backgroundColor: 'rgb(var(--c-surface-2))' }
  }
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-card bg-surface p-4 shadow-card ring-1 ring-hairline/70">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 truncate text-[19px] font-semibold tabular text-ink">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-[12px] text-muted">{hint}</div> : null}
    </motion.div>
  )
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="block w-4 rounded-pill"
        style={dashed ? { height: 0, borderTop: `2px dashed ${color}` } : { height: 3, backgroundColor: color }}
      />
      {label}
    </span>
  )
}

function ChartSkeleton({ height }: { height: number }) {
  return <div className="skeleton w-full rounded-2xl" style={{ height }} />
}
