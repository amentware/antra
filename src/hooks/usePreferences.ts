import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { applyTheme, readStoredTheme, subscribeSystemTheme, type ThemePreference } from '../lib/theme'
import { DEFAULT_CURRENCY, isKnownCurrency } from '@shared/currency'

export interface Preferences {
  currency: string
  theme: ThemePreference
  timezone: string
  weekStart: 0 | 1
  settingsId: string | null
}

const FALLBACK: Preferences = {
  currency: DEFAULT_CURRENCY,
  theme: 'system',
  timezone: 'Asia/Kolkata',
  weekStart: 1,
  settingsId: null,
}

/** Live user preferences (currency/theme/timezone) with sane defaults. */
export function usePreferences(): Preferences {
  const settings = useLiveQuery(() => db.settings.filter((s) => !s.deleted_at).first(), [])

  // While the settings row loads (or offline), fall back to the last theme the
  // user picked so we never momentarily flip back to the OS theme.
  const theme = (settings?.theme as ThemePreference) ?? readStoredTheme()
  const currency = settings?.currency && isKnownCurrency(settings.currency) ? settings.currency : FALLBACK.currency

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return undefined
    return subscribeSystemTheme(() => applyTheme('system'))
  }, [theme])

  if (!settings) return { ...FALLBACK, theme }
  return {
    currency,
    theme,
    timezone: settings.timezone || FALLBACK.timezone,
    weekStart: (settings.week_start === 0 ? 0 : 1) as 0 | 1,
    settingsId: settings.id,
  }
}
