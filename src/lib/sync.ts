/**
 * Antra — client sync engine.
 *
 * Writes: applied optimistically to Dexie, then queued in a persistent outbox
 * and pushed to Cloudflare immediately. Failures keep the op queued and retry
 * with backoff (on reconnect, on foreground, on the next write).
 *
 * Reads: only `GET /api/sync?since=<cursor>` touches the server. It returns
 * changed rows (including tombstones) which are merged locally with
 * last-write-wins by `updated_at`.
 */
import { api, HttpError, type SyncOpPayload } from './api'
import { db, getMeta, META_KEYS, setMeta, type SyncTable } from './db'
import { useSyncStore } from '../store/useSyncStore'
import { dedupeOutbox, shouldApplyRemote } from '@shared/sync'
import type { Account, Budget, Category, Expense, SettingsRow, SyncPullResponse } from '@shared/types'

type AnyRow = Account | Category | Expense | Budget | SettingsRow

const TABLES: SyncTable[] = ['accounts', 'categories', 'expenses', 'budgets', 'settings']

export interface QueuedRow {
  table: SyncTable
  row: AnyRow
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

/** Queue a write and kick off an immediate flush. */
export async function enqueue(table: SyncTable, op: 'upsert' | 'delete', rowId: string, updatedAt: string): Promise<void> {
  await db.outbox.add({ table, op, rowId, updatedAt })
  scheduleFlush(0)
}

/** Drop every pending op for a row (used when a row is deleted before it synced). */
export async function clearQueued(rowId: string): Promise<void> {
  await db.outbox.where('rowId').equals(rowId).delete()
}

async function buildOps(): Promise<{ ops: SyncOpPayload[]; usedIds: number[] }> {
  const items = await db.outbox.orderBy('id').toArray()
  const latest = dedupeOutbox(items)
  const ops: SyncOpPayload[] = []
  const usedIds: number[] = []
  const supersededIds: number[] = []

  for (const item of items) {
    const key = `${item.table}:${item.rowId}`
    const winner = latest.get(key)
    if (!winner || winner.id !== item.id) {
      supersededIds.push(item.id!)
      continue
    }
    const table = db[item.table] as unknown as { get: (id: string) => Promise<AnyRow | undefined> }
    const row = await table.get(item.rowId)
    if (!row) {
      // The row no longer exists locally → send a tombstone instead.
      ops.push({ table: item.table, op: 'delete', row: { id: item.rowId, updated_at: item.updatedAt } })
    } else {
      ops.push({ table: item.table, op: 'upsert', row: row as unknown as Record<string, unknown> })
    }
    usedIds.push(item.id!)
  }

  if (supersededIds.length) await db.outbox.bulkDelete(supersededIds)
  return { ops, usedIds }
}

let flushing = false
let flushTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0

function scheduleFlush(delayMs: number): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushOutbox()
  }, delayMs)
}

/** Push all queued writes. Safe to call concurrently — it self-serialises. */
export async function flushOutbox(): Promise<boolean> {
  if (flushing) return false
  flushing = true
  const store = useSyncStore.getState()
  try {
    const pending = await db.outbox.count()
    store.setPending(pending)
    if (pending === 0) {
      if (store.status !== 'syncing') store.setStatus(navigator.onLine === false ? 'offline' : 'idle')
      return true
    }

    store.setStatus('syncing')
    const { ops, usedIds } = await buildOps()
    if (ops.length === 0) {
      await db.outbox.bulkDelete(usedIds)
      store.setPending(0)
      store.setStatus('idle')
      return true
    }

    const result = await api.push(ops)
    await db.outbox.bulkDelete(usedIds)
    attempt = 0
    store.setPending(await db.outbox.count())
    store.setError(result.errors.length ? `${result.errors.length} change(s) rejected` : null)
    if (result.errors.length) console.warn('[antra] sync rejected some rows', result.errors)
    store.setStatus(store.pending > 0 ? 'syncing' : 'idle')
    return true
  } catch (err) {
    const offline = err instanceof HttpError ? (err.isNetwork || err.status >= 500) : true
    if (err instanceof HttpError && err.isAuth) {
      store.setStatus('error')
      store.setError('Session expired — open Settings to sign in again')
    } else {
      attempt = Math.min(attempt + 1, 8)
      store.setStatus(offline ? 'offline' : 'error')
      store.setError(err instanceof Error ? err.message : 'Sync failed')
      scheduleFlush(Math.min(30_000, 1000 * 2 ** attempt))
    }
    return false
  } finally {
    flushing = false
  }
}

// ---------------------------------------------------------------------------
// Pull / merge
// ---------------------------------------------------------------------------

async function mergeRow(table: SyncTable, row: AnyRow): Promise<void> {
  const store = db[table] as unknown as { get: (id: string) => Promise<AnyRow | undefined>; put: (row: AnyRow) => Promise<unknown> }
  const local = await store.get(row.id)
  if (!shouldApplyRemote(local ?? null, row)) return // local edit wins; it is queued
  await store.put(row)
}

