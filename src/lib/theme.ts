/** Theme application. `system` follows the OS. */

export type ThemePreference = 'system' | 'light' | 'dark'

/** Mirrored to localStorage so the very first paint can restore it (see index.html). */
export const THEME_STORAGE_KEY = 'antra.theme'

/** Canvas colours for the standalone status bar / browser chrome. */
export const THEME_COLORS = { light: '#EDECE6', dark: '#0E0F13' } as const

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The last preference the user picked, readable synchronously before Dexie loads. */
export function readStoredTheme(): ThemePreference {
  try {
    if (typeof window === 'undefined') return 'system'
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* ignore (private mode / storage disabled) */
  }
  return 'system'
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.style.colorScheme = resolved
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.content = THEME_COLORS[resolved]
}

export function subscribeSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}
