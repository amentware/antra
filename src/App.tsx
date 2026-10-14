import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { BottomNav } from './components/BottomNav'
import { ToastHost } from './components/ToastHost'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AddExpenseSheet } from './components/AddExpenseSheet'
import { AuthScreen } from './screens/AuthScreen'
import { LockScreen } from './screens/LockScreen'
import { HomeScreen } from './screens/HomeScreen'
import { InsightsScreen } from './screens/InsightsScreen'
import { AccountsScreen } from './screens/AccountsScreen'
import { AccountDetailScreen } from './screens/AccountDetailScreen'
import { BudgetsScreen } from './screens/BudgetsScreen'
import { TransactionsScreen } from './screens/TransactionsScreen'
import { ExpenseDetailScreen } from './screens/ExpenseDetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { CategoriesScreen } from './screens/CategoriesScreen'
import { ManageAccountsScreen } from './screens/ManageAccountsScreen'
import { TokensScreen } from './screens/TokensScreen'
import { ShortcutsScreen } from './screens/ShortcutsScreen'
import { useSessionStore } from './store/useSessionStore'
import { useUiStore } from './store/useUiStore'
import { useAppLock } from './hooks/useAppLock'
import { useBudgetAlerts } from './hooks/useBudgetAlerts'
import { useKeyboardInset } from './hooks/useKeyboardInset'
import { usePreferences } from './hooks/usePreferences'
import { bindSyncLifecycle, syncNow } from './lib/sync'
import { db, getMeta, META_KEYS } from './lib/db'
import { ensureSettingsRow } from './lib/repo'
import { Logo } from './components/Logo'
import { Button } from './components/Buttons'
import { updateSW } from './pwa'

export default function App() {
  const status = useSessionStore((s) => s.status)
  const bootstrap = useSessionStore((s) => s.bootstrap)

  // Keep bottom sheets clear of the on-screen keyboard (see the hook).
  useKeyboardInset()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <PhoneFrame>
      {status === 'loading' ? (
        <Splash />
      ) : status === 'authenticated' ? (
        <AuthenticatedApp />
      ) : (
        <AuthScreen />
      )}
    </PhoneFrame>
  )
}

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-canvas">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Logo size={64} />
      </motion.div>
      <div className="text-[15px] font-semibold text-muted">Antra</div>
    </div>
  )
}

function AuthenticatedApp() {
  const location = useLocation()
  const addOpen = useUiStore((s) => s.addOpen)
  const openAdd = useUiStore((s) => s.openAdd)
  const closeAdd = useUiStore((s) => s.closeAdd)
  const { locked, unlock } = useAppLock(true)
  const preferences = usePreferences()
  useBudgetAlerts(!locked)

  // First-login full pull + lifecycle wiring.
  useEffect(() => {
    let dispose: (() => void) | undefined
    void (async () => {
      const fullPulled = await getMeta<boolean>(META_KEYS.fullPulled)
      await syncNow({ full: !fullPulled, force: true })
      const hasSettings = await db.settings.filter((s) => !s.deleted_at).count()
      if (hasSettings === 0) await ensureSettingsRow()
      dispose = bindSyncLifecycle()
    })()
    return () => dispose?.()
  }, [])

  // Update toast wiring.
  useEffect(() => {
    const onUpdate = () => useUiStore.getState().setUpdateReady(true)
    window.addEventListener('antra:update-available', onUpdate)
    return () => window.removeEventListener('antra:update-available', onUpdate)
  }, [])

  // Global "add expense" shortcut from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'n' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        openAdd()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openAdd])

  const showNav = !location.pathname.startsWith('/expense/') && !location.pathname.startsWith('/settings/')

  return (
    <div className="relative h-full">
      {/* A single keyed route layer re-mounts on navigation and fades in via
          CSS only. There is deliberately no exit animation: an exiting screen
          lingering on top (invisible, mid-transform) used to create a stacking
          context that swallowed taps and scroll gestures. */}
      <div key={location.pathname} className="absolute inset-0 animate-screen-enter">
        <ErrorBoundary>
          <Routes location={location}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/insights" element={<InsightsScreen />} />
            <Route path="/cards" element={<AccountsScreen />} />
            <Route path="/cards/:id" element={<AccountDetailScreen />} />
            <Route path="/budgets" element={<BudgetsScreen />} />
            <Route path="/transactions" element={<TransactionsScreen />} />
            <Route path="/expense/:id" element={<ExpenseDetailScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/settings/categories" element={<CategoriesScreen />} />
            <Route path="/settings/accounts" element={<ManageAccountsScreen />} />
            <Route path="/settings/tokens" element={<TokensScreen />} />
            <Route path="/settings/shortcuts" element={<ShortcutsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>

      {showNav ? <BottomNav onAdd={() => openAdd()} /> : null}

      <AddExpenseSheet
        open={addOpen}
        onClose={closeAdd}
        currency={preferences.currency}
        onSaved={() => closeAdd()}
      />

      <ToastHost />
      <UpdateToastHost />

      <AnimatePresence>{locked ? <LockScreen onUnlock={unlock} /> : null}</AnimatePresence>
    </div>
  )
}

function UpdateToastHost() {
  const updateReady = useUiStore((s) => s.updateReady)
  const setUpdateReady = useUiStore((s) => s.setUpdateReady)
  if (!updateReady) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[calc(var(--safe-top)+10px)]">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[13px] font-medium text-canvas shadow-float"
      >
        <span>New version available</span>
        <Button
          size="md"
          variant="secondary"
          className="h-9 min-h-0 px-3 text-[13px]"
          onClick={() => {
            setUpdateReady(false)
            void updateSW(true)
          }}
        >
          Refresh
        </Button>
        <button
          type="button"
          aria-label="Dismiss"
          className="pressable text-muted"
          onClick={() => setUpdateReady(false)}
        >
          ✕
        </button>
      </motion.div>
    </div>
  )
}
