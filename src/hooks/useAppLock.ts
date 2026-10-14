import { useCallback, useEffect, useState } from 'react'
import { getLockTimeoutMinutes, isPinEnabled } from '../lib/pin'
import { getMeta, META_KEYS, setMeta } from '../lib/db'

/**
 * App-lock state. Locks on cold start when a PIN is set, and on resume once the
 * configured timeout has elapsed.
 */
export function useAppLock(active: boolean) {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!active) {
      setLocked(false)
      return undefined
    }
    let cancelled = false
    void (async () => {
      const enabled = await isPinEnabled()
      if (cancelled) return
      setLocked(enabled)
      await setMeta(META_KEYS.lastActiveAt, Date.now())
    })()

    const onVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        await setMeta(META_KEYS.lastActiveAt, Date.now())
        return
      }
      const enabled = await isPinEnabled()
      if (!enabled) return
      const timeoutMinutes = await getLockTimeoutMinutes()
      const lastActiveAt = Number(await getMeta<number>(META_KEYS.lastActiveAt)) || Date.now()
      if (timeoutMinutes <= 0 || Date.now() - lastActiveAt >= timeoutMinutes * 60_000) setLocked(true)
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])

  const unlock = useCallback(async () => {
    await setMeta(META_KEYS.lastActiveAt, Date.now())
    setLocked(false)
  }, [])

  const lockNow = useCallback(async () => {
    if (await isPinEnabled()) setLocked(true)
  }, [])

  return { locked, unlock, lockNow }
}
