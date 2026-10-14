import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '../store/useToastStore'
import { cn } from '../lib/cn'
import { CheckIcon, CloseIcon, InfoIcon } from './Icons'

/** Toast host. Lives inside the phone container, above the bottom nav. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(var(--safe-bottom)+96px)]">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastRow key={t.id} id={t.id} message={t.message} tone={t.tone} action={t.action} durationMs={t.durationMs} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastRow({
  id,
  message,
  tone,
  action,
  durationMs,
  onDismiss,
}: {
  id: string
  message: string
  tone: string
  action?: { label: string; onClick: () => void }
  durationMs: number
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), durationMs)
    return () => clearTimeout(timer)
  }, [id, durationMs, onDismiss])

  const icon =
    tone === 'success' ? <CheckIcon size={16} /> : tone === 'error' ? <CloseIcon size={16} /> : <InfoIcon size={16} />

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={cn(
        'pointer-events-auto flex w-full max-w-[398px] items-center gap-3 rounded-2xl px-4 py-3 text-[14px] shadow-float',
        tone === 'error' ? 'bg-danger text-white' : tone === 'success' ? 'bg-positive text-white' : 'bg-ink text-canvas',
      )}
    >
      <span className="shrink-0 opacity-90">{icon}</span>
      <span className="flex-1 font-medium">{message}</span>
      {action ? (
        <button
          type="button"
          className="pressable shrink-0 rounded-pill bg-white/20 px-3 py-1.5 text-[13px] font-semibold"
          onClick={() => {
            action.onClick()
            onDismiss(id)
          }}
        >
          {action.label}
        </button>
      ) : null}
    </motion.div>
  )
}
