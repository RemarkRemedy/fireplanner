import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  format: (n: number) => string
  delay?: number
  className?: string
}

export function AnimatedNumber({ value, format, delay = 0, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const prevValue = useRef(value)
  const rafId = useRef<number>(0)

  useEffect(() => {
    const from = prevValue.current
    const to = value
    prevValue.current = value

    if (from === to) return

    const duration = 600
    let start: number | null = null
    let delayRaf: number | null = null

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp
      const elapsed = timestamp - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate)
      } else {
        setDisplay(to)
      }
    }

    if (delay > 0) {
      const delayStart = (timestamp: number) => {
        if (delayRaf === null) delayRaf = timestamp
        if (timestamp - delayRaf >= delay) {
          rafId.current = requestAnimationFrame(animate)
        } else {
          rafId.current = requestAnimationFrame(delayStart)
        }
      }
      rafId.current = requestAnimationFrame(delayStart)
    } else {
      rafId.current = requestAnimationFrame(animate)
    }

    return () => {
      cancelAnimationFrame(rafId.current)
      // Snap display to target so no NaN interpolation on next change
      setDisplay(value)
      // Reset so StrictMode's re-invocation of the effect doesn't bail out
      prevValue.current = NaN
    }
  }, [value, delay])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(display)}
    </span>
  )
}
