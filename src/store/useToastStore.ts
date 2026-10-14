import { create } from 'zustand'
import { haptic } from '../lib/haptics'

export type ToastTone = 'default' | 'success' | 'error' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  tone: ToastTone
  action?: ToastAction
  durationMs: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'tone' | 'durationMs'> & { tone?: ToastTone; durationMs?: number }) => string
  dismiss: (id: string) => void
}

let counter = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ message, tone = 'default', action, durationMs = tone === 'error' ? 5000 : 3200 }) => {
    const id = `t${++counter}`
    haptic(tone === 'error' ? [12, 40, 12] : 8)
    set({ toasts: [...get().toasts, { id, message, tone, action, durationMs }] })
    return id
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/** Imperative helper usable outside React. */
export function toast(message: string, tone: ToastTone = 'default', action?: ToastAction): string {
  return useToastStore.getState().push({ message, tone, action })
}
