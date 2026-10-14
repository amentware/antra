import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../lib/cn'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** When false the sheet cannot be dragged away (for destructive confirmations). */
  dismissible?: boolean
  className?: string
  /** Renders the sheet as a full-height screen rather than a partial sheet. */
  fullHeight?: boolean
  labelledBy?: string
}

const spring = { type: 'spring' as const, stiffness: 380, damping: 40, mass: 0.9 }

/**
 * Bottom sheet with spring physics and drag-to-dismiss. Positioned absolutely
 * inside the phone container so it never escapes the device illusion.
 */
export function Sheet({ open, onClose, children, dismissible = true, className, fullHeight, labelledBy }: SheetProps) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, dismissible])

  return (
    <AnimatePresence>
      {open ? (
        <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismissible && onClose()}
          />
          <motion.div
            className={cn(
              'absolute inset-x-0 bottom-0 flex flex-col rounded-t-sheet bg-canvas shadow-float',
              fullHeight ? 'top-[env(safe-area-inset-top)]' : 'max-h-[92%]',
              className,
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag={dismissible ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_event, info) => {
              if (!dismissible) return
              if (info.offset.y > 110 || info.velocity.y > 620) onClose()
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1.5 w-11 rounded-pill bg-hairline" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