export async function applyPull(payload: SyncPullResponse): Promise<number> {
  let applied = 0
  for (const table of TABLES) {
    const rows = (payload[table] ?? []) as unknown as AnyRow[]
    for (const row of rows) {
      await mergeRow(table, row)
      applied++
    }
  }
  return applied
}

export interface SyncOptions {
  /** Ignore the throttle window (manual pull-to-refresh). */
  force?: boolean
  /** Pull everything from the beginning of time (first login / resync). */
  full?: boolean
}

const FOREGROUND_THROTTLE_MS = 60_000

export async function syncNow(options: SyncOptions = {}): Promise<void> {
  const store = useSyncStore.getState()
  const now = Date.now()
  const last = await getMeta<number>(META_KEYS.lastSyncAt)
  if (!options.force && !options.full && last && now - Number(last) < FOREGROUND_THROTTLE_MS) {
    // Still flush local writes, but skip the network pull.
    const ok = await flushOutbox()
    if (ok) store.setStatus(navigator.onLine === false ? 'offline' : 'idle')
    return
  }

  store.setStatus('syncing')
  await flushOutbox()

  try {
    const cursor = options.full ? '1970-01-01T00:00:00.000Z' : ((await getMeta<string>(META_KEYS.cursor)) ?? '1970-01-01T00:00:00.000Z')
    const payload = await api.pull(cursor)
    await applyPull(payload)
    await setMeta(META_KEYS.cursor, payload.cursor)
    await setMeta(META_KEYS.lastSyncAt, now)
    if (options.full) await setMeta(META_KEYS.fullPulled, true)

    // Writes may have queued while we were pulling; push them and pull any rows
    // they produced so the cursor stays consistent.
    if ((await db.outbox.count()) > 0) {
      await flushOutbox()
      const second = await api.pull(payload.cursor)
      await applyPull(second)
      await setMeta(META_KEYS.cursor, second.cursor)
      await setMeta(META_KEYS.lastSyncAt, Date.now())
    }

    store.setLastSyncedAt(new Date().toISOString())
    store.setError(null)
    store.setPending(await db.outbox.count())
    store.setStatus(store.pending > 0 ? 'syncing' : 'idle')
  } catch (err) {
    const offline = err instanceof HttpError ? err.isNetwork : true
    store.setStatus(offline ? 'offline' : 'error')
    store.setError(err instanceof Error ? err.message : 'Sync failed')
  }
}

// ---------------------------------------------------------------------------
// Wrappers used by the UI
// ---------------------------------------------------------------------------

/** Upsert a row locally and queue it for the server. */
export async function saveRow(table: SyncTable, row: AnyRow): Promise<void> {
  const store = db[table] as unknown as { put: (row: AnyRow) => Promise<unknown> }
  await store.put(row)
  await enqueue(table, 'upsert', row.id, String(row.updated_at))
}

/** Soft-delete a row locally and queue the tombstone. */
export async function deleteRow(table: SyncTable, id: string): Promise<void> {
  const store = db[table] as unknown as { get: (id: string) => Promise<AnyRow | undefined>; put: (row: AnyRow) => Promise<unknown> }
  const row = await store.get(id)
  const now = new Date().toISOString()
  if (row) {
    const tombstone = { ...row, deleted_at: now, updated_at: now } as AnyRow
    await store.put(tombstone)
  }
  // Replace any pending upsert for this row by clearing then queueing the delete.
  await clearQueued(id)
  await enqueue(table, 'delete', id, now)
}

/** Undo a soft delete (restore locally + re-upsert). */
export async function restoreRow(table: SyncTable, id: string): Promise<void> {
  const store = db[table] as unknown as { get: (id: string) => Promise<AnyRow | undefined>; put: (row: AnyRow) => Promise<unknown> }
  const row = await store.get(id)
  if (!row) return
  const restored = { ...row, deleted_at: null, updated_at: new Date().toISOString() } as AnyRow
  await store.put(restored)
  await clearQueued(id)
  await enqueue(table, 'upsert', id, restored.updated_at)
}

// ---------------------------------------------------------------------------
// Lifecycle wiring
// ---------------------------------------------------------------------------

let listenersBound = false
let onForeground: (() => void) | null = null

export function bindSyncLifecycle(): () => void {
  if (listenersBound) return () => undefined
  listenersBound = true

  const handleOnline = () => {
    void syncNow({ force: true })
  }
  const handleOffline = () => {
    useSyncStore.getState().setStatus('offline')
  }
  const handleVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  const handleFocus = () => void syncNow()

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  document.addEventListener('visibilitychange', handleVisible)
  window.addEventListener('focus', handleFocus)
  onForeground = handleVisible

  void syncNow({ force: true })

  return () => {
    listenersBound = false
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    document.removeEventListener('visibilitychange', handleVisible)
    window.removeEventListener('focus', handleFocus)
    onForeground = null
  }
}

/** Exposed for tests/diagnostics. */
export const __syncInternals = { buildOps, dedupeOutbox, mergeRow, onForeground: () => onForeground }
