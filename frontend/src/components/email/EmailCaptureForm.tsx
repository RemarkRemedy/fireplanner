import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CheckCircle, Loader2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import type { EmailSource, FeatureInterest } from '@/lib/validation/emailConstants'

type Status = 'idle' | 'loading' | 'success' | 'error'

const FEATURE_OPTIONS: { value: FeatureInterest; label: string }[] = [
  { value: 'cpf_optimization', label: 'CPF Optimization (SA Shielding, top-ups)' },
  { value: 'couples_planning', label: 'Couples / Household Planning' },
  { value: 'insurance_gap', label: 'Insurance Gap Calculator' },
  { value: 'general', label: 'General Updates' },
]

interface EmailCaptureFormProps {
  source: EmailSource
  ctaLabel?: string
  className?: string
}

export function EmailCaptureForm({ source, ctaLabel = 'Notify me', className }: EmailCaptureFormProps) {
  const [email, setEmail] = useState('')
  const [featureInterest, setFeatureInterest] = useState<FeatureInterest>('general')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setStatus('loading')
    setErrorMsg('')
    trackEvent('email_signup_submitted', { source })

    try {
      const res = await fetch('/api/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source,
          feature_interest: featureInterest,
        }),
      })

      if (res.ok) {
        setStatus('success')
        trackEvent('email_signup_success', { source, feature_interest: featureInterest })
      } else if (res.status === 429) {
        setStatus('error')
        setErrorMsg('Too many requests. Please try again later.')
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMsg((data as { error?: string }).error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
    }
  }

  if (status === 'success') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm font-medium">Thanks! We'll notify you when new features launch.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={`email-${source}`} className="text-sm font-medium">
            Email
          </Label>
          <Input
            id={`email-${source}`}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
            disabled={status === 'loading'}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium mb-1.5">
            Which feature interests you most?
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {FEATURE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <input
                  type="radio"
                  name={`feature-${source}`}
                  value={opt.value}
                  checked={featureInterest === opt.value}
                  onChange={() => setFeatureInterest(opt.value)}
                  className="accent-primary"
                  disabled={status === 'loading'}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        {status === 'error' && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}

        <Button type="submit" disabled={status === 'loading'} className="w-full sm:w-auto">
          {status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            ctaLabel
          )}
        </Button>
      </div>
    </form>
  )
}
