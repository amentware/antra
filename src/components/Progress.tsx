import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { clampPercent } from '@shared/money'

interface ProgressBarProps {
  /** 0..100+ (values above 100 are clamped but colour switches to "over"). */
  percent: number
  className?: string
  height?: number
  /** Force a colour instead of deriving it from the percentage. */
  tone?: 'auto' | 'accent' | 'positive' | 'warning' | 'danger'
}

function toneColor(percent: number, tone: ProgressBarProps['tone']): string {
  const which = tone && tone !== 'auto' ? tone : percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : 'positive'
  switch (which) {
    case 'danger':
      return 'rgb(var(--c-danger))'
    case 'warning':
      return 'rgb(var(--c-warning))'
    case 'accent':
      return 'rgb(var(--c-accent))'
    case 'positive':
    default:
      return 'rgb(var(--c-positive))'
  }
}

export function ProgressBar({ percent, className, height = 8, tone = 'auto' }: ProgressBarProps) {
  const clamped = clampPercent(percent)
  const color = toneColor(percent, tone)
  return (
    <div
      className={cn('w-full overflow-hidden rounded-pill bg-surface-2', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-pill"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      />
    </div>
  )
}

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
  layoutId?: string
}

/** iOS-style segmented control with an animated sliding thumb. */
export function SegmentedControl<T extends string>({ options, value, onChange, className, layoutId = 'segmented' }: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex rounded-pill bg-surface-2 p-1', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex-1 rounded-pill px-3 py-2 text-[13px] font-semibold transition-colors',
              active ? 'text-ink' : 'text-muted',
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-pill bg-surface shadow-card"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
