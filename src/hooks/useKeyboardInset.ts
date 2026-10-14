import { useEffect } from 'react'

/**
 * Publishes the on-screen keyboard height as `--kb-inset` on <html>.
 *
 * iOS keeps the *layout* viewport at full height while the keyboard is open, so
 * anything anchored to the bottom of the device frame (bottom sheets, their
 * Save buttons) would otherwise sit behind the keyboard. Components that care
 * add `padding-bottom: var(--kb-inset)` to lift themselves above it.
 *
 * On browsers without `visualViewport` this is a no-op and the variable stays 0.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const root = document.documentElement
    let frame = 0

    const update = () => {
      // Space between the layout viewport bottom and the visual one = keyboard.
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      root.style.setProperty('--kb-inset', `${inset}px`)
    }
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }

    update()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('orientationchange', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('orientationchange', schedule)
      root.style.setProperty('--kb-inset', '0px')
    }
  }, [])
}
