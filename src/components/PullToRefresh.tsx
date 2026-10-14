import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { haptic } from '../lib/haptics'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  className?: string
  disabled?: boolean
}

const THRESHOLD = 64
const MAX_PULL = 96

/**
 * Pull-to-refresh for a scrollable region. Uses non-passive touch listeners so
 * we can suppress the rubber-band while pulling.
 */
export function PullToRefresh({ onRefresh, children, className, disabled }: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const runRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic(10)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPull(0)
    }
  }, [onRefresh])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || disabled) return undefined

    const onTouchStart = (event: TouchEvent) => {
      if (el.scrollTop <= 0) startY.current = event.touches[0].clientY
      else startY.current = null
    }

    const onTouchMove = (event: TouchEvent) => {
      if (startY.current === null || refreshing) return
      const delta = event.touches[0].clientY - startY.current
      if (delta <= 0) {
        setPull(0)
        return
      }
      if (el.scrollTop > 0) return
      if (event.cancelable) event.preventDefault()
      setPull(Math.min(MAX_PULL, delta * 0.5))
    }

    const onTouchEnd = () => {
      const current = pull
      startY.current = null
      if (current >= THRESHOLD) void runRefresh()
      else setPull(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  })

  const progress = Math.min(1, pull / THRESHOLD)

  return (
    <div ref={scrollRef} className={cn('scroll-y relative h-full', className)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center"
        style={{ height: refreshing ? 56 : pull, opacity: refreshing ? 1 : progress }}
      >
        <motion.span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-card"
          animate={refreshing ? { rotate: 360 } : { rotate: progress * 270 }}
          transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: 'linear' } : { duration: 0.1 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" />
            <path d="M19.8 4.6v4h-4" />
          </svg>
        </motion.span>
      </div>
      <div style={{ paddingTop: refreshing ? 56 : 0, transition: 'padding-top 200ms ease' }}>{children}</div>
    </div>
  )
}
