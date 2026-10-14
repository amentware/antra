import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

interface CardProps {
  children: ReactNode
  className?: string
  /** Adds the standard press animation for tappable cards. */
  interactive?: boolean
  onClick?: () => void
  as?: 'div' | 'button'
  ariaLabel?: string
}

/** White, large-radius, hairline-bordered, softly shadowed content surface. */
export function Card({ children, className, interactive, onClick, as = 'div', ariaLabel }: CardProps) {
  const classes = cn(
    'rounded-card bg-surface shadow-card ring-1 ring-hairline/70',
    interactive && 'pressable text-left w-full',
    className,
  )
  if (as === 'button' || interactive) {
    return (
      <button type="button" aria-label={ariaLabel} className={classes} onClick={onClick}>
        {children}
      </button>
    )
  }
  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  )
}

/** Small uppercase label used for card headers (e.g. "SPENT THIS MONTH"). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold uppercase tracking-[0.08em] text-muted', className)}>{children}</div>
  )
}

export function SectionHeader({
  title,
  action,
  onAction,
  className,
}: {
  title: string
  action?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between px-1', className)}>
      <h2 className="text-[19px] font-semibold text-ink">{title}</h2>
      {action ? (
        <button type="button" onClick={onAction} className="pressable text-[14px] font-medium text-link">
          {action}
        </button>
      ) : null}
    </div>
  )
}

interface PillProps {
  children: ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'accent' | 'link'
  className?: string
  color?: string
}

/** Soft tinted pill badge. */
export function Pill({ children, tone = 'neutral', className, color }: PillProps) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-2 text-muted',
    positive: 'bg-positive/12 text-positive',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/12 text-danger',
    accent: 'bg-accent/12 text-accent',
    link: 'bg-link/12 text-link',
  }
  const style = color ? { backgroundColor: `${color}1F`, color } : undefined
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-semibold leading-none',
        !color && tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Rounded square that holds a category emoji or icon on a tinted background. */
export function Tile({
  emoji,
  color,
  size = 44,
  className,
}: {
  emoji: string
  color: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-2xl', className)}
      style={{ width: size, height: size, backgroundColor: `${color}1F`, fontSize: size * 0.46 }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  )
}
