/** Haptic-like feedback. `navigator.vibrate` is a no-op on iOS, which is fine. */

export function haptic(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

export const tapFeedback = () => haptic(6)
export const successFeedback = () => haptic([8, 30, 12])
export const warningFeedback = () => haptic([12, 40, 12, 40, 12])
export const selectFeedback = () => haptic(10)
