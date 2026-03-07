import { useEffect, useRef } from 'react'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'

/**
 * Detects exit intent (mouse leaving viewport upward) and opens the
 * expense tracker modal. Fires once per session. Desktop only —
 * mobile has no cursor-based exit intent signal.
 */
export function useExitIntent() {
  const { isEligible, openModal, signup } = useExpenseTracker()
  const firedRef = useRef(false)

  useEffect(() => {
    if (!isEligible || firedRef.current) return

    const handler = (e: MouseEvent) => {
      if (e.clientY <= 0 && !firedRef.current && !signup.formTouched.current) {
        firedRef.current = true
        openModal()
      }
    }

    document.documentElement.addEventListener('mouseleave', handler)
    return () => document.documentElement.removeEventListener('mouseleave', handler)
  }, [isEligible, openModal, signup.formTouched])
}
