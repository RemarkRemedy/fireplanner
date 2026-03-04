import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useEmailSignup } from '@/hooks/useEmailSignup'
import { EMAIL_MAX_LENGTH, FEATURE_OPTIONS, SIGNUP_FLAG } from '@/lib/validation/emailConstants'
import { isCompanionMode } from '@/lib/companion/isCompanionMode'

export function LandingEmailSection() {
  const {
    email, setEmail, submittedEmail, status, errorMsg, step, stepRef,
    handleEmailSubmit, handleFeatureSelect, handleSkip, handleReset,
  } = useEmailSignup('landing_page')
  const companionMode = isCompanionMode()

  if (companionMode) return null

  // Hide entirely for users who completed the full signup flow previously
  try { if (localStorage.getItem(SIGNUP_FLAG) === '1' && !submittedEmail) return null } catch { /* localStorage unavailable */ }

  if (step === 'done') {
    return (
      <div ref={stepRef} tabIndex={-1} className="text-center py-2 outline-none" aria-live="polite">
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          <p className="text-sm">
            {submittedEmail
              ? `Thanks! We'll notify ${submittedEmail} when new features launch.`
              : "Thanks! We'll let you know when new features launch."}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          Use a different email?
        </button>
      </div>
    )
  }

  if (step === 'feature') {
    return (
      <div ref={stepRef} tabIndex={-1} className="space-y-3 text-center outline-none" aria-live="polite">
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          <p className="text-sm font-medium">You're on the list!</p>
        </div>
        <p className="text-sm text-muted-foreground">
          One more thing: which would be most useful for your planning?
        </p>
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Select a feature you're interested in">
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
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground text-center">
        We're building new features based on user feedback. Get notified.
      </p>
      <form onSubmit={handleEmailSubmit} className="flex items-center gap-2 max-w-md mx-auto">
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
        <p className="text-xs text-destructive text-center" role="alert">{errorMsg}</p>
      )}
      <p className="text-xs text-muted-foreground/60 text-center">
        We will only email you about major feature launches. No spam. Unsubscribe anytime.{' '}
        <Link to="/privacy" className="underline hover:text-muted-foreground">Privacy policy</Link>
      </p>
    </div>
  )
}
