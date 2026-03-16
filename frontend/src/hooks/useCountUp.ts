import { useEffect, useRef, useState } from 'react'

/** Animate a number from its previous value to target over duration ms */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (target === prevTarget.current) return
    const from = prevTarget.current
    prevTarget.current = target

    // Animate from previous value to new target (not from 0)
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = isNaN(from) ? target * eased : from + (target - from) * eased
      setValue(Math.round(current))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      // Snap to target so no stale value on next change
      setValue(target)
      // Reset so StrictMode's re-invocation of the effect doesn't bail out
      prevTarget.current = NaN
    }
  }, [target, duration])

  return value
}
