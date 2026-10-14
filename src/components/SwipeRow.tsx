import { useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { cn } from '../lib/cn'

interface SwipeRowProps {
  children: ReactNode
  /** Rendered behind the row on the right; revealed by swiping left. */
  trailing?: ReactNode
  /** Rendered behind the row on the left; revealed by swiping right. */
  leading?: ReactNode
  className?: string
  onClick?: () => void
}

const REVEAL = 88

/**
 * Swipe-to-reveal list row. Uses `drag="x"` with snap points so it feels native.
 */
export function SwipeRow({ children, trailing, leading, className, onClick }: SwipeRowProps) {
  const x = useMotionValue(0)
  const [dragging, setDragging] = useState(false)
  const pointerMoved = useRef(false)

  const snap = (to: number) => animate(x, to, { type: 'spring', stiffness: 460, damping: 40 })

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {leading ? (
        <div className="absolute inset-y-0 left-0 flex w-[88px] items-stretch">{leading}</div>
      ) : null}
      {trailing ? (
        <div className="absolute inset-y-0 right-0 flex w-[88px] items-stretch">{trailing}</div>
      ) : null}
      <motion.div
        style={{ x }}
        drag={trailing || leading ? 'x' : false}
        dragConstraints={{ left: trailing ? -REVEAL : 0, right: leading ? REVEAL : 0 }}
        dragElastic={0.06}
        onDragStart={() => {
          setDragging(true)
          pointerMoved.current = true
        }}
        onDragEnd={(_event, info) => {
          setDragging(false)
          if (info.offset.x < -REVEAL / 2) snap(-REVEAL)
          else if (info.offset.x > REVEAL / 2) snap(REVEAL)
          else snap(0)
        }}
        onClick={() => {
          if (pointerMoved.current) {
            pointerMoved.current = false
            snap(0)
            return
          }
          onClick?.()
        }}
        className={cn('relative bg-surface', !dragging && 'transition-colors')}
      >
        {children}
      </motion.div>
    </div>
  )
}
