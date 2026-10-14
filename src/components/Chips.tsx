import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { tapFeedback } from '../lib/haptics'

interface ChipProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  color?: string
  className?: string
}

export function Chip({ children, selected, onClick, color, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onClick?.()
      }}
      aria-pressed={selected}
      style={selected && color ? { backgroundColor: `${color}1F`, color, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
      className={cn(
        'pressable inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-pill px-4 text-[14px] font-semibold transition-colors',
        selected
          ? color
            ? ''
            : 'bg-ink text-canvas'
          : 'bg-surface-2 text-muted ring-1 ring-hairline/70',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Horizontally scrollable chip row that scrolls under its own edges. */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('scroll-x no-scrollbar flex gap-2 px-4 py-1', className)}>
      {children}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
}

export function Switch({ checked, onChange, label, id }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        tapFeedback()
        onChange(!checked)
      }}
      className={cn(
        'pressable relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-pill transition-colors',
        checked ? 'bg-positive' : 'bg-hairline',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className={cn('absolute h-[27px] w-[27px] rounded-full bg-white shadow-md', checked ? 'right-[2px]' : 'left-[2px]')}
      />
    </button>
  )
}
