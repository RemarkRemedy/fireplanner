import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { trackEvent } from '@/lib/analytics'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'
import { setStorageValue, setFlag } from '@/lib/storageFlags'
import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_DISMISSED_KEY,
  FEEDBACK_SUBMITTED_FLAG,
} from '@/lib/validation/emailConstants'

interface ExitIntentModalProps {
  open: boolean
  onClose: () => void
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export function ExitIntentModal({ open, onClose }: ExitIntentModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const location = useLocation()
  const { isEligible: expenseTrackerEligible, signup } = useExpenseTracker()

  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [wantExpenseTracker, setWantExpenseTracker] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // W2: Reset form state when modal opens
  const prevOpen = useRef(open)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setMessage('')
      setEmail('')
      setWantExpenseTracker(false)
      setStatus('idle')
      setErrorMsg(null)
    }
    prevOpen.current = open
  }, [open])

  const trimmedEmail = email.trim().toLowerCase()
  const hasValidEmail = trimmedEmail.length > 0 && EMAIL_RE.test(trimmedEmail) && trimmedEmail.length <= EMAIL_MAX_LENGTH
  const needsEmail = wantExpenseTracker && !hasValidEmail

  const handleDismiss = useCallback(() => {
    setStorageValue(FEEDBACK_DISMISSED_KEY, new Date().toISOString())
    trackEvent('feedback_modal_dismiss', { page: location.pathname })
    onClose()
  }, [location.pathname, onClose])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      if (status !== 'success') {
        handleDismiss()
      } else {
        onClose()
      }
    }
  }, [handleDismiss, onClose, status])

  const handleSubmit = useCallback(async () => {
    if (status === 'loading') return

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setStatus('error')
      setErrorMsg('Please enter your feedback.')
      return
    }
    if (trimmedMessage.length > FEEDBACK_MAX_LENGTH) {
      setStatus('error')
      setErrorMsg(`Feedback must be ${FEEDBACK_MAX_LENGTH} characters or less.`)
      return
    }
    if (wantExpenseTracker && !hasValidEmail) {
      setStatus('error')
      setErrorMsg('Please enter a valid email to join the expense tracker waitlist.')
      return
    }

    setStatus('loading')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          email: trimmedEmail || null,
          interestedInExpenseTracker: wantExpenseTracker,
          pagePath: location.pathname,
        }),
      })

      if (res.ok) {
        setStatus('success')
        setFlag(FEEDBACK_SUBMITTED_FLAG)
        trackEvent('feedback_submit_success', {
          page: location.pathname,
          has_email: hasValidEmail,
          expense_tracker_interest: wantExpenseTracker,
        })
        // W4: Update live state so banner/CTAs hide immediately
        if (wantExpenseTracker && hasValidEmail) {
          signup.markSignedUp()
        }
      } else if (res.status === 429) {
        setStatus('error')
        setErrorMsg('Too many requests. Please try again later.')
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMsg((data as { error?: string }).error ?? 'Something went wrong.')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
    }
  }, [message, trimmedEmail, wantExpenseTracker, hasValidEmail, status, location.pathname, signup])

  // W7: Update title/description based on state
  const title = status === 'success' ? 'Thanks!' : 'Before you go...'
  const description = status === 'success'
    ? (wantExpenseTracker
      ? "We'll notify you when the expense tracker is ready."
      : 'Your input helps us improve the planner.')
    : "Got a moment? We'd love to hear from you."

  const content = status === 'success' ? (
    <div className="text-center py-4">
      <Button onClick={onClose}>Close</Button>
    </div>
  ) : (
    <div className="space-y-4 mt-2">
      <div>
        <label htmlFor="feedback-message" className="text-sm font-medium">
          What could we do better?
        </label>
        <Textarea
          id="feedback-message"
          placeholder="Missing features, confusing sections, bugs, ideas..."
          value={message}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setMessage(e.target.value)
            if (errorMsg) setErrorMsg(null)
          }}
          className="mt-1.5 min-h-[80px] resize-y"
          maxLength={FEEDBACK_MAX_LENGTH}
        />
      </div>

      <Input
        type="email"
        aria-label="Email address"
        placeholder={wantExpenseTracker
          ? 'Email (required for expense tracker waitlist)'
          : 'Email (optional, if you\'d like a reply)'}
        value={email}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setEmail(e.target.value)
          if (errorMsg) setErrorMsg(null)
        }}
        className={needsEmail ? 'border-primary' : ''}
      />

      {/* W3: Use semantic color tokens instead of hardcoded sky-* */}
      {expenseTrackerEligible && (
        <label
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
            wantExpenseTracker
              ? 'border-primary bg-primary/5'
              : 'border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10'
          }`}
        >
          <Checkbox
            checked={wantExpenseTracker}
            onCheckedChange={(checked) => {
              setWantExpenseTracker(checked === true)
              if (errorMsg) setErrorMsg(null)
            }}
          />
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">
              I want early access to the expense tracker
            </p>
            <p className="text-xs text-primary/60 mt-0.5">
              Track real spending against your FIRE plan
            </p>
          </div>
        </label>
      )}

      {needsEmail && (
        <p className="text-xs text-primary">
          Email is required to join the expense tracker waitlist.
        </p>
      )}

      {errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Sending...' : 'Send feedback'}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Anonymous unless you include your email.
      </p>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{content}</div>
      </SheetContent>
    </Sheet>
  )
}
