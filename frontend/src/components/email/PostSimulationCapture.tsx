import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, X } from 'lucide-react'
import { useEmailSignup } from '@/hooks/useEmailSignup'
import { EMAIL_MAX_LENGTH, FEATURE_OPTIONS, SIGNUP_FLAG } from '@/lib/validation/emailConstants'

const SESSION_KEY = 'fireplanner-post-sim-dismissed'

export function PostSimulationCapture() {
  const [dismissed, setDismissed] = useState(() => {
    // Check sessionStorage and localStorage separately to avoid one failure hiding the other
    let sessionDismissed = false
    let alreadySignedUp = false
    try { sessionDismissed = sessionStorage.getItem(SESSION_KEY) === '1' } catch { /* storage unavailable */ }
    try { alreadySignedUp = localStorage.getItem(SIGNUP_FLAG) === '1' } catch { /* storage unavailable */ }
    return sessionDismissed || alreadySignedUp
  })

  const {
    email, setEmail, submittedEmail, status, errorMsg, step, stepRef,
    handleEmailSubmit, handleFeatureSelect, handleSkip,
  } = useEmailSignup('post_simulation')

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* storage unavailable */ }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h3 className="font-semibold text-base">Help us build what comes next</h3>
            {step === 'done' ? (
              <div ref={stepRef} tabIndex={-1} className="outline-none" aria-live="polite">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm">
                    {submittedEmail
                      ? `Thanks! We'll notify ${submittedEmail} when new features launch.`
                      : "Thanks! We'll let you know when new features launch."}
                  </p>
                </div>
              </div>
            ) : step === 'feature' ? (
              <div ref={stepRef} tabIndex={-1} className="space-y-3 mt-2 outline-none" aria-live="polite">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">You're on the list!</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  One more thing: which feature interests you most?
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select a feature you're interested in">
                  {FEATURE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeatureSelect(opt.value)}
                      className="text-xs"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Skip feature selection"
                >
                  Skip
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  CPF optimization, couples planning, and an insurance gap calculator are in development. Get notified when they're ready.
                </p>
                <form onSubmit={handleEmailSubmit} className="flex items-center gap-2 mt-3">
                  <Input
                    type="email"
                    autoComplete="email"
                    aria-label="Email address"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={EMAIL_MAX_LENGTH}
                    className="h-9 text-sm"
                    disabled={status === 'loading'}
                  />
                  <Button type="submit" size="sm" disabled={status === 'loading'} className="shrink-0">
                    {status === 'loading' ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Sending...</> : 'Notify me'}
                  </Button>
                </form>
                {status === 'error' && (
                  <p className="text-xs text-destructive mt-1" role="alert">{errorMsg}</p>
                )}
                <p className="text-xs text-muted-foreground/60 mt-1">
                  We will only email you about major feature launches. No spam. Unsubscribe anytime.{' '}
                  <Link to="/privacy" className="underline hover:text-muted-foreground">Privacy policy</Link>
                </p>
              </>
            )}
          </div>
          {step !== 'done' && (
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
