/** Theme application. `system` follows the OS. */

export type ThemePreference = 'system' | 'light' | 'dark'

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = resolved === 'dark' ? '#17181B' : '#F5F5F7'
}

export function subscribeSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}
