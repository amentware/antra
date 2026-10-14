import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { IconButton } from './Buttons'
import { BackIcon } from './Icons'

interface ScreenHeaderProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
  left?: ReactNode
  className?: string
  large?: boolean
}

export function ScreenHeader({ title, subtitle, onBack, right, left, className, large }: ScreenHeaderProps) {
  return (
    <header className={cn('flex items-center gap-3 px-4', className)}>
      {onBack ? (
        <IconButton label="Back" onClick={onBack}>
          <BackIcon size={20} />
        </IconButton>
      ) : (
        left
      )}
      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className={cn('truncate font-semibold text-ink', large ? 'text-[26px]' : 'text-[17px]')}>{title}</h1>
        ) : null}
        {subtitle ? <p className="truncate text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  )
}
