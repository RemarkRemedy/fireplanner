import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { trackEvent } from '@/lib/analytics'
import {
  getCheckedItems,
  toggleItem,
  resetChecklist,
  getProgress,
  getCategories,
  getItemsByCategory,
  type ChecklistItem,
} from '@/lib/checklist'
import { usePageMeta } from '@/hooks/usePageMeta'

export function ChecklistPage() {
  usePageMeta({ title: 'FIRE Checklist — SG FIRE Planner', description: 'Track your progress toward financial independence with this Singapore-specific FIRE checklist.', path: '/checklist' })
  const [checked, setChecked] = useState<Record<string, boolean>>(getCheckedItems)
  const progress = getProgress()
  const categories = getCategories()
  const progressPct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0

  const handleToggle = useCallback((id: string) => {
    toggleItem(id)
    const updated = getCheckedItems()
    setChecked(updated)
    trackEvent('checklist_item_toggled', { item_id: id, checked: !!updated[id] })
  }, [])

  const handleReset = useCallback(() => {
    resetChecklist()
    setChecked({})
    trackEvent('checklist_reset')
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Retirement Checklist</h1>
        <p className="text-muted-foreground text-sm">
          Track your progress on key retirement preparation tasks. Your progress is saved locally.
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {progress.checked} of {progress.total} completed
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

      {/* Checklist by category */}
      <Accordion type="multiple" defaultValue={categories}>
        {categories.map((category) => {
          const items = getItemsByCategory(category)
          const catChecked = items.filter((item) => checked[item.id]).length
          return (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger className="text-left font-medium">
                <span className="flex items-center gap-2">
                  {category}
                  <span className="text-xs text-muted-foreground font-normal">
                    {catChecked}/{items.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {items.map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      isChecked={!!checked[item.id]}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Reset button */}
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset all
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset checklist?</AlertDialogTitle>
              <AlertDialogDescription>
                This will uncheck all items. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function ChecklistRow({
  item,
  isChecked,
  onToggle,
}: {
  item: ChecklistItem
  isChecked: boolean
  onToggle: (id: string) => void
}) {
  return (
    <label
      className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggle(item.id)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-primary cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
          {item.label}
        </span>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        {item.referenceLink && (
          <Link
            to={item.referenceLink}
            className="text-xs text-primary hover:underline mt-1 inline-block"
            onClick={(e) => e.stopPropagation()}
          >
            Learn more
          </Link>
        )}
      </div>
    </label>
  )
}
