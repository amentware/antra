import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, Pill, SectionLabel, Tile } from '../components/Card'
import { AmountText } from '../components/AmountText'
import { ProgressBar } from '../components/Progress'
import { ScreenHeader } from '../components/ScreenHeader'
import { EmptyState } from '../components/EmptyState'
import { AmountInputSheet } from '../components/AmountInputSheet'
import { ChevronRight, TargetIcon } from '../components/Icons'
import { useBudgets, useCategories, useExpenses } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { formatMinor, formatPercent } from '../lib/format'
import { formatMonthLabel } from '../lib/date'
import { budgetRows, type BudgetRow } from '../lib/stats'
import { computeBudgetSummary } from '@shared/budget'
import { setBudget } from '../lib/repo'
import { successFeedback } from '../lib/haptics'
import { toast } from '../store/useToastStore'
import { cn } from '../lib/cn'
import type { Category } from '@shared/types'

export function BudgetsScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const categories = useCategories()
  const budgets = useBudgets()
  const expenses = useExpenses()

  const [editing, setEditing] = useState<Category | null>(null)

  const now = useMemo(() => new Date(), [])
  const rows = useMemo(() => budgetRows(categories, budgets, expenses, now), [categories, budgets, expenses, now])

  const budgeted = useMemo(() => rows.filter((r) => r.budget), [rows])
  const unbudgeted = useMemo(() => rows.filter((r) => !r.budget), [rows])

  const summary = useMemo(
    () => computeBudgetSummary(budgeted.map((r) => ({ limitMinor: r.progress!.limitMinor, spentMinor: r.spentMinor }))),
    [budgeted],
  )

  const dailySafe = useMemo(() => {
    const remaining = summary.remainingMinor
    const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1)
    return remaining > 0 ? Math.floor(remaining / daysLeft) : 0
  }, [summary.remainingMinor, now])

  const handleSetBudget = async (category: Category, minor: number | null) => {
    await setBudget(category.id, minor ?? 0)
    if (minor && minor > 0) successFeedback()
    toast(minor && minor > 0 ? `Budget set for ${category.name}` : `Budget removed for ${category.name}`, minor && minor > 0 ? 'success' : 'default')
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <ScreenHeader
          title="Budgets"
          large
          onBack={() => navigate(-1)}
          right={
            <Pill tone="neutral">{formatMonthLabel(now)}</Pill>
          }
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1">
        <Card className="p-5">
          <SectionLabel>Monthly budget</SectionLabel>
          <div className="mt-2">
            <AmountText minor={summary.totalSpentMinor} currency={preferences.currency} animate className="text-display text-ink" />
          </div>
          {summary.totalLimitMinor > 0 ? (
            <>
              <div className="mt-3">
                <ProgressBar percent={summary.percentUsed} height={10} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniStat label="Budget" value={formatMinor(summary.totalLimitMinor, preferences.currency)} />
                <MiniStat
                  label="Remaining"
                  value={formatMinor(Math.max(0, summary.remainingMinor), preferences.currency)}
                  tone={summary.remainingMinor < 0 ? 'danger' : 'positive'}
                />
                <MiniStat label="Safe / day" value={formatMinor(dailySafe, preferences.currency)} />
              </div>
              {summary.overCount > 0 || summary.warningCount > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.overCount > 0 ? <Pill tone="danger">{summary.overCount} over budget</Pill> : null}
                  {summary.warningCount > 0 ? <Pill tone="warning">{summary.warningCount} near limit</Pill> : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-[13px] text-muted">Set a limit on any category below to start tracking your pace.</p>
          )}
        </Card>

        <section>
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="text-[19px] font-semibold text-ink">Category budgets</h2>
            <button type="button" onClick={() => navigate('/settings/categories')} className="pressable text-[14px] font-medium text-link">
              Categories
            </button>
          </div>

          {budgeted.length === 0 ? (
            <Card>
              <EmptyState
                icon={<TargetIcon size={24} />}
                title="No budgets yet"
                message="Pick a category below and set a monthly limit. Antra tracks your pace, projects month-end and warns you at 80%."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {budgeted.map((row, index) => (
                <motion.button
                  key={row.category.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setEditing(row.category)}
                  className="pressable w-full rounded-card bg-surface p-4 text-left shadow-card ring-1 ring-hairline/70"
                >
                  <BudgetRowView row={row} currency={preferences.currency} />
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {unbudgeted.length > 0 ? (
          <section>
            <h2 className="px-1 pb-2 text-[16px] font-semibold text-ink">Add a budget</h2>
            <Card className="divide-y divide-hairline/60">
              {unbudgeted.map((row) => (
                <button
                  key={row.category.id}
                  type="button"
                  onClick={() => setEditing(row.category)}
                  className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <Tile emoji={row.category.emoji} color={row.category.color} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ink">{row.category.name}</div>
                    <div className="text-[12px] text-muted">
                      {row.spentMinor > 0 ? `${formatMinor(row.spentMinor, preferences.currency)} spent this month` : 'No spending yet'}
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-link">Set</span>
                  <ChevronRight size={15} className="shrink-0 text-faint" />
                </button>
              ))}
            </Card>
          </section>
        ) : null}
      </div>

      <AmountInputSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.emoji} ${editing.name}` : 'Set budget'}
        currency={preferences.currency}
        valueMinor={editing ? (rows.find((r) => r.category.id === editing.id)?.budget?.amount_minor ?? null) : null}
        allowClear
        confirmLabel="Set"
        onConfirm={(minor) => {
          if (editing) void handleSetBudget(editing, minor)
        }}
      />
    </div>
  )
}

function BudgetRowView({ row, currency }: { row: BudgetRow; currency: string }) {
  const progress = row.progress!
  const statusTone = progress.status === 'over' ? 'danger' : progress.status === 'warning' ? 'warning' : 'positive'
  const statusLabel = progress.status === 'over' ? 'Over budget' : progress.status === 'warning' ? 'Near limit' : 'On track'

  return (
    <>
      <div className="flex items-center gap-3">
        <Tile emoji={row.category.emoji} color={row.category.color} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink">{row.category.name}</span>
            <Pill tone={statusTone}>{statusLabel}</Pill>
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {formatMinor(row.spentMinor, currency)} of {formatMinor(progress.limitMinor, currency)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn('text-[17px] font-semibold tabular', progress.status === 'over' ? 'text-danger' : 'text-ink')}>
            {formatPercent(progress.percentUsed, 0)}
          </div>
          <div className="text-[11px] text-faint">used</div>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar percent={progress.percentUsed} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="font-semibold uppercase tracking-[0.06em] text-faint">Remaining</div>
          <div className={cn('mt-0.5 text-[13px] font-semibold tabular', progress.remainingMinor < 0 ? 'text-danger' : 'text-ink')}>
            {formatMinor(Math.abs(progress.remainingMinor), currency)}
            {progress.remainingMinor < 0 ? ' over' : ''}
          </div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.06em] text-faint">Safe / day</div>
          <div className="mt-0.5 text-[13px] font-semibold tabular text-ink">{formatMinor(progress.safeToSpendMinor, currency)}</div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.06em] text-faint">Projected</div>
          <div className={cn('mt-0.5 text-[13px] font-semibold tabular', progress.projectedOverMinor > 0 ? 'text-danger' : 'text-ink')}>
            {formatMinor(progress.projectedMinor, currency)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>{progress.daysLeft} days left</span>
        <span className={cn(progress.paceDelta > 5 && 'font-semibold text-warning', progress.paceDelta < -5 && 'font-semibold text-positive')}>
          {progress.paceDelta > 5 ? 'Ahead of pace' : progress.paceDelta < -5 ? 'Behind pace' : 'On pace'}
        </span>
      </div>
    </>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'danger' }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className={cn('mt-0.5 text-[14px] font-semibold tabular', tone === 'danger' ? 'text-danger' : tone === 'positive' ? 'text-positive' : 'text-ink')}>
        {value}
      </div>
    </div>
  )
}
