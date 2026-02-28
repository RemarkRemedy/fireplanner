import { useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Mail } from 'lucide-react'
import { EmailCaptureForm } from './EmailCaptureForm'
import { trackEvent } from '@/lib/analytics'

export function LandingEmailSection() {
  const tracked = useRef(false)
  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true
      trackEvent('email_signup_shown', { source: 'landing_page' })
    }
  }, [])

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="py-6 md:py-8">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3 shrink-0 hidden sm:block">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1 flex-1">
            <h2 className="text-lg font-semibold">Stay updated — new calculators coming</h2>
            <p className="text-sm text-muted-foreground">
              CPF optimization, couples planning, and insurance gap analysis are in development. Join Singapore's FIRE planning community.
            </p>
            <EmailCaptureForm source="landing_page" ctaLabel="Get notified" className="mt-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
