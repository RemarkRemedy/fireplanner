import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { X } from 'lucide-react'
import { EmailCaptureForm } from './EmailCaptureForm'
import { trackEvent } from '@/lib/analytics'

const SESSION_KEY = 'fireplanner-email-capture-shown'

export function PostSimulationCapture() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      return false
    }
  })

  const tracked = useRef(false)
  useEffect(() => {
    if (!dismissed && !tracked.current) {
      tracked.current = true
      trackEvent('email_signup_shown', { source: 'post_simulation' })
    }
  }, [dismissed])

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // sessionStorage unavailable — component stays dismissed for this render
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h3 className="font-semibold text-base">Help us build what comes next</h3>
            <p className="text-sm text-muted-foreground">
              CPF SA Shielding, couples planning, and an insurance gap calculator are in development. Get notified when they're ready.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <EmailCaptureForm source="post_simulation" ctaLabel="Notify me" className="mt-3" />
      </CardContent>
    </Card>
  )
}
