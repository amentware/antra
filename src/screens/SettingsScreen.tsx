import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Pill, SectionLabel } from '../components/Card'
import { Button } from '../components/Buttons'
import { ScreenHeader } from '../components/ScreenHeader'
import { Sheet } from '../components/Sheet'
import { SegmentedControl } from '../components/Progress'
import { PinKeypad } from '../components/Keypad'
import { Switch } from '../components/Chips'
import {
  ChevronRight,
  DownloadIcon,
  InfoIcon,
  KeyIcon,
  LockIcon,
  LogoutIcon,
  RefreshIcon,
  SunIcon,
  TagIcon,
  WalletIcon,
} from '../components/Icons'
import { usePreferences } from '../hooks/usePreferences'
import { useSessionStore } from '../store/useSessionStore'
import { CURRENCIES, getCurrency } from '../lib/format'
import { clearSyncedData, getMeta, setMeta } from '../lib/db'
import { clearPin, getLockTimeoutMinutes, getPinRecord, isPinEnabled, setLockTimeoutMinutes, setPin as savePin, verifyPin } from '../lib/pin'
import { syncNow } from '../lib/sync'
import { updateSettings } from '../lib/repo'
import { toast } from '../store/useToastStore'
import { cn } from '../lib/cn'
import type { ThemePreference } from '../lib/theme'

const BUDGET_ALERTS_KEY = 'prefs.budgetAlerts'

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
]

const LOCK_TIMEOUTS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Immediately' },
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 60, label: '1 hour' },
]

type PinMode = null | 'create' | 'change' | 'disable'

