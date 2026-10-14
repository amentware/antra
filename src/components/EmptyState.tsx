import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center"
    >
      {icon ? <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-2 text-muted">{icon}</div> : null}
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {message ? <p className="max-w-[280px] text-[14px] leading-relaxed text-muted">{message}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </motion.div>
  )
}
