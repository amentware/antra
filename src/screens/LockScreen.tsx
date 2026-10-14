import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PinKeypad } from '../components/Keypad'
import { Logo } from '../components/Logo'
import { getPinRecord, verifyPin } from '../lib/pin'
import { haptic, warningFeedback } from '../lib/haptics'
import { cn } from '../lib/cn'
import { useSessionStore } from '../store/useSessionStore'

const MIN_LENGTH = 4
const MAX_LENGTH = 6

/** Full-screen PIN lock. Uses the custom keypad — no native keyboard. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const logout = useSessionStore((s) => s.logout)

  useEffect(() => {
    if (pin.length < MIN_LENGTH) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      setChecking(true)
      const record = await getPinRecord()
      const ok = record ? await verifyPin(pin, record) : false
      if (cancelled) return
      setChecking(false)
      if (ok) {
        haptic([8, 30, 12])
        onUnlock()
      } else {
        warningFeedback()
        setError(true)
        setPin('')
        setTimeout(() => setError(false), 700)
      }
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pin, onUnlock])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[70] flex flex-col justify-between bg-canvas px-6 safe-top pb-[calc(var(--safe-bottom)+12px)]"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Logo size={56} />
        <div className="text-center">
          <h1 className="text-[20px] font-semibold text-ink">Enter your PIN</h1>
          <p className="mt-1 text-[13px] text-muted">Antra is locked to keep your expenses private.</p>
        </div>

        <motion.div
          className="flex items-center gap-3"
          animate={error ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.42 }}
        >
          {Array.from({ length: Math.max(MIN_LENGTH, pin.length) }).map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-3.5 w-3.5 rounded-full border transition-colors',
                index < pin.length ? 'border-ink bg-ink' : 'border-hairline bg-transparent',
                error && 'border-danger bg-danger/40',
              )}
            />
          ))}
        </motion.div>
        <div className="h-4 text-[12px] font-medium text-danger">{error ? 'Incorrect PIN' : checking ? 'Checking…' : ''}</div>
      </div>

      <div className="mx-auto w-full max-w-[300px]">
        <PinKeypad
          onKey={(key) => {
            setError(false)
            setPin((current) => {
              if (key === '⌫') return current.slice(0, -1)
              if (current.length >= MAX_LENGTH) return current
              return current + key
            })
          }}
        />
        <button
          type="button"
          onClick={() => void logout()}
          className="pressable mx-auto mt-6 block text-[13px] font-medium text-muted"
        >
          Sign out instead
        </button>
      </div>
    </motion.div>
  )
}
