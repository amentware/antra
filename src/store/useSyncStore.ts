import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

interface SyncState {
  status: SyncStatus
  pending: number
  lastSyncedAt: string | null
  lastError: string | null
  setStatus: (status: SyncStatus) => void
  setPending: (pending: number) => void
  setLastSyncedAt: (iso: string | null) => void
  setError: (message: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  setStatus: (status) => set({ status }),
  setPending: (pending) => set({ pending }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setError: (lastError) => set({ lastError }),
}))
