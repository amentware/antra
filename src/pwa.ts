import { registerSW } from 'virtual:pwa-register'

/**
 * Service-worker registration. A non-intrusive toast (see App) tells the user
 * when a new version is ready rather than force-reloading mid-task.
 */
export const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('antra:update-available'))
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('antra:offline-ready'))
  },
})
