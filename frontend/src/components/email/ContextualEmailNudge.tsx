import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, X, CheckCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/useUIStore'
import { usePageVisitCount } from '@/hooks/usePageVisitCount'
import { trackEvent } from '@/lib/analytics'
import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  SIGNUP_FLAG,
  EMAIL_SUBMITTED_FLAG,
} from '@/lib/validation/emailConstants'
import { isCompanionMode } from '@/lib/companion/isCompanionMode'

interface ContextualEmailNudgeProps {
  pageId: string
  message: string
  hidden?: boolean
}

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

function setFlag(key: string) {
  try { localStorage.setItem(key, '1') } catch { /* localStorage unavailable */ }
}

export function ContextualEmailNudge({ pageId, message, hidden = false }: ContextualEmailNudgeProps) {
  const companionMode = isCompanionMode()
  const nudgeId = `email-nudge-${pageId}`
  const dismissedNudges = useUIStore((s) => s.dismissedNudges)
  const dismissNudge = useUIStore((s) => s.dismissNudge)
  const setContextualNudgeActive = useUIStore((s) => s.setContextualNudgeActive)
  const visitCount = usePageVisitCount(pageId)

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const tracked = useRef(false)

  const hasProfile = (() => {
    try { return localStorage.getItem('fireplanner-profile') !== null } catch { return false }
  })()

  const alreadySignedUp = readFlag(SIGNUP_FLAG)
  const emailAlreadySubmitted = readFlag(EMAIL_SUBMITTED_FLAG)

  // Visibility: all conditions must pass
  const visible =
    !companionMode &&
    !hidden &&
    !alreadySignedUp &&
    hasProfile &&
    !dismissedNudges.includes(nudgeId) &&
    visitCount >= 2

  // Track impression once when visible
  useEffect(() => {
    if (visible && !tracked.current) {
      tracked.current = true
      trackEvent('email_signup_shown', { source: 'contextual_nudge' })
    }
  }, [visible])

  // Signal to BetaBanner that a contextual nudge with Telegram CTA is active
  useEffect(() => {
    setContextualNudgeActive(visible)
    return () => setContextualNudgeActive(false)
  }, [visible, setContextualNudgeActive])

  if (!visible) return null

  const handleTelegramClick = () => {
    trackEvent('telegram_join_clicked', { page: pageId })
    dismissNudge(nudgeId)
  }

  const handleDismiss = () => {
    dismissNudge(nudgeId)
  }

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
    trackEvent('email_signup_submitted', { source: 'contextual_nudge' })

    try {
      const res = await fetch('/api/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'contextual_nudge' }),
      })

      if (res.ok) {
        setStatus('success')
        setFlag(SIGNUP_FLAG)
        setFlag(EMAIL_SUBMITTED_FLAG)
        trackEvent('email_signup_success', { source: 'contextual_nudge' })
      } else if (res.status === 429) {
        setStatus('error')
        setErrorMsg('Too many requests. Please try again later.')
        trackEvent('email_signup_error', { source: 'contextual_nudge', reason: 'rate_limited' })
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error ?? 'Unknown'
        setStatus('error')
        setErrorMsg(msg === 'Unknown' ? 'Something went wrong.' : msg)
        trackEvent('email_signup_error', { source: 'contextual_nudge', reason: 'server_error', status: String(res.status), detail: msg })
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
      trackEvent('email_signup_error', { source: 'contextual_nudge', reason: 'network_error', detail: String(err) })
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
      <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        {status === 'success' ? (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400" aria-live="polite">
            <CheckCircle className="h-4 w-4" />
            <p className="text-sm">Thanks! We'll send you tips and guides when they're ready.</p>
          </div>
        ) : (
          <>
            <span className="text-foreground">{message}</span>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://t.me/sgfireplannerann"
                target="_blank"
                rel="noopener"
                onClick={handleTelegramClick}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Join Telegram &rarr;
              </a>
              {!emailAlreadySubmitted && !showEmailForm && (
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  or leave your email
                </button>
              )}
            </div>
            {showEmailForm && (
              <div className="space-y-1.5">
                <form onSubmit={handleEmailSubmit} className="flex items-center gap-2 max-w-xs">
                  <Input
                    type="email"
                    autoComplete="email"
                    aria-label="Email address"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={EMAIL_MAX_LENGTH}
                    className="h-8 text-sm"
                    disabled={status === 'loading'}
                  />
                  <Button type="submit" size="sm" disabled={status === 'loading'} className="shrink-0 h-8">
                    {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Notify me'}
                  </Button>
                </form>
                {status === 'error' && (
                  <p className="text-xs text-destructive" role="alert">{errorMsg}</p>
                )}
                <p className="text-xs text-muted-foreground/60">
                  Your data stays in your browser. Email for updates only.{' '}
                  <Link to="/privacy" className="underline hover:text-muted-foreground">Privacy</Link>
                </p>
              </div>
            )}
          </>
        )}
      </div>
      {status !== 'success' && (
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Dismiss suggestion"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