export function SettingsScreen() {
  const navigate = useNavigate()
  const preferences = usePreferences()
  const user = useSessionStore((s) => s.user)
  const logout = useSessionStore((s) => s.logout)

  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [timezoneOpen, setTimezoneOpen] = useState(false)
  const [pinMode, setPinMode] = useState<PinMode>(null)
  const [pinEnabledState, setPinEnabledState] = useState(false)
  const [lockTimeout, setLockTimeout] = useState(5)
  const [budgetAlerts, setBudgetAlerts] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const currencyMeta = useMemo(() => getCurrency(preferences.currency), [preferences.currency])

  useEffect(() => {
    void (async () => {
      setPinEnabledState(await isPinEnabled())
      setLockTimeout(await getLockTimeoutMinutes())
      setBudgetAlerts((await getMeta<boolean>(BUDGET_ALERTS_KEY)) !== false)
    })()
  }, [])

  const initial = (user?.name || user?.email || 'A').trim().charAt(0).toUpperCase()

  const performResync = async () => {
    setSyncing(true)
    try {
      await clearSyncedData()
      await syncNow({ force: true, full: true })
      toast('Local data cleared and re-synced', 'success')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="scroll-y h-full pb-[calc(var(--safe-bottom)+96px)]">
      <div className="safe-top sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <ScreenHeader title="Settings" large />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-[22px] font-semibold text-canvas">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold text-ink">{user?.name || 'You'}</div>
            <div className="truncate text-[13px] text-muted">{user?.email ?? 'Signed in'}</div>
          </div>
        </Card>

        <section>
          <SectionLabel className="px-1 pb-2">Preferences</SectionLabel>
          <Card className="divide-y divide-hairline/60">
            <SettingRow icon={<WalletIcon size={18} />} label="Currency" onClick={() => setCurrencyOpen(true)} chevron>
              <span className="text-[14px] font-medium text-muted">
                {currencyMeta.symbol} {currencyMeta.code}
              </span>
            </SettingRow>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <RowIcon>
                <SunIcon size={18} />
              </RowIcon>
              <span className="flex-1 text-[15px] font-medium text-ink">Appearance</span>
              <SegmentedControl
                className="w-[186px]"
                layoutId="theme-pref"
                value={preferences.theme}
                onChange={(value) => void updateSettings({ theme: value as ThemePreference })}
                options={[
                  { value: 'system', label: 'Auto' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <RowIcon>
                <RefreshIcon size={18} />
              </RowIcon>
              <span className="flex-1 text-[15px] font-medium text-ink">Week starts on</span>
              <SegmentedControl
                className="w-[140px]"
                layoutId="week-start"
                value={preferences.weekStart === 0 ? 'sun' : 'mon'}
                onChange={(value) => void updateSettings({ week_start: value === 'sun' ? 0 : 1 })}
                options={[
                  { value: 'mon', label: 'Mon' },
                  { value: 'sun', label: 'Sun' },
                ]}
              />
            </div>

            <SettingRow icon={<InfoIcon size={18} />} label="Timezone" onClick={() => setTimezoneOpen(true)} chevron>
              <span className="max-w-[130px] truncate text-[13px] font-medium text-muted">{preferences.timezone}</span>
            </SettingRow>
          </Card>
        </section>

        <section>
          <SectionLabel className="px-1 pb-2">Alerts</SectionLabel>
          <Card>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <RowIcon>
                <TagIcon size={18} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">Budget alerts</div>
                <div className="text-[12px] text-muted">Notify locally at 80% and when a budget is exceeded.</div>
              </div>
              <Switch
                checked={budgetAlerts}
                onChange={(checked) => {
                  setBudgetAlerts(checked)
                  void setMeta(BUDGET_ALERTS_KEY, checked)
                }}
              />
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel className="px-1 pb-2">Security</SectionLabel>
          <Card className="divide-y divide-hairline/60">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <RowIcon>
                <LockIcon size={18} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">App lock (PIN)</div>
                <div className="text-[12px] text-muted">{pinEnabledState ? 'Enabled — a 4–6 digit PIN is required' : 'Off'}</div>
              </div>
              <Switch checked={pinEnabledState} onChange={(checked) => setPinMode(checked ? 'create' : 'disable')} />
            </div>

            {pinEnabledState ? (
              <>
                <SettingRow icon={<KeyIcon size={18} />} label="Change PIN" onClick={() => setPinMode('change')} chevron />
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <RowIcon>
                    <LockIcon size={18} />
                  </RowIcon>
                  <span className="flex-1 text-[15px] font-medium text-ink">Lock after</span>
                  <select
                    value={lockTimeout}
                    onChange={(event) => {
                      const minutes = Number(event.target.value)
                      setLockTimeout(minutes)
                      void setLockTimeoutMinutes(minutes)
                    }}
                    className="h-10 rounded-xl bg-surface-2 px-3 text-[14px] font-medium text-ink outline-none"
                  >
                    {LOCK_TIMEOUTS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </Card>
        </section>

        <section>
          <SectionLabel className="px-1 pb-2">Data</SectionLabel>
          <Card className="divide-y divide-hairline/60">
            <SettingRow icon={<TagIcon size={18} />} label="Categories" onClick={() => navigate('/settings/categories')} chevron />
            <SettingRow icon={<WalletIcon size={18} />} label="Accounts & cards" onClick={() => navigate('/settings/accounts')} chevron />
            <SettingRow icon={<KeyIcon size={18} />} label="API tokens" onClick={() => navigate('/settings/tokens')} chevron />
            <SettingRow icon={<DownloadIcon size={18} />} label="Shortcuts setup" onClick={() => navigate('/settings/shortcuts')} chevron />
            <SettingRow
              icon={<RefreshIcon size={18} />}
              label="Clear cache & re-sync"
              hint="Re-downloads everything from the server"
              onClick={() => void performResync()}
              chevron
              disabled={syncing}
            />
          </Card>
        </section>

        <Button block variant="secondary" size="lg" onClick={() => void logout()}>
          <LogoutIcon size={18} /> Sign out
        </Button>

        <p className="pb-2 text-center text-[12px] text-faint">Antra · v1.0.0 · single-user expense tracker</p>
      </div>

      <Sheet open={currencyOpen} onClose={() => setCurrencyOpen(false)}>
        <div className="px-4 pb-1 pt-1">
          <h2 className="text-[16px] font-semibold text-ink">Currency</h2>
          <p className="text-[13px] text-muted">Display only — amounts are never converted.</p>
        </div>
        <div className="scroll-y max-h-[62vh] px-4 pb-6">
          {CURRENCIES.map((currency) => (
            <button
              key={currency.code}
              type="button"
              onClick={() => {
                void updateSettings({ currency: currency.code })
                setCurrencyOpen(false)
              }}
              className="pressable flex w-full items-center justify-between border-b border-hairline/60 py-3.5 text-left last:border-0"
            >
              <span className="flex items-center gap-3">
                <span className="w-8 text-center text-[18px] text-ink">{currency.symbol}</span>
                <span className="text-[15px] font-medium text-ink">{currency.name}</span>
              </span>
              {currency.code === preferences.currency ? (
                <Pill tone="accent">Selected</Pill>
              ) : (
                <span className="text-[13px] text-faint">{currency.code}</span>
              )}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={timezoneOpen} onClose={() => setTimezoneOpen(false)}>
        <div className="px-4 pb-1 pt-1">
          <h2 className="text-[16px] font-semibold text-ink">Timezone</h2>
          <p className="text-[13px] text-muted">Used for the public API's “today” and monthly totals.</p>
        </div>
        <div className="scroll-y max-h-[62vh] px-4 pb-6">
          {uniqueTimezones(preferences.timezone).map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => {
                void updateSettings({ timezone: zone })
                setTimezoneOpen(false)
              }}
              className="pressable flex w-full items-center justify-between border-b border-hairline/60 py-3.5 text-left last:border-0"
            >
              <span className="text-[15px] font-medium text-ink">{zone}</span>
              {zone === preferences.timezone ? <Pill tone="accent">Selected</Pill> : null}
            </button>
          ))}
        </div>
      </Sheet>

      <PinSheet
        mode={pinMode}
        onClose={() => setPinMode(null)}
        onDone={async () => {
          setPinEnabledState(await isPinEnabled())
          setPinMode(null)
        }}
      />
    </div>
  )
}

function uniqueTimezones(current: string): string[] {
  const set = new Set<string>(TIMEZONES)
  if (current) set.add(current)
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (detected) set.add(detected)
  return [...set]
}

function RowIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">{children}</span>
}

function SettingRow({
  icon,
  label,
  hint,
  children,
  onClick,
  chevron,
  disabled,
}: {
  icon: ReactNode
  label: string
  hint?: string
  children?: ReactNode
  onClick?: () => void
  chevron?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('pressable flex w-full items-center gap-3 px-4 py-3.5 text-left', disabled && 'opacity-50')}
    >
      <RowIcon>{icon}</RowIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {hint ? <span className="block text-[12px] text-muted">{hint}</span> : null}
      </span>
      {children}
      {chevron ? <ChevronRight size={16} className="shrink-0 text-faint" /> : null}
    </button>
  )
}

type PinStage = 'verify' | 'enter' | 'confirm'

/** Modal flow for setting / changing / disabling the app-lock PIN. */
function PinSheet({ mode, onClose, onDone }: { mode: PinMode; onClose: () => void; onDone: () => void | Promise<void> }) {
  const [stage, setStage] = useState<PinStage>('enter')
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!mode) return
    setPin('')
    setFirstPin('')
    setError('')
    setBusy(false)
    setStage(mode === 'create' ? 'enter' : 'verify')
  }, [mode])

  const submit = async () => {
    if (pin.length < 4) {
      setError('Enter at least 4 digits')
      return
    }
    setBusy(true)
    try {
      if (stage === 'verify') {
        const record = await getPinRecord()
        const ok = record ? await verifyPin(pin, record) : false
        if (!ok) {
          setError('Incorrect PIN')
          setPin('')
          return
        }
        if (mode === 'disable') {
          await clearPin()
          toast('App lock disabled', 'success')
          await onDone()
          return
        }
        setStage('enter')
        setPin('')
        return
      }

      if (stage === 'enter') {
        setFirstPin(pin)
        setPin('')
        setStage('confirm')
        return
      }

      // confirm
      if (pin !== firstPin) {
        setError('PINs did not match')
        setFirstPin('')
        setPin('')
        setStage('enter')
        return
      }
      await savePin(pin)
      toast('App lock enabled', 'success')
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'disable'
      ? 'Enter your PIN'
      : stage === 'verify'
        ? 'Enter current PIN'
        : stage === 'confirm'
          ? 'Confirm your PIN'
          : 'Create a PIN'
  const subtitle =
    mode === 'disable'
      ? 'Confirm your current PIN to turn off the app lock.'
      : stage === 'confirm'
        ? 'Enter the same 4–6 digits again.'
        : stage === 'verify'
          ? 'Verify it is you before continuing.'
          : 'Choose 4–6 digits. It never leaves your phone.'
  const confirmLabel = stage === 'confirm' ? 'Set PIN' : stage === 'verify' ? (mode === 'disable' ? 'Turn off' : 'Continue') : 'Continue'

  return (
    <Sheet open={Boolean(mode)} onClose={onClose} dismissible>
      <div className="flex flex-col items-center px-6 pb-2 pt-1">
        <LockIcon size={26} className="text-accent" />
        <h2 className="mt-2 text-[17px] font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-center text-[13px] text-muted">{subtitle}</p>

        <div className="mt-5 flex items-center gap-3">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-3.5 w-3.5 rounded-full border transition-colors',
                index < pin.length ? 'border-ink bg-ink' : 'border-hairline',
                error && 'border-danger bg-danger/30',
              )}
            />
          ))}
        </div>
        <div className="mt-2 h-4 text-[12px] font-medium text-danger">{error}</div>
      </div>

      <div className="mx-auto w-full max-w-[300px] px-6">
        <PinKeypad
          onKey={(key) => {
            setError('')
            setPin((current) => {
              if (key === '⌫') return current.slice(0, -1)
              return current.length >= 6 ? current : current + key
            })
          }}
        />
        <Button block size="lg" className="mt-3" disabled={pin.length < 4 || busy} onClick={() => void submit()}>
          {confirmLabel}
        </Button>
        <div className="h-[calc(var(--safe-bottom)+20px)]" />
      </div>
    </Sheet>
  )
}
