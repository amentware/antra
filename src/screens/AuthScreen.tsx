import { useEffect } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import { usePreferences } from '../hooks/usePreferences'
import { Card } from '../components/Card'
import { SyncIndicator } from '../components/SyncIndicator'
import { Logo } from '../components/Logo'
import { motion } from 'framer-motion'
import { Button } from '../components/Buttons'
import { LockIcon, RefreshIcon } from '../components/Icons'

/**
 * Login / first-run setup. Registration is disabled server-side once the first
 * user exists, so this screen flips to a plain sign-in for every later visit.
 */
export function AuthScreen() {
  const { status, error, busy, login, setup, clearError } = useSessionStore()
  const preferences = usePreferences()

  useEffect(() => {
    clearError()
  }, [status, clearError])

  const isSetup = status === 'setup'

  return (
    <div className="scroll-y h-full safe-top bg-canvas">
      <div
        className="flex min-h-full flex-col justify-center px-6 py-10"
        style={{ paddingBottom: 'calc(var(--kb-inset, 0px) + 2.5rem)' }}
      >
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={64} />
          <div>
            <h1 className="text-[30px] font-semibold tracking-tight text-ink">Antra</h1>
            <p className="mt-1 text-[14px] text-muted">
              {isSetup ? 'Create your account to get started.' : 'Welcome back. Sign in to continue.'}
            </p>
          </div>
        </motion.div>

        <Card className="p-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const email = String(data.get('email') ?? '')
              const password = String(data.get('password') ?? '')
              const name = String(data.get('name') ?? '')
              if (isSetup) await setup(email, password, name)
              else await login(email, password)
            }}
          >
            {isSetup ? (
              <Field label="Your name" name="name" type="text" autoComplete="name" placeholder="Ananthu" required />
            ) : null}
            <Field label="Email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              placeholder={isSetup ? 'At least 8 characters' : '••••••••'}
              minLength={isSetup ? 8 : undefined}
              required
            />

            {error ? (
              <div className="rounded-2xl bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">{error}</div>
            ) : null}

            <Button type="submit" size="lg" block disabled={busy} className="mt-1">
              {busy ? 'Please wait…' : isSetup ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <div className="mt-5 flex items-center justify-center gap-2 px-2 text-center text-[12px] text-faint">
          <LockIcon size={14} />
          <span>Your data stays in your own Cloudflare D1 database.</span>
        </div>
        <div className="mt-4 flex justify-center">
          <SyncIndicator showWhenIdle />
        </div>
        <div className="mt-2 text-center text-[11px] text-faint">Currency: {preferences.currency}</div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  type: string
  autoComplete?: string
  placeholder?: string
  required?: boolean
  minLength?: number
}

function Field({ label, name, type, autoComplete, placeholder, required, minLength }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="min-h-[52px] rounded-2xl bg-surface-2 px-4 text-[16px] text-ink outline-none ring-1 ring-transparent transition placeholder:text-faint focus:ring-link/60"
      />
    </label>
  )
}

/** Full-screen offline / error state. */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-2 text-muted">
        <RefreshIcon size={26} />
      </div>
      <h2 className="text-[18px] font-semibold text-ink">Cannot reach Antra</h2>
      <p className="text-[14px] text-muted">Check your connection and try again. Your logged expenses are safe on this device.</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  )
}
