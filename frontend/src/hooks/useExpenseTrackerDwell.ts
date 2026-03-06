import { useEffect, useRef } from 'react'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'

/**
 * Page-level dwell timer. When hasResults becomes true, starts a timer.
 * After dwellSeconds, opens the expense tracker modal via the provider,
 * unless the user has already started filling the inline card form.
 */
export function useExpenseTrackerDwell(hasResults: boolean, dwellSeconds: number) {
  const { isEligible, openModal, signup } = useExpenseTracker()
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    if (!hasResults || !isEligible || autoOpenedRef.current) return

    const timer = setTimeout(() => {
      // Don't auto-open modal if user is actively filling the inline card
      if (!signup.formTouched.current) {
        autoOpenedRef.current = true
        openModal()
      }
    }, dwellSeconds * 1000)

    return () => clearTimeout(timer)
  }, [hasResults, isEligible, dwellSeconds, openModal, signup.formTouched])
}
