import { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { useLocation } from 'react-router-dom'
import { readSessionFlag, setSessionFlag } from '@/lib/storageFlags'
import { EXPENSE_TRACKER_BANNER_SESSION_KEY } from '@/lib/validation/emailConstants'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'

export function ExpenseTrackerBanner() {
  const { openModal, trackImpression } = useExpenseTracker()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(() => readSessionFlag(EXPENSE_TRACKER_BANNER_SESSION_KEY))

  useEffect(() => {
    if (!dismissed) {
      trackImpression('banner')
    }
  }, [dismissed, trackImpression])

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    setSessionFlag(EXPENSE_TRACKER_BANNER_SESSION_KEY)
  }

  const handleCtaClick = () => {
    trackEvent('expense_tracker_cta_click', { surface: 'banner', page: location.pathname })
    openModal()
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm mb-4">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground">
          Track your spending against your FIRE plan.{' '}
        </span>
        <button
          onClick={handleCtaClick}
          className="text-primary hover:underline font-medium"
        >
          Get early access &rarr;
        </button>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss expense tracker banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
