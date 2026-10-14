import { create } from 'zustand'

export interface AddSheetPrefill {
  amountMinor?: number
  categoryId?: string
  accountId?: string
  merchant?: string
  note?: string
  spentAt?: string
  paid?: number
  /** When set the sheet edits an existing expense instead of creating one. */
  expenseId?: string
}

interface UiState {
  addOpen: boolean
  prefill: AddSheetPrefill | null
  openAdd: (prefill?: AddSheetPrefill) => void
  closeAdd: () => void
  updateReady: boolean
  setUpdateReady: (ready: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  addOpen: false,
  prefill: null,
  openAdd: (prefill) => set({ addOpen: true, prefill: prefill ?? null }),
  closeAdd: () => set({ addOpen: false, prefill: null }),
  updateReady: false,
  setUpdateReady: (updateReady) => set({ updateReady }),
}))
