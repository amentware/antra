import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, Pill, SectionLabel } from '../components/Card'
import { CompactAmount } from '../components/AmountText'
import { ExpenseRow } from '../components/ExpenseRow'
import { EmptyState } from '../components/EmptyState'
import { ScreenHeader } from '../components/ScreenHeader'
import { Sheet } from '../components/Sheet'
import { Button, IconButton } from '../components/Buttons'
import { Chip, ChipRow } from '../components/Chips'
import { SwipeRow } from '../components/SwipeRow'
import { FilterIcon, SearchIcon, TrashIcon, UndoIcon } from '../components/Icons'
import { PullToRefresh } from '../components/PullToRefresh'
import { useAccounts, useCategories, useExpenses, useLookups } from '../hooks/useData'
import { usePreferences } from '../hooks/usePreferences'
import { formatDayHeading } from '../lib/date'
import { formatMinor } from '../lib/format'
import { deleteExpense, restoreExpense } from '../lib/repo'
import { parseMajorToMinor } from '@shared/money'
import { groupByDay } from '../lib/stats'
import { toast } from '../store/useToastStore'
import { syncNow } from '../lib/sync'
import { cn } from '../lib/cn'
import type { Expense } from '@shared/types'

interface Filters {
  categoryId: string | null
  accountId: string | null
  paid: 'all' | 'paid' | 'unpaid'
  from: string
  to: string
  min: string
  max: string
}

const EMPTY_FILTERS: Filters = { categoryId: null, accountId: null, paid: 'all', from: '', to: '', min: '', max: '' }

