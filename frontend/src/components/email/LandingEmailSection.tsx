import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { EMAIL_MAX_LENGTH } from '@/lib/validation/emailConstants'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function LandingEmailSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const tracked = useRef(false)
  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true
      trackEvent('email_signup_shown', { source: 'landing_page' })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setStatus('loading')
    setErrorMsg('')
    trackEvent('email_signup_submitted', { source: 'landing_page' })

    try {
      const res = await fetch('/api/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'landing_page', feature_interest: 'general' }),
      })

      if (res.ok) {
        setStatus('success')
        trackEvent('email_signup_success', { source: 'landing_page', feature_interest: 'general' })
      } else if (res.status === 429) {
        setStatus('error')
        setErrorMsg('Too many requests. Please try again later.')
        trackEvent('email_signup_error', { source: 'landing_page', reason: 'rate_limited' })
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMsg((data as { error?: string }).error ?? 'Something went wrong.')
        trackEvent('email_signup_error', { source: 'landing_page', reason: 'server_error' })
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
      trackEvent('email_signup_error', { source: 'landing_page', reason: 'network_error' })
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 py-2">
        <CheckCircle className="h-4 w-4" />
        <p className="text-sm">Thanks! We'll let you know when new features launch.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground text-center">
        New calculators in development. Get notified when they launch.
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-md mx-auto">
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={EMAIL_MAX_LENGTH}
          className="h-9 text-sm"
          disabled={status === 'loading'}
        />
        <Button type="submit" size="sm" disabled={status === 'loading'} className="shrink-0">
          {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Notify me'}
        </Button>
      </form>
      {status === 'error' && (
        <p className="text-xs text-destructive text-center" role="alert">{errorMsg}</p>
      )}
    </div>
  )
}
