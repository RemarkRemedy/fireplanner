import { useCallback } from 'react'
import { Plus, Trash2, GraduationCap, Home, Car, Plane, PaintBucket, Baby, Heart, Gift, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useProfileStore } from '@/stores/useProfileStore'
import { GOAL_TEMPLATES } from '@/lib/data/goalTemplates'
import type { FinancialGoal, GoalCategory } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'

const MAX_GOALS = 10

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const CATEGORY_ICONS: Record<GoalCategory, React.ReactNode> = {
  wedding: <Heart className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  housing: <Home className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  travel: <Plane className="h-4 w-4" />,
  renovation: <PaintBucket className="h-4 w-4" />,
  medical: <Plus className="h-4 w-4" />,
  family: <Baby className="h-4 w-4" />,
  other: <Target className="h-4 w-4" />,
}

const PRIORITY_COLORS: Record<string, string> = {
  essential: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  important: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'nice-to-have': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function GoalsSection() {
  const goals = useProfileStore((s) => s.financialGoals)
  const currentAge = useProfileStore((s) => s.currentAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const addGoal = useProfileStore((s) => s.addFinancialGoal)
  const removeGoal = useProfileStore((s) => s.removeFinancialGoal)
  const updateGoal = useProfileStore((s) => s.updateFinancialGoal)
  const validationErrors = useProfileStore((s) => s.validationErrors)

  const handleAddFromTemplate = useCallback((category: GoalCategory) => {
    if (goals.length >= MAX_GOALS) return
    const template = GOAL_TEMPLATES.find((t) => t.category === category)
    if (!template) return
    const goal: FinancialGoal = {
      id: generateId(),
      label: template.label,
      amount: template.defaultAmount,
      targetAge: Math.min(currentAge + 5, lifeExpectancy - 1),
      durationYears: template.defaultDuration,
      priority: 'important',
      inflationAdjusted: true,
      category: template.category,
    }
    addGoal(goal)
    trackEvent('goal_added', { category, source: 'template' })
  }, [goals.length, currentAge, lifeExpectancy, addGoal])

  const handleAddCustom = useCallback(() => {
    if (goals.length >= MAX_GOALS) return
    const goal: FinancialGoal = {
      id: generateId(),
      label: `Goal ${goals.length + 1}`,
      amount: 50000,
      targetAge: Math.min(currentAge + 5, lifeExpectancy - 1),
      durationYears: 1,
      priority: 'important',
      inflationAdjusted: true,
      category: 'other',
    }
    addGoal(goal)
    trackEvent('goal_added', { category: 'other', source: 'custom' })
  }, [goals.length, currentAge, lifeExpectancy, addGoal])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Financial Goals
          <InfoTooltip text="Plan for major life expenses like weddings, education, or home purchases. Pre-retirement goals reduce your annual savings. Post-retirement goals are deducted from your portfolio." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template buttons */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Quick add from templates:</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_TEMPLATES.map((template) => (
              <button
                key={template.category}
                onClick={() => handleAddFromTemplate(template.category)}
                disabled={goals.length >= MAX_GOALS}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={template.description}
              >
                {CATEGORY_ICONS[template.category]}
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {goals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No financial goals planned. Add milestone expenses that could impact your savings timeline.
          </p>
        )}

        {/* Goal list */}
        {goals.map((goal) => {
          const amountError = validationErrors[`goal_${goal.id}_amount`]
          const ageError = validationErrors[`goal_${goal.id}_age`]
          const durationError = validationErrors[`goal_${goal.id}_duration`]

          return (
            <div
              key={goal.id}
              className="rounded-lg border p-3 space-y-3"
            >
              {/* Row 1: Label + Category badge + Remove */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {CATEGORY_ICONS[goal.category]}
                  </span>
                  <input
                    type="text"
                    value={goal.label}
                    onChange={(e) => updateGoal(goal.id, { label: e.target.value })}
                    className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-48"
                  />
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY_COLORS[goal.priority]}`}>
                    {goal.priority}
                  </span>
                </div>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label={`Remove ${goal.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Row 2: Amount, Target Age, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <CurrencyInput
                  label="Amount"
                  value={goal.amount}
                  onChange={(v) => updateGoal(goal.id, { amount: v })}
                  error={amountError}
                  tooltip="Total cost of this goal (in today's dollars if inflation-adjusted)"
                />
                <NumberInput
                  label="Target Age"
                  value={goal.targetAge}
                  onChange={(v) => updateGoal(goal.id, { targetAge: v })}
                  min={currentAge + 1}
                  max={lifeExpectancy}
                  error={ageError}
                  tooltip="Your age when this expense occurs"
                />
                <NumberInput
                  label="Duration (years)"
                  value={goal.durationYears}
                  onChange={(v) => updateGoal(goal.id, { durationYears: Math.max(1, v) })}
                  min={1}
                  max={Math.max(1, lifeExpectancy - goal.targetAge)}
                  error={durationError}
                  tooltip="Set to 1 for a one-time expense. Set to more than 1 to spread the amount equally across that many years (e.g., 4 years of university tuition)."
                />
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Category
                  </Label>
                  <Select
                    value={goal.category}
                    onValueChange={(v) => updateGoal(goal.id, { category: v as GoalCategory })}
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="housing">Housing</SelectItem>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="renovation">Renovation</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Priority + Inflation-adjusted */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Priority
                    <InfoTooltip text="Essential = must-have. Important = strong preference. Nice-to-have = aspirational." />
                  </Label>
                  <Select
                    value={goal.priority}
                    onValueChange={(v) => updateGoal(goal.id, { priority: v as FinancialGoal['priority'] })}
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="essential">Essential</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="nice-to-have">Nice-to-have</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Inflation-adjusted
                    <InfoTooltip text="If on, the amount is in today's dollars and will grow with inflation until the target age." />
                  </Label>
                  <label className="flex items-center gap-2 text-sm h-10">
                    <input
                      type="checkbox"
                      checked={goal.inflationAdjusted}
                      onChange={(e) => updateGoal(goal.id, { inflationAdjusted: e.target.checked })}
                    />
                    <span className="text-muted-foreground text-xs">
                      {goal.inflationAdjusted ? "Today's dollars" : 'Nominal (fixed)'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )
        })}

        {/* Add custom goal button */}
        {goals.length < MAX_GOALS && (
          <button
            onClick={handleAddCustom}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Gift className="h-4 w-4" /> Add custom goal
          </button>
        )}

        {goals.length >= MAX_GOALS && (
          <p className="text-xs text-muted-foreground">
            Maximum of {MAX_GOALS} goals reached.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
