import { useState } from 'react'
import { CalendarClock, X } from 'lucide-react'
import { isReviewDue } from '@/lib/annualReview'
import { useUIStore } from '@/stores/useUIStore'
import { AnnualReviewChecklist } from '@/components/shared/AnnualReviewChecklist'

/**
 * Shows a banner at the top of the Dashboard when an annual review is due.
 * "Start Review" opens the checklist drawer. "Dismiss" snoozes for 30 days.
 */
export function AnnualReviewBanner() {
  const lastReviewDate = useUIStore((s) => s.lastReviewDate)
  const snoozeUntil = useUIStore((s) => s.reviewSnoozeUntil)
  const snoozeReview = useUIStore((s) => s.snoozeReview)

  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!isReviewDue(lastReviewDate, snoozeUntil)) {
    return null
  }

  return (
    <>
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3">
        <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Time for your annual financial review</p>
          <p className="mt-0.5">
            Review your assumptions, update your inputs, and re-run simulations to keep your plan accurate.
          </p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            Start Review
          </button>
        </div>
        <button
          onClick={snoozeReview}
          className="shrink-0 rounded-sm p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors"
          aria-label="Dismiss for 30 days"
          title="Dismiss for 30 days"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <AnnualReviewChecklist open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
}
