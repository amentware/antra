import { registerSW } from 'virtual:pwa-register'

/**
 * Service-worker registration.
 *
 * We show a non-intrusive "New version available" toast (see App) instead of
 * force-reloading mid-task. Because installed PWAs can stay open for days, we
 * also poll for updates periodically and whenever the app returns to the
 * foreground, so a fresh deploy is noticed without a manual restart.
 */
let registration: ServiceWorkerRegistration | undefined

function checkForUpdate() {
  void registration?.update()
}

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, reg) {
    registration = reg
    if (!reg) return
    // Check periodically while the app is open…
    window.setInterval(checkForUpdate, 60 * 1000)
    // …and as soon as it comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    window.addEventListener('online', checkForUpdate)
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('antra:update-available'))
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('antra:offline-ready'))
  },
})
