import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { cn } from '../lib/cn'
import { tapFeedback } from '../lib/haptics'
import { CardIcon, HomeIcon, InsightsIcon, PlusIcon, UserIcon } from './Icons'

interface BottomNavProps {
  onAdd: () => void
}

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/insights', label: 'Insights', Icon: InsightsIcon },
  { to: '/cards', label: 'Cards', Icon: CardIcon },
  { to: '/settings', label: 'Profile', Icon: UserIcon },
] as const

/** Floating pill navigation with an animated highlight and a raised Add button. */
export function BottomNav({ onAdd }: BottomNavProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(var(--safe-bottom)+10px)]">
      <nav
        aria-label="Primary"
        className="pointer-events-auto glass relative flex w-full max-w-[398px] items-center justify-between rounded-pill bg-surface/85 px-2 py-2 shadow-nav ring-1 ring-hairline/70"
      >
        {TABS.slice(0, 2).map((tab) => (
          <NavItem key={tab.to} {...tab} active={isActive(tab.to)} onClick={() => navigate(tab.to)} />
        ))}

        <button
          type="button"
          aria-label="Add expense"
          onClick={() => {
            tapFeedback()
            onAdd()
          }}
          className="pressable relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-float ring-4 ring-canvas"
        >
          <PlusIcon size={26} strokeWidth={2} />
        </button>

        {TABS.slice(2).map((tab) => (
          <NavItem key={tab.to} {...tab} active={isActive(tab.to)} onClick={() => navigate(tab.to)} />
        ))}
      </nav>
    </div>
  )
}

function NavItem({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string
  Icon: (props: { size?: number }) => ReactElement
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onClick()
      }}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn('relative flex h-11 w-11 items-center justify-center rounded-full', active ? 'text-ink' : 'text-muted')}
    >
      {active ? (
        <motion.span
          layoutId="nav-highlight"
          className="absolute inset-0 rounded-full bg-surface-2"
          transition={{ type: 'spring', stiffness: 480, damping: 34 }}
        />
      ) : null}
      <span className="relative z-10">
        <Icon size={22} />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
