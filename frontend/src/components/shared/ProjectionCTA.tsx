import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, X } from 'lucide-react'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { trackEvent } from '@/lib/analytics'

const DISMISS_KEY = 'fireplanner-projection-cta-dismissed'

export function ProjectionCTA() {
  const { metrics } = useFireCalculations()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed || !metrics) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sessionStorage unavailable (private browsing, etc.)
    }
  }

  return (
    <Card className="relative border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss projection prompt"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <CardContent className="py-5 md:py-5">
        <p className="text-sm text-foreground pr-6">
          Your plan so far: FIRE at age{' '}
          <span className="font-semibold">{metrics.fireAge}</span> with{' '}
          <span className="font-semibold">
            ${metrics.fireNumber.toLocaleString('en-SG', { maximumFractionDigits: 0 })}
          </span>{' '}
          needed.{' '}
          <span className="font-medium">See your full year-by-year projection</span> with
          CPF, withdrawal strategies, and Monte Carlo simulation.
        </p>
        <Button asChild size="sm" className="mt-3" onClick={() => trackEvent('projection_cta_clicked')}>
          <Link to="/projection">
            View Projection <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
