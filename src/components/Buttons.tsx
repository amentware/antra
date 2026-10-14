import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { tapFeedback } from '../lib/haptics'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  variant?: 'surface' | 'ghost' | 'accent'
  size?: 'md' | 'lg'
}

export function IconButton({ label, children, className, variant = 'surface', size = 'md', onClick, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'pressable inline-flex items-center justify-center rounded-full transition-colors',
        size === 'lg' ? 'h-12 w-12' : 'h-11 w-11',
        'min-h-[44px] min-w-[44px]',
        variant === 'surface' && 'bg-surface text-ink shadow-card',
        variant === 'ghost' && 'bg-transparent text-ink',
        variant === 'accent' && 'bg-accent text-white shadow-float',
        className,
      )}
      onClick={(event) => {
        tapFeedback()
        onClick?.(event)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  block?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, className, children, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'pressable inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none',
        size === 'lg' ? 'h-14 px-6 text-[17px]' : 'h-12 px-5 text-[15px]',
        'min-h-[44px]',
        block && 'w-full',
        variant === 'primary' && 'bg-ink text-canvas',
        variant === 'secondary' && 'bg-surface-2 text-ink',
        variant === 'ghost' && 'bg-transparent text-link',
        variant === 'danger' && 'bg-danger/10 text-danger',
        className,
      )}
      onClick={(event) => {
        tapFeedback()
        onClick?.(event)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
