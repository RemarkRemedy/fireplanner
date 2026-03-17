import { Trash2, Plus } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'

export interface GoalDraft {
  id: string
  name: string
  amount: number
  year: number
  category: string
  isNew?: boolean
}

interface GoalListEditorProps {
  goals: GoalDraft[]
  onAdd: () => void
  onUpdate: (id: string, updates: Partial<GoalDraft>) => void
  onRemove: (id: string) => void
}

export function GoalListEditor({ goals, onAdd, onUpdate, onRemove }: GoalListEditorProps) {
  return (
    <div className="space-y-4">
      {goals.length === 0 && (
        <p className="text-sm text-muted-foreground">No goals yet. Add one below.</p>
      )}

      {goals.map((goal) => (
        <div key={goal.id} className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Goal name</label>
              <input
                type="text"
                value={goal.name}
                onChange={(e) => onUpdate(goal.id, { name: e.target.value })}
                placeholder="e.g., Wedding, Education, Renovation"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => { trackEvent('goal_deleted'); onRemove(goal.id) }}
              aria-label={`Remove ${goal.name || 'goal'}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Target amount (today's $)"
              value={goal.amount}
              onChange={(v) => onUpdate(goal.id, { amount: v })}
            />
            <NumberInput
              label="Target year"
              value={goal.year}
              onChange={(v) => onUpdate(goal.id, { year: Math.round(v) })}
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 60}
              step={1}
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { trackEvent('goal_added'); onAdd() }}
        className="w-full gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add another goal
      </Button>
    </div>
  )
}
