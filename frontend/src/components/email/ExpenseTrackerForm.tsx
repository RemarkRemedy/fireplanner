import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import {
  EMAIL_MAX_LENGTH,
  EXPENSE_TRACKING_OPTIONS,
  PRIMARY_DEVICE_OPTIONS,
  type ExpenseTrackingStatus,
  type PrimaryDevice,
  type SourceSurface,
} from '@/lib/validation/emailConstants'
import type { ExpenseTrackerSignupHook } from '@/hooks/useExpenseTrackerSignup'

interface ExpenseTrackerFormProps {
  signup: ExpenseTrackerSignupHook
  surface: SourceSurface
  pagePath: string
}

export function ExpenseTrackerForm({ signup, surface, pagePath }: ExpenseTrackerFormProps) {
  const {
    email, setEmail,
    expenseTrackingStatus, setExpenseTrackingStatus,
    primaryDevice, setPrimaryDevice,
    status, errorMsg, submit, markTouched, isSignedUp,
  } = signup

  if (isSignedUp) {
    return (
      <div className="space-y-1" aria-live="polite">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          <p className="text-sm font-medium">You're in.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Thanks, I'll reach out when early access is ready.
        </p>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(surface, pagePath)
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    markTouched(surface, pagePath)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={`et-email-${surface}`} className="text-sm font-medium block mb-1">
          Email
        </label>
        <Input
          id={`et-email-${surface}`}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={handleEmailChange}
          required
          maxLength={EMAIL_MAX_LENGTH}
          className="h-9 text-sm"
          disabled={status === 'loading'}
          aria-required="true"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-2">How do you track expenses today?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {EXPENSE_TRACKING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={expenseTrackingStatus === opt.value}
              onClick={() => { setExpenseTrackingStatus(opt.value as ExpenseTrackingStatus); markTouched(surface, pagePath) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                expenseTrackingStatus === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              }`}
              disabled={status === 'loading'}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium mb-2">Primary device</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {PRIMARY_DEVICE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={primaryDevice === opt.value}
              onClick={() => { setPrimaryDevice(opt.value as PrimaryDevice); markTouched(surface, pagePath) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                primaryDevice === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              }`}
              disabled={status === 'loading'}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-destructive" role="alert">{errorMsg}</p>
      )}

      <Button type="submit" size="sm" disabled={status === 'loading'} className="w-full">
        {status === 'loading'
          ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Submitting...</>
          : 'Join early access'}
      </Button>

      <p className="text-xs text-muted-foreground/60">
        Only used for early access invites. No spam.{' '}
        <Link to="/privacy" className="underline hover:text-muted-foreground">Privacy policy</Link>
      </p>
    </form>
  )
}
