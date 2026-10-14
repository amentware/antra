/**
 * Antra — auth/session state.
 *
 * The session lives in an HttpOnly cookie. We cache only the (non-sensitive)
 * user profile in localStorage so the app can still open offline.
 */
import { create } from 'zustand'
import { api, HttpError, type UserProfile } from '../lib/api'
import { clearCache } from '../lib/db'

export type SessionStatus = 'loading' | 'setup' | 'login' | 'authenticated' | 'offline'

const USER_KEY = 'antra.user'

function readCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

function writeCachedUser(user: UserProfile | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

interface SessionState {
  status: SessionStatus
  user: UserProfile | null
  setupRequired: boolean
  busy: boolean
  error: string | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  setup: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  setupRequired: false,
  busy: false,
  error: null,

  bootstrap: async () => {
    const cached = readCachedUser()
    try {
      const { user } = await api.me()
      writeCachedUser(user)
      set({ status: 'authenticated', user })
      return
    } catch (err) {
      if (err instanceof HttpError && err.isAuth) {
        // No valid session. Are we allowed to create the first account?
        try {
          const status = await api.authStatus()
          writeCachedUser(null)
          set({ status: status.setup_required ? 'setup' : 'login', user: null, setupRequired: status.setup_required })
        } catch {
          set({ status: cached ? 'authenticated' : 'login', user: cached })
        }
        return
      }
      // Network failure — allow offline use with the cached profile.
      if (cached) {
        set({ status: 'authenticated', user: cached, error: null })
        return
      }
      set({ status: 'login', error: 'Cannot reach the server. Check your connection.' })
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null })
    try {
      const { user } = await api.login({ email, password })
      writeCachedUser(user)
      set({ status: 'authenticated', user, busy: false })
      return true
    } catch (err) {
      set({ busy: false, error: err instanceof Error ? err.message : 'Sign in failed' })
      return false
    }
  },

  setup: async (email, password, name) => {
    set({ busy: true, error: null })
    try {
      const { user } = await api.setup({ email, password, name })
      writeCachedUser(user)
      await clearCache()
      set({ status: 'authenticated', user, busy: false, setupRequired: false })
      return true
    } catch (err) {
      set({ busy: false, error: err instanceof Error ? err.message : 'Could not create your account' })
      return false
    }
  },

  logout: async () => {
    try {
      await api.logout()
    } catch {
      /* ignore — we clear locally regardless */
    }
    writeCachedUser(null)
    await clearCache()
    set({ status: 'login', user: null, error: null })
  },

  clearError: () => set({ error: null }),
}))

export function getCachedUser(): UserProfile | null {
  return readCachedUser()
}
