import type { HouseholdPlanType } from '@/lib/household/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PLAN_TYPES: Array<{
  value: HouseholdPlanType
  title: string
  description: string
}> = [
  {
    value: 'individual',
    title: 'Individual',
    description: 'Keep the current quick-start flow for one planner.',
  },
  {
    value: 'couple',
    title: 'Couple',
    description: 'Set up two planning adults and one shared household result.',
  },
  {
    value: 'household',
    title: 'Household',
    description: 'Start with one or two adults and optional dependents.',
  },
]

interface PlanTypeSelectorProps {
  value: HouseholdPlanType
  onChange: (value: HouseholdPlanType) => void
}

export function PlanTypeSelector({ value, onChange }: PlanTypeSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Plan setup</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 @lg:grid-cols-3 gap-3">
        {PLAN_TYPES.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            onClick={() => onChange(option.value)}
            className={cn(
              'h-auto min-h-28 items-start justify-start text-left whitespace-normal',
              value === option.value && 'border-primary bg-primary/5 text-foreground',
            )}
          >
            <div className="space-y-1">
              <div className="font-semibold">{option.title}</div>
              <div className="text-sm text-muted-foreground">{option.description}</div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
