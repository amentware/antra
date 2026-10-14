import { useSyncStore } from '../store/useSyncStore'
import { cn } from '../lib/cn'
import { formatRelative } from '../lib/date'

/** Subtle sync state chip: synced / syncing / offline pending N. */
export function SyncIndicator({ className, showWhenIdle = false }: { className?: string; showWhenIdle?: boolean }) {
  const status = useSyncStore((s) => s.status)
  const pending = useSyncStore((s) => s.pending)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)

  const visible = pending > 0 || status === 'offline' || status === 'error' || status === 'syncing' || showWhenIdle
  if (!visible) return null

  const label =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? pending > 0
          ? `Offline · ${pending} pending`
          : 'Offline'
        : status === 'error'
          ? 'Sync issue'
          : pending > 0
            ? `${pending} pending`
            : lastSyncedAt
              ? `Synced ${formatRelative(lastSyncedAt)}`
              : 'Synced'

  const tone =
    status === 'error'
      ? 'bg-danger/12 text-danger'
      : status === 'offline'
        ? 'bg-warning/15 text-warning'
        : status === 'syncing'
          ? 'bg-link/12 text-link'
          : 'bg-positive/12 text-positive'

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold', tone, className)}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full bg-current',
          status === 'syncing' && 'animate-pulse',
        )}
      />
      {label}
    </span>
  )
}
