import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ANNUAL_REVIEW_ITEMS } from '@/lib/data/annualReviewItems'
import { useUIStore } from '@/stores/useUIStore'

interface AnnualReviewChecklistProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A slide-out drawer containing the annual review checklist.
 * Each item has a checkbox, label, description, and a link to the relevant section.
 * A progress bar shows completion. "Mark Review Complete" stamps lastReviewDate.
 */
export function AnnualReviewChecklist({ open, onOpenChange }: AnnualReviewChecklistProps) {
  const checkedItems = useUIStore((s) => s.reviewCheckedItems)
  const toggleReviewItem = useUIStore((s) => s.toggleReviewItem)
  const completeReview = useUIStore((s) => s.completeReview)

  const total = ANNUAL_REVIEW_ITEMS.length
  const checked = checkedItems.length
  const progressPct = total > 0 ? (checked / total) * 100 : 0
  const allDone = checked === total

  const handleComplete = () => {
    completeReview()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Annual Financial Review</SheetTitle>
          <SheetDescription>
            Walk through each item to make sure your plan is up to date.
          </SheetDescription>
        </SheetHeader>

        {/* Progress bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {checked} of {total} completed
            </span>
            <span className="text-muted-foreground">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className="mt-4 space-y-1">
          {ANNUAL_REVIEW_ITEMS.map((item) => {
            const isChecked = checkedItems.includes(item.id)
            return (
              <label
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleReviewItem(item.id)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-primary cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                    {item.label}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  <Link
                    to={item.link}
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Go to section
                  </Link>
                </div>
              </label>
            )
          })}
        </div>

        {/* Complete button */}
        <div className="mt-6 pb-4">
          <button
            onClick={handleComplete}
            disabled={!allDone}
            className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark Review Complete
          </button>
          {!allDone && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Complete all items to finish the review
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
