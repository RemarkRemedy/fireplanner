import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { useLocation } from 'react-router-dom'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'

export function ExpenseTrackerBanner() {
  const { openModal, trackImpression } = useExpenseTracker()
  const location = useLocation()

  useEffect(() => {
    trackImpression('banner')
  }, [trackImpression])

  const handleCtaClick = () => {
    trackEvent('expense_tracker_cta_click', { surface: 'banner', page: location.pathname })
    openModal(true)
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
    </div>
  )
}
