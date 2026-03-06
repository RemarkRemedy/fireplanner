import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { X } from 'lucide-react'
import { ExpenseTrackerForm } from './ExpenseTrackerForm'
import { useExpenseTracker } from '@/hooks/useExpenseTracker'

export function ExpenseTrackerCard() {
  const { signup, trackImpression } = useExpenseTracker()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    trackImpression('card')
  }, [trackImpression])

  if (dismissed || signup.isSignedUp) return null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-base">Track your spending against this plan</h3>
              <p className="text-sm text-muted-foreground">
                I'm building a companion expense tracker for SGFirePlanner so your real spending can help keep your FIRE plan up to date.
              </p>
            </div>
            <ExpenseTrackerForm signup={signup} surface="card" pagePath={location.pathname} />
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