export function TransactionsScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const expenses = useExpenses()
  const categories = useCategories()
  const accounts = useAccounts()
  const lookups = useLookups()

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)

  const activeFilterCount = useMemo(
    () =>
      (filters.categoryId ? 1 : 0) +
      (filters.accountId ? 1 : 0) +
      (filters.paid !== 'all' ? 1 : 0) +
      (filters.from ? 1 : 0) +
      (filters.to ? 1 : 0) +
      (filters.min ? 1 : 0) +
      (filters.max ? 1 : 0),
    [filters],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTime = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null
    const toTime = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null
    const min = filters.min ? parseMajorToMinor(filters.min, preferences.currency) : null
    const max = filters.max ? parseMajorToMinor(filters.max, preferences.currency) : null

    return expenses.filter((expense) => {
      const t = new Date(expense.spent_at).getTime()
      if (fromTime !== null && t < fromTime) return false
      if (toTime !== null && t > toTime) return false
      if (filters.categoryId && expense.category_id !== filters.categoryId) return false
      if (filters.accountId && expense.account_id !== filters.accountId) return false
      if (filters.paid === 'paid' && expense.paid !== 1) return false
      if (filters.paid === 'unpaid' && expense.paid !== 0) return false
      if (min !== null && expense.amount_minor < min) return false
      if (max !== null && expense.amount_minor > max) return false
      if (q) {
        const category = lookups.categories.get(expense.category_id)?.name ?? ''
        const account = lookups.accounts.get(expense.account_id)?.name ?? ''
        const haystack = `${expense.merchant ?? ''} ${expense.note ?? ''} ${category} ${account}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [expenses, query, filters, lookups, preferences.currency])

  const groups = useMemo(() => groupByDay(filtered), [filtered])
  const totalMinor = useMemo(() => filtered.reduce((sum, e) => sum + e.amount_minor, 0), [filtered])

  const handleDelete = async (expense: Expense) => {
    await deleteExpense(expense.id)
    toast('Expense deleted', 'default', {
      label: 'Undo',
      onClick: () => void restoreExpense(expense.id),
    })
  }

  return (
    <div className="relative h-full">
      <div className="pt-safe-3 sticky top-0 z-20 bg-canvas/85 px-4 pb-3 backdrop-blur-xl">
        <ScreenHeader
          title="Transactions"
          onBack={() => navigate(-1)}
          right={
            <IconButton label="Filters" onClick={() => setFilterOpen(true)} className={cn(activeFilterCount > 0 && 'text-link')}>
              <FilterIcon size={20} />
            </IconButton>
          }
        />
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3.5">
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merchant, note, category…"
            type="search"
            enterKeyHint="search"
            className="h-12 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} className="pressable text-[13px] font-semibold text-link">
              Clear
            </button>
          ) : null}
        </div>
        {activeFilterCount > 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <Pill tone="link">{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}</Pill>
            <button type="button" className="pressable text-[13px] font-semibold text-link" onClick={() => setFilters(EMPTY_FILTERS)}>
              Reset
            </button>
          </div>
        ) : null}
      </div>

      <PullToRefresh onRefresh={() => syncNow({ force: true })} className="pb-[calc(var(--safe-bottom)+96px)]">
        <div className="px-4">
          <div className="flex items-center justify-between px-1 py-2 text-[12px] text-muted">
            <span>
              {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'}
            </span>
            <span className="tabular font-semibold">{formatMinor(totalMinor, preferences.currency)}</span>
          </div>

          {groups.length === 0 ? (
            <Card className="mt-2">
              <EmptyState
                icon={<SearchIcon size={24} />}
                title={expenses.length === 0 ? 'No expenses yet' : 'No matches'}
                message={expenses.length === 0 ? 'Tap + to log your first expense.' : 'Try a different search or clear your filters.'}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {groups.map((group) => (
                  <motion.div key={group.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Card className="overflow-hidden">
                      <div className="flex items-center justify-between px-4 pb-1 pt-3">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{formatDayHeading(group.date)}</span>
                        <CompactAmount minor={group.totalMinor} currency={preferences.currency} className="text-[12px] font-semibold text-muted" />
                      </div>
                      <div className="divide-y divide-hairline/60">
                        <AnimatePresence initial={false}>
                          {group.items.map((expense) => (
                            <motion.div key={expense.id} layout exit={{ opacity: 0, height: 0 }}>
                              <SwipeRow
                                trailing={
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(expense)}
                                    className="flex w-full items-center justify-center gap-1 bg-danger text-white"
                                    aria-label="Delete expense"
                                  >
                                    <TrashIcon size={18} />
                                    <span className="text-[12px] font-semibold">Delete</span>
                                  </button>
                                }
                              >
                                <ExpenseRow
                                  expense={expense}
                                  category={lookups.categories.get(expense.category_id)}
                                  account={lookups.accounts.get(expense.account_id)}
                                  currency={preferences.currency}
                                  onClick={() => navigate(`/expense/${expense.id}`)}
                                />
                              </SwipeRow>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-faint">
            <UndoIcon size={14} />
            Swipe a row left to delete
          </div>
        </div>
      </PullToRefresh>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={(next) => {
          setFilters(next)
          setFilterOpen(false)
        }}
        categories={categories}
        accounts={accounts}
      />
    </div>
  )
}

function FilterSheet({
  open,
  onClose,
  filters,
  onApply,
  categories,
  accounts,
}: {
  open: boolean
  onClose: () => void
  filters: Filters
  onApply: (filters: Filters) => void
  categories: Array<{ id: string; name: string; emoji: string; color: string }>
  accounts: Array<{ id: string; name: string; icon: string; color: string }>
}) {
  const [draft, setDraft] = useState<Filters>(filters)
  const preferences = usePreferences()

  // Re-sync when reopened with (possibly) new values.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(filters)
  }

  return (
    <Sheet open={open} onClose={onClose} fullHeight>
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <button type="button" className="pressable text-[14px] font-medium text-muted" onClick={() => setDraft(EMPTY_FILTERS)}>
          Reset
        </button>
        <h2 className="text-[16px] font-semibold text-ink">Filters</h2>
        <button type="button" className="pressable text-[14px] font-semibold text-link" onClick={() => onApply(draft)}>
          Apply
        </button>
      </div>

      <div className="scroll-y min-h-0 flex-1 pb-6">
        <div className="mt-2">
          <SectionLabel className="px-4 pb-2">Status</SectionLabel>
          <ChipRow>
            {(['all', 'paid', 'unpaid'] as const).map((value) => (
              <Chip key={value} selected={draft.paid === value} onClick={() => setDraft((d) => ({ ...d, paid: value }))}>
                {value === 'all' ? 'All' : value === 'paid' ? 'Paid' : 'Unpaid'}
              </Chip>
            ))}
          </ChipRow>
        </div>

        <div className="mt-4">
          <SectionLabel className="px-4 pb-2">Category</SectionLabel>
          <ChipRow>
            <Chip selected={!draft.categoryId} onClick={() => setDraft((d) => ({ ...d, categoryId: null }))}>
              Any
            </Chip>
            {categories.map((category) => (
              <Chip
                key={category.id}
                selected={draft.categoryId === category.id}
                color={category.color}
                onClick={() => setDraft((d) => ({ ...d, categoryId: d.categoryId === category.id ? null : category.id }))}
              >
                <span aria-hidden>{category.emoji}</span>
                {category.name}
              </Chip>
            ))}
          </ChipRow>
        </div>

        <div className="mt-4">
          <SectionLabel className="px-4 pb-2">Account</SectionLabel>
          <ChipRow>
            <Chip selected={!draft.accountId} onClick={() => setDraft((d) => ({ ...d, accountId: null }))}>
              Any
            </Chip>
            {accounts.map((account) => (
              <Chip
                key={account.id}
                selected={draft.accountId === account.id}
                color={account.color}
                onClick={() => setDraft((d) => ({ ...d, accountId: d.accountId === account.id ? null : account.id }))}
              >
                <span aria-hidden>{account.icon}</span>
                {account.name}
              </Chip>
            ))}
          </ChipRow>
        </div>

        <div className="mt-5 px-4">
          <SectionLabel className="pb-2">Date range</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={draft.from}
              onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
              className="h-12 flex-1 rounded-2xl bg-surface-2 px-3 text-[14px] text-ink outline-none"
            />
            <span className="text-muted">–</span>
            <input
              type="date"
              value={draft.to}
              onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
              className="h-12 flex-1 rounded-2xl bg-surface-2 px-3 text-[14px] text-ink outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip onClick={() => setDraft((d) => ({ ...d, from: isoDay(-7), to: isoDay(0) }))}>Last 7 days</Chip>
            <Chip onClick={() => setDraft((d) => ({ ...d, from: isoDay(-30), to: isoDay(0) }))}>Last 30 days</Chip>
            <Chip onClick={() => setDraft((d) => ({ ...d, from: monthStartIso(), to: isoDay(0) }))}>This month</Chip>
          </div>
        </div>

        <div className="mt-5 px-4">
          <SectionLabel className="pb-2">Amount range</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={draft.min}
              onChange={(event) => setDraft((d) => ({ ...d, min: event.target.value.replace(/[^0-9.]/g, '') }))}
              placeholder="Min"
              className="h-12 flex-1 rounded-2xl bg-surface-2 px-3 text-[15px] text-ink outline-none placeholder:text-faint"
            />
            <span className="text-muted">–</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.max}
              onChange={(event) => setDraft((d) => ({ ...d, max: event.target.value.replace(/[^0-9.]/g, '') }))}
              placeholder="Max"
              className="h-12 flex-1 rounded-2xl bg-surface-2 px-3 text-[15px] text-ink outline-none placeholder:text-faint"
            />
          </div>
          <p className="mt-2 text-[12px] text-faint">Amounts are in {preferences.currency}.</p>
        </div>

        <div className="mt-6 px-4">
          <Button block size="lg" onClick={() => onApply(draft)}>
            Show results
          </Button>
        </div>
      </div>
      <div className="h-[calc(var(--safe-bottom)+12px)]" />
    </Sheet>
  )
}

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthStartIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
