import { describe, expect, it } from 'vitest'
import { dedupeOutbox, shouldApplyRemote, type OutboxEntry } from '@shared/sync'

describe('shouldApplyRemote (last-write-wins by updated_at)', () => {
  const remote = { id: 'e1', updated_at: '2026-03-01T10:00:00.000Z' }

  it('applies when there is no local copy', () => {
    expect(shouldApplyRemote(undefined, remote)).toBe(true)
    expect(shouldApplyRemote(null, remote)).toBe(true)
  })

  it('applies when the remote copy is newer', () => {
    expect(shouldApplyRemote({ id: 'e1', updated_at: '2026-03-01T09:00:00.000Z' }, remote)).toBe(true)
  })

  it('applies when the timestamps are equal (idempotent)', () => {
    expect(shouldApplyRemote({ id: 'e1', updated_at: remote.updated_at }, remote)).toBe(true)
  })

  it('keeps the local copy when it is strictly newer (it is queued for push)', () => {
    expect(shouldApplyRemote({ id: 'e1', updated_at: '2026-03-01T11:00:00.000Z' }, remote)).toBe(false)
  })
})

describe('dedupeOutbox', () => {
  const entry = (id: number, table: string, rowId: string, op: 'upsert' | 'delete' = 'upsert'): OutboxEntry => ({
    id,
    table,
    op,
    rowId,
    updatedAt: '2026-03-01T10:00:00.000Z',
  })

  it('keeps only the latest op per table:rowId', () => {
    const deduped = dedupeOutbox([
      entry(1, 'expenses', 'e1', 'upsert'),
      entry(2, 'expenses', 'e1', 'upsert'),
      entry(3, 'expenses', 'e1', 'delete'),
      entry(4, 'expenses', 'e2'),
    ])
    expect(deduped.size).toBe(2)
    expect(deduped.get('expenses:e1')?.op).toBe('delete')
    expect(deduped.get('expenses:e1')?.id).toBe(3)
    expect(deduped.get('expenses:e2')?.id).toBe(4)
  })

  it('keys by table so the same row id in different tables does not collide', () => {
    const deduped = dedupeOutbox([entry(1, 'expenses', 'x'), entry(2, 'budgets', 'x')])
    expect(deduped.size).toBe(2)
    expect(deduped.has('expenses:x')).toBe(true)
    expect(deduped.has('budgets:x')).toBe(true)
  })

  it('is order-independent: the highest id wins regardless of input order', () => {
    const deduped = dedupeOutbox([entry(9, 'accounts', 'a1'), entry(2, 'accounts', 'a1')])
    expect(deduped.get('accounts:a1')?.id).toBe(9)
  })

  it('handles an empty outbox', () => {
    expect(dedupeOutbox([]).size).toBe(0)
  })
})
