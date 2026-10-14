/**
 * Antra — local budget alerts.
 *
 * Fully offline: watches the same live Dexie data the screens use and, the first
 * time a category crosses 80% or 100% of its monthly budget, shows a toast with
 * a subtle warning/error tone. Each (month, category, threshold) fires at most
 * once — the fired-keys live in `localStorage` so they survive reloads and are
 * pruned when the month rolls over.
 *
 * Respects the Settings toggle (`prefs.budgetAlerts`, default on) and does
 * nothing while the app is locked.
 */
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useBudgets, useCategories, useExpenses } from './useData'
import { budgetRows } from '../lib/stats'
import { formatMinor } from '../lib/format'
import { usePreferences } from './usePreferences'
import { toast } from '../store/useToastStore'

const ALERTS_KEY = 'prefs.budgetAlerts'
const FIRED_KEY = 'antra.budgetAlerts.fired'

interface FiredMap {
  [key: string]: boolean
}

function readFired(): FiredMap {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as FiredMap) : {}
  } catch {
    return {}
  }
}

function writeFired(map: FiredMap): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map))
  } catch {
    /* storage unavailable — alerts simply repeat next launch */
  }
}

/** Local calendar month key, e.g. "2026-03". */
function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * @param enabled pass `false` while the app is locked so alerts never fire over
 *   the lock screen (they will fire on the next unlock instead).
 */
export function useBudgetAlerts(enabled: boolean): void {
  const categories = useCategories()
  const budgets = useBudgets()
  const expenses = useExpenses()
  const preferences = usePreferences()
  const alertsEnabled = useLiveQuery(async () => (await db.meta.get(ALERTS_KEY))?.value !== false, [], true)

  useEffect(() => {
    if (!enabled || alertsEnabled === false) return
    if (categories.length === 0 || budgets.length === 0) return

    const now = new Date()
    const monthKey = monthKeyOf(now)
    const fired = readFired()

    const candidates = budgetRows(categories, budgets, expenses, now)
      .filter((row) => row.budget && row.progress && row.progress.status !== 'safe')
      .map((row) => ({
        id: row.category.id,
        name: row.category.name,
        progress: row.progress!,
        threshold: row.progress!.status === 'over' ? 100 : 80,
      }))
      .filter((c) => !fired[`${monthKey}|${c.id}|${c.threshold}`])
      .sort((a, b) => b.threshold - a.threshold || b.progress.percentUsed - a.progress.percentUsed)

    if (candidates.length === 0) return

    let changed = false
    for (const c of candidates) {
      const overspent = -c.progress.remainingMinor
      toast(
        overspent > 0
          ? `${c.name} is over budget by ${formatMinor(overspent, preferences.currency)}`
          : `${c.name} has used ${Math.round(c.progress.percentUsed)}% of its budget`,
        c.threshold === 100 ? 'error' : 'warning',
      )
      fired[`${monthKey}|${c.id}|${c.threshold}`] = true
      changed = true
    }

    if (changed) {
      // Drop last month's keys so the map never grows unbounded.
      const pruned: FiredMap = {}
      for (const key of Object.keys(fired)) {
        if (key.startsWith(`${monthKey}|`)) pruned[key] = true
      }
      writeFired(pruned)
    }
  }, [enabled, alertsEnabled, categories, budgets, expenses, preferences.currency])
}
