import { useState, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { trackEvent } from '@/lib/analytics'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { EMAIL_RE, EMAIL_MAX_LENGTH, FEEDBACK_MAX_LENGTH } from '@/lib/validation/emailConstants'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function FeedbackFab() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleOpen = useCallback(() => {
    setOpen(true)
    setMessage('')
    setEmail('')
    setStatus('idle')
    setErrorMsg(null)
    trackEvent('feedback_fab_open', { page: location.pathname })
  }, [location.pathname])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

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
    const trimmedEmail = email.trim().toLowerCase()
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
      return
    }
    if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      setStatus('error')
      setErrorMsg('Email is too long.')
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
          interestedInExpenseTracker: false,
          pagePath: location.pathname,
        }),
      })

      if (res.ok) {
        setStatus('success')
        trackEvent('feedback_fab_submit', { page: location.pathname, has_email: !!trimmedEmail })
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
  }, [message, email, status, location.pathname])

  const title = status === 'success' ? 'Thanks!' : 'Share feedback'
  const description = status === 'success'
    ? 'Your input helps us improve the planner.'
    : 'Found a bug, have an idea, or want something different?'

  const formContent = status === 'success' ? (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground mb-4">We read every piece of feedback.</p>
      <Button onClick={handleClose}>Close</Button>
    </div>
  ) : (
    <div className="space-y-4 mt-2">
      <div>
        <label htmlFor="fab-feedback-message" className="text-sm font-medium">
          What could we do better?
        </label>
        <Textarea
          id="fab-feedback-message"
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
        placeholder="Email (optional, if you'd like a reply)"
        value={email}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setEmail(e.target.value)
          if (errorMsg) setErrorMsg(null)
        }}
      />

      {errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={status === 'loading'}
        className="w-full"
      >
        {status === 'loading' ? 'Sending...' : 'Send feedback'}
      </Button>
    </div>
  )

  // Desktop: Dialog. Mobile: bottom Sheet.
  const modal = isDesktop ? (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {formContent}
      </SheetContent>
    </Sheet>
  )

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Send feedback"
        className="fixed z-40 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors bottom-[10.5rem] right-4 md:bottom-6 md:right-6 h-10 w-10 md:h-11 md:w-11 flex items-center justify-center"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
      {modal}
    </>
  )
}
