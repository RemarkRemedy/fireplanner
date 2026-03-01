import { useState, useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'
import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  SIGNUP_FLAG,
  EMAIL_SUBMITTED_FLAG,
  type EmailSource,
  type FeatureInterest,
} from '@/lib/validation/emailConstants'

type Status = 'idle' | 'loading' | 'success' | 'error'
type Step = 'email' | 'feature' | 'done'

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

function setFlag(key: string) {
  try { localStorage.setItem(key, '1') } catch { /* localStorage unavailable */ }
}

function removeFlag(key: string) {
  try { localStorage.removeItem(key) } catch { /* localStorage unavailable */ }
}

/** Determines the initial step based on persisted flags. */
function resolveInitialStep(): Step {
  if (readFlag(SIGNUP_FLAG)) return 'done'
  if (readFlag(EMAIL_SUBMITTED_FLAG)) return 'feature'
  return 'email'
}

export function useEmailSignup(source: EmailSource) {
  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [step, setStep] = useState<Step>(resolveInitialStep)

  const stepRef = useRef<HTMLDivElement>(null)
  const tracked = useRef(false)

  // Track impression once
  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true
      trackEvent('email_signup_shown', { source })
    }
  }, [source])

  // Focus management: move focus to new step content on transition
  useEffect(() => {
    if (step !== 'email' && stepRef.current) {
      stepRef.current.focus()
    }
  }, [step])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    if (!EMAIL_RE.test(trimmed) || trimmed.length > EMAIL_MAX_LENGTH) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    setErrorMsg('')
    trackEvent('email_signup_submitted', { source })

    try {
      const res = await fetch('/api/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source }),
      })

      if (res.ok) {
        setSubmittedEmail(trimmed)
        setStatus('idle')
        setStep('feature')
        setFlag(EMAIL_SUBMITTED_FLAG)
        trackEvent('email_signup_success', { source })
      } else if (res.status === 429) {
        setStatus('error')
        setErrorMsg('Too many requests. Please try again later.')
        trackEvent('email_signup_error', { source, reason: 'rate_limited' })
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error ?? 'Unknown'
        setStatus('error')
        setErrorMsg(msg === 'Unknown' ? 'Something went wrong.' : msg)
        trackEvent('email_signup_error', { source, reason: 'server_error', status: String(res.status), detail: msg })
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
      trackEvent('email_signup_error', { source, reason: 'network_error', detail: String(err) })
    }
  }

  const handleFeatureSelect = (feature: FeatureInterest) => {
    setStep('done')
    setFlag(SIGNUP_FLAG)
    trackEvent('feature_interest_selected', { source, feature_interest: feature })

    // Fire-and-forget: email is already saved, feature interest is bonus data
    fetch('/api/email-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: submittedEmail, source, feature_interest: feature }),
    }).catch(() => {})
  }

  const handleSkip = () => {
    setStep('done')
    setFlag(SIGNUP_FLAG)
  }

  const handleReset = () => {
    setStep('email')
    setEmail('')
    setSubmittedEmail('')
    setStatus('idle')
    removeFlag(SIGNUP_FLAG)
    removeFlag(EMAIL_SUBMITTED_FLAG)
  }

  return {
    email,
    setEmail,
    submittedEmail,
    status,
    errorMsg,
    step,
    stepRef,
    handleEmailSubmit,
    handleFeatureSelect,
    handleSkip,
    handleReset,
  }
}
