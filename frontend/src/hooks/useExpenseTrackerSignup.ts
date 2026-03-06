import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { trackEvent } from '@/lib/analytics'
import { readFlag, setFlag } from '@/lib/storageFlags'
import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  EXPENSE_TRACKER_SIGNED_UP_FLAG,
  type ExpenseTrackingStatus,
  type PrimaryDevice,
  type SourceSurface,
} from '@/lib/validation/emailConstants'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function useExpenseTrackerSignup() {
  const [email, setEmail] = useState('')
  const [expenseTrackingStatus, setExpenseTrackingStatus] = useState<ExpenseTrackingStatus | null>(null)
  const [primaryDevice, setPrimaryDevice] = useState<PrimaryDevice | null>(null)
  const [status, setStatus] = useState<Status>(() => readFlag(EXPENSE_TRACKER_SIGNED_UP_FLAG) ? 'success' : 'idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const formTouchedRef = useRef(false)
  const submittedRef = useRef(status === 'success')
  const isSubmittingRef = useRef(false)
  const lastSurfaceRef = useRef<SourceSurface | null>(null)
  const lastPageRef = useRef<string>('')

  // Track form abandon via visibilitychange (more reliable on mobile than beforeunload)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden' && formTouchedRef.current && !submittedRef.current && !isSubmittingRef.current && lastSurfaceRef.current) {
        const fieldsFilled = [email, expenseTrackingStatus, primaryDevice].filter(Boolean).length
        trackEvent('expense_tracker_form_abandon', {
          surface: lastSurfaceRef.current,
          page: lastPageRef.current,
          fields_filled: fieldsFilled,
        })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [email, expenseTrackingStatus, primaryDevice])

  const markTouched = useCallback((surface: SourceSurface, pagePath: string) => {
    formTouchedRef.current = true
    lastSurfaceRef.current = surface
    lastPageRef.current = pagePath
  }, [])

  const submit = useCallback(async (sourceSurface: SourceSurface, pagePath: string, copyVariant = 'default') => {
    if (status === 'loading' || submittedRef.current) return

    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !EMAIL_RE.test(trimmed) || trimmed.length > EMAIL_MAX_LENGTH) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
      return
    }
    if (!expenseTrackingStatus) {
      setStatus('error')
      setErrorMsg('Please select your expense tracking status.')
      return
    }
    if (!primaryDevice) {
      setStatus('error')
      setErrorMsg('Please select your primary device.')
      return
    }

    setStatus('loading')
    setErrorMsg(null)
    isSubmittingRef.current = true

    try {
      const res = await fetch('/api/expense-tracker-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          expenseTrackingStatus,
          primaryDevice,
          sourceSurface,
          copyVariant,
          pagePath,
          submittedAt: new Date().toISOString(),
        }),
      })

      if (res.ok) {
        setStatus('success')
        submittedRef.current = true
        setFlag(EXPENSE_TRACKER_SIGNED_UP_FLAG)
        trackEvent('expense_tracker_submit_success', { surface: sourceSurface, page: pagePath })
      } else if (res.status === 429) {
        setStatus('error')
        setErrorMsg('Too many requests. Please try again later.')
        trackEvent('expense_tracker_submit_error', { surface: sourceSurface, page: pagePath, reason: 'rate_limited' })
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error ?? 'Something went wrong.'
        setStatus('error')
        setErrorMsg(msg)
        trackEvent('expense_tracker_submit_error', { surface: sourceSurface, page: pagePath, reason: 'server_error' })
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
      trackEvent('expense_tracker_submit_error', { surface: sourceSurface, page: pagePath, reason: 'network_error' })
    } finally {
      isSubmittingRef.current = false
    }
  }, [email, expenseTrackingStatus, primaryDevice, status])

  return useMemo(() => ({
    email, setEmail,
    expenseTrackingStatus, setExpenseTrackingStatus,
    primaryDevice, setPrimaryDevice,
    status, errorMsg,
    submit, markTouched,
    isSignedUp: status === 'success',
    formTouched: formTouchedRef,
  }), [email, expenseTrackingStatus, primaryDevice, status, errorMsg, submit, markTouched])
}

export type ExpenseTrackerSignupHook = ReturnType<typeof useExpenseTrackerSignup>
