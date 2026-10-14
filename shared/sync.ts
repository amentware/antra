/**
 * Antra — pure sync primitives shared by the client engine and unit tests.
 *
 * Kept dependency-free (no Dexie, no network) so the last-write-wins rules can
 * be verified in isolation.
 */

export interface SyncableRow {
  id: string
  updated_at: string
}

export interface OutboxEntry {
  id?: number
  table: string
  op: 'upsert' | 'delete'
  rowId: string
  updatedAt: string
}

/**
 * Last-write-wins: apply a remote row unless the local copy is strictly newer
 * (a newer local copy is, by definition, already queued for the server).
 */
export function shouldApplyRemote(local: SyncableRow | undefined | null, remote: SyncableRow): boolean {
  if (!local) return true
  return String(local.updated_at) <= String(remote.updated_at)
}

/**
 * Collapse the outbox to one op per `table:rowId`, keeping the highest local id
 * (Dexie auto-increment order == write order). Later writes supersede earlier
 * ones for the same row.
 */
export function dedupeOutbox<T extends OutboxEntry>(items: T[]): Map<string, T> {
  const latest = new Map<string, T>()
  for (const item of items) {
    const key = `${item.table}:${item.rowId}`
    const existing = latest.get(key)
    if (!existing || (item.id ?? 0) > (existing.id ?? 0)) latest.set(key, item)
  }
  return latest
}
