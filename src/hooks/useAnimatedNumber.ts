import { useEffect, useRef, useState } from 'react'

/**
 * Tween a number for count-up animations. Respects `prefers-reduced-motion`.
 */
export function useAnimatedNumber(target: number, durationMs = 520): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || durationMs <= 0) {
      setValue(target)
      fromRef.current = target
      return undefined
    }

    const from = fromRef.current
    const delta = target - from
    if (delta === 0) return undefined
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + delta * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      fromRef.current = target
    }
  }, [target, durationMs])

  return value
}
